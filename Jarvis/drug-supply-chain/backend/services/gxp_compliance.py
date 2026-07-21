"""GxP compliance guard: electronic signatures and immutable audit logging."""

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..config import settings
from ..models.gxp_audit_trail import GxPAuditTrail, append_gxp_audit
from ..models.user import User
from ..services.security import verify_password

logger = logging.getLogger(__name__)

CRITICAL_ACTIONS = frozenset(
    {
        "FORCE_RELEASE_TEMPERATURE_ALERT",
        "MANUAL_OVERRIDE",
        "QUARANTINE_RELEASE",
        "ANOMALY_RESOLVE",
        "INVENTORY_ADJUSTMENT",
        "BATCH_STATUS_OVERRIDE",
    }
)


def hash_password_for_client_reference(password: str) -> str:
    """Optional client-side pre-hash (server still verifies plaintext password)."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_electronic_signature(
    user: User,
    password: str,
    *,
    password_verification_hash: Optional[str] = None,
) -> None:
    """
    Re-authenticate user before a GxP-critical action (Part 11 e-signature).
    Accepts plaintext password (preferred over HTTPS) or matching pre-hash reference.
    """
    if not password and not password_verification_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Electronic signature verification failed: password required.",
        )

    if not password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Electronic signature verification failed: password re-entry required.",
        )
    if not verify_password(password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Electronic signature verification failed: invalid password.",
        )


def validate_reason_notes(reason_notes: str, min_length: int = 10) -> None:
    if not reason_notes or len(reason_notes.strip()) < min_length:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GxP compliance violation: reason notes must be at least {min_length} characters.",
        )


def record_gxp_action(
    db: Session,
    user: User,
    action_type: str,
    target_table: str,
    record_id: str,
    pre_image: Optional[Dict[str, Any]],
    post_image: Dict[str, Any],
    reason_notes: str,
    *,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> GxPAuditTrail:
    """Create append-only audit entry with cryptographic signature."""
    validate_reason_notes(reason_notes)
    timestamp_iso = datetime.now(timezone.utc).isoformat()
    post_image = {**post_image, "execution_timestamp": timestamp_iso}
    signature = GxPAuditTrail.generate_signature_hash(
        username=user.email,
        action=action_type,
        data_payload=post_image,
        secret_salt=settings.gxp_signature_salt,
        timestamp_iso=timestamp_iso,
    )

    ts_dt = datetime.fromisoformat(timestamp_iso.replace("Z", "+00:00"))
    entry = append_gxp_audit(
        db,
        user_id=user.id,
        username=user.email,
        action_type=action_type,
        target_table=target_table,
        record_id=record_id,
        pre_image=pre_image,
        post_image=post_image,
        reason_notes=reason_notes.strip(),
        electronic_signature_hash=signature,
        ip_address=ip_address,
        session_correlation_id=correlation_id,
        timestamp=ts_dt,
    )
    logger.info(
        "GxP audit recorded id=%s action=%s user=%s record=%s",
        entry.id,
        action_type,
        user.email,
        record_id,
    )
    return entry
