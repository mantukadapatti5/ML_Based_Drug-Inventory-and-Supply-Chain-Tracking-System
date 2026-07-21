"""Dialect-aware SQL fragments for SQLite (dev) and PostgreSQL (production)."""

from ..config import settings


def insert_ignore(table: str, columns: str, values_placeholders: str, conflict_target: str = "id") -> str:
    if settings.is_postgres:
        return (
            f"INSERT INTO {table} ({columns}) VALUES ({values_placeholders}) "
            f"ON CONFLICT ({conflict_target}) DO NOTHING"
        )
    return f"INSERT OR IGNORE INTO {table} ({columns}) VALUES ({values_placeholders})"


def upsert_shipment() -> str:
    if settings.is_postgres:
        return """
            INSERT INTO shipments (id, status, origin, destination, dispatched_at)
            VALUES (:id, 'In Transit', 'Warehouse', 'Customer', :now)
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                dispatched_at = EXCLUDED.dispatched_at
        """
    return """
        INSERT OR REPLACE INTO shipments (id, status, origin, destination, dispatched_at)
        VALUES (:id, 'In Transit', 'Warehouse', 'Customer', :now)
    """


def last_insert_id(db) -> int:
    from sqlalchemy import text

    if settings.is_postgres:
        return db.execute(text("SELECT lastval()")).scalar()
    return db.execute(text("SELECT last_insert_rowid()")).scalar()


def for_update_clause() -> str:
    return "" if settings.is_sqlite else " FOR UPDATE"


def returning_id() -> str:
    return " RETURNING id" if settings.is_postgres else ""
