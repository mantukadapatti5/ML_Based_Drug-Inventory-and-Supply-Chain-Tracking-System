import uuid

from sqlalchemy import Column, DateTime, JSON, String, func

from .base import Base


class OutboxEvent(Base):
    __tablename__ = "outbox_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    aggregate_type = Column(String(64), nullable=False)
    aggregate_id = Column(String(128), nullable=False)
    event_type = Column(String(64), nullable=False)
    payload = Column(JSON, nullable=False)
    idempotency_key = Column(String(256), unique=True, nullable=False)
    status = Column(String(20), nullable=False, default="PENDING")
    fabric_tx_id = Column(String(128), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    published_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
