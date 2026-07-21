"""Final system test — tests all 4 portals with real JWT tokens."""
import requests

BASE = "http://localhost:8000"

# ── 1. Login all 4 roles ─────────────────────────────────────────────────────
print("=" * 60)
print("FINAL FULL SYSTEM TEST")
print("=" * 60)

creds = [
    ("admin@gmail.com",  "admin@12",  "admin"),
    ("vendor@gmail.com", "vendor@12", "vendor"),
    ("dis@gmail.com",    "dis@12",    "distributor"),
    ("reg@gmail.com",    "reg@12",    "regulator"),
]
tokens = {}
print("\n1. LOGIN TEST")
for email, pwd, role in creds:
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pwd}, timeout=8)
    if r.status_code == 200:
        d = r.json()
        tokens[role] = d.get("access_token", "")
        print(f"  OK  {role:12} | user_id={d.get('user_id')} | redirect={d.get('redirectTo')}")
    else:
        print(f"  FAIL {role} -> {r.status_code} {r.text[:80]}")

# ── 2. Docker / health ────────────────────────────────────────────────────────
print("\n2. BACKEND HEALTH")
h = requests.get(f"{BASE}/health", timeout=5).json()
print(f"  status={h['status']} | database={h['database']} | ml={h['ml_models_frozen']}")

# ── 3. Panel API tests ────────────────────────────────────────────────────────
tests = [
    # portal, role, endpoint, description
    ("VENDOR",      "vendor",       "/api/inventory/items",              "Inventory items"),
    ("VENDOR",      "vendor",       "/api/inventory/fefo-sorted",        "FEFO Expiry batches"),
    ("VENDOR",      "vendor",       "/api/inventory/requests",           "Incoming stock requests"),
    ("VENDOR",      "vendor",       "/api/analytics/summary",            "AI Dashboard analytics"),
    ("VENDOR",      "vendor",       "/api/forecast/drugs",               "ML Forecast drugs"),
    ("VENDOR",      "vendor",       "/api/anomalies/logs",               "Anomaly detection logs"),
    ("VENDOR",      "vendor",       "/api/iot/cold-chain/monitor",       "Cold chain monitor"),
    ("VENDOR",      "vendor",       "/api/inventory/rop-dashboard",      "ROP dashboard"),
    ("VENDOR",      "vendor",       "/api/orders/history",               "Billing / invoices"),
    ("VENDOR",      "vendor",       "/api/inventory/catalog",            "Product catalog"),
    ("DISTRIBUTOR", "distributor",  "/api/analytics/distributor-stats",  "Distributor dashboard stats"),
    ("DISTRIBUTOR", "distributor",  "/api/sales/drugs",                  "Sales drug dropdown"),
    ("DISTRIBUTOR", "distributor",  "/api/sales",                        "Sales list"),
    ("DISTRIBUTOR", "distributor",  "/api/orders",                       "Orders list"),
    ("DISTRIBUTOR", "distributor",  "/api/suppliers/performance/summary","Supplier ratings"),
    ("DISTRIBUTOR", "distributor",  "/api/compliance/report",            "Compliance report"),
    ("DISTRIBUTOR", "distributor",  "/api/iot/cold-chain/monitor-fallback","Cold chain (fallback)"),
    ("DISTRIBUTOR", "distributor",  "/api/iot/events/active-shipments",  "GPS shipment map"),
    ("ADMIN",       "admin",        "/api/admin/dashboard/stats",        "Admin dashboard stats"),
    ("ADMIN",       "admin",        "/api/admin/users",                  "User management"),
    ("ADMIN",       "admin",        "/api/admin/audit-trail",            "Audit trail"),
    ("ADMIN",       "admin",        "/api/blockchain/health",            "Blockchain health"),
    ("ADMIN",       "admin",        "/api/blockchain/verify/C-003",      "QR batch verify"),
    ("ADMIN",       "admin",        "/api/blockchain/explorer-fallback", "Blockchain ledger"),
    ("REGULATOR",   "regulator",    "/api/admin/dashboard/stats",        "Regulator dashboard"),
    ("REGULATOR",   "regulator",    "/api/compliance/report",            "Compliance reports"),
    ("REGULATOR",   "regulator",    "/api/anomalies/logs",               "Anomaly alerts"),
]

ok = 0
fail = 0
last_portal = ""

print("\n3. PORTAL API TESTS")
for portal, role, endpoint, desc in tests:
    if portal != last_portal:
        print(f"\n  [{portal} PORTAL]")
        last_portal = portal

    token = tokens.get(role, "")
    headers = {"Authorization": f"Bearer {token}"}
    try:
        r = requests.get(f"{BASE}{endpoint}", headers=headers, timeout=12)
        if r.status_code == 200:
            # Count items returned
            d = r.json()
            cnt = (len(d.get("items", d.get("drugs", d.get("logs", d.get("batches",
                   d.get("orders", d.get("available", d.get("reports",
                   d.get("users", []))))))))))
            ok += 1
            print(f"  OK  {desc:40} [{cnt} items]")
        else:
            fail += 1
            print(f"  FAIL {desc} -> HTTP {r.status_code}")
    except Exception as e:
        fail += 1
        print(f"  FAIL {desc} -> {str(e)[:60]}")

# ── 4. Summary ────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
status = "ALL PASS" if fail == 0 else f"{fail} FAILED"
print(f"RESULT: {ok} PASS / {fail} FAIL  ({status})")
print("=" * 60)
print(f"\nFrontend → http://localhost:3000")
print(f"Backend  → http://localhost:8000")
print(f"API Docs → http://localhost:8000/docs")
print(f"\nLogin credentials:")
print(f"  Admin:       admin@gmail.com / admin@12")
print(f"  Vendor:      vendor@gmail.com / vendor@12")
print(f"  Distributor: dis@gmail.com / dis@12")
print(f"  Regulator:   reg@gmail.com / reg@12")
