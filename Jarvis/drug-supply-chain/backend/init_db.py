"""
Automatic Database Initialization & CSV-to-SQLite Sync Engine
Ensures database is populated with fallback data on startup.
Cross-OS path fix: no more hardcoded Windows paths.
"""
import logging
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import text

from .database import SessionLocal, engine
from .models.base import Base
from .services.security import get_password_hash

logger = logging.getLogger(__name__)

# ── Cross-OS path fix ──────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent   # drug-supply-chain/
DATA_DIR = BASE_DIR / "data"
CSV_MODULE5 = DATA_DIR / "module5_drug_consumption_history.csv"


def init_db():
    """
    Initialize database on startup:
    1. Create all tables
    2. Seed required FK anchor users (admin id=1, vendor id=2, distributor id=3)
    3. Seed drugs catalog if empty
    4. Seed expiry batches + stock_requests table
    """
    logger.info("🔄 Database initialization starting...")

    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database schema created/verified")
    except Exception as e:
        logger.error(f"❌ Failed to create schema: {e}")
        return

    db = SessionLocal()
    try:
        _migrate_extra_tables(db)
        _sync_users_fallback(db)
        if _should_sync_csv(db):
            logger.info("📊 Syncing CSV data into SQLite...")
            _sync_drugs_from_csv(db)
            _sync_expiry_batches(db)
            logger.info("✅ CSV data sync complete")
        else:
            logger.info("✅ Database already populated, skipping CSV sync")
    except Exception as e:
        logger.error(f"❌ Init failed: {e}")
    finally:
        db.close()


def _migrate_extra_tables(db: Session):
    """Create tables that may not be in Base.metadata yet."""
    stmts = [
        """CREATE TABLE IF NOT EXISTS stock_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drug_id INTEGER,
            drug_name TEXT,
            batch_no TEXT,
            quantity INTEGER DEFAULT 0,
            status TEXT DEFAULT 'PENDING',
            requested_by TEXT,
            distributor_id INTEGER,
            priority TEXT DEFAULT 'Normal',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS inventory_expiry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id TEXT UNIQUE,
            drug_id TEXT,
            drug_name TEXT,
            expiry_date DATE,
            days_until_expiry INTEGER,
            quantity_units INTEGER DEFAULT 0,
            storage_zone TEXT DEFAULT 'WH-A'
        )""",
        """CREATE TABLE IF NOT EXISTS audit_trail (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT,
            entity_type TEXT,
            entity_id TEXT,
            batch_id TEXT,
            blockchain_hash TEXT,
            user_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS anomaly_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id TEXT,
            drug_id INTEGER,
            anomaly_type TEXT,
            anomaly_score REAL DEFAULT 0.0,
            confidence_score REAL DEFAULT 0.0,
            resolved INTEGER DEFAULT 0,
            triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP,
            notes TEXT
        )""",
        # Add missing columns to orders if they don't exist
        "ALTER TABLE orders ADD COLUMN blockchain_order_id TEXT",
        "ALTER TABLE orders ADD COLUMN distributor_id INTEGER",
        "ALTER TABLE orders ADD COLUMN vendor_id INTEGER DEFAULT 2",
        # supplier_performance extra column
        "ALTER TABLE supplier_performance ADD COLUMN average_lead_time_days REAL DEFAULT 5.0",
        "ALTER TABLE supplier_performance ADD COLUMN on_time_delivery_pct REAL DEFAULT 95.0",
        "ALTER TABLE supplier_performance ADD COLUMN cold_chain_compliance_score REAL DEFAULT 98.0",
    ]
    for stmt in stmts:
        try:
            db.execute(text(stmt))
            db.commit()
        except Exception:
            db.rollback()


def _should_sync_csv(db: Session) -> bool:
    try:
        drugs_count = db.execute(text("SELECT COUNT(*) FROM drugs")).scalar() or 0
        return drugs_count < 3
    except Exception:
        return True


