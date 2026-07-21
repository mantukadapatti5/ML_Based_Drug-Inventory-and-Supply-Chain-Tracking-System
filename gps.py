from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime, timedelta
import random
from sqlalchemy.orm import Session

from ..models.gps_tracking import GPSReading, GPSReadingCreate, GPSTrackingRepository
from ..services.security import get_db

router = APIRouter(tags=["GPS Tracking"])


def get_gps_repo(db: Session = Depends(get_db)) -> GPSTrackingRepository:
    return GPSTrackingRepository(db=db)


# Pre-built realistic India routes for demo
DEMO_ROUTES = {
    "SHIP-001": {
        "name": "Delhi → Jaipur",
        "status": "In Transit",
        "points": [
            (28.6139, 77.2090),   # Delhi
            (28.5500, 76.9800),
            (28.4200, 76.7500),
            (28.2000, 76.4500),
            (27.9000, 76.1000),
            (27.6000, 75.8000),
            (27.4000, 75.6000),
            (27.2000, 75.4000),   # Jaipur approaching
            (26.9124, 75.7873),   # Jaipur
        ],
    },
    "SHIP-002": {
        "name": "Mumbai → Pune",
        "status": "At Checkpoint",
        "points": [
            (19.0760, 72.8777),   # Mumbai
            (19.0500, 73.0000),
            (19.0000, 73.2000),
            (18.8000, 73.4000),
            (18.7000, 73.6000),
            (18.6000, 73.7000),
            (18.5204, 73.8567),   # Pune
        ],
    },
    "SHIP-003": {
        "name": "Bangalore → Chennai",
        "status": "Delivered",
        "points": [
            (12.9716, 77.5946),   # Bangalore
            (12.8000, 77.8000),
            (12.5000, 78.2000),
            (12.2000, 78.8000),
            (12.0000, 79.5000),
            (13.0827, 80.2707),   # Chennai
        ],
    },
}

_mock_seeded = False


def _build_mock_store(repo: GPSTrackingRepository):
    global _mock_seeded
    if _mock_seeded:
        return
    now = datetime.utcnow()
    for ship_id, route_data in DEMO_ROUTES.items():
        pts = route_data["points"]
        for i, (lat, lng) in enumerate(pts):
            reading = GPSReading(
                shipment_id=ship_id,
                lat=lat,
                lng=lng,
                timestamp=now - timedelta(minutes=(len(pts) - i) * 8),
                speed_kmh=round(random.uniform(55, 90), 1),
                battery_pct=max(70, 100 - i * 3),
                signal_strength_dbm=random.randint(-80, -60),
                transit_status=route_data["status"],
            )
            repo.mock_store.append(reading.dict())
    _mock_seeded = True


@router.get("/shipments/{shipment_id}/location")
async def get_shipment_location(
    shipment_id: str,
    repo: GPSTrackingRepository = Depends(get_gps_repo)
):
    """M18: Current GPS location of a shipment."""
    _build_mock_store(repo)
    latest = await repo.get_latest(shipment_id)
    if latest:
        return latest

    # Absolute fallback for any unknown shipment_id
    route = DEMO_ROUTES.get(shipment_id, DEMO_ROUTES["SHIP-001"])
    lat, lng = route["points"][-1]
    return {
        "shipment_id": shipment_id,
        "lat": lat,
        "lng": lng,
        "timestamp": datetime.utcnow().isoformat(),
        "speed_kmh": 67.5,
        "battery_pct": 85,
        "signal_strength_dbm": -72,
        "transit_status": route["status"],
    }


@router.get("/shipments/{shipment_id}/location/history")
async def get_shipment_history(
    shipment_id: str,
    from_dt: Optional[datetime] = None,
    to_dt: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 100,
    repo: GPSTrackingRepository = Depends(get_gps_repo)
):
    """M18: Full GPS trail for route polyline on map."""
    _build_mock_store(repo)
    history = await repo.get_history(shipment_id, from_dt, to_dt, page, page_size)

    # If DB and mock empty, build from DEMO_ROUTES
    if not history["readings"]:
        route = DEMO_ROUTES.get(shipment_id, DEMO_ROUTES["SHIP-001"])
        now = datetime.utcnow()
        readings = [
            {
                "shipment_id": shipment_id,
                "lat": lat,
                "lng": lng,
                "timestamp": (now - timedelta(minutes=(len(route["points"]) - i) * 8)).isoformat(),
                "speed_kmh": round(random.uniform(55, 90), 1),
                "battery_pct": max(70, 100 - i * 3),
                "signal_strength_dbm": -72,
                "transit_status": route["status"],
            }
            for i, (lat, lng) in enumerate(route["points"])
        ]
        history = {"readings": readings, "total": len(readings), "page": 1, "pages": 1}

    total_distance = repo.calculate_haversine_km(history["readings"])
    return {
        "shipment_id": shipment_id,
        "total_distance_km": round(total_distance, 2),
        "history": history,
    }


@router.post("/iot/gps-events")
async def ingest_gps_event(
    shipment_id: str,
    event: GPSReadingCreate,
    repo: GPSTrackingRepository = Depends(get_gps_repo)
):
    """M18: Ingest live GPS from MQTT/IoT devices."""
    reading = GPSReading(
        shipment_id=shipment_id,
        lat=event.lat,
        lng=event.lng,
        timestamp=datetime.utcnow(),
        speed_kmh=event.speed_kmh,
        battery_pct=event.battery_pct,
        signal_strength_dbm=event.signal_strength_dbm,
        transit_status=event.transit_status,
    )
    _id = await repo.insert_reading(reading)
    return {
        "accepted": True,
        "shipment_id": shipment_id,
        "inserted_id": _id,
        "inserted_at": datetime.utcnow().isoformat(),
    }


@router.get("/iot/events/active-shipments")
async def get_active_shipments(repo: GPSTrackingRepository = Depends(get_gps_repo)):
    """M18: Active shipment list — always returns 3 demo shipments for the ShipmentMap sidebar."""
    _build_mock_store(repo)
    db_result = await repo.get_active_shipments()

    # db_result already has fallback built in, but ensure all 3 demo routes appear
    known_ids = {s["shipment_id"] for s in db_result}
    for ship_id, route_data in DEMO_ROUTES.items():
        if ship_id not in known_ids:
            lat, lng = route_data["points"][-1]
            db_result.append({
                "shipment_id": ship_id,
                "transit_status": route_data["status"],
                "latest_lat": lat,
                "latest_lng": lng,
                "timestamp": datetime.utcnow().isoformat(),
                "route_name": route_data["name"],
            })

    return db_result
