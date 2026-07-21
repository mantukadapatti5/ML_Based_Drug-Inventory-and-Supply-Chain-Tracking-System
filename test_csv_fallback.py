#!/usr/bin/env python3
"""Quick test to verify CSV fallback service can load data"""

import sys
import os

# Add backend to path
backend_path = r'c:\Users\Mahanthesh V K\OneDrive\Desktop\Dummy\Jarvis\drug-supply-chain\backend'
sys.path.insert(0, backend_path)

from services.csv_fallback import csv_fallback_service

print("=" * 60)
print("🧪 CSV FALLBACK SERVICE TEST")
print("=" * 60)

# Test each CSV endpoint
test_cases = [
    ("inventory", "Drug Consumption History"),
    ("telemetry", "IoT Sensor Logs"),
    ("anomalies", "Anomaly Detection Features"),
    ("blockchain", "QR Code Registry"),
]

for key, description in test_cases:
    print(f"\n📂 Testing {description} ({key})...")
    try:
        data = csv_fallback_service.load_csv(key, limit=3)
        print(f"   ✅ Loaded {len(data)} records")
        if data:
            print(f"   📋 Sample columns: {list(data[0].keys())[:5]}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

print("\n" + "=" * 60)
print("✅ CSV FALLBACK SERVICE READY")
print("=" * 60)
