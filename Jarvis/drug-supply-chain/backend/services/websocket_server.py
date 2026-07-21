"""Kafka → Socket.IO broadcaster for live portal dashboards (mounted at /ws on FastAPI)."""

import asyncio
import json
import logging
import threading
from typing import Any, Dict, Optional
from urllib.parse import parse_qs

from ..config import settings
from .iot_manager import sio

logger = logging.getLogger("WebSocketBroadcaster")

ALERTS_TOPIC = "iot.alerts.coldchain"
CONSUMER_GROUP = "websocket-broadcaster-group"

ROLE_ROOMS = {
    "admin": "admin_room",
    "vendor": "vendor_room",
    "distributor": "distributor_room",
    "regulator": "admin_room",
}


class WebSocketBroadcaster:
    """Pushes pipeline events to browser clients via Socket.IO rooms."""

    def __init__(self) -> None:
        self._consumer = None
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._handlers_registered = False

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def register_handlers(self) -> None:
        if self._handlers_registered:
            return

        @sio.event
        async def connect(sid, environ, auth=None):
            role = "admin"
            if auth and isinstance(auth, dict) and auth.get("role"):
                role = str(auth["role"]).lower()
            else:
                query = environ.get("QUERY_STRING", "") if environ else ""
                params = parse_qs(query)
                if "role" in params and params["role"]:
                    role = params["role"][0].lower()

            room = ROLE_ROOMS.get(role, "admin_room")
            await sio.enter_room(sid, room)
            await sio.enter_room(sid, "all_portals")
            logger.info("Dashboard client connected sid=%s role=%s room=%s", sid, role, room)
            await sio.emit("connection_ack", {"status": "connected", "room": room, "role": role}, to=sid)

        @sio.event
        async def disconnect(sid):
            logger.info("Dashboard client disconnected sid=%s", sid)

        self._handlers_registered = True
        logger.info("Socket.IO portal handlers registered (CORS open)")

    def _init_kafka_consumer(self) -> bool:
        try:
            from kafka import KafkaConsumer

            self._consumer = KafkaConsumer(
                ALERTS_TOPIC,
                bootstrap_servers=settings.kafka_bootstrap_servers,
                auto_offset_reset="latest",
                group_id=CONSUMER_GROUP,
                enable_auto_commit=True,
                value_deserializer=lambda x: json.loads(x.decode("utf-8")),
                consumer_timeout_ms=1000,
                request_timeout_ms=3000,
                connections_max_idle_ms=5000,
            )
        except Exception as exc:
            logger.warning("WebSocket Kafka bridge unavailable (%s).", exc)
            return False

    async def emit_alert(self, alert_payload: Dict[str, Any]) -> None:
        """Broadcast ML / cold-chain alerts to all portal rooms."""
        telemetry_key = alert_payload.get("telemetry_key", alert_payload.get("idempotency_key"))
        logger.info("Forwarding event over WebSockets: %s", telemetry_key)

        legacy_payload = {
            "batch_id": alert_payload.get("batch_id"),
            "issue": alert_payload.get("reason") or alert_payload.get("title"),
            "value": alert_payload.get("score"),
            "timestamp": alert_payload.get("timestamp"),
            "source": alert_payload.get("ml_method", "pipeline"),
        }

        for room in ("admin_room", "vendor_room", "distributor_room", "all_portals"):
            await sio.emit("new_anomaly_alert", alert_payload, room=room)
            await sio.emit("new_anomaly", legacy_payload, room=room)

    async def emit_sensor_update(self, payload: Dict[str, Any]) -> None:
        await sio.emit("sensor_update", payload, room="all_portals")
        await sio.emit("sensor_update", payload, room="vendor_room")
        await sio.emit("sensor_update", payload, room="distributor_room")

    async def emit_batch_quarantined(self, payload: Dict[str, Any]) -> None:
        await sio.emit("batch_quarantined", payload, room="all_portals")
        for room in ("admin_room", "vendor_room", "distributor_room"):
            await sio.emit("batch_quarantined", payload, room=room)

    def schedule_alert(self, alert_payload: Dict[str, Any]) -> None:
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self.emit_alert(alert_payload), self._loop)

    def schedule_sensor_update(self, payload: Dict[str, Any]) -> None:
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self.emit_sensor_update(payload), self._loop)

    def schedule_quarantine(self, payload: Dict[str, Any]) -> None:
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self.emit_batch_quarantined(payload), self._loop)

    def _kafka_bridge_loop(self) -> None:
        if not self._consumer:
            return
        logger.info("WebSocket broadcaster engine active on topic %s", ALERTS_TOPIC)
        while self._running:
            try:
                for message in self._consumer:
                    if not self._running:
                        break
                    self.schedule_alert(message.value)
            except Exception as exc:
                if self._running:
                    logger.error("WebSocket Kafka bridge error: %s", exc)

    def start_background(self) -> None:
        if self._thread is not None:
            return
        self.register_handlers()
        if not self._init_kafka_consumer():
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._kafka_bridge_loop,
            name="websocket-kafka-bridge",
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


realtime_broadcaster = WebSocketBroadcaster()
