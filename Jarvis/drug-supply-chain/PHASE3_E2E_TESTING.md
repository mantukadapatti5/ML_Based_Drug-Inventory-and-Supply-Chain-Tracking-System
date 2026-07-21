# Phase 3: End-to-End Testing & Verification

## Pre-Test Checklist

Before starting, ensure:
- [ ] Backend environment configured (venv activated)
- [ ] Docker Desktop running
- [ ] PostgreSQL database accessible or SQLite fallback ready
- [ ] CSV data files present:
  - `data/live_sensor_logs_fixed.csv`
  - `data/module5_drug_consumption_history.csv`

---

## Test 1: Verify Startup with Phase 3 Freezing

**Objective:** Confirm Phase 3 models freeze automatically at startup

```bash
# Start backend (watch logs carefully)
cd C:\Users\Mahanthesh V K\OneDrive\Desktop\Dummy\Jarvis\drug-supply-chain
.\.venv\Scripts\Activate.ps1
python -m backend.main
```

**Expected Output** (watch the console):

```
INFO:     Uvicorn running on http://0.0.0.0:8000

Pre-training ML models for instant inference...
[1/3] Freezing Security Anomaly Detector...
   Training on 300 sensor samples...
   ✅ Security detector frozen: backend/ml/saved_models/security_isolation_forest.pkl
   Features: temperature, humidity, weight

[2/3] Freezing Demand Ensemble Forecasters...
   Found 15 drug+region combinations...
   ✅ Ensemble saved: Aspirin_Delhi_rf.pkl (200KB)
   ✅ Ensemble saved: Ibuprofen_Mumbai_rf.pkl (250KB)
   ... (more ensembles)

[3/3] Verifying frozen models...
   Security models: 1
   Demand models: 12
   Scalers: 12
   ✅ Phase 3 Complete! ML pipeline frozen successfully.

✅ Pre-trained ML models detected (Phase 3 frozen)
✅ ML models frozen and cached
```

**✅ PASS**: If you see all ✅ messages  
**❌ FAIL**: If you see ⚠️ warnings (proceed to troubleshooting)

---

## Test 2: Check ML Status Endpoint

**Objective:** Verify Phase 3 indicator in API response

```bash
# In a new terminal, check ML status
curl http://localhost:8000/api/ml/status | ConvertFrom-Json | Format-List

# Or use jq for cleaner output (if installed)
curl http://localhost:8000/api/ml/status | jq '.'
```

**Expected Response:**

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

**Verification Points:**
- ✅ `"models_frozen": true`
- ✅ `"phase_3_frozen": true`
- ✅ `"demand_ensemble_cached"` > 0
- ✅ `"security_anomaly_detector.trained": true`

**✅ PASS**: All true values  
**❌ FAIL**: Any false values (Phase 3 not active)

---

## Test 3: Performance Test - Frozen vs Runtime

**Objective:** Verify sub-millisecond predictions

### Test 3a: Forecast Prediction (Frozen Model)

```bash
# Single prediction with timing
$timer = [System.Diagnostics.Stopwatch]::StartNew()

$response = curl -X POST http://localhost:8000/api/forecast/predict `
  -H "Content-Type: application/json" `
  -d '{
    "drug_id": "Aspirin",
    "region": "Delhi",
    "horizon_days": 30
  }'

$timer.Stop()
Write-Host "Response Time: $($timer.ElapsedMilliseconds)ms"
$response | ConvertFrom-Json | Format-List
```

**Expected Response:**

```json
{
  "drug_id": "Aspirin",
  "region": "Delhi",
  "horizon_days": 30,
  "predictions": [120.5, 125.3, 130.1, ...],
  "model_metrics": {
    "mae": 15.2,
    "rmse": 22.5
  },
  "phase_3_frozen": true,
  "inference_mode": "frozen_model",
  "generated_at": "2026-06-07T10:30:00Z"
}
```

**Performance Check:**
- ✅ Response time: **<100ms** (Phase 3 frozen)
- ⚠️ Response time: 500-2000ms (runtime training - Phase 3 not active)

### Test 3b: Repeat 10 Times (Cache Warmth)

```bash
# Run 10 predictions and average the time
$times = @()
for ($i = 1; $i -le 10; $i++) {
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    $null = curl -s -X POST http://localhost:8000/api/forecast/predict `
      -H "Content-Type: application/json" `
      -d '{"drug_id": "Aspirin", "region": "Delhi", "horizon_days": 30}'
    $timer.Stop()
    $times += $timer.ElapsedMilliseconds
}

$avgTime = ($times | Measure-Object -Average).Average
Write-Host "Average Response Time: $([math]::Round($avgTime, 2))ms"
Write-Host "Individual times: $($times -join ', ')ms"
```

