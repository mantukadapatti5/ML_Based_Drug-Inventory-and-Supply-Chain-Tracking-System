"""MQTT → Redpanda bridge: receives edge telemetry and publishes to iot.telemetry.raw only."""

import json
import logging
import sys
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import paho.mqtt.client as mqtt

try:
    from ..config import settings
except ImportError:
    _root = Path(__file__).resolve().parents[2]
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from backend.config import settings

logger = logging.getLogger("MQTTBridge")

TELEMETRY_TOPIC = "iot.telemetry.raw"
MQTT_SUBSCRIBE_PATTERN = "pharma/iot/sensors/#"


class MqttBridge:
    """Listens on Mosquitto and forwards payloads to the Kafka-compatible event bus."""

    def __init__(self) -> None:
        self.broker_host = settings.mqtt_broker_host
        self.broker_port = settings.mqtt_broker_port
        self._producer = None
        self._enabled = False
        try:
            self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, client_id="pharma-mqtt-bridge")
        except AttributeError:
            self._client = mqtt.Client(client_id="pharma-mqtt-bridge")
        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message
        self._thread: Optional[threading.Thread] = None
        self._running = False
        # NOTE: producer init is deferred to start_background() to avoid blocking import

    def _init_producer(self) -> None:
        try:
            from kafka import KafkaProducer

            self._producer = KafkaProducer(
                bootstrap_servers=settings.kafka_bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
                acks="all",
                retries=3,
                request_timeout_ms=3000,
                max_block_ms=3000,
            )
            self._enabled = True
            logger.info(
                "MQTT bridge connected to Kafka at %s (MQTT %s:%s)",
                settings.kafka_bootstrap_servers,
                self.broker_host,
                self.broker_port,
            )
        except ImportError:
            logger.warning("kafka-python not installed — MQTT bridge disabled.")
        except Exception as exc:
            logger.warning("Kafka producer unavailable (%s). MQTT bridge disabled.", exc)

    @property
    def enabled(self) -> bool:
        return self._enabled and self._producer is not None

    @staticmethod
    def _ensure_idempotency_key(payload: Dict[str, Any], device_id: str) -> str:
        existing = payload.get("idempotency_key")
        if existing:
            return str(existing)
        timestamp = payload.get("timestamp_utc") or datetime.now(timezone.utc).isoformat()
        return f"{device_id}:{timestamp}:{uuid.uuid4().hex[:8]}"

    def _on_connect(self, client, userdata, flags, rc) -> None:
        logger.info("MQTT bridge connected rc=%s; subscribing %s", rc, MQTT_SUBSCRIBE_PATTERN)
        client.subscribe(MQTT_SUBSCRIBE_PATTERN)

    def _on_message(self, client, userdata, msg) -> None:
        if not self.enabled:
            return
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            device_id = str(payload.get("device_id", "unknown_device"))
            payload["device_id"] = device_id
            payload["mqtt_topic"] = msg.topic
            payload["bridge_received_at"] = datetime.now(timezone.utc).isoformat()
            payload["idempotency_key"] = self._ensure_idempotency_key(payload, device_id)

            future = self._producer.send(
                TELEMETRY_TOPIC,
                key=device_id,
                value=payload,
            )
            future.get(timeout=10)
            logger.info("Forwarded IoT signal from device %s to %s", device_id, TELEMETRY_TOPIC)
        except json.JSONDecodeError as exc:
            logger.error("Invalid MQTT JSON on topic %s: %s", msg.topic, exc)
        except Exception as exc:
            logger.error("Error routing MQTT message to Redpanda: %s", exc)

    def _mqtt_loop(self) -> None:
        try:
            self._client.connect(self.broker_host, self.broker_port, 60)
            self._client.loop_forever()
        except Exception as exc:
            logger.warning(
                "MQTT broker unavailable at %s:%s (%s). Bridge idle.",
                self.broker_host,
                self.broker_port,
                exc,
            )

    def start_background(self) -> None:
        if self._thread is not None:
            return
        self._init_producer()
        if not self.enabled:
            return
        self._running = True
        self._thread = threading.Thread(target=self._mqtt_loop, name="mqtt-bridge", daemon=True)
        self._thread.start()
        logger.info("MQTT bridge started on %s:%s", self.broker_host, self.broker_port)

    def stop(self) -> None:
        self._running = False
        try:
            self._client.disconnect()
        except Exception:
            pass
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None
        if self._producer is not None:
            try:
                self._producer.flush(timeout=5)
                self._producer.close(timeout=5)
            except Exception:
                pass
            self._producer = None


mqtt_bridge = MqttBridge()


def run_standalone() -> None:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    logging.basicConfig(level=logging.INFO)
    logger.info("Starting IoT Bridge service (standalone)...")
    bridge = MqttBridge()
    if not bridge.enabled:
        raise SystemExit(
            f"Kafka producer unavailable — check KAFKA_SERVERS ({settings.kafka_bootstrap_servers}) "
            "and ensure Redpanda is running (docker compose up -d redpanda)."
        )
    bridge._client.connect(bridge.broker_host, bridge.broker_port, 60)
    bridge._client.subscribe(MQTT_SUBSCRIBE_PATTERN)
    bridge._client.loop_forever()


if __name__ == "__main__":
    run_standalone()
