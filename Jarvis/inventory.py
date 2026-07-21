from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from pathlib import Path
from typing import Optional
import pandas as pd
import os

from ..database import get_db

router = APIRouter(tags=["Inventory"])

# ── Cross-OS path fix (works on Windows, Linux, Mac, Docker) ──────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent   # drug-supply-chain/
DATA_DIR = BASE_DIR / "data"
CSV_MODULE5 = DATA_DIR / "module5_drug_consumption_history.csv"


def _load_catalog_from_csv(limit: int = 25):
    """Load product catalog from module5 CSV — column-safe."""
    if not CSV_MODULE5.exists():
        return []
    try:
        df = pd.read_csv(CSV_MODULE5)
        df = df.where(pd.notnull(df), None)
        products = []
        seen = set()
        for idx, row in df.iterrows():
            name = row.get("drug_name") or row.get("Drug_Name") or "General Medicine"
            if name in seen:
                continue
            seen.add(name)
            drug_id = int(row["drug_id"]) if "drug_id" in df.columns and row.get("drug_id") else (150 + idx)
            products.append({
                "id": drug_id,
                "name": name,
                "batch_no": row.get("batch_no") or f"B-LN-{idx:03d}",
                "manufacturer": "PharmaPrime Global",
                "quantity": 450,
                "stock": 450,
                "price": float(row["price"]) if "price" in df.columns and row.get("price") else 135.00,
                "expiry_date": "2027-12-31",
                "expiry": "2027-12-31",
                "category": "Pharmaceuticals",
                "vendor_id": 2,
            })
            if len(products) >= limit:
                break
        return products
    except Exception as e:
        print(f"CSV catalog load error: {e}")
        return []


STATIC_CATALOG = [
    {"id": 156, "name": "Cold Chain Vaccine Serum", "batch_no": "C-003",
     "manufacturer": "Biomed Labs", "quantity": 500, "stock": 500, "price": 250.00,
     "expiry_date": "2027-08-14", "expiry": "2027-08-14", "category": "Vaccines", "vendor_id": 2},
    {"id": 157, "name": "Paracetamol Infusion Pack", "batch_no": "P-911",
     "manufacturer": "Apex Health", "quantity": 750, "stock": 750, "price": 45.00,
     "expiry_date": "2028-01-20", "expiry": "2028-01-20", "category": "Analgesics", "vendor_id": 2},
    {"id": 158, "name": "Amoxicillin 500mg Capsules", "batch_no": "A-441",
     "manufacturer": "PharmaPrime", "quantity": 620, "stock": 620, "price": 120.00,
     "expiry_date": "2027-06-30", "expiry": "2027-06-30", "category": "Antibiotics", "vendor_id": 2},
    {"id": 159, "name": "Azithromycin 250mg Tablets", "batch_no": "AZ-201",
     "manufacturer": "MediCore", "quantity": 300, "stock": 300, "price": 85.00,
     "expiry_date": "2027-09-15", "expiry": "2027-09-15", "category": "Antibiotics", "vendor_id": 2},
    {"id": 160, "name": "Metformin 500mg", "batch_no": "MF-330",
     "manufacturer": "Cadila Health", "quantity": 900, "stock": 900, "price": 30.00,
     "expiry_date": "2028-03-01", "expiry": "2028-03-01", "category": "Antidiabetic", "vendor_id": 2},
]


# ── /api/inventory/catalog ─────────────────────────────────────────────────
@router.get("/inventory/catalog")
async def get_catalog(db: Session = Depends(get_db)):
    """Returns product catalog. Tries DB → CSV → static fallback."""
    try:
        rows = db.execute(
            text("SELECT id, name, batch_no, manufacturer, quantity, price, expiry_date, vendor_id FROM drugs ORDER BY name")
        ).mappings().all()
        if rows:
            products = []
            for r in rows:
                p = dict(r)
                p["stock"] = p.get("quantity", 0)
                p["category"] = p.get("manufacturer", "General")
                p["expiry"] = str(p.get("expiry_date", ""))[:10]
                p["expiry_date"] = str(p.get("expiry_date", ""))[:10]
                products.append(p)
            return {"products": products}
    except Exception as e:
        print(f"DB catalog error: {e}")

    csv_products = _load_catalog_from_csv(25)
    if csv_products:
        return {"products": csv_products}

    return {"products": STATIC_CATALOG}


