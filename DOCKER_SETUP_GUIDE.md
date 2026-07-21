# Docker Desktop Setup Guide
# Drug Supply Chain Tracking System — Full Production Mode
# For guide submission: activates Kafka, MQTT, PostgreSQL, InfluxDB, MongoDB

## ════════════════════════════════════════════════════════════
## STEP 1 — Install Docker Desktop
## ════════════════════════════════════════════════════════════

1. Go to: https://www.docker.com/products/docker-desktop/
2. Download for Windows (your OS)
3. Run the installer — click Next all the way
4. RESTART your computer when asked (mandatory)
5. After restart, open Docker Desktop
6. Wait until you see "Docker Desktop is running" (green icon in taskbar)
7. Verify in Command Prompt:
   docker --version
   → Should show: Docker version 24.x.x or higher

## ════════════════════════════════════════════════════════════
## STEP 2 — Copy Fixed Files Before Starting Docker
## ════════════════════════════════════════════════════════════

Before running Docker, copy these files into your project:

backend/seed.py           ← from the download above (fixes M19 supplier data)
mosquitto/config/mosquitto.conf ← from the download above (fixes MQTT)

## ════════════════════════════════════════════════════════════
## STEP 3 — Create .env File (Docker environment config)
## ════════════════════════════════════════════════════════════

In your drug-supply-chain/ folder, create a file called .env
Copy this exactly:

DATABASE_URL=postgresql://jarvis_admin:SecretPassword123@localhost:5432/drug_supply_chain
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=pharma-influx-token
INFLUXDB_ORG=pharma_consortium
INFLUXDB_BUCKET=telemetry_stream
MONGODB_URL=mongodb://mongo_admin:MongoPassword123@localhost:27018/?authSource=admin
MONGO_DB=drug_supply_chain
KAFKA_SERVERS=localhost:19092
MQTT_HOST=localhost
MQTT_PORT=1883
FABRIC_MODE=mock
SECRET_KEY=drug-supply-chain-secret-2024-sih

## ════════════════════════════════════════════════════════════
## STEP 4 — Start Docker Services (infrastructure only)
## ════════════════════════════════════════════════════════════

Open Command Prompt in your drug-supply-chain/ folder:

# Start ONLY the infrastructure services (NOT backend/frontend — keep those in Python/Node)
docker compose up -d postgres influxdb mongodb redpanda mosquitto

# Wait 30 seconds for services to start, then verify:
docker compose ps

# You should see all 5 services as "running" or "healthy":
# pharma_postgres   running
# pharma_influxdb   running
# pharma_mongodb    running
# pharma_redpanda   running
# pharma_mosquitto  running

## ════════════════════════════════════════════════════════════
## STEP 5 — Start Backend (still use Python, not Docker)
## ════════════════════════════════════════════════════════════

Open a NEW Command Prompt:

cd drug-supply-chain/backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# The backend will now auto-connect to:
# PostgreSQL at localhost:5432  ✅
# InfluxDB at localhost:8086    ✅
# MongoDB at localhost:27018    ✅
# Kafka at localhost:19092      ✅
# MQTT at localhost:1883        ✅

## ════════════════════════════════════════════════════════════
## STEP 6 — Start Frontend (keep using Vite)
## ════════════════════════════════════════════════════════════

Open ANOTHER Command Prompt:

cd drug-supply-chain/frontend
npm run dev

Visit: http://localhost:3000  ← same as before, everything works

## ════════════════════════════════════════════════════════════
## STEP 7 — Verify Everything Is Live
## ════════════════════════════════════════════════════════════

Go to http://localhost:8000/health

You should see:
{
  "status": "healthy",
  "database": "postgresql",   ← was "sqlite" before
  "blockchain_mode": "mock",
  "mqtt_broker": "connected",
  "kafka": "connected"
}

## ════════════════════════════════════════════════════════════
## WHAT CHANGES AFTER DOCKER (what your guide sees as "full production")
## ════════════════════════════════════════════════════════════

| Feature              | Before Docker     | After Docker          |
|----------------------|-------------------|-----------------------|
| Database             | SQLite (file)     | PostgreSQL (real DB)  |
| IoT data store       | CSV files         | InfluxDB time-series  |
| Event streaming      | CSV simulation    | Kafka real-time       |
| MQTT sensor data     | Simulated         | Real MQTT broker      |
| MongoDB events       | Mock              | Real MongoDB          |
| Blockchain           | Mock (unchanged)  | Mock (same)           |
| All 21 UI screens    | Working           | Working (same)        |

## ════════════════════════════════════════════════════════════
## CRASH PREVENTION — What to watch out for
## ════════════════════════════════════════════════════════════

PROBLEM 1: "Error: port 5432 already in use"
CAUSE: You have PostgreSQL installed locally already
FIX: Change port in docker-compose.yml: "5433:5432" and update .env:
     DATABASE_URL=postgresql://jarvis_admin:SecretPassword123@localhost:5433/drug_supply_chain

PROBLEM 2: "redpanda health check failing" / redpanda not starting
CAUSE: Redpanda needs at least 1GB RAM available
FIX: Open Docker Desktop → Settings → Resources → Memory → set to 4GB minimum
     Then: docker compose restart redpanda

PROBLEM 3: Backend starts but shows "FATAL: database drug_supply_chain does not exist"
CAUSE: PostgreSQL started but schema not created yet
FIX: Wait 20 more seconds, then restart backend:
     Ctrl+C → python -m uvicorn main:app --reload

PROBLEM 4: "MQTT bridge disabled" in backend logs
CAUSE: mosquitto.conf has wrong path or anonymous not allowed
FIX: Make sure you copied the fixed mosquitto.conf from Step 2

PROBLEM 5: Docker Desktop says "WSL 2 installation incomplete"
CAUSE: Windows Subsystem for Linux not enabled
FIX: Open PowerShell as Administrator and run:
     wsl --install
     Restart computer, then open Docker Desktop again

## ════════════════════════════════════════════════════════════
## STOP DOCKER (when you're done for the day)
## ════════════════════════════════════════════════════════════

docker compose down

# This stops all containers but keeps your data safe.
# Next time: just run "docker compose up -d postgres influxdb mongodb redpanda mosquitto"
# and your data will still be there.

## ════════════════════════════════════════════════════════════
## EMERGENCY: If something breaks badly
## ════════════════════════════════════════════════════════════

# Nuclear reset — removes ALL Docker data and starts fresh:
docker compose down -v
docker compose up -d postgres influxdb mongodb redpanda mosquitto

# Your Python backend and React frontend are NOT affected by this.
# Only Docker containers are reset.
# Then restart backend → it will reseed the database automatically.
