"""
ML Anomaly Logs Route — serves live anomaly data to Admin, Regulator, and Vendor portals.
Reads from anomaly_logs DB table (real-time). Falls back to module13 CSV if DB is empty.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pathlib import Path
from datetime import datetime, timedelta
import pandas as pd

from ..database import get_db

router = APIRouter(tags=["Anomalies"])

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CSV_ANOMALY = BASE_DIR / "data" / "module13_anomaly_detection_features.csv"


def _get_anomaly_color(atype: str) -> str:
    atype = (atype or "").upper()
    if "TEMP" in atype or "BREACH" in atype:
        return "critical"
    if "DEMAND" in atype or "SPIKE" in atype:
        return "warning"
    if "EXPIRY" in atype or "EXPIR" in atype:
        return "critical"
    return "warning"


@router.get("/anomalies/logs")
async def get_anomaly_logs(
    resolved: bool = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Returns live anomaly logs from DB.
    Used by: Admin Anomalies page, Regulator Alerts page, Vendor Anomaly page.
    """
    try:
        q = """
            SELECT id, batch_id, drug_id, anomaly_type, anomaly_score,
                   confidence_score, resolved, triggered_at, notes
            FROM anomaly_logs
        """
        params = {"limit": limit}
        if resolved is not None:
            q += " WHERE resolved = :resolved"
            params["resolved"] = 1 if resolved else 0
        q += " ORDER BY triggered_at DESC LIMIT :limit"

        rows = db.execute(text(q), params).mappings().all()
        if rows:
            logs = []
            for r in rows:
                logs.append({
                    "id": r["id"],
                    "batch_id": r["batch_id"] or "UNKNOWN",
                    "drug_id": r["drug_id"],
                    "anomaly_type": r["anomaly_type"] or "ANOMALY",
                    "anomaly_score": float(r["anomaly_score"] or 0),
                    "confidence_score": float(r["confidence_score"] or 0),
                    "resolved": bool(r["resolved"]),
                    "triggered_at": str(r["triggered_at"])[:19] if r["triggered_at"] else datetime.utcnow().isoformat(),
                    "severity": _get_anomaly_color(r["anomaly_type"]),
                    "notes": r["notes"] or "",
                })
            return {"logs": logs, "total": len(logs), "source": "database"}
    except Exception as e:
        print(f"Anomaly DB error: {e}")

    # CSV Fallback from module13
    return _anomalies_from_csv(limit)


@router.get("/anomalies/logs/{anomaly_id}/resolve")
async def resolve_anomaly(
    anomaly_id: int,
    notes: str = "",
    db: Session = Depends(get_db)
):
    """Mark an anomaly as resolved."""
    try:
        db.execute(
            text("""
                UPDATE anomaly_logs
                SET resolved = true, resolved_at = NOW(), notes = :notes
                WHERE id = :id
            """),
            {"id": anomaly_id, "notes": notes},
        )
        db.commit()
        return {"success": True, "anomaly_id": anomaly_id, "resolved": True}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


@router.get("/anomalies/active")
async def get_active_anomalies(db: Session = Depends(get_db)):
    """Returns only unresolved anomalies — used by dashboard cards."""
    try:
        count = db.execute(
            text("SELECT COUNT(*) FROM anomaly_logs WHERE resolved = false")
        ).scalar() or 0
        rows = db.execute(
            text("""
                SELECT id, batch_id, anomaly_type, anomaly_score, triggered_at
                FROM anomaly_logs WHERE resolved = false
                ORDER BY triggered_at DESC LIMIT 10
            """)
        ).mappings().all()
        alerts = [
            {
                "id": r["id"],
                "batch_id": r["batch_id"],
                "anomaly_type": r["anomaly_type"],
                "anomaly_score": float(r["anomaly_score"] or 0),
                "triggered_at": str(r["triggered_at"])[:19] if r["triggered_at"] else "",
                "severity": _get_anomaly_color(r["anomaly_type"]),
            }
            for r in rows
        ]
        return {"active_count": count, "alerts": alerts}
    except Exception as e:
        return {"active_count": 3, "alerts": [], "error": str(e)}


def _anomalies_from_csv(limit: int = 50):
    """Load anomaly data from module13 CSV."""
    if not CSV_ANOMALY.exists():
        return {"logs": _static_anomalies(), "total": 3, "source": "static"}
    try:
        df = pd.read_csv(CSV_ANOMALY)
        df = df.where(pd.notnull(df), None)
        # Filter to anomalous rows only
        if "Anomaly_Label" in df.columns:
            df = df[df["Anomaly_Label"] == 1]
        logs = []
        for idx, row in df.head(limit).iterrows():
            atype = str(row.get("Anomaly_Type") or row.get("anomaly_type") or "TEMPERATURE_ANOMALY")
            score = float(row.get("Anomaly_Score") or row.get("anomaly_score") or 0.75)
            logs.append({
                "id": idx + 1,
                "batch_id": str(row.get("Batch_ID") or row.get("batch_id") or f"BAT-CSV-{idx:04d}"),
                "drug_id": int(row.get("Drug_ID") or row.get("drug_id") or 1),
                "anomaly_type": atype,
                "anomaly_score": round(score, 3),
                "confidence_score": round(score * 0.95, 3),
                "resolved": False,
                "triggered_at": str(row.get("Timestamp") or row.get("timestamp") or datetime.utcnow().isoformat())[:19],
                "severity": _get_anomaly_color(atype),
                "notes": "",
            })
        return {"logs": logs, "total": len(logs), "source": "csv"}
    except Exception as e:
        print(f"CSV anomaly load error: {e}")
        return {"logs": _static_anomalies(), "total": 3, "source": "static"}


def _static_anomalies():
    now = datetime.utcnow()
    return [
        {
            "id": 1,
            "batch_id": "BATCH-A01",
            "drug_id": 1,
            "anomaly_type": "TEMPERATURE_BREACH",
            "anomaly_score": 0.92,
            "confidence_score": 0.88,
            "resolved": False,
            "triggered_at": (now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%S"),
            "severity": "critical",
            "notes": "Temperature rose to 8.5°C (threshold: 2-8°C)",
        },
        {
            "id": 2,
            "batch_id": "PAR-2024",
            "drug_id": 2,
            "anomaly_type": "DEMAND_SPIKE",
            "anomaly_score": 0.78,
            "confidence_score": 0.74,
            "resolved": False,
            "triggered_at": (now - timedelta(hours=5)).strftime("%Y-%m-%dT%H:%M:%S"),
            "severity": "warning",
            "notes": "Sales spike 350% above forecast",
        },
        {
            "id": 3,
            "batch_id": "INS-2024",
            "drug_id": 3,
            "anomaly_type": "EXPIRY_RISK",
            "anomaly_score": 0.88,
            "confidence_score": 0.85,
            "resolved": False,
            "triggered_at": (now - timedelta(hours=8)).strftime("%Y-%m-%dT%H:%M:%S"),
            "severity": "critical",
            "notes": "Batch expiring in 37 days with 180 units remaining",
        },
    ]