def _sync_users_fallback(db: Session):
    """
    Insert FK anchor users: admin(1), vendor(2), distributor(3).
    These MUST exist before any order/sale/drug can be inserted.
    """
    users = [
        (1, "System Admin",      "admin@gmail.com",  "admin@12",  "admin",       "ADM-2024-001"),
        (2, "PharmaPrime Vendor","vendor@gmail.com", "vendor@12", "vendor",      "VEN-2024-001"),
        (3, "MediHub Distributor","dis@gmail.com",   "dis@12",    "distributor", "DIS-2024-001"),
        (4, "CDSCO Regulator",   "reg@gmail.com",    "reg@12",    "regulator",   "REG-2024-001"),
    ]
    for uid, name, email, pwd, role, lic in users:
        try:
            exists = db.execute(text("SELECT id FROM users WHERE id = :id"), {"id": uid}).scalar()
            if not exists:
                db.execute(
                    text("""
                        INSERT OR IGNORE INTO users
                            (id, name, email, password, role, license_no, verified)
                        VALUES (:id, :name, :email, :pwd, :role, :lic, 1)
                    """),
                    {"id": uid, "name": name, "email": email,
                     "pwd": get_password_hash(pwd), "role": role, "lic": lic},
                )
                db.commit()
                logger.info(f"✅ Seeded user: {email} (id={uid})")
        except Exception as e:
            db.rollback()
            logger.warning(f"User seed skipped for id={uid}: {e}")


def _sync_drugs_from_csv(db: Session):
    """Load drugs from CSV and insert into SQLite."""
    if not CSV_MODULE5.exists():
        logger.warning(f"⚠️ CSV not found: {CSV_MODULE5}")
        _insert_static_drugs(db)
        return

    try:
        df = pd.read_csv(CSV_MODULE5)
        df = df.where(pd.notnull(df), None)
        logger.info(f"📂 Loaded CSV: {len(df)} rows, cols: {list(df.columns)}")

        inserted = 0
        seen_ids = set()
        for idx, row in df.iterrows():
            try:
                drug_id_raw = row.get("drug_id") or row.get("Drug_ID")
                if drug_id_raw is None:
                    drug_id = 1000 + idx
                else:
                    try:
                        drug_id = int(float(str(drug_id_raw).split("|")[0]))
                    except Exception:
                        drug_id = 1000 + idx

                if drug_id in seen_ids:
                    continue
                seen_ids.add(drug_id)

                drug_name = str(row.get("drug_name") or row.get("Drug_Name") or "Unknown Drug").strip()
                price = float(row.get("price") or 150.0)
                expiry_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")

                db.execute(
                    text("""
                        INSERT OR IGNORE INTO drugs
                            (id, name, batch_no, manufacturer, expiry_date, quantity, price, vendor_id)
                        VALUES (:id, :name, :batch, :mfr, :exp, 1000, :price, 2)
                    """),
                    {"id": drug_id, "name": drug_name,
                     "batch": f"BATCH-{drug_id:05d}", "mfr": "PharmaPrime",
                     "exp": expiry_date, "price": price},
                )
                inserted += 1
                if inserted % 50 == 0:
                    db.commit()
            except Exception as row_err:
                logger.debug(f"Row {idx} skipped: {row_err}")
                continue

        db.commit()
        logger.info(f"✅ CSV sync: {inserted} drugs inserted")

    except Exception as e:
        db.rollback()
        logger.error(f"❌ CSV sync failed: {e}")
        _insert_static_drugs(db)


