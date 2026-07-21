# 5-Minute Live Demonstration Script

Use this when presenting the project to judges, faculty, or stakeholders.

## Before the demo (5 min prior)

1. `docker compose up -d` — all containers green
2. Terminal A: `python -m uvicorn backend.main:app --port 8000`
3. Terminal B: `cd frontend && npm run dev`
4. Browser: Admin login → **Anomalies** page (watch **[ LIVE ]** badge)
5. Terminal C ready: `$env:EDGE_FORCE_BREACH="1"; python edge/raspberry-pi/main.py`

## Narration + actions

| Time | Say | Do |
|------|-----|-----|
| 0:00 | "Layer 1 — our truck sends RFID, temperature, weight, and GPS every 5 seconds." | Start edge simulator (normal mode first) |
| 0:30 | "Layer 2 — MQTT feeds Redpanda Kafka so bursts never crash the database." | Point to backend log: `Forwarded IoT signal` |
| 1:00 | "Layer 3 — ML scores each reading; normal cold chain passes." | Show `Telemetry normal` in logs |
| 1:30 | "We simulate a freezer failure — temperature exceeds 8°C." | Stop edge; restart with `EDGE_FORCE_BREACH=1` |
| 2:00 | "Isolation Forest flags CRITICAL_TEMPERATURE_BREACH instantly." | Show yellow `ALERT!` in backend |
| 2:30 | "Layer 4 — Hyperledger quarantines the batch; record cannot be deleted." | Show `QUARANTINED on ledger` + tx id |
| 3:00 | "Layer 6 — dashboards flip to ALERT without refresh." | Show browser badge **[ ALERT ]** |
| 3:30 | "Layer 7 — resolving requires password + 10-character justification." | Click **E-Sign & Resolve (GxP)** |
| 4:00 | "Immutable audit hash is stored in gxp_audit_trail." | `GET /api/compliance/audit-trail` in Swagger |
| 4:30 | "System health shows all consumers active." | Admin → Health or `/health` |

## Backup if Docker fails

Run `python scripts/smoke_test.py` and show:
- ML breach detection
- Mock blockchain quarantine tx
- GxP SHA-256 signature

## One-liner summary

"We built an FDA-aligned supply chain that senses, streams, learns, locks, and logs — from Raspberry Pi to blockchain to electronic signatures."
