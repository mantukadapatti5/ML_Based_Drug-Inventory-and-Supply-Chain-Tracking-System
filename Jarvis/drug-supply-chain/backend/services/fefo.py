"""
First-Expiry-First-Out (FEFO) stock allocation.
FK-safe: auto-creates missing user/distributor records before inserting orders.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from .sql_compat import for_update_clause, last_insert_id
from ..config import settings
from ..services.security import get_password_hash


def _ensure_user_exists(db: Session, user_id: int, role: str = "vendor") -> int:
    """
    Ensure user record exists in DB. If not, insert a placeholder.
    This prevents FOREIGN KEY constraint failures on orders table.
    """
    if not user_id or user_id <= 0:
        # Use known safe fallbacks
        return 2 if role == "vendor" else 3

    try:
        exists = db.execute(
            text("SELECT id FROM users WHERE id = :id"), {"id": user_id}
        ).scalar()
        if exists:
            return user_id
    except Exception:
        pass

    # Auto-create placeholder user
    email = f"{role}_auto_{user_id}@system.local"
    try:
        db.execute(
            text("""
                INSERT OR IGNORE INTO users
                    (id, name, email, password, role, license_no, verified)
                VALUES (:id, :name, :email, :pwd, :role, :lic, 1)
            """),
            {
                "id": user_id,
                "name": f"{role.title()} {user_id}",
                "email": email,
                "pwd": get_password_hash(f"auto_{user_id}"),
                "role": role,
                "lic": f"{role.upper()[:3]}-AUTO-{user_id:05d}",
            },
        )
        db.commit()
        print(f"✅ Auto-created {role} user id={user_id}")
        return user_id
    except Exception as e:
        db.rollback()
        print(f"⚠️ Could not auto-create user id={user_id}: {e}")
        # Return safe fallback IDs
        return 2 if role == "vendor" else 3


def allocate_fefo_stock(
    db: Session,
    drug_id: int,
    quantity_needed: int,
) -> List[Dict[str, Any]]:
    if quantity_needed <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive.")

    drug = db.execute(
        text("SELECT id, name, batch_no, quantity, price, vendor_id FROM drugs WHERE id = :id"),
        {"id": drug_id},
    ).mappings().first()
    if not drug:
        raise HTTPException(status_code=404, detail=f"Drug id {drug_id} not found in catalog.")

    lock = for_update_clause()
    try:
        batches = db.execute(
            text(f"""
                SELECT id, batch_id, drug_id, drug_name, expiry_date, quantity_units
                FROM inventory_expiry
                WHERE (
                    CAST(drug_id AS TEXT) = CAST(:did AS TEXT)
                    OR drug_name = :dname
                    OR batch_id IN (SELECT batch_no FROM drugs WHERE id = :did)
                )
                AND quantity_units > 0
                ORDER BY expiry_date ASC, id ASC
                {lock}
            """),
            {"did": str(drug_id), "dname": drug["name"]},
        ).mappings().all()
    except Exception:
        batches = []

    if not batches:
        # No expiry batches — deduct directly from drugs table
        total = int(drug["quantity"] or 0)
        if total < quantity_needed:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {drug['name']}. Available: {total}, Requested: {quantity_needed}",
            )
        db.execute(
            text("UPDATE drugs SET quantity = quantity - :qty WHERE id = :id"),
            {"qty": quantity_needed, "id": drug_id},
        )
        return [{
            "batch_id": drug["batch_no"] or f"DRUG-{drug_id}",
            "quantity_deducted": quantity_needed,
            "expiry_date": None,
        }]

    remaining = quantity_needed
    allocations: List[Dict[str, Any]] = []

    for batch in batches:
        if remaining <= 0:
            break
        available = int(batch["quantity_units"] or 0)
        if available <= 0:
            continue
        take = min(available, remaining)
        db.execute(
            text("UPDATE inventory_expiry SET quantity_units = quantity_units - :take WHERE id = :bid"),
            {"take": take, "bid": batch["id"]},
        )
        allocations.append({
            "batch_id": batch["batch_id"],
            "quantity_deducted": take,
            "expiry_date": str(batch["expiry_date"]) if batch["expiry_date"] else None,
        })
        remaining -= take

    if remaining > 0:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient FEFO batch stock for {drug['name']}. "
                f"Needed {quantity_needed}, only {quantity_needed - remaining} available."
            ),
        )

    db.execute(
        text("UPDATE drugs SET quantity = CASE WHEN quantity >= :qty THEN quantity - :qty ELSE 0 END WHERE id = :id"),
        {"qty": quantity_needed, "id": drug_id},
    )
    return allocations


def insert_order(
    db: Session,
    drug_id: int,
    qty: int,
    distributor_id: int,
    vendor_id: int,
    requested_by: str,
) -> int:
    """
    Insert order with full FK safety.
    Ensures vendor_id and distributor_id exist in users table first.
    """
    # Resolve vendor_id from drug table if not provided
    if not vendor_id:
        row = db.execute(
            text("SELECT vendor_id FROM drugs WHERE id = :id"), {"id": drug_id}
        ).mappings().first()
        vendor_id = int(row["vendor_id"]) if row and row["vendor_id"] else 2

    if not distributor_id:
        distributor_id = 3

    # ── CRITICAL FK SAFETY ─────────────────────────────────────────────────
    # Both must exist in users table before INSERT INTO orders
    vendor_id = _ensure_user_exists(db, vendor_id, "vendor")
    distributor_id = _ensure_user_exists(db, distributor_id, "distributor")

    # Verify drug exists
    drug_exists = db.execute(
        text("SELECT id FROM drugs WHERE id = :id"), {"id": drug_id}
    ).scalar()
    if not drug_exists:
        raise HTTPException(
            status_code=400,
            detail=f"Drug ID {drug_id} not found. Cannot create order."
        )

    try:
        now = datetime.utcnow()
        returning = " RETURNING id" if settings.is_postgres else ""
        row = db.execute(
            text(f"""
                INSERT INTO orders (
                    drug_id, quantity, status, created_at,
                    blockchain_order_id, distributor_id, vendor_id
                )
                VALUES (
                    :did, :qty, 'PENDING_APPROVAL', :now,
                    :by, :dist, :vid
                ){returning}
            """),
            {
                "did": drug_id,
                "qty": qty,
                "now": now,
                "by": requested_by,
                "dist": distributor_id,
                "vid": vendor_id,
            },
        )
        db.commit()

        if settings.is_postgres:
            order_id = row.scalar()
        else:
            order_id = last_insert_id(db)

        # Write audit trail
        try:
            db.execute(
                text("""
                    INSERT INTO audit_trail
                        (action, entity_type, entity_id, user_id, created_at)
                    VALUES ('ORDER_CREATED', 'order', :oid, :uid, datetime('now'))
                """),
                {"oid": str(order_id), "uid": distributor_id},
            )
            db.commit()
        except Exception:
            pass

        return order_id

    except Exception as e:
        db.rollback()
        print(f"❌ Order insert failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")


def resolve_vendor_id(db: Session, drug_id: int, vendor_id_override: Optional[int] = None) -> int:
    if vendor_id_override:
        return vendor_id_override
    row = db.execute(
        text("SELECT vendor_id FROM drugs WHERE id = :id"), {"id": drug_id}
    ).mappings().first()
    if row and row["vendor_id"]:
        return int(row["vendor_id"])
    return 2
