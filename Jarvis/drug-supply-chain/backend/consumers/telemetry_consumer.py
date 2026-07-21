"""Kafka telemetry consumer: reads iot.telemetry.raw and persists to MongoDB + InfluxDB."""

import asyncio
import json
import logging
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from ..config import settings
    from ..services.influx_service import influx_service
    from ..services.mongo_service import mongo_service
    from ..utils.parsing import optional_float, safe_float
except ImportError:
    _root = Path(__file__).resolve().parents[2]
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from backend.config import settings
    from backend.services.influx_service import influx_service
    from backend.services.mongo_service import mongo_service
    from backend.utils.parsing import optional_float, safe_float

logger = logging.getLogger("TelemetryConsumer")

TELEMETRY_TOPIC = "iot.telemetry.raw"
CONSUMER_GROUP = "ingestion-worker-group"


def extract_sensor_fields(payload: Dict[str, Any]) -> Dict[str, float]:
    """Bulletproof field extraction — protects the consumer from malformed payloads."""
    return {
        "temperature": safe_float(payload.get("temperature_c", payload.get("temperature"))),
        "humidity": safe_float(payload.get("humidity_pct", payload.get("humidity"))),
        "weight": safe_float(payload.get("weight_g", payload.get("weight"))),
        "latitude": safe_float(payload.get("latitude")),
        "longitude": safe_float(payload.get("longitude")),
    }


class TelemetryConsumer:
    """Pulls telemetry off the conveyor belt and files it into time-series and document stores."""

    def __init__(self) -> None:
        self._consumer = None
        self._enabled = False
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def _init_consumer(self) -> None:
        try:
            from kafka import KafkaConsumer

            self._consumer = KafkaConsumer(
                TELEMETRY_TOPIC,
                bootstrap_servers=settings.kafka_bootstrap_servers,
                auto_offset_reset="earliest",
                group_id=CONSUMER_GROUP,
                enable_auto_commit=True,
                value_deserializer=lambda x: json.loads(x.decode("utf-8")),
                consumer_timeout_ms=1000,
                request_timeout_ms=3000,
                connections_max_idle_ms=5000,
            )
            self._enabled = True
            logger.info(
                "Telemetry consumer connected to %s on topic %s",
                settings.kafka_bootstrap_servers,
                TELEMETRY_TOPIC,
            )
        except ImportError:
            logger.warning("kafka-python not installed — telemetry consumer disabled.")
        except Exception as exc:
            logger.warning("Kafka consumer unavailable (%s). Telemetry consumer disabled.", exc)

    @property
    def enabled(self) -> bool:
        return self._enabled and self._consumer is not None

    def _build_alerts(self, payload: Dict[str, Any]) -> List[Dict[str, str]]:
        alerts: List[Dict[str, str]] = []
        temp = optional_float(payload.get("temperature_c", payload.get("temperature")))
        weight = optional_float(payload.get("weight_g", payload.get("weight")))

        if temp is not None and temp > 8.0:
            alerts.append(
                {
                    "type": "TEMP_BREACH",
                    "msg": f"Critical Temp: {temp}°C",
                    "severity": "High",
                }
            )
        if weight is not None and weight < 10.0:
            alerts.append(
                {
                    "type": "LOW_VOLUME",
                    "msg": f"Critical Volume: {weight}g",
                    "severity": "High",
                }
            )
        return alerts

    def _emit_realtime(self, payload: Dict[str, Any], alerts: List[Dict[str, str]]) -> None:
        try:
            from ..services.websocket_server import realtime_broadcaster
        except ImportError:
            from backend.services.websocket_server import realtime_broadcaster

        try:
            realtime_broadcaster.schedule_sensor_update(payload)
            batch_id = str(payload.get("batch_id", "UNKNOWN"))
            temp = optional_float(payload.get("temperature_c", payload.get("temperature")))
            weight = optional_float(payload.get("weight_g", payload.get("weight")))

            for alert in alerts:
                realtime_broadcaster.schedule_alert(
                    {
                        "batch_id": batch_id,
                        "reason": alert["type"],
                        "title": alert["msg"],
                        "message": alert["msg"],
                        "severity": alert["severity"].lower(),
                        "score": temp if alert["type"] == "TEMP_BREACH" else weight,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "telemetry_key": payload.get("idempotency_key"),
                        "device_id": payload.get("device_id"),
                    }
                )
        except Exception as exc:
            logger.error("Realtime emit failed: %s", exc)

    def process_message(self, payload: Dict[str, Any]) -> None:
        idempotency_key = payload.get("idempotency_key")

        if mongo_service.is_already_processed(idempotency_key):
            logger.warning("Duplicate message ignored! Key: %s", idempotency_key)
            return

        logger.info("Processing telemetry fingerprint: %s", idempotency_key)

        fields = extract_sensor_fields(payload)
        payload["_parsed_fields"] = fields

        mongo_service.log_raw_iot_payload(payload)
        influx_service.write_telemetry_payload(payload, fields=fields)

        alerts = self._build_alerts(payload)
        if alerts:
            for alert in alerts:
                mongo_service.trigger_dashboard_notification(
                    {
                        "type": "alert",
                        "title": alert["type"],
                        "message": alert["msg"],
                        "severity": alert["severity"].lower(),
                        "target_roles": ["vendor", "admin", "distributor"],
                        "metadata": {
                            "batch_id": payload.get("batch_id"),
                            "device_id": payload.get("device_id"),
                            "idempotency_key": idempotency_key,
                        },
                    }
                )

        self._emit_realtime(payload, alerts)
        logger.info("Stored telemetry for key: %s", idempotency_key)

    def _consume_loop(self) -> None:
        if not self.enabled:
            return
        logger.info("Telemetry consumer listening on %s", TELEMETRY_TOPIC)
        while self._running:
            try:
                for message in self._consumer:
                    if not self._running:
                        break
                    try:
                        self.process_message(message.value)
                    except Exception as exc:
                        key = message.value.get("idempotency_key", "unknown")
                        logger.error("Failed to process telemetry block %s: %s", key, exc)
            except Exception as exc:
                if self._running:
                    logger.error("Telemetry consumer loop error: %s", exc)

    def start_background(self) -> None:
        if self._thread is not None:
            return
        self._init_consumer()
        if not self.enabled:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._consume_loop,
            name="telemetry-consumer",
            daemon=True,
        )
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._consumer is not None:
            try:
                self._consumer.close()
            except Exception:
                pass
            self._consumer = None
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None
        self._enabled = False


telemetry_consumer = TelemetryConsumer()


def run_standalone() -> None:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    logging.basicConfig(level=logging.INFO)
    consumer = TelemetryConsumer()
    consumer._init_consumer()
    if not consumer.enabled:
        raise SystemExit(
            f"Kafka consumer unavailable — check KAFKA_SERVERS ({settings.kafka_bootstrap_servers}) "
            "and ensure Redpanda is running (docker compose up -d redpanda)."
        )
    consumer._running = True
    logger.info("Telemetry processing worker booting up (standalone)...")
    try:
        for message in consumer._consumer:
            consumer.process_message(message.value)
    except KeyboardInterrupt:
        logger.info("Telemetry consumer stopped.")


if __name__ == "__main__":
    run_standalone()
