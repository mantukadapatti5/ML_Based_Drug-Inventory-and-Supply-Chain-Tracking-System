from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool

from .config import settings
from .models.base import Base

_engine_kwargs = {"future": True}

if settings.is_postgres:
    _engine_kwargs.update(
        poolclass=QueuePool,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_reset_on_return="rollback",
    )
elif settings.is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(settings.database_url, **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


# Force rollback any aborted transaction when a connection is checked out from pool
if settings.is_postgres:
    @event.listens_for(engine, "checkout")
    def _force_rollback_on_checkout(dbapi_conn, conn_rec, conn_proxy):
        try:
            dbapi_conn.rollback()
        except Exception:
            pass


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    if settings.is_sqlite:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
