"""Generate Indian pharmaceutical catalog — drugs + FEFO expiry batches."""

import random
from datetime import date, datetime, timedelta
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import settings

INDIAN_PHARMA_BASE = [
    ("Paracetamol 500mg", "Micro Labs", 18.0, 45.0),
    ("Paracetamol 650mg", "GlaxoSmithKline", 22.0, 55.0),
    ("Amoxicillin 250mg", "Cipla", 35.0, 85.0),
    ("Amoxicillin + Clavulanate 625mg", "Sun Pharma", 95.0, 145.0),
    ("Azithromycin 500mg", "Alembic", 55.0, 120.0),
    ("Metformin HCl 500mg", "USV Ltd", 28.0, 65.0),
    ("Metformin HCl 1000mg", "Lupin", 42.0, 78.0),
    ("Atorvastatin 10mg", "Torrent", 48.0, 95.0),
    ("Atorvastatin 20mg", "Zydus", 62.0, 110.0),
    ("Pantoprazole 40mg", "Alkem", 38.0, 72.0),
    ("Omeprazole 20mg", "Dr Reddy's", 32.0, 68.0),
    ("Cetirizine 10mg", "Cadila", 15.0, 35.0),
    ("Levocetirizine 5mg", "Glenmark", 22.0, 48.0),
    ("Vitamin D3 Cholecalciferol 60k IU", "Abbott", 85.0, 150.0),
    ("Ibuprofen 400mg", "Abbott", 25.0, 58.0),
    ("Ibuprofen + Paracetamol", "Sanofi", 35.0, 75.0),
    ("Losartan Potassium 50mg", "Biocon", 45.0, 88.0),
    ("Amlodipine 5mg", "Mankind", 28.0, 55.0),
    ("Telmisartan 40mg", "Glenmark", 52.0, 98.0),
    ("Montelukast 10mg", "Cipla", 48.0, 92.0),
    ("Salbutamol Inhaler 100mcg", "Cipla", 120.0, 185.0),
    ("Insulin Glargine 100IU/ml", "Biocon", 450.0, 680.0),
    ("Metoprolol 50mg", "Sun Pharma", 38.0, 72.0),
    ("Aspirin 75mg", "Bayer", 18.0, 42.0),
    ("Clopidogrel 75mg", "Torrent", 55.0, 105.0),
    ("Ranitidine 150mg", "Cadila", 22.0, 48.0),
    ("Domperidone 10mg", "Janssen", 28.0, 55.0),
    ("ORS Powder", "FDC Ltd", 12.0, 28.0),
    ("Zinc Sulphate 20mg", "Himalaya", 15.0, 32.0),
    ("Doxycycline 100mg", "Pfizer", 42.0, 88.0),
    ("Cefixime 200mg", "Lupin", 65.0, 125.0),
    ("Ofloxacin 200mg", "Mankind", 38.0, 75.0),
    ("Hydroxychloroquine 200mg", "IPC", 45.0, 95.0),
    ("Prednisolone 5mg", "Wockhardt", 32.0, 68.0),
    ("Dexamethasone 0.5mg", "Zydus", 28.0, 58.0),
]

MANUFACTURERS_EXTRA = [
    "Cipla", "Sun Pharma", "Dr Reddy's", "Lupin", "Torrent", "Glenmark",
    "Alkem", "Mankind", "Abbott", "Biocon", "USV Ltd", "Cadila",
]


def _as_date(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        raw = val.strip()[:10]
        for fmt in ("%Y-%m-%d", "%d-%m-%Y"):
            try:
                return datetime.strptime(raw, fmt).date()
            except ValueError:
                continue
        try:
            return date.fromisoformat(raw)
        except ValueError:
            return None
    return None


def _ignore_insert(table: str, columns: str, values: str, conflict: str = "id") -> str:
    if settings.is_postgres:
        return f"INSERT INTO {table} ({columns}) VALUES ({values}) ON CONFLICT ({conflict}) DO NOTHING"
    return f"INSERT OR IGNORE INTO {table} ({columns}) VALUES ({values})"


def generate_indian_pharma_catalog(db: Session, target_drugs: int = 200, target_batches: int = 800) -> None:
    """Populate drugs + inventory_expiry with realistic Indian pharma data."""
    from datetime import datetime

    now = datetime.utcnow()
    random.seed(42)
    vendor_id = 2

    drug_count = 0
    for i in range(target_drugs):
        if i < len(INDIAN_PHARMA_BASE):
            name, mfr, price_lo, price_hi = INDIAN_PHARMA_BASE[i]
        else:
            base = random.choice(INDIAN_PHARMA_BASE)
            strength = random.choice(["250mg", "500mg", "10mg", "20mg", "40mg", "625mg"])
            name = f"{base[0].split()[0]} {strength}"
            mfr = random.choice(MANUFACTURERS_EXTRA)
            price_lo, price_hi = base[2], base[3]

        price = round(random.uniform(price_lo, price_hi), 2)
        batch_no = f"BAT-2026-{str(i + 1).zfill(4)}"
        expiry = (now + timedelta(days=random.randint(30, 540))).date()
        qty = random.randint(80, 2500)

        try:
            db.execute(
                text("""
                    INSERT INTO drugs (name, batch_no, manufacturer, expiry_date, quantity, price, vendor_id)
                    VALUES (:name, :batch, :mfr, :exp, :qty, :price, :vid)
                """),
                {
                    "name": name,
                    "batch": batch_no,
                    "mfr": mfr,
                    "exp": expiry,
                    "qty": qty,
                    "price": price,
                    "vid": vendor_id,
                },
            )
            drug_count += 1
        except Exception:
            db.rollback()
            continue

    db.commit()

    rows = db.execute(text("SELECT id, name, batch_no, expiry_date, quantity FROM drugs ORDER BY id")).mappings().all()
    if not rows:
        return

    batch_inserts = 0
    for drug in rows:
        batches_per_drug = max(1, target_batches // max(len(rows), 1))
        for b in range(batches_per_drug):
            if batch_inserts >= target_batches:
                break
            sub_batch = f"{drug['batch_no']}-L{b + 1}" if b > 0 else drug["batch_no"]
            exp = _as_date(drug["expiry_date"])
            days_left = (exp - now.date()).days if exp else 90
            split_qty = max(10, int((drug["quantity"] or 100) / batches_per_drug))
            try:
                db.execute(
                    text(_ignore_insert(
                        "inventory_expiry",
                        "batch_id, drug_id, drug_name, expiry_date, days_until_expiry, quantity_units, storage_zone",
                        ":bid, :did, :dn, :ed, :days, :qty, :zone",
                        "batch_id",
                    )),
                    {
                        "bid": sub_batch,
                        "did": str(drug["id"]),
                        "dn": drug["name"],
                        "ed": exp,
                        "days": days_left,
                        "qty": split_qty,
                        "zone": random.choice(["WH-A", "WH-B", "WH-C", "Cold-1", "Cold-2"]),
                    },
                )
                batch_inserts += 1
            except Exception:
                pass
        if batch_inserts >= target_batches:
            break

    db.commit()
    print(f"Catalog seeded: ~{drug_count} drugs, {batch_inserts} expiry batches.")