**Expected Output:**

```
Average Response Time: 25.43ms
Individual times: 24, 26, 23, 25, 27, 24, 25, 26, 24, 25ms
```

**✅ PASS**: Consistent <50ms times with model caching  
**❌ FAIL**: High variance or >500ms (models not frozen)

---

## Test 4: Anomaly Scoring (Security Detector)

**Objective:** Verify frozen IsolationForest scoring

```bash
$payload = @{
    temperature = 22.5
    humidity = 65.0
    weight = 50.0
} | ConvertTo-Json

curl -X POST http://localhost:8000/api/anomalies/score-telemetry `
  -H "Content-Type: application/json" `
  -d $payload
```

**Expected Response:**

```json
{
  "is_anomaly": false,
  "anomaly_score": 0.12,
  "timestamp": "2026-06-07T10:30:00Z"
}
```

**✅ PASS**: Instant response with frozen detector  
**❌ FAIL**: Slow response (model not frozen)

---

## Test 5: Dashboard Analytics (Phase 3 Indicator)

**Objective:** Verify analytics endpoint shows Phase 3 status

```bash
curl http://localhost:8000/api/analytics/summary | ConvertFrom-Json | Format-List
```

**Expected Response Includes:**

```json
{
  "series": [...],
  "kpis": {
    "spoilage_risk_pct": 4.2,
    "inventory_health_pct": 92.8,
    "avg_lead_time_days": 3.4
  },
  "phase_3_frozen": true,
  "generated_at": "2026-06-07T10:30:00Z"
}
```

**✅ PASS**: `"phase_3_frozen": true`  
**❌ FAIL**: `"phase_3_frozen": false`

---

## Test 6: Compliance Report (Phase 3 Indicator)

**Objective:** Verify compliance endpoint shows Phase 3 status

```bash
curl http://localhost:8000/api/compliance/report | ConvertFrom-Json | Format-List
```

**Expected Response:**

```json
{
  "generated_at": "2026-06-07T10:30:00Z",
  "phase_3_frozen": true,
  "sections": [...]
}
```

**✅ PASS**: `"phase_3_frozen": true`  
**❌ FAIL**: `"phase_3_frozen": false`

---

## Test 7: Multi-Drug Forecast (Ensemble Coverage)

**Objective:** Verify all drug+region ensembles are frozen

```bash
# Test different drugs
$drugs = @("Aspirin", "Ibuprofen", "Paracetamol")
$regions = @("Delhi", "Mumbai", "Bangalore")

foreach ($drug in $drugs) {
    foreach ($region in $regions) {
        try {
            $response = curl -s -X POST http://localhost:8000/api/forecast/predict `
              -H "Content-Type: application/json" `
              -d "{`"drug_id`": `"$drug`", `"region`": `"$region`", `"horizon_days`": 30}"
            
            if ($response -match '"inference_mode": "frozen_model"') {
                Write-Host "✅ $drug / $region - Frozen" -ForegroundColor Green
            } else {
                Write-Host "⚠️  $drug / $region - Runtime Training" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "❌ $drug / $region - Error" -ForegroundColor Red
        }
    }
}
```

**Expected Output:**

```
✅ Aspirin / Delhi - Frozen
✅ Aspirin / Mumbai - Frozen
✅ Ibuprofen / Delhi - Frozen
... (all frozen)
```

**✅ PASS**: All show "Frozen"  
**❌ FAIL**: Any show "Runtime Training"

---

## Test 8: Model File Verification

**Objective:** Confirm .pkl files exist on disk

```bash
# Check security detector
Test-Path "backend\ml\saved_models\security_isolation_forest.pkl"

# Count ensemble models
(Get-ChildItem "backend\ml\saved_models\*_rf.pkl" -ErrorAction SilentlyContinue | Measure-Object).Count

# Count scalers
(Get-ChildItem "backend\ml\scalers\*.pkl" -ErrorAction SilentlyContinue | Measure-Object).Count

# List all
Get-ChildItem "backend\ml\saved_models\" | Format-Table Name, Length
Get-ChildItem "backend\ml\scalers\" | Format-Table Name, Length
```

**Expected Output:**

```
True                    (security_isolation_forest.pkl exists)
12                      (12 ensemble models)
12                      (12 scalers)

