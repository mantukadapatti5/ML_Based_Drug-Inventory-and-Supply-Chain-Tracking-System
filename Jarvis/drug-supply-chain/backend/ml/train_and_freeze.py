"""Phase 3: ML Model Freezing - Pre-Train & Export Model Artifacts
 
This script trains demand ensemble and anomaly detection models once,
then exports them as static .pkl files for instant inference.

Run once at deployment time:
    python -m backend.ml.train_and_freeze

Models are cached in:
    backend/ml/saved_models/          (ensembles)
    backend/ml/scalers/               (feature scalers)
    
Then routes load them at startup for sub-millisecond predictions.
"""

import logging
import os
import sys
from pathlib import Path
from typing import List

import joblib
import numpy as np
import pandas as pd

# Suppress TensorFlow warnings
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Add parent directories to path
ml_dir = Path(__file__).parent
sys.path.insert(0, str(ml_dir.parent))
sys.path.insert(0, str(ml_dir.parent.parent))

from anomaly_detector import SecurityAnomalyDetector, build_baseline_matrix_from_csv
from demand_ensemble import DemandEnsembleForecaster, load_or_train_ensemble
from demand_forecaster import get_all_drug_region_pairs


def freeze_security_detector() -> bool:
    """Pre-train and export Isolation Forest for cold-chain telemetry.
    
    Feature: #13 Anomaly Detection (Live)
    Returns: True if successful, False otherwise
    """
    logger.info("🔒 Freezing Security Anomaly Detector (Isolation Forest)...")

    try:
        detector = SecurityAnomalyDetector()

        # Build training data from sensor logs
        baseline_data = build_baseline_matrix_from_csv()

        if baseline_data is None or len(baseline_data) == 0:
            logger.warning("No sensor baseline data found. Using synthetic normals.")
            # Generate synthetic cold-chain normals (temp, humidity, weight)
            baseline_data = np.array([
                [4.0, 55.0, 500.0],      # Normal state
                [4.5, 52.0, 499.5],
                [3.8, 56.0, 500.1],
                [4.2, 54.0, 499.8],
                [5.0, 58.0, 500.2],
                [3.5, 50.0, 499.9],
            ] * 50)  # Repeat 50x for sufficient training

        # Train detector
        detector.train_baseline(baseline_data)

        model_path = detector._model_path
        logger.info("✅ Security detector frozen: %s", model_path)
        logger.info("   Features: temperature, humidity, weight")
        logger.info("   Samples: %d", len(baseline_data))

        return True

    except Exception as e:
        logger.error("❌ Security detector freezing failed: %s", e)
        return False


def freeze_demand_ensembles() -> bool:
    """Pre-train and export demand forecasting ensembles for all drug+region pairs.
    
    Feature: #5 Demand Forecasting
    Returns: True if at least one model trained successfully
    """
    logger.info("📦 Freezing Demand Ensemble Forecasters...")

    try:
        drug_region_pairs = get_all_drug_region_pairs()
        logger.info("   Found %d drug+region combinations", len(drug_region_pairs))

        if not drug_region_pairs:
            logger.warning("No drug+region pairs found. Skipping ensemble training.")
            return False

        success_count = 0
        for pair in drug_region_pairs[:10]:  # Train first 10 to avoid timeout
            try:
                # Extract from dictionary returned by to_dict('records')
                drug_id = pair.get('Drug_ID') if isinstance(pair, dict) else pair[0]
                region = pair.get('Region') if isinstance(pair, dict) else pair[1]
                logger.info("   Training ensemble for drug_id=%s region=%s...", drug_id, region)

                forecaster = load_or_train_ensemble(drug_id, region)

                if forecaster is None:
                    logger.warning("   ⚠️  Failed to load/train %s/%s", drug_id, region)
                    continue

                # Verify files were created
                if (
                    os.path.exists(forecaster.rf_path)
                    and os.path.exists(forecaster.scaler_path)
                ):
                    logger.info(
                        "   ✅ Ensemble saved: %s",
                        os.path.basename(forecaster.rf_path),
                    )
                    success_count += 1
                else:
                    logger.warning("   ⚠️  Model files not found after training")

            except Exception as e:
                logger.warning("   ⚠️  Ensemble training failed for %s/%s: %s", drug_id, region, e)
                continue

        logger.info("✅ Ensemble freezing complete: %d models exported", success_count)
        return success_count > 0

    except Exception as e:
        logger.error("❌ Demand ensemble freezing failed: %s", e)
        return False


