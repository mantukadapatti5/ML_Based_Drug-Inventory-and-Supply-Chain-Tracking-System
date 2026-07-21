"""Transactional outbox helpers for blockchain synchronization."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.outbox_event import OutboxEvent

logger = logging.getLogger(__name__)


def enqueue_event(
    aggregate_type: str,
    aggregate_id: str,
    event_type: str,
    payload: Dict[str, Any],
    idempotency_key: str,
    db: Optional[Session] = None,
) -> Optional[str]:
    """Append a PENDING outbox row; returns event id."""
    own_session = db is None
    session = db or SessionLocal()
    try:
        existing = (
            session.query(OutboxEvent)
            .filter(OutboxEvent.idempotency_key == idempotency_key)
            .first()
        )
        if existing:
            logger.debug("Outbox event already exists for key %s", idempotency_key)
            return str(existing.id)

        event = OutboxEvent(
            id=str(uuid.uuid4()),
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            event_type=event_type,
            payload=payload,
            idempotency_key=idempotency_key,
            status="PENDING",
        )
        session.add(event)
        session.commit()
        return str(event.id)
    except Exception as exc:
        session.rollback()
        logger.error("Failed to enqueue outbox event: %s", exc)
        return None
    finally:
        if own_session:
            session.close()


def confirm_outbox(
    idempotency_key: str,
    fabric_tx_id: str,
    status: str = "CONFIRMED",
    db: Optional[Session] = None,
) -> bool:
    """Mark outbox row confirmed after successful Fabric transaction."""
    own_session = db is None
    session = db or SessionLocal()
    try:
        event = (
            session.query(OutboxEvent)
            .filter(OutboxEvent.idempotency_key == idempotency_key)
            .first()
        )
        if not event:
            logger.warning("No outbox event found for key %s", idempotency_key)
            return False

        event.status = status
        event.fabric_tx_id = fabric_tx_id
        event.confirmed_at = datetime.now(timezone.utc)
        if event.published_at is None:
            event.published_at = datetime.now(timezone.utc)
        session.commit()
        return True
    except Exception as exc:
        session.rollback()
        logger.error("Failed to confirm outbox for %s: %s", idempotency_key, exc)
        return False
    finally:
        if own_session:
            session.close()


def mark_outbox_failed(idempotency_key: str, db: Optional[Session] = None) -> None:
    own_session = db is None
    session = db or SessionLocal()
    try:
        event = (
            session.query(OutboxEvent)
            .filter(OutboxEvent.idempotency_key == idempotency_key)
            .first()
        )
        if event:
            event.status = "FAILED"
            session.commit()
    except Exception as exc:
        session.rollback()
        logger.error("Failed to mark outbox failed: %s", exc)
    finally:
        if own_session:
            session.close()
