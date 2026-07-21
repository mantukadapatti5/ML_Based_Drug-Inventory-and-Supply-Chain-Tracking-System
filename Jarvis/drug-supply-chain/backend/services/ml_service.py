"""ML orchestration: calibrate live engines and expose demand ensemble.

Phase 3 Enhancement: Load pre-trained models instead of training on-demand.
Routes now get instant predictions without CSV re-parsing.
"""

import logging
from typing import Any, Dict

from ..ml.anomaly_detector import (
    TELEMETRY_FEATURE_NAMES,
    calibrate_security_detector,
    score_telemetry_payload,
    security_anomaly_detector,
)
from ..ml.demand_ensemble import DemandEnsembleForecaster, load_or_train_ensemble

logger = logging.getLogger(__name__)


class MLService:
    def __init__(self) -> None:
        self._security_ready = False
        self._ensemble_cache: Dict[str, DemandEnsembleForecaster] = {}
        self._models_frozen = False

    def initialize(self) -> None:
        """Calibrate security detector and warm default demand ensemble if data exists.
        
        Phase 3: Attempts to load pre-trained models first (fast path).
        Falls back to runtime training if models don't exist yet.
        """
        try:
            calibrate_security_detector()
            self._security_ready = security_anomaly_detector.is_trained
            logger.info("Security anomaly engine ready: %s", self._security_ready)
        except Exception as exc:
            logger.error("Security engine calibration failed: %s", exc)
        
        # Phase 3: Check if models were pre-trained
        try:
            self._models_frozen = security_anomaly_detector.is_trained
            if self._models_frozen:
                logger.info("✅ Pre-trained ML models detected (Phase 3 frozen)")
            else:
                logger.info("⚠️  No pre-trained models found - routes will use runtime training")
        except Exception as exc:
            logger.warning("Could not verify frozen models: %s", exc)

    @property
    def security_ready(self) -> bool:
        return self._security_ready and security_anomaly_detector.is_trained
    
    @property
    def models_frozen(self) -> bool:
        """Check if Phase 3 model freezing was successful."""
        return self._models_frozen

    def get_ensemble_forecaster(self, drug_id: str, region: str) -> DemandEnsembleForecaster:
        """Get or load demand ensemble for drug+region.
        
        Phase 3: Loads pre-trained model if available (cache check first).
        Falls back to load_or_train_ensemble if model doesn't exist.
        """
        key = f"{drug_id}|{region}"
        if key not in self._ensemble_cache:
            try:
                forecaster = load_or_train_ensemble(drug_id, region)
                if forecaster:
                    self._ensemble_cache[key] = forecaster
                    if self._models_frozen:
                        logger.debug("Loaded frozen ensemble: %s/%s", drug_id, region)
                else:
                    logger.warning("Could not load ensemble: %s/%s", drug_id, region)
                    return None
            except Exception as e:
                logger.error("Error loading ensemble %s/%s: %s", drug_id, region, e)
                return None
        return self._ensemble_cache[key]

    def forecast_demand(self, drug_id: str, region: str, horizon_days: int = 30) -> Dict[str, Any]:
        """Generate demand forecast for drug+region.
        
        Phase 3: Uses cached/frozen model for instant inference.
        """
        forecaster = self.get_ensemble_forecaster(drug_id, region)
        if not forecaster:
            raise ValueError(f"Could not load forecaster for {drug_id}/{region}")
        
        predictions = forecaster.predict_next_n_days(horizon_days)
        return {
            "drug_id": drug_id,
            "region": region,
            "horizon_days": horizon_days,
            "predictions": predictions,
            "model_metrics": forecaster.evaluate(),
            "phase_3_frozen": self._models_frozen,  # Indicator for monitoring
        }

    def score_telemetry(self, payload: dict) -> Dict[str, Any]:
        return score_telemetry_payload(payload)

    def status(self) -> Dict[str, Any]:
        return {
            "security_anomaly_detector": {
                "trained": security_anomaly_detector.is_trained,
                "feature_count": len(TELEMETRY_FEATURE_NAMES),
                "features": list(TELEMETRY_FEATURE_NAMES),
            },
            "demand_ensemble_cached": len(self._ensemble_cache),
            "models_frozen": self._models_frozen,  # Phase 3 indicator
        }


ml_service = MLService()
