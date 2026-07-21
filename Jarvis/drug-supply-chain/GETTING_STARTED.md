# Drug Supply Chain Platform - Getting Started Guide

## Welcome! 👋

This platform implements a complete drug supply chain with **three integrated phases**:

1. **Phase 1: Database Persistence** - Stores data reliably across restarts
2. **Phase 2: Blockchain Ledger** - Immutable record of all transactions
3. **Phase 3: ML Predictions** - Instant forecasts and anomaly detection

---

## Quick Start (5 minutes)

### 1. Start the Backend

```bash
cd C:\Users\Mahanthesh V K\OneDrive\Desktop\Dummy\Jarvis\drug-supply-chain
.\.venv\Scripts\Activate.ps1
python -m backend.main
```

**Watch for:**
```
✅ Pre-trained ML models detected (Phase 3 frozen)
✅ ML models frozen and cached
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 2. Test the API

```bash
# Check status (all phases)
curl http://localhost:8000/api/ml/status

# Try a forecast prediction
curl -X POST http://localhost:8000/api/forecast/predict \
  -H "Content-Type: application/json" \
  -d '{"drug_id": "Aspirin", "region": "Delhi", "horizon_days": 30}'
```

✅ **Done!** All three phases now running.

---

## What Each Phase Does

### Phase 1: Database (Data Storage)
- Stores users, drugs, orders, sales
- Tracks anomalies and cold chain compliance
- Persists GPS coordinates for shipments
- **Automatically started** when backend starts

**Test it:**
```bash
curl http://localhost:8000/api/analytics/summary
# Response: Real-time stats from database
```

### Phase 2: Blockchain (Immutable Records)
- Records all critical transactions to Hyperledger Fabric
- Supports mock mode (testing) or production mode (real network)
- Enables compliance auditing (DSCSA, CDSCO, Part 11)

**Test it:**
```bash
curl -X POST http://localhost:8000/api/blockchain/quarantine \
  -H "Content-Type: application/json" \
  -d '{
    "drug_id": "ASPIRIN-001",
    "reason": "Temperature alert",
    "batch_id": "BATCH-2026-001"
  }'
# Response: Transaction recorded to blockchain
```

### Phase 3: ML Pipeline (Predictions)
- Forecasts demand for any drug+region
- Detects anomalies in temperature/humidity sensors
- Pre-trained models for sub-millisecond predictions
- **Automatically freezes models at startup**

**Test it:**
```bash
curl -X POST http://localhost:8000/api/forecast/predict \
  -H "Content-Type: application/json" \
  -d '{
    "drug_id": "Aspirin",
    "region": "Delhi",
    "horizon_days": 30
  }'
# Response: ~50 predictions for next 30 days in <50ms
```

---

## Documentation by Use Case

### "I want to understand the database schema"
→ Read: [START_HERE.md](START_HERE.md)

### "I want to know all features implemented"
→ Read: [MODULE_QUICK_REFERENCE.md](MODULE_QUICK_REFERENCE.md)

### "I want to set up Phase 2 (Blockchain)"
→ Read: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

### "I want quick Phase 3 reference"
→ Read: [PHASE3_QUICK_START.md](PHASE3_QUICK_START.md)

### "I want comprehensive Phase 3 details"
→ Read: [PHASE3_SUMMARY.md](PHASE3_SUMMARY.md)

### "I want to test everything end-to-end"
→ Read: [PHASE3_E2E_TESTING.md](PHASE3_E2E_TESTING.md)

### "I want to see all phases integrated"
→ Read: [ALL_PHASES_INTEGRATED.md](ALL_PHASES_INTEGRATED.md)

### "I need command reference for Phase 3"
→ Read: [PHASE3_COMMANDS.md](PHASE3_COMMANDS.md)

### "I'm having issues"
→ Check: Troubleshooting section below

---

## Common Tasks

### Check if Phase 3 is Working

```bash
curl http://localhost:8000/api/ml/status | jq '.phase_3_frozen'
# Result: true (working) or false (needs fixing)
```

### View Database Statistics

```bash
curl http://localhost:8000/api/analytics/summary | jq '.'
```

### Make a Drug Prediction

```bash
curl -X POST http://localhost:8000/api/forecast/predict \
  -H "Content-Type: application/json" \
  -d '{
    "drug_id": "Ibuprofen",
    "region": "Mumbai",
    "horizon_days": 7
  }'
```

### Check an Anomaly

```bash
curl -X POST http://localhost:8000/api/anomalies/score-telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 28.5,
    "humidity": 70.0,
    "weight": 49.8
  }'
```

### See Compliance Status

```bash
curl http://localhost:8000/api/compliance/report | jq '.sections'
```

---

## Architecture Overview

```
Your API Requests
        │
        ▼
┌──────────────────────────────────────┐
│  FastAPI Backend (Port 8000)         │
│                                      │
│  Phase 1: Database Layer             │
│  (SQLAlchemy ORM, PostgreSQL/SQLite) │
│        │                             │
│        ▼                             │
│  Phase 2: Blockchain Layer           │
│  (Hyperledger Fabric, Mock/Live)     │
│        │                             │
│        ▼                             │
│  Phase 3: ML Inference               │
│  (Pre-trained models, <50ms)         │
│                                      │
└──────────────────────────────────────┘
        │
        ▼
  JSON Responses (with Phase 3 indicators)
