# MongoDB Collection Schemas

## iot_events
Stores sensor and RFID events for IoT simulation.

Example document:
{
  "type": "rfid_event",
  "rfid_tag": "RFID-12345",
  "drug_id": 1,
  "location": "Warehouse A",
  "timestamp": "2026-05-06T12:00:00Z",
  "payload": {
    "temperature": 4.3,
    "humidity": 58.1,
    "latitude": 12.9716,
    "longitude": 77.5946
  }
}

Fields:
- `type`: string, one of `rfid_event`, `sensor_reading`, `gps_stream`
- `rfid_tag`: string
- `drug_id`: integer reference to drug record
- `location`: string
- `timestamp`: ISODate
- `payload`: object containing event-specific values

## notifications
Stores alerts and system messages.

Example document:
{
  "type": "alert",
  "title": "Cold chain temperature alert",
  "message": "Drug batch B001 exceeded 8°C.",
  "severity": "high",
  "target_roles": ["vendor", "admin", "distributor"],
  "created_at": "2026-05-06T12:05:00Z",
  "metadata": {
    "drug_id": 1,
    "shipment_id": "SHIP-9876"
  }
}

Fields:
- `type`: string, e.g. `alert`, `system`, `info`
- `title`: string
- `message`: string
- `severity`: string
- `target_roles`: array of strings
- `created_at`: ISODate
- `metadata`: object with optional tags and IDs
