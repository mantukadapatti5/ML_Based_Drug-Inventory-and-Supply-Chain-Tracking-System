# Drug Supply Chain Platform — Start Here

ML-based pharmaceutical inventory & supply chain tracking (5-layer architecture, Phases 1–8 complete).

## Quick start (3 commands)

```powershell
# 1. Prerequisites: Docker Desktop running, Python 3.11+
cd Jarvis\drug-supply-chain
copy .env.example .env
pip install -r backend\requirements.txt

# 2. Smoke test (no Docker)
python scripts\smoke_test.py

# 3. Full live demo
docker compose up -d --build
# New terminal:
$env:PYTHONPATH = (Get-Location)
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
# New terminal:
$env:EDGE_FORCE_BREACH = "1"   # optional — triggers AI + blockchain alert
python edge\raspberry-pi\main.py
```

Frontend: `cd frontend && npm install && npm run dev` → http://localhost:3000

## Architecture

```
Edge (Pi) → MQTT → Kafka → Consumers → PostgreSQL / MongoDB / InfluxDB
                              ↓
                         ML Anomaly → Kafka Alerts → Fabric Quarantine
                              ↓
                         WebSocket → React Dashboards (LIVE / ALERT)
                              ↓
                         GxP Audit Trail (e-signatures)
```

## Key URLs

| Service | URL |
|---------|-----|
| API + WebSocket | http://localhost:8000 |
| Health | http://localhost:8000/health |
| API docs | http://localhost:8000/docs |
| Frontend (dev) | http://localhost:3000 |

## Demo credentials

Use accounts from seed data after first API boot, or register via `/auth/register`.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts\smoke_test.py` | Offline verification (ML, Fabric, GxP) |
| `scripts\run_live_demo.ps1` | Docker + backend + edge (one script) |
| `scripts\E2E_VERIFICATION.md` | Full troubleshooting guide |

## Production notes

- Change `SECRET_KEY` and `GXP_SIGNATURE_SALT` in `.env`
- Run `backend\sql\gxp_hardening.sql` on PostgreSQL after deploy
- Set `FABRIC_CERT_PATH` / `FABRIC_KEY_PATH` for real Hyperledger
