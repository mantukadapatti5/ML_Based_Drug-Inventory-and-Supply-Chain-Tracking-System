# End-to-End Live Verification Guide

## Prerequisites

1. **Docker Desktop** running (Linux engine)
2. **Python 3.11+** with dependencies: `pip install -r backend/requirements.txt`
3. **Node 20+** (optional, for React): `cd frontend && npm install && npm run dev`
4. Copy env: `copy .env.example .env` (Windows) or `cp .env.example .env`

---

## Important: Terminal 2 + 3 consolidation

The unified FastAPI app (`uvicorn backend.main:app`) already starts:

- MQTT bridge → Kafka
- Telemetry consumer
- ML anomaly consumer
- Fabric gateway consumer
- WebSocket broadcaster (`/ws`)
- Outbox relay

You do **not** need separate `websocket_server.py` (no standalone entrypoint).  
Use **either** uvicorn **or** manual consumers—not both (duplicate Kafka groups will fight).

---

## Recommended: 3-terminal flow

### Terminal 1 — Infrastructure

```powershell
cd Jarvis\drug-supply-chain
docker compose down -v
docker compose up -d --build
```

Wait ~20 seconds, then verify:

```powershell
docker compose ps
curl http://localhost:8000/health
```

(Health works after Terminal 2 starts.)

### Terminal 2 — Backend (brain + WebSocket)

```powershell
cd Jarvis\drug-supply-chain
$env:PYTHONPATH = (Get-Location)
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Expect log lines: `MQTT bridge started`, `Telemetry consumer`, `ML security engine`, `Fabric gateway`, `Socket.IO`.

### Terminal 3 — Truck simulator

**Normal readings (cold chain OK):**

```powershell
cd Jarvis\drug-supply-chain
$env:EDGE_MQTT_HOST = "localhost"
python edge/raspberry-pi/main.py
```

**Force temperature breach (demo):**

```powershell
$env:EDGE_FORCE_BREACH = "1"
python edge/raspberry-pi/main.py
```

### Terminal 4 (optional) — React dashboards

```powershell
cd Jarvis\drug-supply-chain\frontend
npm run dev
```

Open http://localhost:3000 → Admin → Anomalies. Status badge should show **[ LIVE ]**, then **[ ALERT ]** on breach.

---

## Alternative: 4-terminal manual mode

Only if you are **not** running uvicorn:

| Terminal | Command |
|----------|---------|
| 1 | `docker compose up -d` |
| 2a | `python backend/iot/mqtt_bridge.py` |
| 2b | `python backend/consumers/telemetry_consumer.py` |
| 2c | `python backend/consumers/anomaly_consumer.py` |
| 2d | `python backend/consumers/fabric_gateway_consumer.py` |
| 3 | `python -m uvicorn backend.main:app --port 8000` *(WebSocket only needs ASGI)* |
| 4 | `python edge/raspberry-pi/main.py` |

---

## One-command demo script

```powershell
.\scripts\run_live_demo.ps1
```

With forced breach:

```powershell
.\scripts\run_live_demo.ps1 -Breach
```

---

## Chain reaction checklist

| Step | Where to look | Expected |
|------|---------------|----------|
| 1 | Edge terminal | `Telemetry broadcast via MQTT` |
| 2 | Backend logs | `Forwarded IoT signal` (MQTT bridge) |
| 3 | Backend logs | `Processing telemetry fingerprint` |
| 4 | Backend logs | `Telemetry normal` OR `ALERT! Anomaly` |
| 5 | Backend logs | `CRITICAL COMPLIANCE LOCKED` (on breach) |
| 6 | Browser Admin | Badge **[ ALERT ]** |
| 7 | `curl localhost:8000/health` | `"gxp_compliance": true` |

---

## PostgreSQL GxP hardening (after first boot)

```powershell
Get-Content backend\sql\gxp_hardening.sql | docker exec -i pharma_postgres psql -U jarvis_admin -d drug_supply_chain
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `dockerDesktopLinuxEngine` not found | Start **Docker Desktop** |
| `Connection refused` on 19092 | `docker compose up -d redpanda` |
| `Connection refused` on 1883 | `docker compose up -d mosquitto` |
| No Kafka messages | Ensure `mqtt_bridge` is running |
| CORS / WebSocket fail | Use Vite proxy (`npm run dev`) not raw port 3000 without proxy |
| Duplicate consumer lag | Stop uvicorn OR stop manual consumers—not both |
