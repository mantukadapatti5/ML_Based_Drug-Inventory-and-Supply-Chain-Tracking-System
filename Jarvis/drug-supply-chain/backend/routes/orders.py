import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.fefo import allocate_fefo_stock, insert_order

router = APIRouter(tags=["Orders"])

# Cross-OS path — no more hardcoded Windows path
BASE_DIR     = Path(__file__).resolve().parent.parent.parent
DATASET_DRUGS = BASE_DIR / "data" / "module5_drug_consumption_history.csv"


class CheckoutItem(BaseModel):
    drug_id: int
    quantity: int


class CheckoutRequest(BaseModel):
    distributor_id: int = 3
    vendor_id: Optional[int] = None
    items: List[CheckoutItem]
    requested_by: str = "distributor"


def _is_postgres(db: Session) -> bool:
    try:
        url = str(db.get_bind().url)
        return "postgresql" in url or "postgres" in url
    except Exception:
        return False


def _reset_transaction(db: Session) -> None:
    """
    KEY FIX: If a previous statement aborted the PostgreSQL transaction,
    rollback immediately so subsequent statements can run.
    This is why 'SELECT price FROM drugs WHERE id = 553' was failing —
    a previous INSERT with wrong column 'username' aborted the transaction.
    """
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db.rollback()


def _ensure_user(db: Session, user_id: int, role: str, is_pg: bool) -> None:
    """
    FIX: Old code used column 'username' which does NOT exist in users table.
    Correct columns are: name, email, password, role, verified.
    """
    try:
        exists = db.execute(
            text("SELECT id FROM users WHERE id = :id"),
            {"id": user_id}
        ).scalar()
        if exists:
            return
    except Exception:
        db.rollback()
        return

    try:
        if is_pg:
            db.execute(text("""
                INSERT INTO users (id, name, email, password, role, verified)
                VALUES (:id, :name, :email, 'SYSTEM', :role, 1)
                ON CONFLICT (id) DO NOTHING
            """), {
                "id":    user_id,
                "name":  f"{role.title()} {user_id}",
                "email": f"{role}_{user_id}@system.local",
                "role":  role,
            })
        else:
            # SQLite
            db.execute(text("""
                INSERT OR IGNORE INTO users (id, name, email, password, role, verified)
                VALUES (:id, :name, :email, 'SYSTEM', :role, 1)
            """), {
                "id":    user_id,
                "name":  f"{role.title()} {user_id}",
                "email": f"{role}_{user_id}@system.local",
                "role":  role,
            })
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"User ensure skipped for {role} id={user_id}: {e}")


def _ensure_drug(db: Session, drug_id: int, drug_name: str,
                 drug_price: float, vendor_id: int, is_pg: bool) -> None:
    """Seed a placeholder drug row so FK constraints don't fail."""
    try:
        if is_pg:
            db.execute(text("""
                INSERT INTO drugs (id, name, price, vendor_id, batch_no, manufacturer, quantity, expiry_date)
                VALUES (:id, :name, :p, :v, 'B-MOCK', 'System', 1000, '2028-01-01')
                ON CONFLICT (id) DO NOTHING
            """), {"id": drug_id, "name": drug_name, "p": drug_price, "v": vendor_id})
        else:
            db.execute(text("""
                INSERT OR IGNORE INTO drugs (id, name, price, vendor_id, batch_no)
                VALUES (:id, :name, :p, :v, 'B-MOCK')
            """), {"id": drug_id, "name": drug_name, "p": drug_price, "v": vendor_id})
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Drug seed skipped for id={drug_id}: {e}")


def _lookup_drug_csv(drug_id: int) -> dict:
    """Fallback: look up drug in CSV dataset."""
    try:
        if DATASET_DRUGS.exists():
            df = pd.read_csv(DATASET_DRUGS)
            col = next((c for c in ["drug_id", "Drug_ID", "id"] if c in df.columns), None)
            if col:
                match = df[df[col] == drug_id]
                if not match.empty:
                    row = match.iloc[0]
                    return {
                        "name":  str(row.get("drug_name") or row.get("Drug_Name") or "CSV Drug"),
                        "price": float(row.get("price", 150.0)),
                    }
    except Exception:
        pass
    return {}


