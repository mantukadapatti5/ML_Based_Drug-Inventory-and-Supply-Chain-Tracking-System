from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from datetime import datetime
import sys
import os
import logging
import pandas as pd

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "ml"))
from demand_forecaster import get_all_drug_region_pairs
from anomaly_detector import AnomalyDetector, score_telemetry_payload

from ..database import get_db
from ..services.ml_service import ml_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["ML Forecasting & Anomalies"])

detector: AnomalyDetector | None = None


def init_ml_models() -> None:
    global detector
    detector = AnomalyDetector()
    ml_service.initialize()
    if detector.using_baseline:
        logger.warning("Fraud anomaly detector using baseline rule engine (no .pkl artifacts).")
    else:
        logger.info("Fraud anomaly detector loaded trained artifacts.")
    if ml_service.security_ready:
        logger.info("Live telemetry security engine (Isolation Forest) calibrated.")
    else:
        logger.warning("Telemetry security engine not calibrated.")


class ForecastRequest(BaseModel):
    drug_id: str
    region: str
    horizon_days: int = 30

    @field_validator("horizon_days")
    @classmethod
    def validate_horizon(cls, v):
        if v < 1 or v > 365:
            raise ValueError("horizon_days must be between 1 and 365")
        return v


class TelemetryScoreRequest(BaseModel):
    device_id: str = "unknown"
    batch_id: str = "UNKNOWN"
    temperature_c: float = 4.0
    humidity_pct: float = 55.0
    weight_g: float = 500.0
    idempotency_key: str = ""


class AnomalyDetectRequest(BaseModel):
    batch_id: str
    transaction_hash: str = ""
    price_deviation_score: float = 0.0
    transaction_frequency: float = 0.0
    geographic_inconsistency_score: float = 0.0
    quantity_deviation_score: float = 0.0
    event_time_gap_hours: float = 0.0
    low_consensus_flag: int = 0
    unverified_flag: int = 0


@router.get("/ml/status")
async def ml_status():
    """Get ML pipeline status (Phase 3: Shows if models are frozen/cached).
    
    Features:
      • #3: Dashboard Stats (uses cached predictions)
      • #5: Forecasting (uses pre-trained models)
      • #13: Anomaly Detection (uses frozen IsolationForest)
    """
    return {
        **ml_service.status(),
        "phase_3_frozen": ml_service.models_frozen,  # Phase 3 indicator
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


@router.post("/anomalies/score-telemetry")
async def score_telemetry_live(request: TelemetryScoreRequest):
    payload = request.model_dump()
    result = score_telemetry_payload(payload)
    return {
        **result,
        "batch_id": request.batch_id,
        "device_id": request.device_id,
        "scored_at": datetime.utcnow().isoformat() + "Z",
    }


@router.post("/forecast/predict")
async def forecast_predict(request: ForecastRequest, db: Session = Depends(get_db)):
    """Predict demand for drug+region (Feature #5: Forecasting).
    
    Phase 3: Uses pre-trained ensemble models for instant inference.
    Returns predictions with model metadata and performance metrics.
    """
    try:
        result = ml_service.forecast_demand(
            request.drug_id, request.region, request.horizon_days
        )
        return {
            **result,
            "inference_mode": "frozen_model" if ml_service.models_frozen else "runtime_training",
            "generated_at": datetime.utcnow().isoformat() + "Z",
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=f"Data or Model not found: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model error: {str(e)}")


@router.get("/forecast/drugs")
async def list_forecastable_drugs():
    try:
        pairs = get_all_drug_region_pairs()
        return {"available": pairs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast/history/{drug_id}")
async def get_forecast_history(drug_id: str, region: str, days: int = 90):
    try:
        forecaster = ml_service.get_ensemble_forecaster(drug_id, region)
        df = forecaster.load_data()
        df["Date"] = pd.to_datetime(df["Date"])
        recent = df.sort_values("Date").tail(days)
        history = [
            {
                "date": row["Date"].strftime("%Y-%m-%d"),
                "actual_units": float(row["Daily_Consumption_Units"]),
                "moving_avg_7day": float(row.get("Moving_Avg_7Day", 0.0)),
            }
            for _, row in recent.iterrows()
        ]
        return {"drug_id": drug_id, "region": region, "history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/anomalies/detect")
async def detect_anomaly(request: AnomalyDetectRequest, db: Session = Depends(get_db)):
    if detector is None:
        init_ml_models()

    feature_dict = {
        "Price_Deviation_Score": request.price_deviation_score,
        "Transaction_Frequency": request.transaction_frequency,
        "Geographic_Inconsistency_Score": request.geographic_inconsistency_score,
        "Quantity_Deviation_Score": request.quantity_deviation_score,
        "Event_Time_Gap_Hours": request.event_time_gap_hours,
        "Low_Consensus_Flag": request.low_consensus_flag,
        "Unverified_Flag": request.unverified_flag,
    }
    result = detector.detect(feature_dict)

    logged = False
    log_id = None
    if result["is_anomaly"]:
        try:
            res = db.execute(
                text("""
                    INSERT INTO anomaly_logs
                    (batch_id, transaction_hash, anomaly_score, anomaly_type, triggered_at, resolved)
                    VALUES (:batch_id, :tx_hash, :score, :type, :triggered_at, :resolved)
                """),
                {
                    "batch_id": request.batch_id,
                    "tx_hash": request.transaction_hash,
                    "score": result["anomaly_score"],
                    "type": result.get("anomaly_type", "MLAnomaly"),
                    "triggered_at": datetime.utcnow(),
                    "resolved": False,
                },
            )
            db.commit()
            log_id = res.lastrowid
            logged = True
        except Exception as e:
            db.rollback()
            logger.error("Error logging anomaly: %s", e)

    return {
        "batch_id": request.batch_id,
        "is_anomaly": result["is_anomaly"],
        "anomaly_score": result["anomaly_score"],
        "anomaly_type": result.get("anomaly_type", "Unknown"),
        "method": result.get("method", "unknown"),
        "logged": logged,
        "anomaly_log_id": log_id,
        "detected_at": datetime.utcnow().isoformat() + "Z",
    }


@router.put("/anomalies/logs/{log_id}/resolve")
async def resolve_anomaly(log_id: int, notes: str, db: Session = Depends(get_db)):
    """Deprecated: use POST /api/compliance/resolve-anomaly with e-signature (Part 11)."""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=(
            "GxP compliance: direct anomaly resolution is disabled. "
            "Use POST /api/compliance/resolve-anomaly with password and reason_notes (min 10 chars)."
        ),
    )