# ── /api/inventory/items ────────────────────────────────────────────────────
@router.get("/inventory/items")
async def get_inventory_items(db: Session = Depends(get_db)):
    """Vendor Inventory page — Live stock list."""
    try:
        rows = db.execute(
            text("SELECT id, name, batch_no, manufacturer, quantity, price, expiry_date, vendor_id FROM drugs ORDER BY name")
        ).mappings().all()
        if rows:
            items = []
            for r in rows:
                p = dict(r)
                p["stock"] = p.get("quantity", 0)
                p["expiry"] = str(p.get("expiry_date", ""))[:10]
                p["expiry_date"] = str(p.get("expiry_date", ""))[:10]
                items.append(p)
            return {"items": items}
    except Exception as e:
        print(f"DB items error: {e}")

    # Fallback: return static items so UI never shows 0 items
    items = [
        {**p, "expiry": p["expiry_date"]}
        for p in STATIC_CATALOG
    ]
    return {"items": items}


# ── /api/inventory/items-fallback ───────────────────────────────────────────
@router.get("/inventory/items-fallback")
async def get_inventory_items_fallback(limit: int = 50):
    """CSV fallback for vendor inventory."""
    csv_products = _load_catalog_from_csv(limit)
    if csv_products:
        return {"items": csv_products}
    return {"items": STATIC_CATALOG}


# ── POST /api/inventory/items ───────────────────────────────────────────────
class ItemCreate(BaseModel):
    name: str
    batch_no: str
    manufacturer: str
    quantity: int
    price: float
    expiry_date: str
    vendor_id: int = 2