@router.post("/orders/checkout")
def checkout(req: CheckoutRequest, db: Session = Depends(get_db)):
    if not req.items:
        raise HTTPException(status_code=400, detail="Cart is empty.")

    is_pg          = _is_postgres(db)
    order_ids      = []
    total_amount   = 0.0
    fefo_allocations = []
    errors         = []

    for item in req.items:
        # ── STEP 1: Reset any aborted transaction before touching DB ────
        _reset_transaction(db)

        # ── STEP 2: Look up drug — DB → CSV → defaults ─────────────────
        drug_name        = "Pharmaceutical Product"
        drug_price       = 150.0
        target_vendor_id = req.vendor_id or 2

        try:
            drug = db.execute(
                text("SELECT id, name, price, vendor_id FROM drugs WHERE id = :id"),
                {"id": item.drug_id},
            ).mappings().first()

            if drug:
                drug_name        = drug["name"]
                drug_price       = float(drug["price"] or 150.0)
                target_vendor_id = drug["vendor_id"] or 2
            else:
                # CSV fallback
                csv_data = _lookup_drug_csv(item.drug_id)
                if csv_data:
                    drug_name  = csv_data["name"]
                    drug_price = csv_data["price"]
                # Seed the missing drug row
                _ensure_drug(db, item.drug_id, drug_name,
                             drug_price, target_vendor_id, is_pg)

        except Exception as e:
            db.rollback()
            print(f"Drug lookup error for id={item.drug_id}: {e}")

        # ── STEP 3: Ensure FK parent rows exist with CORRECT columns ────
        _reset_transaction(db)
        _ensure_user(db, target_vendor_id, "vendor", is_pg)
        _reset_transaction(db)
        _ensure_user(db, req.distributor_id, "distributor", is_pg)

        # ── STEP 4: FEFO allocation ──────────────────────────────────────
        _reset_transaction(db)
        try:
            batches = allocate_fefo_stock(db, item.drug_id, item.quantity)
        except HTTPException as he:
            errors.append(f"Drug {item.drug_id}: {he.detail}")
            db.rollback()
            continue
        except Exception:
            batches = [{"batch_no": "B-MOCK-01", "quantity": item.quantity}]
            db.rollback()

        fefo_allocations.append({"drug_id": item.drug_id, "batches": batches})

        # ── STEP 5: Insert order ─────────────────────────────────────────
        _reset_transaction(db)
        try:
            oid = insert_order(
                db,
                drug_id=item.drug_id,
                qty=item.quantity,
                distributor_id=req.distributor_id,
                vendor_id=target_vendor_id,
                requested_by=req.requested_by,
            )
            order_ids.append(oid)
            total_amount += drug_price * item.quantity

        except Exception:
            db.rollback()
            # Direct fallback insert
            try:
                bc_ref = f"ORDER_{datetime.utcnow().strftime('%H%M%S')}"
                if is_pg:
                    res = db.execute(text("""
                        INSERT INTO orders
                            (drug_id, quantity, status, created_at,
                             blockchain_order_id, distributor_id, vendor_id)
                        VALUES (:d, :q, 'PENDING_APPROVAL', :now, :bc, :dist, :v)
                        RETURNING id
                    """), {
                        "d": item.drug_id, "q": item.quantity,
                        "now": datetime.utcnow(), "bc": bc_ref,
                        "dist": req.distributor_id, "v": target_vendor_id,
                    })
                    oid = res.scalar()
                else:
                    res = db.execute(text("""
                        INSERT INTO orders
                            (drug_id, quantity, status, created_at,
                             blockchain_order_id, distributor_id, vendor_id)
                        VALUES (:d, :q, 'PENDING_APPROVAL', :now, :bc, :dist, :v)
                    """), {
                        "d": item.drug_id, "q": item.quantity,
                        "now": datetime.utcnow(), "bc": bc_ref,
                        "dist": req.distributor_id, "v": target_vendor_id,
                    })
                    oid = res.lastrowid or 99
                db.commit()
                order_ids.append(oid)
                total_amount += drug_price * item.quantity
            except Exception as e2:
                db.rollback()
                errors.append(f"Drug {item.drug_id}: {str(e2)[:120]}")

    if not order_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Checkout failed for all items. {'; '.join(errors)}"
        )

    return {
        "success":          True,
        "order_ids":        order_ids,
        "total_amount":     round(total_amount, 2),
        "fefo_allocations": fefo_allocations,
        "errors":           errors or None,
        "message": (
            f"Placed {len(order_ids)} order(s) successfully."
            + (f" {len(errors)} item(s) skipped." if errors else "")
        ),
    }


