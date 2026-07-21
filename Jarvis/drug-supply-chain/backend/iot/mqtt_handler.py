import asyncio
import json
from datetime import datetime
import os
import pandas as pd
import paho.mqtt.client as mqtt

# Try to use motor for async MongoDB, but fallback gracefully if not configured
try:
    import motor.motor_asyncio
    HAS_MOTOR = True
except ImportError:
    HAS_MOTOR = False

MQTT_TOPICS = [
    "iot/drug/+/temperature",
    "iot/drug/+/location",
    "iot/drug/+/alerts",
    "rfid/scan/+",
]

ALERT_THRESHOLDS = {
    "temperature_general": 25.0,
    "temperature_vaccine": 8.0,
    "humidity": 75.0,
    "battery_low": 20,
    "signal_weak": -100,
}

class MQTTHandler:
    def __init__(self, broker_host: str = "localhost", broker_port: int = 1883,
                 mongo_uri: str = "mongodb://localhost:27017", simulation_mode: bool = False):
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.simulation_mode = simulation_mode
        try:
            self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, client_id="pharma_backend_subscriber")
        except AttributeError:
            self.client = mqtt.Client(client_id="pharma_backend_subscriber")
        
        self.mongo_client = None
        self.db = None
        if HAS_MOTOR:
            try:
                self.mongo_client = motor.motor_asyncio.AsyncIOMotorClient(mongo_uri)
                self.db = self.mongo_client["pharma_db"]
            except Exception as e:
                print(f"Warning: MongoDB connection failed: {e}")
                
        self.buffer = []
        self.buffer_size = 10
        self.loop = asyncio.get_event_loop()
    
    def connect(self):
        if self.simulation_mode:
            print("MQTT Handler starting in SIMULATION MODE (reading from CSV)")
            self.loop.create_task(self.run_simulation())
            return
            
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_message = self.on_message
        
        try:
            print(f"Connecting to MQTT broker at {self.broker_host}:{self.broker_port}")
            self.client.connect(self.broker_host, self.broker_port, 60)
            self.client.loop_start()
        except Exception as e:
            print(f"Failed to connect to real MQTT broker: {e}. Falling back to simulation.")
            self.simulation_mode = True
            self.loop.create_task(self.run_simulation())
    
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("Connected to MQTT Broker!")
            for topic in MQTT_TOPICS:
                self.client.subscribe(topic, qos=1)
                print(f"Subscribed to {topic}")
        else:
            print(f"Failed to connect, return code {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        if rc != 0:
            print("Unexpected MQTT disconnection. Will auto-reconnect.")
    
    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode('utf-8'))
            topic = msg.topic
            
            event_doc = self.build_event_document(topic, payload)
            self.buffer.append(event_doc)
            
            if len(self.buffer) >= self.buffer_size:
                self.flush_buffer()
        except json.JSONDecodeError:
            print(f"Failed to decode message on topic {msg.topic}")
        except Exception as e:
            print(f"Error processing message: {e}")
            
    def build_event_document(self, topic: str, payload: dict) -> dict:
        parts = topic.split('/')
        batch_id = ""
        event_type = "unknown"
        
        if "temperature" in topic:
            batch_id = parts[2]
            event_type = "temperature_reading"
        elif "location" in topic:
            batch_id = parts[2]
            event_type = "gps_update"
        elif "alerts" in topic:
            batch_id = parts[2]
            event_type = "alert"
        elif "rfid/scan" in topic:
            batch_id = payload.get("batch_id", "")
            event_type = "rfid_scan"
            
        alerts = self.check_alerts(payload)
            
        return {
            "batch_id": batch_id,
            "device_id": payload.get("device_id", "unknown"),
            "event_type": event_type,
            "topic": topic,
            "reading": payload,
            "alerts": alerts,
            "received_at": datetime.utcnow(),
            "processed": False
        }
        
    def check_alerts(self, payload: dict) -> list:
        alerts = []
        temp = payload.get("temperature_c")
        drug_type = payload.get("drug_type", "general")
        
        if temp is not None:
            if drug_type == "vaccine" and temp > ALERT_THRESHOLDS["temperature_vaccine"]:
                alerts.append(f"TEMPERATURE_EXCEEDED: {temp}°C > {ALERT_THRESHOLDS['temperature_vaccine']}°C (Vaccine)")
            elif drug_type == "general" and temp > ALERT_THRESHOLDS["temperature_general"]:
                alerts.append(f"TEMPERATURE_EXCEEDED: {temp}°C > {ALERT_THRESHOLDS['temperature_general']}°C (General)")
                
        humidity = payload.get("humidity_pct")
        if humidity is not None and humidity > ALERT_THRESHOLDS["humidity"]:
            alerts.append(f"HUMIDITY_EXCEEDED: {humidity}% > {ALERT_THRESHOLDS['humidity']}%")
            
        battery = payload.get("battery_pct")
        if battery is not None and battery < ALERT_THRESHOLDS["battery_low"]:
            alerts.append(f"BATTERY_LOW: {battery}% < {ALERT_THRESHOLDS['battery_low']}%")
            
        return alerts
        
    def flush_buffer(self):
        if not self.buffer:
            return
            
        asyncio.run_coroutine_threadsafe(self._async_flush(), self.loop)
        
    async def _async_flush(self):
        docs_to_insert = self.buffer.copy()
        self.buffer.clear()
        
        if self.db is not None:
            try:
                await self.db["iot_events"].insert_many(docs_to_insert)
                print(f"Flushed {len(docs_to_insert)} events to MongoDB")
            except Exception as e:
                print(f"Error flushing to MongoDB: {e}")
        else:
            # If no MongoDB, just print for debug
            print(f"No MongoDB connection. Simulated flush of {len(docs_to_insert)} events.")
            # For anomalies with alerts, we would normally POST to PostgreSQL here as well
            
    def disconnect(self):
        if not self.simulation_mode:
            self.client.loop_stop()
            self.client.disconnect()
            
    async def run_simulation(self):
        print("Starting CSV Simulation for IoT Data...")
        csv_path = "data/live_sensor_logs_fixed.csv"
        alt_paths = [
            "../data/live_sensor_logs_fixed.csv",
            "../../data/live_sensor_logs_fixed.csv"
        ]
        
        found_path = None
        if os.path.exists(csv_path): found_path = csv_path
        else:
            for p in alt_paths:
                if os.path.exists(p):
                    found_path = p
                    break
                    
        if not found_path:
            print("Simulation failed: live_sensor_logs_fixed.csv not found")
            return
            
        df = pd.read_csv(found_path)
        print(f"Loaded {len(df)} records for simulation")
        
        for idx, row in df.iterrows():
            # Simulate a message payload
            payload = {
                "device_id": row.get("Device_ID", f"SIM_DEV_{idx}"),
                "drug_type": row.get("Drug_Category", "general").lower(),
                "temperature_c": float(row.get("Temperature_C", 20.0)),
                "humidity_pct": float(row.get("Humidity_pct", 50.0)),
                "timestamp": datetime.utcnow().isoformat()
            }
            batch_id = row.get("Batch_ID", f"BAT{idx:04d}")
            topic = f"iot/drug/{batch_id}/temperature"
            
            event_doc = self.build_event_document(topic, payload)
            self.buffer.append(event_doc)
            
            if len(self.buffer) >= self.buffer_size:
                await self._async_flush()
                
            await asyncio.sleep(2) # 2 seconds between simulated messages

if __name__ == "__main__":
    handler = MQTTHandler(simulation_mode=True)
    handler.connect()
    
    try:
        asyncio.get_event_loop().run_forever()
    except KeyboardInterrupt:
        handler.disconnect()
