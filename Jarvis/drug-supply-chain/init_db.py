"""Initialize PostgreSQL or SQLite schema with dialect-safe DDL and connection pooling."""

from sqlalchemy import text

from backend.config import settings
from backend.database import engine, Base
from backend.models import *  # noqa: F401,F403 — register ORM models


def _pk() -> str:
    return "SERIAL PRIMARY KEY" if settings.is_postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"


def _bool_default() -> str:
    return "BOOLEAN DEFAULT FALSE" if settings.is_postgres else "BOOLEAN DEFAULT 0"


def init_db() -> None:
    print(f"Initializing database ({settings.database_url.split('://')[0]})...")
    Base.metadata.create_all(bind=engine)

    pk = _pk()
    bool_def = _bool_default()

    ddl_statements = [
        f"""
        CREATE TABLE IF NOT EXISTS anomaly_logs (
            id {pk},
            batch_id TEXT,
            transaction_hash TEXT,
            anomaly_score REAL,
            anomaly_type TEXT,
            triggered_at TIMESTAMP,
            resolved {bool_def},
            resolution_notes TEXT,
            resolved_at TIMESTAMP
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS supplier_performance (
            id {pk},
            supplier_id TEXT UNIQUE,
            supplier_name TEXT,
            rating_score REAL DEFAULT 0,
            average_lead_time_days REAL DEFAULT 5.0,
            min_lead_time REAL DEFAULT 3.0,
            max_lead_time REAL DEFAULT 10.0,
            on_time_delivery_pct REAL DEFAULT 95.0,
            cold_chain_compliance_score REAL DEFAULT 98.0,
            quality_rejection_rate_pct REAL DEFAULT 1.0,
            delivery_accuracy_rate_pct REAL DEFAULT 97.0,
            iso_certified BOOLEAN DEFAULT TRUE,
            gmp_certified BOOLEAN DEFAULT TRUE,
            fda_approved BOOLEAN DEFAULT TRUE,
            audit_result TEXT DEFAULT 'Pass'
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS shipments (
            id TEXT PRIMARY KEY,
            status TEXT,
            origin TEXT,
            destination TEXT,
            dispatched_at TIMESTAMP,
            delivered_at TIMESTAMP,
            vehicle_id TEXT,
            driver_id TEXT
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS inventory_expiry (
            id {pk},
            batch_id TEXT UNIQUE,
            drug_id TEXT,
            drug_name TEXT,
            expiry_date DATE,
            days_until_expiry INTEGER,
            quantity_units INTEGER,
            storage_zone TEXT
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS orders (
            id {pk},
            vendor_id INTEGER,
            distributor_id INTEGER,
            drug_id INTEGER,
            quantity INTEGER,
            status TEXT,
            created_at TIMESTAMP,
            blockchain_order_id TEXT
        )
        """,
    ]

    for stmt in ddl_statements:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
        except Exception as exc:
            print(f"DDL warning: {exc}")

    seed_statements = []
    if settings.is_postgres:
        seed_statements = [
            """
            INSERT INTO supplier_performance (supplier_id, supplier_name, rating_score)
            VALUES ('SUPP_DEFAULT', 'Main Pharma Supplier', 9.0)
            ON CONFLICT (supplier_id) DO NOTHING
            """,
            """
            INSERT INTO drugs (id, name, batch_no, manufacturer, expiry_date, quantity, price, vendor_id)
            VALUES (1, 'Amoxicillin 250mg', 'AMX-2024', 'PharmaCorp', '2025-12-31', 1000, 15.5, 2)
            ON CONFLICT (id) DO NOTHING
            """,
        ]
    else:
        seed_statements = [
            """
            INSERT OR IGNORE INTO supplier_performance (supplier_id, supplier_name, rating_score)
            VALUES ('SUPP_DEFAULT', 'Main Pharma Supplier', 9.0)
            """,
            """
            INSERT OR IGNORE INTO drugs (id, name, batch_no, manufacturer, expiry_date, quantity, price, vendor_id)
            VALUES (1, 'Amoxicillin 250mg', 'AMX-2024', 'PharmaCorp', '2025-12-31', 1000, 15.5, 2)
            """,
        ]

    for stmt in seed_statements:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
        except Exception as exc:
            print(f"Seed warning: {exc}")

    for col_def in [
        "ALTER TABLE orders ADD COLUMN blockchain_order_id TEXT",
        "ALTER TABLE orders ADD COLUMN distributor_id INTEGER",
        "ALTER TABLE supplier_performance ADD COLUMN average_lead_time_days REAL DEFAULT 5.0",
    ]:
        try:
            with engine.begin() as conn:
                conn.execute(text(col_def))
        except Exception:
            pass

    if settings.is_postgres:
        try:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_expiry_batch_id "
                        "ON inventory_expiry (batch_id)"
                    )
                )
        except Exception as exc:
            print(f"Index warning: {exc}")

    print("Database initialized successfully.")


if __name__ == "__main__":
    init_db()
