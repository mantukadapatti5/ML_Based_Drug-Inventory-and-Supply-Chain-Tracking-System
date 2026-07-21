import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

logger = logging.getLogger(__name__)

# Live IoT scoring feature order — must match train + score exactly (3 features)
TELEMETRY_FEATURE_NAMES = ("temperature", "humidity", "weight")


class SecurityAnomalyDetector:
    """Isolation Forest for real-time cold-chain telemetry (temp, humidity, weight)."""

    def __init__(self) -> None:
        self.model = IsolationForest(n_estimators=100, contamination=0.02, random_state=42)
        self.is_trained = False
        self._models_dir = Path(__file__).parent / "saved_models"
        self._models_dir.mkdir(parents=True, exist_ok=True)
        self._model_path = self._models_dir / "security_isolation_forest.pkl"
        self._try_load_saved()

    def _try_load_saved(self) -> None:
        if self._model_path.exists():
            try:
                self.model = joblib.load(self._model_path)
                self.is_trained = True
                logger.info("Loaded security IsolationForest from %s", self._model_path)
            except Exception as exc:
                logger.warning("Could not load security IF model: %s", exc)

    def train_baseline(self, historical_clean_data: np.ndarray) -> None:
        """Train on clean baseline matrix shape [samples, 3] -> temperature, humidity, weight."""
        if historical_clean_data.ndim != 2 or historical_clean_data.shape[1] != 3:
            raise ValueError(
                f"Expected baseline shape (n_samples, 3), got {historical_clean_data.shape}"
            )
        self.model.fit(historical_clean_data)
        self.is_trained = True
        joblib.dump(self.model, self._model_path)
        logger.info("Security IsolationForest trained on %s samples", len(historical_clean_data))

    def score_reading(self, temperature: float, humidity: float, weight: float) -> Dict[str, Any]:
        """Score one live truck reading; returns anomaly flag, score, and reason code."""
        if not self.is_trained:
            return {"is_anomaly": False, "score": 0.0, "reason": "Model not calibrated"}

        data_point = np.array([[float(temperature), float(humidity), float(weight)]])
        prediction = int(self.model.predict(data_point)[0])
        anomaly_score = float(self.model.score_samples(data_point)[0])
        is_anomaly = prediction == -1

        reason = "NORMAL"
        # GxP hard guardrails — always flag known breach patterns
        if temperature > 8.0:
            is_anomaly = True
            reason = "CRITICAL_TEMPERATURE_BREACH"
        elif weight < 495.0:
            is_anomaly = True
            reason = "POTENTIAL_PRODUCT_THEFT_OR_SUBSTITUTION"
        elif is_anomaly:
            reason = "UNKNOWN_ENVIRONMENTAL_DRIFT"

        return {
            "is_anomaly": is_anomaly,
            "score": round(anomaly_score, 4),
            "reason": reason,
            "features_used": list(TELEMETRY_FEATURE_NAMES),
        }


def build_baseline_matrix_from_csv(csv_path: Optional[str] = None) -> np.ndarray:
    """Build [n, 3] training matrix from sensor logs or synthetic cold-chain normals."""
    candidates = [
        csv_path,
        "data/live_sensor_logs_fixed.csv",
        "../data/live_sensor_logs_fixed.csv",
        "../../data/live_sensor_logs_fixed.csv",
    ]
    found = next((p for p in candidates if p and os.path.exists(p)), None)

    if found:
        df = pd.read_csv(found)
        temps = df.get("Internal_Temperature_C", df.get("Temperature_C", pd.Series(dtype=float)))
        humids = df.get("Humidity_Level_pct", df.get("Humidity_pct", pd.Series(dtype=float)))
        temps = pd.to_numeric(temps, errors="coerce").fillna(4.0)
        humids = pd.to_numeric(humids, errors="coerce").fillna(55.0)
        # Cold-chain subset for baseline when possible
        cold_mask = temps <= 10.0
        if cold_mask.sum() >= 100:
            temps = temps[cold_mask]
            humids = humids[cold_mask]
        weights = np.random.normal(500.0, 1.0, len(temps))
        return np.column_stack((temps.values, humids.values, weights))

    np.random.seed(42)
    clean_temps = np.random.normal(4.0, 0.5, 1000)
    clean_humids = np.random.normal(55.0, 2.0, 1000)
    clean_weights = np.random.normal(500.0, 1.0, 1000)
    return np.column_stack((clean_temps, clean_humids, clean_weights))