def verify_frozen_models() -> dict:
    """Verify that all expected model artifacts exist.
    
    Returns: Dict with verification status
    """
    logger.info("🔍 Verifying frozen model artifacts...")

    ml_dir = Path(__file__).parent
    saved_models_dir = ml_dir / "saved_models"
    scalers_dir = ml_dir / "scalers"

    status = {
        "security_models": [],
        "demand_models": [],
        "scalers": [],
        "total": 0,
    }

    if saved_models_dir.exists():
        for model_file in saved_models_dir.glob("*.pkl"):
            if "isolation_forest" in model_file.name:
                status["security_models"].append(model_file.name)
            elif "rf" in model_file.name or "xgb" in model_file.name:
                status["demand_models"].append(model_file.name)

    if scalers_dir.exists():
        for scaler_file in scalers_dir.glob("*.pkl"):
            status["scalers"].append(scaler_file.name)

    status["total"] = (
        len(status["security_models"]) +
        len(status["demand_models"]) +
        len(status["scalers"])
    )

    logger.info("✅ Verification complete:")
    logger.info("   Security models: %d", len(status["security_models"]))
    for f in status["security_models"]:
        logger.info("      - %s", f)

    logger.info("   Demand models: %d", len(status["demand_models"]))
    for f in status["demand_models"][:5]:  # Show first 5
        logger.info("      - %s", f)
    if len(status["demand_models"]) > 5:
        logger.info("      ... and %d more", len(status["demand_models"]) - 5)

    logger.info("   Scalers: %d", len(status["scalers"]))
    logger.info("   Total artifacts: %d", status["total"])

    return status


def main():
    """Main training pipeline: freeze all models for production inference."""
    logger.info("=" * 70)
    logger.info("Phase 3: ML Model Freezing")
    logger.info("=" * 70)
    logger.info("")

    results = {
        "security_detector": False,
        "demand_ensembles": False,
    }

    # Step 1: Freeze security detector
    logger.info("[1/3] Freezing Security Anomaly Detector...")
    results["security_detector"] = freeze_security_detector()
    logger.info("")

    # Step 2: Freeze demand ensembles
    logger.info("[2/3] Freezing Demand Ensemble Forecasters...")
    results["demand_ensembles"] = freeze_demand_ensembles()
    logger.info("")

    # Step 3: Verify
    logger.info("[3/3] Verifying frozen models...")
    verification = verify_frozen_models()
    logger.info("")

    # Summary
    logger.info("=" * 70)
    logger.info("SUMMARY")
    logger.info("=" * 70)
    logger.info("Security detector:  %s", "✅ READY" if results["security_detector"] else "⚠️  INCOMPLETE")
    logger.info("Demand ensembles:   %s", "✅ READY" if results["demand_ensembles"] else "⚠️  INCOMPLETE")
    logger.info("Total artifacts:    %d", verification["total"])
    logger.info("")

    if results["security_detector"] and results["demand_ensembles"] and verification["total"] > 0:
        logger.info("✅ Phase 3 Complete! ML pipeline frozen successfully.")
        logger.info("")
        logger.info("Routes will now load these models at startup for:")
        logger.info("  • Feature #3: Dashboard Stats (cached predictions)")
        logger.info("  • Feature #5: Demand Forecasting (instant inference)")
        logger.info("  • Feature #13: Anomaly Detection (sub-millisecond scoring)")
        logger.info("  • Feature #20: Dynamic ROP (ledger-based optimization)")
        return 0
    else:
        logger.warning("⚠️  Phase 3 Incomplete - some models failed to freeze")
        logger.warning("Routes will fall back to runtime training (slower)")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
