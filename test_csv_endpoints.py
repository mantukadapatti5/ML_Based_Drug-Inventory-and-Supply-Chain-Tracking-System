import requests, json

endpoints = [
    '/api/inventory',
    '/api/coldchain/telemetry', 
    '/api/admin/users',
    '/api/analytics/anomalies'
]

print("\n=== Testing CSV Fallback Endpoints ===\n")
for ep in endpoints:
    r = requests.get(f'http://localhost:8000{ep}')
    if r.status_code == 200:
        data = r.json()
        count = len(data.get('data', []))
        print(f"✅ {ep:30} {count:3} records")
        if count > 0:
            print(f"   Sample: {str(list(data['data'][0].keys())[:3])}\n")
    else:
        print(f"❌ {ep:30} Status: {r.status_code}\n")

print("\n=== Health Check ===\n")
r = requests.get('http://localhost:8000/health')
if r.status_code == 200:
    health = r.json()
    print(f"Status: {health['status']}")
    print(f"Fabric Mode: {health['fabric_mode']}")
    print(f"Database: {health['database']}")