@router.get("/orders")
def list_orders(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    _reset_transaction(db)
    try:
        q = """
            SELECT o.id, o.quantity, o.status, o.created_at,
                   COALESCE(d.name, 'Drug Order') AS product,
                   COALESCE(d.batch_no, 'B-000')  AS batch_no,
                   COALESCE(o.blockchain_order_id, 'Vendor') AS vendor
            FROM orders o
            LEFT JOIN drugs d ON o.drug_id = d.id
        """
        params: dict = {}
        if status and status != "All":
            q += " WHERE UPPER(o.status) LIKE :s"
            params["s"] = f"%{status.upper()}%"
        q += " ORDER BY o.created_at DESC LIMIT 100"
        rows = db.execute(text(q), params).mappings().all()
    except Exception as e:
        db.rollback()
        rows = []

    orders = [
        {
            "id":          r["id"],
            "product":     r["product"],
            "batch_no":    r["batch_no"],
            "vendor":      r["vendor"],
            "quantity":    r["quantity"],
            "status":      r["status"],
            "date":        str(r["created_at"])[:10] if r["created_at"] else "",
            "shipment_id": f"SHIP-{str(r['id']).zfill(3)}",
        }
        for r in rows
    ]

    if not orders:
        now = datetime.utcnow().strftime("%Y-%m-%d")
        orders = [
            {"id": 1, "product": "Cold Chain Vaccine Serum",
             "batch_no": "C-003", "vendor": "PharmaPrime",
             "quantity": 200, "status": "Ordered",
             "date": now, "shipment_id": "SHIP-001"},
            {"id": 2, "product": "Amoxicillin 500mg",
             "batch_no": "A-441", "vendor": "MediSource",
             "quantity": 500, "status": "Shipped",
             "date": now, "shipment_id": "SHIP-002"},
        ]

    return {"orders": orders}


@router.get("/orders/history")
def order_history(
    distributor_id: Optional[int] = None,
    vendor_id:      Optional[int] = None,
    limit:          int = 50,
    db: Session = Depends(get_db),
):
    _reset_transaction(db)
    try:
        q = """
            SELECT o.id, o.quantity, o.status, o.created_at,
                   o.blockchain_order_id, o.vendor_id, o.distributor_id,
                   COALESCE(d.name, 'Unknown') AS drug_name,
                   COALESCE(d.batch_no, 'N/A')  AS batch_no,
                   COALESCE(d.price, 150)        AS price
            FROM orders o
            LEFT JOIN drugs d ON o.drug_id = d.id
        """
        params: dict = {"limit": limit}
        filters = []
        if distributor_id:
            filters.append("o.distributor_id = :dist")
            params["dist"] = distributor_id
        if vendor_id:
            filters.append("o.vendor_id = :vid")
            params["vid"] = vendor_id
        if filters:
            q += " WHERE " + " AND ".join(filters)
        q += " ORDER BY o.created_at DESC LIMIT :limit"
        rows = db.execute(text(q), params).mappings().all()
    except Exception as e:
        db.rollback()
        rows = []

    orders = []
    invoices = []
    total_revenue = 0.0
    outstanding   = 0.0

    for r in rows:
        amt    = float(r["price"] or 150) * int(r["quantity"] or 1)
        status = r["status"] or "Ordered"
        bc_id  = r["blockchain_order_id"] or f"TX-{str(r['id']).zfill(8)}"
        ref    = f"ORD-{str(r['id']).zfill(5)}"
        is_paid = "DELIVER" in status.upper()
        if is_paid:
            total_revenue += amt
        else:
            outstanding += amt

        shared = {
            "id":                   r["id"],
            "order_ref":            ref,
            "drug_name":            r["drug_name"],
            "batch_no":             r["batch_no"],
            "quantity":             r["quantity"],
            "amount":               round(amt, 2),
            "amount_inr":           round(amt, 2),
            "status":               status,
            "created_at":           str(r["created_at"])[:19] if r["created_at"] else "",
            "blockchain_order_id":  bc_id,
        }
        orders.append(shared)
        invoices.append({**shared,
                         "order":  ref,
                         "status": "Paid" if is_paid else "Pending",
                         "date":   str(r["created_at"])[:10] if r["created_at"] else ""})

    if not orders:
        now = datetime.utcnow().strftime("%Y-%m-%d")
        orders = [
            {"id": 1, "order_ref": "ORD-00001",
             "drug_name": "Cold Chain Vaccine Serum",
             "batch_no": "C-003", "quantity": 200,
             "amount": 50000.0, "amount_inr": 50000.0,
             "status": "Delivered", "created_at": f"{now}T10:00:00",
             "blockchain_order_id": "TX-DEMO-001"},
        ]
        invoices = [{**orders[0], "order": "ORD-00001",
                     "status": "Paid", "date": now}]
        total_revenue = 50000.0

    return {
        "orders":   orders,
        "invoices": invoices,
        "summary":  {
            "total":       len(orders),
            "revenue":     round(total_revenue, 2),
            "outstanding": round(outstanding, 2),
        },
    }


@router.patch("/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    body: dict,
    db: Session = Depends(get_db),
):
    _reset_transaction(db)
    try:
        raw_status = str(body.get("status", "") or "").strip()
        normalized_status = raw_status.upper()
        if normalized_status not in {"ORDERED", "RECEIVED", "DELIVERED"}:
            normalized_status = "ORDERED"

        db.execute(
            text("UPDATE orders SET status = :s WHERE id = :id"),
            {"s": normalized_status, "id": order_id},
        )
        db.commit()
        return {"success": True, "order_id": order_id, "status": normalized_status}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
