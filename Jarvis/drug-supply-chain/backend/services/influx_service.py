"""InfluxDB v2 async-friendly telemetry writer for cold-chain IoT metrics."""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from ..config import settings

logger = logging.getLogger(__name__)


class InfluxTelemetryService:
    def __init__(self):
        self._client = None
        self._write_api = None
        self._query_api = None
        self._enabled = False
        self._init_client()

    def _init_client(self) -> None:
        try:
            from influxdb_client import InfluxDBClient
            from influxdb_client.client.write_api import SYNCHRONOUS

            self._client = InfluxDBClient(
                url=settings.influxdb_url,
                token=settings.influxdb_token,
                org=settings.influxdb_org,
            )
            self._write_api = self._client.write_api(write_options=SYNCHRONOUS)
            self._query_api = self._client.query_api()
            self._enabled = True
            logger.info("InfluxDB client connected: %s", settings.influxdb_url)
        except Exception as exc:
            logger.warning("InfluxDB unavailable (%s). Telemetry will be logged only.", exc)
            self._enabled = False

    @property
    def enabled(self) -> bool:
        return self._enabled

    def write_cold_chain_point(
        self,
        batch_id: str,
        temperature: float,
        humidity: Optional[float] = None,
        weight: Optional[float] = None,
        device_id: str = "mqtt-edge",
        extra_tags: Optional[Dict[str, str]] = None,
    ) -> bool:
        if not self._enabled:
            return False
        try:
            from influxdb_client import Point

            point = (
                Point("cold_chain")
                .tag("batch_id", batch_id)
                .tag("device_id", device_id)
            )
            if extra_tags:
                for k, v in extra_tags.items():
                    point = point.tag(k, str(v))
            point = point.field("temperature", float(temperature))
            if humidity is not None:
                point = point.field("humidity", float(humidity))
            if weight is not None:
                point = point.field("weight", float(weight))
            point = point.time(datetime.now(timezone.utc))

            self._write_api.write(
                bucket=settings.influxdb_bucket,
                org=settings.influxdb_org,
                record=point,
            )
            return True
        except Exception as exc:
            logger.error("InfluxDB write failed: %s", exc)
            return False

    def write_telemetry_payload(
        self,
        payload: Dict[str, Any],
        fields: Optional[Dict[str, float]] = None,
    ) -> bool:
        """Write a full IoT telemetry payload to InfluxDB (cold-chain + GPS fields)."""
        from ..utils.parsing import safe_float

        batch_id = str(payload.get("batch_id", "UNKNOWN"))
        device_id = str(payload.get("device_id", "mqtt-edge"))

        if fields is None:
            fields = {
                "temperature": safe_float(payload.get("temperature_c", payload.get("temperature"))),
                "humidity": safe_float(payload.get("humidity_pct", payload.get("humidity"))),
                "weight": safe_float(payload.get("weight_g", payload.get("weight"))),
                "latitude": safe_float(payload.get("latitude")),
                "longitude": safe_float(payload.get("longitude")),
            }

        if not self._enabled:
            return False
        try:
            from influxdb_client import Point

            point = (
                Point("truck_sensors")
                .tag("batch_id", batch_id)
                .tag("device_id", device_id)
            )
            for field_name, field_value in fields.items():
                point = point.field(field_name, float(field_value))
            point = point.time(datetime.now(timezone.utc))

            self._write_api.write(
                bucket=settings.influxdb_bucket,
                org=settings.influxdb_org,
                record=point,
            )
            return True
        except Exception as exc:
            logger.error("InfluxDB telemetry write failed: %s", exc)
            return False

    def batch_cold_chain_summary(self, batch_id: str, hours: int = 168) -> Dict[str, Any]:
        """Aggregate min/max/mean temperature and breach count for compliance PDFs."""
        if not self._enabled:
            return {
                "batch_id": batch_id,
                "min_temperature": None,
                "max_temperature": None,
                "mean_temperature": None,
                "breach_count": 0,
                "source": "unavailable",
            }
        flux = f'''
from(bucket: "{settings.influxdb_bucket}")
  |> range(start: -{hours}h)
  |> filter(fn: (r) => r["_measurement"] == "cold_chain")
  |> filter(fn: (r) => r["batch_id"] == "{batch_id}")
  |> filter(fn: (r) => r["_field"] == "temperature")
'''
        try:
            tables = self._query_api.query(flux, org=settings.influxdb_org)
            temps: List[float] = []
            breaches = 0
            for table in tables:
                for record in table.records:
                    val = float(record.get_value())
                    temps.append(val)
                    if val > 8.0:
                        breaches += 1
            if not temps:
                return {
                    "batch_id": batch_id,
                    "min_temperature": None,
                    "max_temperature": None,
                    "mean_temperature": None,
                    "breach_count": 0,
                    "source": "influxdb",
                }
            return {
                "batch_id": batch_id,
                "min_temperature": round(min(temps), 2),
                "max_temperature": round(max(temps), 2),
                "mean_temperature": round(sum(temps) / len(temps), 2),
                "breach_count": breaches,
                "source": "influxdb",
            }
        except Exception as exc:
            logger.error("InfluxDB query failed: %s", exc)
            return {
                "batch_id": batch_id,
                "min_temperature": None,
                "max_temperature": None,
                "mean_temperature": None,
                "breach_count": 0,
                "source": "error",
                "error": str(exc),
            }


influx_service = InfluxTelemetryService()
