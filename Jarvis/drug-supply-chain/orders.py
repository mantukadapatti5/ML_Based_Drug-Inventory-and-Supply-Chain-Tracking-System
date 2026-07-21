from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from pathlib import Path
from typing import Optional, List
import pandas as pd

from ..database import get_db
from ..services.fefo import allocate_fefo_stock, insert_order, resolve_vendor_id

router = APIRouter(tags=["Orders"])

# ── Cross-OS path fix ─────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
CSV_MODULE5 = DATA_DIR / "module5_drug_consumption_history.csv"


class OrderStatusUpdate(BaseModel):
    status: str


class CheckoutItem(BaseModel):
    drug_id: int
    quantity: int


class CheckoutRequest(BaseModel):
    distributor_id: int = 3
    vendor_id: Optional[int] = None
    items: List[CheckoutItem]
    requested_by: str = "distributor"


_STATUS_FILTER_MAP = {
    "Ordered": "PENDING%",
    "Received": "IN_TRANSIT%",
    "Delivered": "DELIVER%",
    "PENDING_APPROVAL": "PENDING%",
    "SHIPPED": "%TRANSIT%",
}


def _normalize_status(raw: str) -> str:
    if not raw:
        return "Ordered"
    raw = raw.upper()
    if "PENDING" in raw or "APPROVAL" in raw:
        return "Ordered"
    if "TRANSIT" in raw or "SHIP" in raw:
        return "Shipped"
    if "DELIVER" in raw:
        return "Delivered"
    if "CANCEL" in raw:
        return "Cancelled"
    return raw.title()


@router.get("/orders")
def list_orders(status: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        q = """
            SELECT o.id, o.quantity, o.status, o.created_at,
                   d.name AS product, d.batch_no,
                   COALESCE(o.blockchain_order_id, 'Vendor') AS vendor
            FROM orders o
            LEFT JOIN drugs d ON o.drug_id = d.id
        """
        params = {}
        if status and status != "All":
            pattern = _STATUS_FILTER_MAP.get(status, f"%{status.upper()}%")
            q += " WHERE o.status LIKE :status"
            params["status"] = pattern
        q += " ORDER BY o.created_at DESC"
        rows = db.execute(text(q), params).mappings().all()
        orders = []
        for r in rows:
            created = r["created_at"]
            orders.append({
                "id": r["id"],
                "product": r["product"] or "Unknown drug",
                "batch_no": r["batch_no"] or "B-092",
                "vendor": r["vendor"] or "Vendor",
                "quantity": r["quantity"],
                "status": _normalize_status(r["status"]),
                "date": str(created)[:10] if created else datetime.utcnow().strftime("%Y-%m-%d"),
                "shipment_id": f"SHIP-{str(r['id']).zfill(3)}",
            })
        return {"orders": orders if orders else [
            {"id": 1, "product": "Cold Chain Serum", "batch_no": "C-003", "vendor": "PharmaPrime",
             "quantity": 220, "status": "Ordered", "date": datetime.utcnow().strftime("%Y-%m-%d"), "shipment_id": "SHIP-001"}
        ]}
    except Exception as e:
        print(f"Orders query error: {e}")
        return {"orders": [
            {"id": 1, "product": "Cold Chain Serum", "batch_no": "C-003", "vendor": "PharmaPrime",
             "quantity": 220, "status": "Ordered", "date": datetime.utcnow().strftime("%Y-%m-%d"), "shipment_id": "SHIP-001"}
        ]}


@router.get("/orders/history")
def order_history(
    role: Optional[str] = None,
    user_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    try:
        q = """
            SELECT o.id, o.quantity, o.status, o.created_at,
                   d.name AS product, d.batch_no,
                   o.distributor_id, o.vendor_id
            FROM orders o
            LEFT JOIN drugs d ON o.drug_id = d.id
            ORDER BY o.created_at DESC LIMIT :limit
        """
        rows = db.execute(text(q), {"limit": limit}).mappings().all()
        orders = [
            {
                "id": r["id"],
                "product": r["product"] or "Unknown",
                "batch_no": r["batch_no"] or "N/A",
                "quantity": r["quantity"],
                "status": _normalize_status(r["status"]),
                "date": str(r["created_at"])[:10] if r["created_at"] else "",
                "shipment_id": f"SHIP-{str(r['id']).zfill(3)}",
                "distributor_id": r["distributor_id"],
                "vendor_id": r["vendor_id"],
            }
            for r in rows
        ]
        return {"orders": orders}
    except Exception as e:
        return {"orders": [], "error": str(e)}


@router.patch("/orders/{order_id}/status")
def update_order_status(order_id: int, body: OrderStatusUpdate, db: Session = Depends(get_db)):
    try:
        db.execute(
            text("UPDATE orders SET status = :s WHERE id = :id"),
            {"s": body.status.upper(), "id": order_id},
        )
        db.commit()
        return {"success": True, "order_id": order_id, "status": body.status}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/orders/checkout")
def checkout(payload: CheckoutRequest, db: Session = Depends(get_db)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cart is empty.")

    results = []
    total_amount = 0.0

    for item in payload.items:
        try:
            allocations = allocate_fefo_stock(db, item.drug_id, item.quantity)
            vendor_id = resolve_vendor_id(db, item.drug_id, payload.vendor_id)
            order_id = insert_order(
                db,
                drug_id=item.drug_id,
                qty=item.quantity,
                distributor_id=payload.distributor_id,
                vendor_id=vendor_id,
                requested_by=payload.requested_by,
            )
            price_row = db.execute(
                text("SELECT price FROM drugs WHERE id = :id"), {"id": item.drug_id}
            ).mappings().first()
            unit_price = float(price_row["price"]) if price_row else 100.0
            line_total = unit_price * item.quantity
            total_amount += line_total
            results.append({
                "drug_id": item.drug_id,
                "order_id": order_id,
                "quantity": item.quantity,
                "allocations": allocations,
                "line_total": round(line_total, 2),
            })
        except HTTPException as he:
            raise he
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Checkout failed for drug {item.drug_id}: {str(e)}")

    return {
        "success": True,
        "message": f"Order placed for {len(results)} item(s).",
        "orders": results,
        "total_amount": round(total_amount, 2),
    }