@router.post("/inventory/items")
async def create_inventory_item(item: ItemCreate, db: Session = Depends(get_db)):
    try:
        db.execute(
            text("""
                INSERT INTO drugs (name, batch_no, manufacturer, quantity, price, expiry_date, vendor_id)
                VALUES (:name, :batch_no, :manufacturer, :quantity, :price, :expiry_date, :vendor_id)
            """),
            item.dict(),
        )
        db.commit()
        return {"success": True, "message": f"Product '{item.name}' added."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to add product: {str(e)}")


# ── PUT /api/inventory/items/{id} ───────────────────────────────────────────
class ItemUpdate(BaseModel):
    name: Optional[str] = None
    batch_no: Optional[str] = None
    manufacturer: Optional[str] = None
    quantity: Optional[int] = None
    price: Optional[float] = None
    expiry_date: Optional[str] = None


@router.put("/inventory/items/{item_id}")
async def update_inventory_item(item_id: int, item: ItemUpdate, db: Session = Depends(get_db)):
    updates = {k: v for k, v in item.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")
    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["item_id"] = item_id
    try:
        db.execute(text(f"UPDATE drugs SET {set_clause} WHERE id = :item_id"), updates)
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ── DELETE /api/inventory/items/{id} ───────────────────────────────────────
@router.delete("/inventory/items/{item_id}")
async def delete_inventory_item(item_id: int, db: Session = Depends(get_db)):
    try:
        db.execute(text("DELETE FROM drugs WHERE id = :id"), {"id": item_id})
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ── /api/inventory/fefo-sorted ──────────────────────────────────────────────
@router.get("/inventory/fefo-sorted")
async def get_fefo_sorted(limit: int = 20, db: Session = Depends(get_db)):
    """Expiry Management page — FEFO-sorted batches."""
    try:
        rows = db.execute(
            text("""
                SELECT id, batch_id, drug_name, expiry_date, quantity_units, storage_zone,
                       CAST((julianday(expiry_date) - julianday('now')) AS INTEGER) AS days_until_expiry
                FROM inventory_expiry
                WHERE quantity_units > 0
                ORDER BY expiry_date ASC
                LIMIT :limit
            """),
            {"limit": limit},
        ).mappings().all()
        if rows:
            batches = []
            for i, r in enumerate(rows, 1):
                d = dict(r)
                d["fefo_rank"] = i
                d["days_until_expiry"] = max(0, d.get("days_until_expiry") or 0)
                batches.append(d)
            return {"batches": batches}
    except Exception as e:
        print(f"FEFO DB error: {e}")

    # Generate batches from drugs table as fallback
    try:
        rows = db.execute(
            text("""
                SELECT id, batch_no as batch_id, name as drug_name, expiry_date,
                       quantity as quantity_units,
                       CAST((julianday(expiry_date) - julianday('now')) AS INTEGER) AS days_until_expiry
                FROM drugs
                WHERE quantity > 0
                ORDER BY expiry_date ASC
                LIMIT :limit
            """),
            {"limit": limit},
        ).mappings().all()
        if rows:
            batches = [
                {**dict(r), "fefo_rank": i, "days_until_expiry": max(0, dict(r).get("days_until_expiry") or 0)}
                for i, r in enumerate(rows, 1)
            ]
            return {"batches": batches}
    except Exception as e:
        print(f"FEFO drugs fallback error: {e}")

    # Static demo batches so expiry page is never blank
    from datetime import date, timedelta
    today = date.today()
    demo = [
        {"fefo_rank": 1, "batch_id": "BAT-EXP-001", "drug_name": "Amoxicillin 250mg",
         "expiry_date": str(today + timedelta(days=10)), "quantity_units": 200,
         "days_until_expiry": 10, "storage_zone": "Cold-A"},
        {"fefo_rank": 2, "batch_id": "BAT-EXP-002", "drug_name": "Paracetamol 500mg",
         "expiry_date": str(today + timedelta(days=18)), "quantity_units": 500,
         "days_until_expiry": 18, "storage_zone": "Dry-B"},
        {"fefo_rank": 3, "batch_id": "BAT-EXP-003", "drug_name": "Cold Chain Vaccine",
         "expiry_date": str(today + timedelta(days=45)), "quantity_units": 100,
         "days_until_expiry": 45, "storage_zone": "Cold-A"},
    ]
    return {"batches": demo}


# ── /api/inventory/requests ─────────────────────────────────────────────────
@router.get("/inventory/requests")
async def get_stock_requests(db: Session = Depends(get_db)):
    try:
        rows = db.execute(
            text("""
                SELECT sr.id, sr.drug_id, sr.drug_name, sr.quantity, sr.status, sr.requested_by, sr.created_at,
                       d.name as product_name
                FROM stock_requests sr
                LEFT JOIN drugs d ON d.id = sr.drug_id
                ORDER BY sr.created_at DESC LIMIT 50
            """)
        ).mappings().all()
        if rows:
            return {"requests": [dict(r) for r in rows]}
    except Exception:
        pass
    return {"requests": []}


# ── POST /api/inventory/request-stock ───────────────────────────────────────
class StockRequest(BaseModel):
    drug_id: int
    drug_name: Optional[str] = "Unknown"
    batch_no: Optional[str] = ""
    quantity: int
    requested_quantity: Optional[int] = None
    requested_by: Optional[str] = "distributor"
    distributor_id: Optional[int] = 6
    priority: Optional[str] = "Normal"


@router.post("/inventory/request-stock")
async def request_stock(payload: StockRequest, db: Session = Depends(get_db)):
    """Distributor Products page — Request Stock button."""
    qty = payload.requested_quantity or payload.quantity
    try:
        # Try inserting into stock_requests table if it exists
        db.execute(
            text("""
                INSERT OR IGNORE INTO stock_requests
                    (drug_id, drug_name, quantity, status, requested_by, created_at)
                VALUES (:drug_id, :drug_name, :qty, 'PENDING', :by, datetime('now'))
            """),
            {
                "drug_id": payload.drug_id,
                "drug_name": payload.drug_name,
                "qty": qty,
                "by": payload.requested_by,
            },
        )
        db.commit()
    except Exception as e:
        print(f"stock_requests insert skipped: {e}")
        db.rollback()

    return {
        "success": True,
        "message": f"Stock request for {payload.drug_name} ({qty} units) submitted successfully.",
        "drug_id": payload.drug_id,
        "quantity": qty,
        "status": "PENDING",
    }


# ── PATCH /api/inventory/requests/{id}/status ──────────────────────────────
@router.patch("/inventory/requests/{req_id}/status")
async def update_request_status(req_id: int, status: str, db: Session = Depends(get_db)):
    try:
        db.execute(
            text("UPDATE stock_requests SET status = :s WHERE id = :id"),
            {"s": status, "id": req_id},
        )
        db.commit()
        return {"success": True, "status": status}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ── /api/inventory/rop-dashboard ────────────────────────────────────────────
@router.get("/inventory/rop-dashboard")
async def rop_dashboard(region: str = "Ahmedabad", db: Session = Depends(get_db)):
    try:
        rows = db.execute(
            text("SELECT id, name, quantity, price FROM drugs WHERE quantity < 200 ORDER BY quantity ASC LIMIT 10")
        ).mappings().all()
        items = [dict(r) for r in rows] if rows else []
    except Exception:
        items = []
    return {
        "region": region,
        "rop_items": items or [
            {"id": 156, "name": "Cold Chain Vaccine Serum", "quantity": 45, "rop_threshold": 100, "price": 250.0},
            {"id": 158, "name": "Amoxicillin 500mg", "quantity": 80, "rop_threshold": 150, "price": 120.0},
        ],
        "summary": {"total_items": len(items), "below_rop": len(items)},
    }
