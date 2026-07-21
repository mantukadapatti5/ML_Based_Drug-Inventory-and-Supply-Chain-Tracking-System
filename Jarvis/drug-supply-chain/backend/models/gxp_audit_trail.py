"""GxP Part 11 append-only audit trail with cryptographic electronic signatures."""

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import Column, DateTime, Integer, JSON, String, event
from sqlalchemy.orm import Session

from .base import Base


class GxPAuditTrail(Base):
    __tablename__ = "gxp_audit_trail"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    username = Column(String(100), nullable=False)
    action_type = Column(String(80), nullable=False)
    target_table = Column(String(100), nullable=False)
    record_id = Column(String(128), nullable=False, index=True)
    pre_image = Column(JSON, nullable=True)
    post_image = Column(JSON, nullable=False)
    reason_notes = Column(String(2000), nullable=True)
    electronic_signature_hash = Column(String(64), nullable=False, index=True)
    ip_address = Column(String(64), nullable=True)
    session_correlation_id = Column(String(64), nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)

    @staticmethod
    def generate_signature_hash(
        username: str,
        action: str,
        data_payload: dict,
        secret_salt: str,
        timestamp_iso: Optional[str] = None,
    ) -> str:
        """SHA-256 fingerprint binding user identity to a specific modification."""
        payload = {
            "data": data_payload,
            "timestamp": timestamp_iso or datetime.now(timezone.utc).isoformat(),
        }
        serialized_data = json.dumps(payload, sort_keys=True, default=str)
        raw_string = f"{username}||{action}||{serialized_data}||{secret_salt}"
        return hashlib.sha256(raw_string.encode("utf-8")).hexdigest()

    def verify_integrity(self, secret_salt: str) -> bool:
        ts = None
        if isinstance(self.post_image, dict):
            ts = self.post_image.get("execution_timestamp")
        if not ts and self.timestamp:
            ts = self.timestamp.isoformat()
        expected = self.generate_signature_hash(
            username=self.username,
            action=self.action_type,
            data_payload=self.post_image,
            secret_salt=secret_salt,
            timestamp_iso=ts,
        )
        return expected == self.electronic_signature_hash


@event.listens_for(GxPAuditTrail, "before_update")
def _block_gxp_audit_update(mapper, connection, target) -> None:
    raise ValueError("GxP audit trail is append-only: UPDATE operations are prohibited.")


@event.listens_for(GxPAuditTrail, "before_delete")
def _block_gxp_audit_delete(mapper, connection, target) -> None:
    raise ValueError("GxP audit trail is append-only: DELETE operations are prohibited.")


def append_gxp_audit(
    db: Session,
    *,
    user_id: int,
    username: str,
    action_type: str,
    target_table: str,
    record_id: str,
    post_image: Dict[str, Any],
    electronic_signature_hash: str,
    pre_image: Optional[Dict[str, Any]] = None,
    reason_notes: Optional[str] = None,
    ip_address: Optional[str] = None,
    session_correlation_id: Optional[str] = None,
    timestamp: Optional[datetime] = None,
) -> GxPAuditTrail:
    """Insert-only audit record (Part 11)."""
    entry = GxPAuditTrail(
        user_id=user_id,
        username=username,
        action_type=action_type,
        target_table=target_table,
        record_id=str(record_id),
        pre_image=pre_image,
        post_image=post_image,
        reason_notes=reason_notes,
        electronic_signature_hash=electronic_signature_hash,
        ip_address=ip_address,
        session_correlation_id=session_correlation_id,
        timestamp=timestamp or datetime.now(timezone.utc),
    )
    db.add(entry)
    db.flush()
    return entry
