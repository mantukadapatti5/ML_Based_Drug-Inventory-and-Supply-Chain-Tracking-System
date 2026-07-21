import requests

base = 'http://127.0.0.1:8000'
paths = [
    '/health',
    '/api/auth/login',
    '/api/inventory/catalog',
    '/api/inventory/items',
    '/api/orders',
    '/api/orders/history',
    '/api/suppliers/performance/summary',
    '/api/analytics/summary',
    '/api/analytics/distributor-stats',
    '/api/compliance/report',
]
for path in paths:
    try:
        if path == '/api/auth/login':
            r = requests.post(base + path, json={'email': 'admin@gmail.com', 'password': 'admin@12'}, timeout=20)
        else:
            r = requests.get(base + path, timeout=20)
        print(path, r.status_code)
        print(r.text[:1200])
    except Exception as e:
        print(path, 'ERROR', repr(e))
    print('---')
