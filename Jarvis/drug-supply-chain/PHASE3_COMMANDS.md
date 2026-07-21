# Phase 3: Command Reference & Diagnostics

## One-Command Start (Recommended)

```bash
cd C:\Users\Mahanthesh V K\OneDrive\Desktop\Dummy\Jarvis\drug-supply-chain
.\.venv\Scripts\Activate.ps1
python -m backend.main
```

**Phase 3 auto-runs at startup.** Watch for success messages in logs.

---

## Manual Commands

### Train and Export Models

```bash
# From drug-supply-chain directory
python -m backend.ml.train_and_freeze
```

**Output:**
```
[1/3] Freezing Security Anomaly Detector...
✅ Security detector frozen: backend/ml/saved_models/security_isolation_forest.pkl

[2/3] Freezing Demand Ensemble Forecasters...
✅ Ensemble freezing complete: 12 models exported

[3/3] Verifying frozen models...
✅ Phase 3 Complete! ML pipeline frozen successfully.
```

---

## API Verification

### Check if Phase 3 is Active

```bash
curl http://localhost:8000/api/ml/status
```

**Success Response** (Phase 3 active):
```json
{
  "security_anomaly_detector": {
    "trained": true,
    "feature_count": 3,
    "features": ["temperature", "humidity", "weight"]
  },
  "demand_ensemble_cached": 12,
  "models_frozen": true,
  "phase_3_frozen": true
}
```

**Alternative** (quick check):
```bash
curl http://localhost:8000/api/ml/status | jq '.phase_3_frozen'
# Output: true
```

### Test Forecast with Frozen Models

```bash
$body = @{
    drug_id = "Aspirin"
    region = "Delhi"
    horizon_days = 30
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/api/forecast/predict" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body | Select-Object -ExpandProperty Content | ConvertFrom-Json
```

**Success Response**:
```json
{
  "drug_id": "Aspirin",
  "region": "Delhi",
  "horizon_days": 30,
  "predictions": [120, 125, 130, ...],
  "model_metrics": {...},
  "phase_3_frozen": true,
  "inference_mode": "frozen_model",
  "generated_at": "2026-06-07T10:30:00Z"
}
```

---

## Diagnostic Commands

### Check if Models Are Frozen

```bash
# Check ML status
curl http://localhost:8000/api/ml/status | jq '.phase_3_frozen'

# Check model files exist
dir backend\ml\saved_models\*.pkl
dir backend\ml\scalers\*.pkl

# Count models
(Get-ChildItem backend\ml\saved_models\*.pkl | Measure-Object).Count
(Get-ChildItem backend\ml\scalers\*.pkl | Measure-Object).Count
```

### Monitor Backend Logs for Phase 3

Look for these messages (when backend starts):

```
✅ Pre-trained ML models detected (Phase 3 frozen)
✅ ML models frozen and cached
```

