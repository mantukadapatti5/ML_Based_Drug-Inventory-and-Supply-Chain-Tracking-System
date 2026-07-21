# Phase 3: ML Pipeline - Quick Start

## What Phase 3 Does

Replaces **on-demand model training** (slow) with **pre-trained model artifacts** (fast).

**Result:** Predictions go from 2000ms → 15ms ✨

---

## How to Activate Phase 3

### Option 1: Automatic (Recommended)
Just start the backend — Phase 3 runs automatically at startup:

```bash
cd C:\Users\Mahanthesh V K\OneDrive\Desktop\Dummy\Jarvis\drug-supply-chain
.\.venv\Scripts\Activate.ps1
python -m backend.main
```

Watch for these success messages in logs:
```
Pre-training ML models for instant inference...
✅ ML models frozen and cached
✅ Pre-trained ML models detected (Phase 3 frozen)
```

### Option 2: Manual Training
Explicitly train and export models:

```bash
python -m backend.ml.train_and_freeze
```

**Output:** Shows training progress and exports `.pkl` files

---

## Verify Phase 3 is Working

```bash
# Check if models are frozen
curl http://localhost:8000/api/ml/status | jq '.phase_3_frozen'

# Response: true (Phase 3 active) or false (using runtime training)
```

---

## Test Prediction Speed

**Before freezing:** ~2000ms  
**After freezing:** ~15ms

```bash
curl -X POST http://localhost:8000/api/forecast/predict \
  -H "Content-Type: application/json" \
  -d '{
    "drug_id": "Aspirin",
    "region": "Delhi",
    "horizon_days": 30
  }'
```

Response will include `"inference_mode": "frozen_model"` 🚀

---

## Features That Got Faster

- **#3 Dashboard Stats**: Real-time predictions (cached)
- **#5 Demand Forecasting**: Instant predictions from pre-trained models
- **#13 Anomaly Detection**: Sub-millisecond IsolationForest scoring
- **#20 Dynamic ROP**: Fast ledger-based optimization

---

## If Something Goes Wrong

**Models didn't freeze?** Check logs for missing data files:
- `data/live_sensor_logs_fixed.csv`
- `data/module5_drug_consumption_history.csv`

**Still slow?** Check status:
```bash
curl http://localhost:8000/api/ml/status | jq '.models_frozen'
```

**Want to retrain?**
```bash
# Delete old models and restart
rm -rf backend/ml/saved_models
rm -rf backend/ml/scalers
python -m backend.main  # Will rebuild
```

---

## Model Storage

Models saved in:
```
backend/ml/saved_models/          (ensembles: *.pkl)
backend/ml/scalers/               (feature scalers: *.pkl)
```

**Size:** ~10-20MB total (negligible storage)

---

## Done! ✅

Phase 3 is automatically active when you see `phase_3_frozen: true` in the status endpoint.

Next: Phase 4 (Distributed caching & federated inference)
