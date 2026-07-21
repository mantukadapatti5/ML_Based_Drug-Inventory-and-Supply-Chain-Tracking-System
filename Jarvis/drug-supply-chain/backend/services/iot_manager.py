"""Real-time Socket.IO server for portal dashboards (telemetry is handled by mqtt_bridge + consumer)."""

import logging

import socketio

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
sio_app = socketio.ASGIApp(sio)


class IoTManager:
    """Legacy facade kept for Socket.IO mounting; MQTT ingestion moved to mqtt_bridge."""

    def set_event_loop(self, loop) -> None:
        pass

    def start_background(self) -> None:
        logger.info("Socket.IO realtime server ready at /ws")

    def stop(self) -> None:
        pass


iot_manager = IoTManager()