Or these warnings (if Phase 3 didn't work):

```
⚠️  Model freezing skipped (will use runtime training)
⚠️  No pre-trained models found - routes will use runtime training
```

---

## Troubleshooting

### Issue: Phase 3 Not Active
**Check:**
```bash
# Status endpoint
curl http://localhost:8000/api/ml/status | jq '.phase_3_frozen'
# Returns: false

# Logs
# Look for: "⚠️ Model freezing skipped"
```

**Solution:**
```bash
# Verify data files exist
Test-Path "data\live_sensor_logs_fixed.csv"
Test-Path "data\module5_drug_consumption_history.csv"

# If missing, download or create them
# Then manually freeze:
python -m backend.ml.train_and_freeze

# Restart backend
python -m backend.main
```

### Issue: "No module named xgboost"
**Symptom:** Logs show ImportError

**Solution:** Optional dependency not required, but recommended:
```bash
# Install xgboost for better ensemble performance
pip install xgboost

# Retrain
python -m backend.ml.train_and_freeze
```

### Issue: Predictions Still Slow
**Check inference_mode:**
```bash
curl -X POST http://localhost:8000/api/forecast/predict \
  -H "Content-Type: application/json" \
  -d '{"drug_id": "Aspirin", "region": "Delhi", "horizon_days": 30}' \
  | jq '.inference_mode'

# If "runtime_training" instead of "frozen_model", models aren't loaded
```

**Solution:**
```bash
# Manual freeze
python -m backend.ml.train_and_freeze

# Check model files
dir backend\ml\saved_models
dir backend\ml\scalers

# Restart backend
python -m backend.main
```

---

## Performance Benchmark

### Before Phase 3 (Runtime Training)
```bash
# Time a prediction request (with runtime training)
Measure-Command {
    curl -X POST http://localhost:8000/api/forecast/predict `
      -H "Content-Type: application/json" `
      -d '{"drug_id": "Aspirin", "region": "Delhi", "horizon_days": 30}'
}

# Expected: 1500-2500ms
```

### After Phase 3 (Frozen Models)
```bash
# Same request (with frozen models)
Measure-Command {
    curl -X POST http://localhost:8000/api/forecast/predict `
      -H "Content-Type: application/json" `
      -d '{"drug_id": "Aspirin", "region": "Delhi", "horizon_days": 30}'
}

# Expected: 10-50ms
# Improvement: 100x faster! ✨
```

---

## File Management

### Model Artifacts Location
```
backend/ml/
├── saved_models/
│   ├── security_isolation_forest.pkl       (anomaly detector)
│   ├── Aspirin_Delhi_rf.pkl                (random forest)
│   ├── Aspirin_Delhi_xgb.pkl               (xgboost, optional)
│   └── ... (more drug+region pairs)
└── scalers/
    ├── Aspirin_Delhi_ensemble.pkl          (feature scaler)
    └── ... (paired with ensembles)
```

### Delete and Retrain (Full Reset)
```bash
# Remove all frozen models
Remove-Item backend\ml\saved_models\*.pkl -Force
Remove-Item backend\ml\scalers\*.pkl -Force

# Restart backend (will retrain and re-freeze)
python -m backend.main
```

### Backup Models
```bash
# Create backup of frozen models
Copy-Item backend\ml\saved_models -Destination "backup\saved_models-$(Get-Date -Format 'yyyy-MM-dd')" -Recurse
Copy-Item backend\ml\scalers -Destination "backup\scalers-$(Get-Date -Format 'yyyy-MM-dd')" -Recurse
```

---

## Monitoring

### Phase 3 Health Check Script

```bash
# Save as: check-phase3.ps1
$status = curl http://localhost:8000/api/ml/status | ConvertFrom-Json

Write-Host "Phase 3 Health Check" -ForegroundColor Cyan
Write-Host "===================="
Write-Host "Frozen: $($status.phase_3_frozen)" -ForegroundColor $(if($status.phase_3_frozen) {"Green"} else {"Red"})
Write-Host "Security Trained: $($status.security_anomaly_detector.trained)"
Write-Host "Ensemble Count: $($status.demand_ensemble_cached)"
Write-Host "Features: $($status.security_anomaly_detector.features -join ', ')"
```

**Run it:**
```bash
powershell -File check-phase3.ps1
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Start backend with Phase 3 | `python -m backend.main` |
| Manually train/freeze | `python -m backend.ml.train_and_freeze` |
| Check if active | `curl http://localhost:8000/api/ml/status \| jq '.phase_3_frozen'` |
| Test prediction | `curl -X POST http://localhost:8000/api/forecast/predict ...` |
| List models | `dir backend\ml\saved_models\*.pkl` |
| Delete old models | `Remove-Item backend\ml\saved_models\*.pkl -Force` |
| View backend logs | Check console output from `python -m backend.main` |

---

✅ **Phase 3 is production-ready. Use any of the commands above to verify and test.**
