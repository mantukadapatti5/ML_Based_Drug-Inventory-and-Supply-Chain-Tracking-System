from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

from ..services.influx_service import influx_service
from ..services.csv_fallback import csv_fallback_service

router = APIRouter(tags=["IoT Sensors"])

class IoTEventCreate(BaseModel):
    batch_id: str
    device_id: str
    event_type: str
    reading: Dict[str, Any]
    timestamp: Optional[datetime] = None

# We use mock DB here unless user explicitly sets up motor in FastAPI deps
@router.post("/iot/events")
async def ingest_iot_event(event: IoTEventCreate):
    temp = event.reading.get("temperature_c", event.reading.get("temperature", 20.0))
    humidity = event.reading.get("humidity_pct", event.reading.get("humidity"))
    influx_service.write_cold_chain_point(
        batch_id=event.batch_id,
        temperature=float(temp),
        humidity=float(humidity) if humidity is not None else None,
        device_id=event.device_id,
    )
    alerts = []
    if float(temp) > 8.0:
        alerts.append("TEMPERATURE_EXCEEDED")
    return {
        "accepted": True,
        "event_id": f"evt_{datetime.utcnow().timestamp()}",
        "alerts": alerts,
        "influx_written": influx_service.enabled,
        "inserted_at": datetime.utcnow().isoformat(),
    }

@router.get("/iot/sensors/{batch_id}/latest")
async def get_latest_sensor(batch_id: str):
    # Mock data return for dashboard
    return {
        "batch_id": batch_id,
        "device_id": "DEV001",
        "event_type": "temperature_reading",
        "reading": {
            "temperature_c": 21.5,
            "humidity_pct": 45.2,
            "battery_pct": 88
        },
        "received_at": datetime.utcnow().isoformat()
    }

@router.get("/iot/sensors/{batch_id}/history")
async def get_sensor_history(batch_id: str, hours: int = 24):
    return {
        "batch_id": batch_id,
        "history": [
            {
                "temperature_c": 21.5,
                "humidity_pct": 45.2,
                "timestamp": datetime.utcnow().isoformat()
            }
        ]
    }

@router.get("/iot/sensors/alerts/active")
async def get_active_alerts():
    return [
        {
            "id": "alt_001",
            "batch_id": "BAT001",
            "alert_type": "TEMPERATURE_EXCEEDED",
            "message": "Temperature reached 27.5°C > 25.0°C (General)",
            "severity": "High",
            "triggered_at": datetime.utcnow().isoformat()
        }
    ]

@router.put("/iot/sensors/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    return {"success": True, "message": "Alert acknowledged"}


@router.get("/iot/cold-chain/monitor")
async def cold_chain_monitor():
    """Aggregated cold-chain readings for vendor/distributor dashboards."""
    batches = ["BATCH-A01", "BATCH-I02", "BATCH-B03", "AMX-2024", "PAR-2024", "INS-2024"]
    alerts = []
    for i, batch in enumerate(batches):
        temp = round(18.0 + (i * 1.7) % 12, 1)
        humidity = round(42.0 + (i * 3.1) % 20, 1)
        status = "critical" if temp > 28 else "warning" if temp > 24 else "normal"
        alerts.append({
            "id": i + 1,
            "batch_id": batch,
            "product": f"Batch {batch}",
            "temperature": temp,
            "humidity": humidity,
            "location": ["Storage A", "Storage B", "Transit Hub"][i % 3],
            "status": status,
            "threshold_max_c": 25.0,
            "updated_at": datetime.utcnow().isoformat(),
        })
    return {"alerts": alerts, "active_breaches": sum(1 for a in alerts if a["status"] != "normal")}


# ─────────────────────────────────────────────────────────────────────
# CSV FALLBACK ENDPOINTS - Used when database is empty
# ─────────────────────────────────────────────────────────────────────

@router.get("/iot/cold-chain/monitor-fallback")
async def cold_chain_monitor_fallback(limit: int = Query(50, ge=1, le=500)):
    """
    Fallback endpoint: Returns raw IoT sensor telemetry from CSV.
    Maps to Vendor (Cold Chain) & Distributor (Cold Chain, Shipment Tracking) panels.
    """
    return csv_fallback_service.get_telemetry_data(limit)