def _insert_static_drugs(db: Session):
    """Static fallback drug catalog — always works."""
    static = [
        (1,   "Amoxicillin 250mg",      "AMX-2024", "PharmaCorp",  "2027-12-31", 1000, 15.50),
        (2,   "Paracetamol 500mg",      "PAR-2024", "MediSource",  "2027-06-15", 800,   9.00),
        (3,   "Insulin Glargine",        "INS-2024", "HealthWave",  "2027-01-20", 400,  45.00),
        (156, "Cold Chain Vaccine Serum","C-003",    "Biomed Labs", "2027-08-14", 500, 250.00),
        (157, "Paracetamol Infusion",   "P-911",    "Apex Health", "2028-01-20", 750,  45.00),
        (158, "Amoxicillin 500mg",      "A-441",    "PharmaPrime", "2027-06-30", 620, 120.00),
        (159, "Azithromycin 250mg",     "AZ-201",   "MediCore",    "2027-09-15", 300,  85.00),
        (160, "Metformin 500mg",        "MF-330",   "Cadila Health","2028-03-01",900,  30.00),
    ]
    for row in static:
        try:
            db.execute(
                text("""
                    INSERT OR IGNORE INTO drugs
                        (id, name, batch_no, manufacturer, expiry_date, quantity, price, vendor_id)
                    VALUES (:id, :name, :batch, :mfr, :exp, :qty, :price, 2)
                """),
                {"id": row[0], "name": row[1], "batch": row[2], "mfr": row[3],
                 "exp": row[4], "qty": row[5], "price": row[6]},
            )
        except Exception:
            pass
    try:
        db.commit()
        logger.info("✅ Static drug catalog inserted")
    except Exception:
        db.rollback()


def _sync_expiry_batches(db: Session):
    """Seed inventory_expiry table with real batches so FEFO page is never empty."""
    now = datetime.utcnow()
    batches = [
        ("BATCH-A01", "1", "Amoxicillin 250mg",     (now + timedelta(days=10)).strftime("%Y-%m-%d"), 10, 220, "Cold-A"),
        ("AMX-2024",  "1", "Amoxicillin 250mg",     (now + timedelta(days=90)).strftime("%Y-%m-%d"), 90, 500, "WH-A"),
        ("PAR-2024",  "2", "Paracetamol 500mg",     (now + timedelta(days=16)).strftime("%Y-%m-%d"), 16,  95, "Dry-B"),
        ("INS-2024",  "3", "Insulin Glargine",       (now + timedelta(days=37)).strftime("%Y-%m-%d"), 37, 180, "Cold-B"),
        ("C-003",   "156", "Cold Chain Vaccine",     (now + timedelta(days=55)).strftime("%Y-%m-%d"), 55, 500, "Cold-A"),
        ("P-911",   "157", "Paracetamol Infusion",  (now + timedelta(days=18)).strftime("%Y-%m-%d"), 18, 200, "Dry-A"),
    ]
    for bid, did, dname, exp, days, qty, zone in batches:
        try:
            db.execute(
                text("""
                    INSERT OR IGNORE INTO inventory_expiry
                        (batch_id, drug_id, drug_name, expiry_date, days_until_expiry, quantity_units, storage_zone)
                    VALUES (:bid, :did, :dn, :ed, :days, :qty, :zone)
                """),
                {"bid": bid, "did": did, "dn": dname, "ed": exp,
                 "days": days, "qty": qty, "zone": zone},
            )
        except Exception:
            pass
    try:
        db.commit()
        logger.info("✅ Expiry batches seeded")
    except Exception:
        db.rollback()

    # Seed a couple of demo anomaly logs
    anomalies = [
        ("BATCH-A01", 1, "TEMPERATURE_BREACH", 0.92, 0),
        ("PAR-2024",  2, "DEMAND_SPIKE",       0.75, 0),
        ("INS-2024",  3, "EXPIRY_RISK",        0.88, 0),
    ]
    for bid, did, atype, score, resolved in anomalies:
        try:
            db.execute(
                text("""
                    INSERT OR IGNORE INTO anomaly_logs
                        (batch_id, drug_id, anomaly_type, anomaly_score, resolved, triggered_at)
                    VALUES (:bid, :did, :atype, :score, :resolved, datetime('now'))
                """),
                {"bid": bid, "did": did, "atype": atype, "score": score, "resolved": resolved},
            )
        except Exception:
            pass
    try:
        db.commit()
        logger.info("✅ Demo anomaly logs seeded")
    except Exception:
        db.rollback()


def create_tables():
    """Explicit table creation (called by main.py lifespan)."""
    Base.metadata.create_all(bind=engine)