backend\ml\saved_models\
Name                          Length
----                          ------
security_isolation_forest.pkl 512000
Aspirin_Delhi_rf.pkl          250000
Aspirin_Mumbai_rf.pkl         240000
... (more models)
```

**✅ PASS**: All files exist and >0 bytes  
**❌ FAIL**: Missing files or 0 bytes (freeze failed)

---

## Test 9: Fallback Behavior (Delete Models)

**Objective:** Verify graceful fallback if frozen models deleted

```bash
# Delete frozen models
Remove-Item "backend\ml\saved_models\*.pkl" -Force -ErrorAction SilentlyContinue
Remove-Item "backend\ml\scalers\*.pkl" -Force -ErrorAction SilentlyContinue

# Make a prediction (should fall back to runtime training)
$timer = [System.Diagnostics.Stopwatch]::StartNew()
curl -s -X POST http://localhost:8000/api/forecast/predict `
  -H "Content-Type: application/json" `
  -d '{"drug_id": "Aspirin", "region": "Delhi", "horizon_days": 30}' | ConvertFrom-Json
$timer.Stop()

Write-Host "Response time without frozen models: $($timer.ElapsedMilliseconds)ms"
Write-Host "(Should be slow - 500-2000ms, using runtime training)"
```

**Expected Behavior:**
- ✅ Request succeeds (doesn't crash)
- ✅ Response time increases to 500-2000ms (runtime training)
- ✅ Logs show fallback message

**✅ PASS**: Graceful fallback, system still functional  
**❌ FAIL**: Crashes or returns error

---

## Test 10: Restart and Refreeze

**Objective:** Verify Phase 3 reactivates on restart

```bash
# Restart backend
# (Stop current instance with Ctrl+C, then restart)

python -m backend.main
```

**Expected Output:**

```
✅ Pre-trained ML models detected (Phase 3 frozen)
✅ ML models frozen and cached
```

**Verify:**
```bash
curl http://localhost:8000/api/ml/status | jq '.phase_3_frozen'
# Result: true
```

**✅ PASS**: Models refrozen, Phase 3 indicator true  
**❌ FAIL**: Models not refrozen

---

## Summary Scorecard

| Test | Objective | Status | Notes |
|------|-----------|--------|-------|
| 1 | Startup with Phase 3 | ✅/⏳/❌ | Watch console logs |
| 2 | ML Status Endpoint | ✅/⏳/❌ | Check `phase_3_frozen` flag |
| 3a | Forecast Performance | ✅/⏳/❌ | Should be <100ms |
| 3b | Caching Consistency | ✅/⏳/❌ | 10 predictions, low variance |
| 4 | Anomaly Scoring | ✅/⏳/❌ | Should be instant |
| 5 | Analytics Dashboard | ✅/⏳/❌ | Check indicator |
| 6 | Compliance Report | ✅/⏳/❌ | Check indicator |
| 7 | Multi-Drug Coverage | ✅/⏳/❌ | All drugs should use frozen |
| 8 | Model Files Exist | ✅/⏳/❌ | Check .pkl files on disk |
| 9 | Fallback Behavior | ✅/⏳/❌ | Should fail gracefully |
| 10 | Restart & Refreeze | ✅/⏳/❌ | Should reactivate on restart |

**Overall Status:** All ✅ = Phase 3 Production Ready

---

## Troubleshooting Guide

### If Test 1 Fails (No Startup Freezing)

**Check data files:**
```bash
Test-Path "data\live_sensor_logs_fixed.csv"
Test-Path "data\module5_drug_consumption_history.csv"
```

**If missing, download or create test data, then:**
```bash
python -m backend.ml.train_and_freeze
```

### If Test 3 Shows Slow Performance

**Check inference mode:**
```bash
curl -s -X POST http://localhost:8000/api/forecast/predict ... | jq '.inference_mode'
# If "runtime_training", models not frozen
```

**Solution:**
```bash
# Manually freeze
python -m backend.ml.train_and_freeze

# Restart backend
python -m backend.main
```

### If Test 8 Shows Missing Files

**Check backend logs for errors:**
```
⚠️  Model freezing skipped: [error message]
```

**Common causes:**
- Data files missing or corrupted
- Out of memory (reduce horizon_days in train_and_freeze.py)
- Database connection failed (check SQL engine)

---

## Performance Baseline

| Metric | Expected | Actual |
|--------|----------|--------|
| Startup time | 5-10s | _____ |
| First prediction | <100ms | _____ |
| Avg 10 predictions | <50ms | _____ |
| Anomaly score | <10ms | _____ |
| Dashboard load | <200ms | _____ |

**Record actual times above for baseline tracking.**

---

✅ **All tests pass = Phase 3 ready for production!**