def calibrate_security_detector(detector: Optional[SecurityAnomalyDetector] = None) -> SecurityAnomalyDetector:
    """Train or load the live telemetry security model."""
    instance = detector or security_anomaly_detector
    if instance.is_trained:
        return instance
    baseline = build_baseline_matrix_from_csv()
    instance.train_baseline(baseline)
    return instance


security_anomaly_detector = SecurityAnomalyDetector()

FEATURE_COLUMNS = [
    "Price_Deviation_Score",
    "Transaction_Frequency",
    "Geographic_Inconsistency_Score",
    "Quantity_Deviation_Score",
    "Event_Time_Gap_Hours",
    "Low_Consensus_Flag",
    "Unverified_Flag",
]


class AnomalyDetector:
    def __init__(self):
        self.scaler = StandardScaler()
        self.isolation_forest = None
        self.autoencoder = None
        self.threshold = 0.5
        self.ae_threshold = 0.0
        self.models_loaded = False
        self.using_baseline = False

        self.models_dir = os.path.join(os.path.dirname(__file__), "saved_models")
        self.scalers_dir = os.path.join(os.path.dirname(__file__), "scalers")
        os.makedirs(self.models_dir, exist_ok=True)
        os.makedirs(self.scalers_dir, exist_ok=True)

        self.if_path = os.path.join(self.models_dir, "isolation_forest.pkl")
        self.ae_path = os.path.join(self.models_dir, "autoencoder.keras")
        self.scaler_path = os.path.join(self.scalers_dir, "scaler.pkl")
        self.thresh_path = os.path.join(self.models_dir, "ae_threshold.pkl")

        self._try_load_artifacts()

    def _try_load_artifacts(self) -> None:
        try:
            if os.path.exists(self.scaler_path) and os.path.exists(self.if_path):
                self.scaler = joblib.load(self.scaler_path)
                self.isolation_forest = joblib.load(self.if_path)
                self.models_loaded = True
                logger.info("Loaded IsolationForest from %s", self.if_path)
            else:
                raise FileNotFoundError("IsolationForest artifacts missing")
        except Exception as exc:
            logger.warning("ML anomaly models not found (%s). Using baseline rule engine.", exc)
            self.isolation_forest = None
            self.models_loaded = False
            self.using_baseline = True

        try:
            if os.path.exists(self.ae_path) and os.path.exists(self.thresh_path):
                from tensorflow.keras import models

                self.autoencoder = models.load_model(self.ae_path)
                self.ae_threshold = joblib.load(self.thresh_path)
                logger.info("Loaded autoencoder from %s", self.ae_path)
        except Exception as exc:
            logger.warning("Autoencoder not loaded: %s", exc)
            self.autoencoder = None

    def load_models(self) -> None:
        self._try_load_artifacts()

    def _baseline_detect(self, data_dict: dict) -> dict:
        price = float(data_dict.get("Price_Deviation_Score", 0))
        geo = float(data_dict.get("Geographic_Inconsistency_Score", 0))
        qty = float(data_dict.get("Quantity_Deviation_Score", 0))
        unverified = int(data_dict.get("Unverified_Flag", 0))
        score = min(1.0, 0.35 * price + 0.25 * geo + 0.25 * qty + 0.15 * unverified)
        is_anomaly = score > 0.55 or unverified == 1
        return {
            "is_anomaly": is_anomaly,
            "anomaly_score": float(score),
            "method": "BaselineRuleEngine",
            "anomaly_type": "RuleBasedFlag" if is_anomaly else "Normal",
        }

    def detect(self, data_dict: dict) -> dict:
        if self.using_baseline or self.isolation_forest is None:
            return self._baseline_detect(data_dict)

        features = np.array([[data_dict.get(c, 0) for c in FEATURE_COLUMNS]])
        try:
            features_scaled = self.scaler.transform(features)
        except Exception:
            features_scaled = features

        if_score = self.isolation_forest.decision_function(features_scaled)[0]
        if_norm = 1 - (if_score + 0.5)

        ae_norm = 0.0
        if self.autoencoder is not None:
            try:
                reconstruction = self.autoencoder.predict(features_scaled, verbose=0)
                mse = np.mean(np.power(features_scaled - reconstruction, 2))
                ae_norm = mse / self.ae_threshold if self.ae_threshold > 0 else 0
            except Exception:
                ae_norm = 0.0

        ensemble_score = min(1.0, if_norm * 1.5) if self.autoencoder is None else (0.4 * if_norm) + (0.6 * min(1.0, ae_norm))
        is_anomaly = ensemble_score > self.threshold
        return {
            "is_anomaly": is_anomaly,
            "anomaly_score": float(ensemble_score),
            "method": "Ensemble" if self.autoencoder else "IsolationForest-Only",
            "anomaly_type": "MLAnomaly" if is_anomaly else "Normal",
        }

    def load_and_preprocess(self, csv_path: str) -> np.ndarray:
        df = pd.read_csv(csv_path)
        X = df[FEATURE_COLUMNS].values
        X = np.nan_to_num(X)
        X_scaled = self.scaler.fit_transform(X)
        joblib.dump(self.scaler, self.scaler_path)
        return X_scaled

    def build_autoencoder(self, input_dim: int):
        try:
            from tensorflow.keras import layers, models

            model = models.Sequential()
            model.add(layers.Input(shape=(input_dim,)))
            model.add(layers.Dense(16, activation="relu"))
            model.add(layers.Dense(8, activation="relu"))
            model.add(layers.Dense(16, activation="relu"))
            model.add(layers.Dense(input_dim))
            model.compile(optimizer="adam", loss="mse")
            return model
        except Exception as exc:
            logger.warning("Could not build autoencoder: %s", exc)
            return None

    def train_autoencoder(self, X: np.ndarray, epochs: int = 5, batch_size: int = 32) -> None:
        self.autoencoder = self.build_autoencoder(X.shape[1])
        if self.autoencoder is None:
            return
        try:
            self.autoencoder.fit(X, X, epochs=epochs, batch_size=batch_size, verbose=0)
            reconstructions = self.autoencoder.predict(X, verbose=0)
            mse = np.mean(np.power(X - reconstructions, 2), axis=1)
            self.ae_threshold = float(np.percentile(mse, 95))
            self.autoencoder.save(self.ae_path)
            joblib.dump(self.ae_threshold, self.thresh_path)
        except Exception as exc:
            logger.warning("Autoencoder training failed: %s", exc)
            self.autoencoder = None

    def train_isolation_forest(self, X: np.ndarray) -> None:
        self.isolation_forest = IsolationForest(contamination=0.05, random_state=42)
        self.isolation_forest.fit(X)
        joblib.dump(self.isolation_forest, self.if_path)
        self.models_loaded = True
        self.using_baseline = False


def score_telemetry_payload(payload: dict) -> Dict[str, Any]:
    """Extract IoT fields and run live security scoring (3-feature matrix)."""
    from ..utils.parsing import safe_float

    temperature = safe_float(payload.get("temperature_c", payload.get("temperature")), 4.0)
    humidity = safe_float(payload.get("humidity_pct", payload.get("humidity")), 55.0)
    weight = safe_float(payload.get("weight_g", payload.get("weight")), 500.0)
    return security_anomaly_detector.score_reading(temperature, humidity, weight)