```

---

## Performance Expectations

| Operation | Time | Powered By |
|-----------|------|-----------|
| User registration | ~100ms | Phase 1 (DB) |
| Database query | ~20ms | Phase 1 (DB) |
| Blockchain record (mock) | <5ms | Phase 2 (Fabric mock) |
| Blockchain record (production) | ~800ms | Phase 2 (Fabric network) |
| Demand forecast | ~15ms | Phase 3 (frozen model) |
| Anomaly score | ~10ms | Phase 3 (frozen detector) |
| Dashboard stats | ~50ms | Phase 1 (DB) + Phase 3 |

---

## Troubleshooting

### "Backend won't start"

```bash
# Check if venv activated
echo $env:VIRTUAL_ENV  # Should show path to .venv

# If not activated:
.\.venv\Scripts\Activate.ps1

# Try again:
python -m backend.main
```

### "Predictions are slow (>500ms)"

```bash
# Check if Phase 3 is active
curl http://localhost:8000/api/ml/status | jq '.phase_3_frozen'

# If false, manually freeze models:
python -m backend.ml.train_and_freeze

# Restart backend:
python -m backend.main
```

### "Database errors"

```bash
# Check if data files exist:
Test-Path "data\live_sensor_logs_fixed.csv"
Test-Path "data\module5_drug_consumption_history.csv"

# If missing, backend will use mock data (still works)
```

### "Blockchain connection fails"

```bash
# Ensure Docker Desktop is running
# Verify Phase 2 setup:
# Read: IMPLEMENTATION_SUMMARY.md

# For now, use mock mode (default):
# Predictions and database work fine without blockchain
```

---

## Key Endpoints

### Status & Monitoring
- `GET /api/ml/status` - Check all phases status
- `GET /api/analytics/summary` - Dashboard statistics
- `GET /api/compliance/report` - Compliance status

### Predictions
- `POST /api/forecast/predict` - Demand forecast
- `POST /api/anomalies/score-telemetry` - Anomaly detection

### Transactions
- `POST /api/blockchain/quarantine` - Record quarantine event
- `GET /api/blockchain/status` - Blockchain status

### Authentication
- `POST /auth/register` - Create user account
- `POST /auth/login` - User login

---

## Environment Variables

To customize behavior, set these environment variables:

```bash
# Phase 2: Blockchain mode
$env:FABRIC_MODE = "mock"        # (default) or "production"

# Phase 2: Blockchain network
$env:FABRIC_CHANNEL = "drugchannel"
$env:FABRIC_CHAINCODE = "drug_provenance"

# Phase 1: Database
$env:DATABASE_URL = "sqlite:///./db.sqlite"  # (default) or PostgreSQL URL
```

**Example - Use Production Fabric:**
```bash
$env:FABRIC_MODE = "production"
python -m backend.main
```

---

## File Organization

```
Jarvis/
└── drug-supply-chain/
    ├── backend/                    (Phase 1: DB, Phase 2: Blockchain, Phase 3: ML)
    │   ├── models/                (15 SQLAlchemy models)
    │   ├── routes/                (API endpoints)
    │   ├── services/              (ml_service, fabric_client)
    │   ├── ml/                    (Anomaly detector, forecasters)
    │   │   ├── saved_models/      (Phase 3: Frozen .pkl files)
    │   │   ├── scalers/           (Phase 3: Feature scalers)
    │   │   └── train_and_freeze.py (Phase 3: Model freezing)
    │   ├── database.py            (DB connection)
    │   ├── config.py              (Settings, env vars)
    │   └── main.py                (FastAPI app + Phase startup)
    │
    ├── blockchain/                (Phase 2: Fabric setup)
    │   └── chaincode/
    │       └── drug_provenance.go (Chaincode implementation)
    │
    ├── data/                      (Input CSV files)
    │   ├── live_sensor_logs_fixed.csv
    │   └── module5_drug_consumption_history.csv
    │
    ├── START_HERE.md              (First read)
    ├── PHASE3_QUICK_START.md      (Phase 3 overview)
    ├── PHASE3_SUMMARY.md          (Phase 3 detailed)
    ├── ALL_PHASES_INTEGRATED.md   (How they work together)
    └── docker-compose.yml         (Kafka, Mosquitto, other services)
```

---

## Next Steps

1. **Start backend:** `python -m backend.main`
2. **Test predictions:** `curl -X POST http://localhost:8000/api/forecast/predict ...`
3. **Check status:** `curl http://localhost:8000/api/ml/status`
4. **Read Phase 3 guide:** [PHASE3_QUICK_START.md](PHASE3_QUICK_START.md)
5. **Run full tests:** See [PHASE3_E2E_TESTING.md](PHASE3_E2E_TESTING.md)

---

## Support

- **Database issues?** → See START_HERE.md
- **Blockchain issues?** → See IMPLEMENTATION_SUMMARY.md
- **ML/Performance issues?** → See PHASE3_SUMMARY.md
- **Integration issues?** → See ALL_PHASES_INTEGRATED.md
- **Command reference?** → See PHASE3_COMMANDS.md

---

✅ **You're all set! Backend is ready to use.**

Start with: `python -m backend.main`
