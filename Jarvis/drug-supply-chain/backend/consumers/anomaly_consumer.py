"""Real-time ML anomaly scoring on iot.telemetry.raw → iot.alerts.coldchain."""

import asyncio
import json
import logging
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

try:
    from ..config import settings
    from ..ml.anomaly_detector import (
        calibrate_security_detector,
        score_telemetry_payload,
        security_anomaly_detector,
    )
    from ..services.mongo_service import mongo_service
    from ..utils.parsing import safe_float
except ImportError:
    _root = Path(__file__).resolve().parents[2]
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from backend.config import settings
    from backend.ml.anomaly_detector import (
        calibrate_security_detector,
        score_telemetry_payload,
        security_anomaly_detector,
    )
    from backend.services.mongo_service import mongo_service
    from backend.utils.parsing import safe_float

logger = logging.getLogger("MLAnomalyConsumer")

TELEMETRY_TOPIC = "iot.telemetry.raw"
ALERTS_TOPIC = "iot.alerts.coldchain"
CONSUMER_GROUP = "ml-anomaly-scoring-group"


class AnomalyConsumer:
    """Scores live truck telemetry with Isolation Forest and publishes security alerts."""

    def __init__(self) -> None:
        self._consumer = None
        self._producer = None
        self._enabled = False
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._engine_ready = False

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def initialize_ai_engine(self) -> None:
        if self._engine_ready and security_anomaly_detector.is_trained:
            return
        logger.info("Calibrating Isolation Forest on safe baseline data matrix...")
        calibrate_security_detector()
        self._engine_ready = True
        logger.info("ML security engine calibrated and armed.")

    def _init_kafka(self) -> None:
        try:
            from kafka import KafkaConsumer, KafkaProducer

            self._consumer = KafkaConsumer(
                TELEMETRY_TOPIC,
                bootstrap_servers=settings.kafka_bootstrap_servers,
                auto_offset_reset="latest",
                group_id=CONSUMER_GROUP,
                enable_auto_commit=True,
                value_deserializer=lambda x: json.loads(x.decode("utf-8")),
                consumer_timeout_ms=1000,
                request_timeout_ms=3000,
                connections_max_idle_ms=5000,
            )
            self._producer = KafkaProducer(
                bootstrap_servers=settings.kafka_bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
                acks="all",
                request_timeout_ms=3000,
                max_block_ms=3000,
            )
            self._enabled = True
            logger.info(
                "Anomaly consumer connected to %s (group=%s)",
                settings.kafka_bootstrap_servers,
                CONSUMER_GROUP,
            )
        except ImportError:
            logger.warning("kafka-python not installed — anomaly consumer disabled.")
        except Exception as exc:
            logger.warning("Anomaly consumer Kafka init failed (%s).", exc)

    @property
    def enabled(self) -> bool:
        return self._enabled and self._consumer is not None and self._producer is not None

    @property
    def engine_ready(self) -> bool:
        return self._engine_ready and security_anomaly_detector.is_trained

    def _emit_socket_alert(self, alert_payload: Dict[str, Any]) -> None:
        try:
            from ..services.websocket_server import realtime_broadcaster
        except ImportError:
            from backend.services.websocket_server import realtime_broadcaster

        realtime_broadcaster.schedule_alert(alert_payload)

    def process_message(self, payload: Dict[str, Any]) -> None:
        ikey = payload.get("idempotency_key", "unknown")
        assessment = score_telemetry_payload(payload)

        if assessment["is_anomaly"]:
            logger.warning(
                "ALERT! Anomaly spotted by AI! Key: %s | Reason: %s",
                ikey,
                assessment["reason"],
            )
            alert_payload = {
                "type": "alert",
                "title": assessment["reason"],
                "message": f"ML anomaly score {assessment['score']} for batch {payload.get('batch_id')}",
                "severity": "high",
                "target_roles": ["vendor", "admin", "distributor"],
                "telemetry_key": ikey,
                "device_id": payload.get("device_id"),
                "batch_id": payload.get("batch_id"),
                "reason": assessment["reason"],
                "score": assessment["score"],
                "timestamp": payload.get("timestamp_utc"),
                "ml_method": "IsolationForest",
                "metadata": {
                    "temperature_c": safe_float(
                        payload.get("temperature_c", payload.get("temperature")), 4.0
                    ),
                    "humidity_pct": safe_float(
                        payload.get("humidity_pct", payload.get("humidity")), 55.0
                    ),
                    "weight_g": safe_float(payload.get("weight_g", payload.get("weight")), 500.0),
                },
            }

            mongo_service.trigger_dashboard_notification(alert_payload)

            if self._producer:
                self._producer.send(
                    ALERTS_TOPIC,
                    key=str(ikey),
                    value=alert_payload,
                )
                self._producer.flush(timeout=5)

            self._emit_socket_alert(alert_payload)
        else:
            logger.info("Telemetry normal -> Key: %s | ML score: %s", ikey, assessment["score"])

    def _consume_loop(self) -> None:
        if not self.enabled:
            return
        logger.info("AI brain listening on %s", TELEMETRY_TOPIC)
        while self._running:
            try:
                for message in self._consumer:
                    if not self._running:
                        break
                    try:
                        self.process_message(message.value)
                    except Exception as exc:
                        key = message.value.get("idempotency_key", "unknown")
                        logger.error("ML scoring failed for %s: %s", key, exc)
            except Exception as exc:
                if self._running:
                    logger.error("Anomaly consumer loop error: %s", exc)

    def start_background(self) -> None:
        if self._thread is not None:
            return
        self.initialize_ai_engine()
        self._init_kafka()
        if not self.enabled:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._consume_loop,
            name="ml-anomaly-consumer",
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
        if self._producer is not None:
            try:
                self._producer.flush(timeout=5)
                self._producer.close(timeout=5)
            except Exception:
                pass
            self._producer = None
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None
        self._enabled = False


anomaly_consumer = AnomalyConsumer()


def run_standalone() -> None:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    logging.basicConfig(level=logging.INFO)
    consumer = AnomalyConsumer()
    consumer.initialize_ai_engine()
    consumer._init_kafka()
    if not consumer.enabled:
        raise SystemExit(
            f"Kafka unavailable — check KAFKA_SERVERS ({settings.kafka_bootstrap_servers})."
        )
    consumer._running = True
    logger.info("ML anomaly consumer running (standalone)...")
    try:
        for message in consumer._consumer:
            consumer.process_message(message.value)
    except KeyboardInterrupt:
        logger.info("ML anomaly consumer stopped.")


if __name__ == "__main__":
    run_standalone()
