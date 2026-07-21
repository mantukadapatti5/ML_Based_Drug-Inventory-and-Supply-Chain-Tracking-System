"""GxP Part 11 compliance routes: electronic signatures and immutable audit trail."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.gxp_audit_trail import GxPAuditTrail
from ..models.user import User
from ..services.gxp_compliance import (
    record_gxp_action,
    validate_reason_notes,
    verify_electronic_signature,
)
from ..services.security import get_current_user, require_role
from ..config import settings

router = APIRouter(prefix="/compliance", tags=["Compliance"])


class OverrideRequest(BaseModel):
    action: str = Field(..., description="e.g. FORCE_RELEASE_TEMPERATURE_ALERT")
    target_batch_id: str
    reason_notes: str
    current_data_snapshot: Dict[str, Any] = Field(default_factory=dict)
    password: str = Field(..., min_length=1, description="Re-enter password for e-signature")
    password_verification_hash: Optional[str] = None


class AnomalyResolveComplianceRequest(BaseModel):
    log_id: int
    reason_notes: str
    password: str
    current_data_snapshot: Dict[str, Any] = Field(default_factory=dict)


@router.post("/verify-override")
async def verify_and_log_override(
    request: OverrideRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """GxP gate: verify e-signature and append immutable audit record before any override."""
    verify_electronic_signature(
        current_user,
        request.password,
        password_verification_hash=request.password_verification_hash,
    )
    validate_reason_notes(request.reason_notes)

    post_image_state = {
        "batch_id": request.target_batch_id,
        "override_action": request.action,
        "justification": request.reason_notes,
        "snapshot": request.current_data_snapshot,
        "execution_timestamp": datetime.now(timezone.utc).isoformat(),
        "performed_by_user_id": current_user.id,
    }

    entry = record_gxp_action(
        db,
        current_user,
        action_type=request.action,
        target_table="drug_batches",
        record_id=request.target_batch_id,
        pre_image=request.current_data_snapshot,
        post_image=post_image_state,
        reason_notes=request.reason_notes,
        ip_address=http_request.client.host if http_request.client else None,
        correlation_id=http_request.headers.get("X-Correlation-ID"),
    )
    db.commit()

    return {
        "status": "APPROVED_AND_RECORDED",
        "electronic_signature_hash": entry.electronic_signature_hash,
        "audit_trail_id": entry.id,
        "username": current_user.email,
    }


@router.post("/resolve-anomaly")
async def gxp_resolve_anomaly(
    request: AnomalyResolveComplianceRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Resolve anomaly only after Part 11 e-signature and audit logging."""
    from sqlalchemy import text

    verify_electronic_signature(current_user, request.password)
    validate_reason_notes(request.reason_notes)

    row = db.execute(
        text("SELECT id, batch_id, resolved, anomaly_type, anomaly_score FROM anomaly_logs WHERE id = :id"),
        {"id": request.log_id},
    ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Anomaly log not found")
    if row["resolved"]:
        raise HTTPException(status_code=409, detail="Anomaly already resolved")

    pre_image = {
        "log_id": row["id"],
        "batch_id": row["batch_id"],
        "resolved": bool(row["resolved"]),
        "anomaly_type": row["anomaly_type"],
        "anomaly_score": float(row["anomaly_score"]) if row["anomaly_score"] else None,
        "snapshot": request.current_data_snapshot,
    }

    post_image = {
        **pre_image,
        "resolved": True,
        "resolution_notes": request.reason_notes,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
        "resolved_by": current_user.email,
        "execution_timestamp": datetime.now(timezone.utc).isoformat(),
    }

    entry = record_gxp_action(
        db,
        current_user,
        action_type="ANOMALY_RESOLVE",
        target_table="anomaly_logs",
        record_id=str(request.log_id),
        pre_image=pre_image,
        post_image=post_image,
        reason_notes=request.reason_notes,
        ip_address=http_request.client.host if http_request.client else None,
    )

    db.execute(
        text("""
            UPDATE anomaly_logs
            SET resolved = true, resolution_notes = :notes, resolved_at = :resolved_at
            WHERE id = :id
        """),
        {
            "notes": request.reason_notes,
            "resolved_at": datetime.now(timezone.utc),
            "id": request.log_id,
        },
    )
    db.commit()

    return {
        "success": True,
        "message": "Anomaly resolved with GxP audit trail",
        "electronic_signature_hash": entry.electronic_signature_hash,
        "audit_trail_id": entry.id,
    }


@router.get("/audit-trail")
def list_gxp_audit_trail(
    limit: int = 50,
    record_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    q = db.query(GxPAuditTrail).order_by(GxPAuditTrail.timestamp.desc())
    if record_id:
        q = q.filter(GxPAuditTrail.record_id == record_id)
    entries = q.limit(min(limit, 200)).all()
    return {
        "total": len(entries),
        "entries": [
            {
                "id": e.id,
                "username": e.username,
                "action_type": e.action_type,
                "target_table": e.target_table,
                "record_id": e.record_id,
                "pre_image": e.pre_image,
                "post_image": e.post_image,
                "reason_notes": e.reason_notes,
                "electronic_signature_hash": e.electronic_signature_hash,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            }
            for e in entries
        ],
    }


@router.get("/verify-signature/{audit_id}")
def verify_audit_signature_integrity(
    audit_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    entry = db.query(GxPAuditTrail).filter(GxPAuditTrail.id == audit_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Audit entry not found")
    valid = entry.verify_integrity(settings.gxp_signature_salt)
    return {
        "audit_trail_id": audit_id,
        "integrity_valid": valid,
        "electronic_signature_hash": entry.electronic_signature_hash,
    }


@router.get("/status")
def compliance_status():
    return {
        "part11_enabled": True,
        "audit_table": "gxp_audit_trail",
        "append_only_enforced": True,
        "min_reason_length": 10,
        "electronic_signature": "password_reauthentication_required",
    }
