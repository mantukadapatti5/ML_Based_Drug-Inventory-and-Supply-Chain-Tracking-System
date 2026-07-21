"""
Edge Node Firmware Orchestrator — Raspberry Pi truck tracking unit.

Reads (simulated) sensors, buffers to SQLite when MQTT is unreachable,
and replays backlog in chronological order when connectivity returns.
"""

import json
import os
import random
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path

import paho.mqtt.client as mqtt

# --- CONFIGURATION (override via environment / .env) ---
DEVICE_ID = os.getenv("EDGE_DEVICE_ID", "pi-truck-001")
MQTT_BROKER = os.getenv("EDGE_MQTT_HOST", os.getenv("MQTT_HOST", "localhost"))
MQTT_PORT = int(os.getenv("EDGE_MQTT_PORT", os.getenv("MQTT_PORT", "1883")))
MQTT_TOPIC = f"pharma/iot/sensors/{DEVICE_ID}"
DB_FILE = Path(__file__).resolve().parent / "edge_buffer.db"
READ_INTERVAL_SEC = int(os.getenv("EDGE_READ_INTERVAL_SEC", "5"))
REPLAY_BATCH_SIZE = int(os.getenv("EDGE_REPLAY_BATCH_SIZE", "10"))
FORCE_BREACH = os.getenv("EDGE_FORCE_BREACH", "").lower() in ("1", "true", "yes")


def init_offline_buffer() -> None:
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS telemetry_buffer (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                idempotency_key TEXT UNIQUE,
                payload TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def save_to_buffer(idempotency_key: str, payload_dict: dict) -> None:
    """Persist telemetry locally when the network is down."""
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR IGNORE INTO telemetry_buffer (idempotency_key, payload) VALUES (?, ?)",
            (idempotency_key, json.dumps(payload_dict)),
        )
        conn.commit()
    except Exception as exc:
        print(f"Local storage write error on hardware layer: {exc}")
    finally:
        conn.close()


def fetch_backlog(limit: int = REPLAY_BATCH_SIZE) -> list[tuple[int, str]]:
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, payload FROM telemetry_buffer ORDER BY id ASC LIMIT ?",
            (limit,),
        )
        return cursor.fetchall()
    finally:
        conn.close()


def delete_backlog_row(row_id: int) -> None:
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM telemetry_buffer WHERE id = ?", (row_id,))
        conn.commit()
    finally:
        conn.close()


def read_sensors(sequence_num: int, current_batch: str = "BATCH-AMOX-9921") -> dict:
    """Simulate DHT22, GPS, HX711 weight, and RFID reads."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    idempotency_key = f"{DEVICE_ID}:{int(time.time())}:{sequence_num}"

    if FORCE_BREACH:
        temperature_c = round(random.uniform(9.0, 12.0), 2)
    else:
        temperature_c = round(random.uniform(3.5, 6.5), 2)

    return {
        "schema_version": "1.0.0",
        "idempotency_key": idempotency_key,
        "device_id": DEVICE_ID,
        "batch_id": current_batch,
        "timestamp_utc": timestamp,
        "temperature_c": temperature_c,
        "humidity_pct": round(random.uniform(50.0, 60.0), 2),
        "weight_g": round(random.uniform(498.0, 501.0), 1),
        "latitude": round(12.9716 + random.uniform(-0.01, 0.01), 6),
        "longitude": round(77.5946 + random.uniform(-0.01, 0.01), 6),
        "rfid_epc": "303402514000C14000000034",
        "connectivity_state": "online",
    }


def replay_backlog(client: mqtt.Client) -> int:
    backlog = fetch_backlog()
    if not backlog:
        return 0

    print(f"Network restored! Replaying {len(backlog)} backlog entries from storage cache...")
    replayed = 0
    for row_id, raw_payload in backlog:
        loaded_payload = json.loads(raw_payload)
        loaded_payload["connectivity_state"] = "replayed"
        client.publish(MQTT_TOPIC, json.dumps(loaded_payload), qos=1)
        delete_backlog_row(row_id)
        replayed += 1
    return replayed


def publish_live_reading(client: mqtt.Client, sensor_data: dict) -> None:
    print(
        f"Telemetry broadcast via MQTT -> Key: {sensor_data['idempotency_key']} "
        f"| Temp: {sensor_data['temperature_c']}C"
    )
    client.publish(MQTT_TOPIC, json.dumps(sensor_data), qos=1)


def main() -> None:
    print(f"Booting Edge Tracking System on {DEVICE_ID}...")
    print(f"MQTT target: {MQTT_BROKER}:{MQTT_PORT} topic={MQTT_TOPIC}")
    init_offline_buffer()

    sequence = 0
    client = mqtt.Client(client_id=f"edge-{DEVICE_ID}")

    while True:
        sequence += 1
        sensor_data = read_sensors(sequence)
        ikey = sensor_data["idempotency_key"]

        try:
            client.connect(MQTT_BROKER, MQTT_PORT, keepalive=10)
            replay_backlog(client)
            publish_live_reading(client, sensor_data)
            client.disconnect()
        except Exception as network_error:
            print(
                f"Offline mode triggered (network down: {network_error}). "
                f"Safely buffering event locally -> Key: {ikey}"
            )
            sensor_data["connectivity_state"] = "offline"
            save_to_buffer(ikey, sensor_data)

        time.sleep(READ_INTERVAL_SEC)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Edge node stopped.")
