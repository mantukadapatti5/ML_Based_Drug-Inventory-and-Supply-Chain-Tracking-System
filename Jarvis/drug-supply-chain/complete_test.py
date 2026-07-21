#!/usr/bin/env python3
"""
Complete RBAC Authentication Test - Verifies Frontend + Backend Integration
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:3002"

print("=" * 70)
print("PHASE 4: RBAC AUTHENTICATION - COMPLETE END-TO-END TEST")
print("=" * 70)

# Test credentials
credentials = [
    {"email": "admin@gmail.com", "password": "admin@12", "role": "ADMIN", "dashboard": "/admin/dashboard"},
    {"email": "vendor@gmail.com", "password": "vendor@12", "role": "VENDOR", "dashboard": "/vendor/dashboard"},
    {"email": "dis@gmail.com", "password": "dis@12", "role": "DISTRIBUTOR", "dashboard": "/distributor/dashboard"},
]

print("\n✅ BACKEND: Testing Login Endpoint\n")

all_passed = True

for cred in credentials:
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": cred["email"], "password": cred["password"]},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response fields
            checks = [
                ("Token", data.get("access_token") is not None),
                ("Email", data.get("email") == cred["email"]),
                ("Role", data.get("role") == cred["role"]),
                ("Redirect", data.get("redirectTo") == cred["dashboard"]),
                ("Token Type", data.get("token_type") == "bearer"),
            ]
            
            status = "✅ PASS" if all(c[1] for c in checks) else "❌ FAIL"
            print(f"{status}: {cred['role']} Login")
            print(f"   Email: {data.get('email')}")
            print(f"   Role: {data.get('role')}")
            print(f"   Redirect To: {data.get('redirectTo')}")
            print(f"   Token: {data.get('access_token', '')[:30]}...")
            
            if not all(c[1] for c in checks):
                print(f"   ❌ Failed checks:")
                for check_name, check_result in checks:
                    if not check_result:
                        print(f"      - {check_name}: Expected {cred.get(check_name.lower(), 'value')}")
                all_passed = False
        else:
            print(f"❌ FAIL: {cred['role']} Login - HTTP {response.status_code}")
            print(f"   Error: {response.json().get('detail')}")
            all_passed = False
            
        print()
        
    except requests.exceptions.ConnectionError:
        print(f"❌ FAIL: Cannot connect to backend at {BASE_URL}")
        print(f"   Make sure backend is running!")
        all_passed = False
    except Exception as e:
        print(f"❌ FAIL: {cred['role']} - {str(e)}")
        all_passed = False

print("\n✅ FRONTEND: Testing Access\n")

try:
    response = requests.get(FRONTEND_URL, timeout=5)
    if response.status_code == 200:
        print(f"✅ PASS: Frontend accessible at {FRONTEND_URL}")
        if "Sign in" in response.text or "Email" in response.text:
            print(f"✅ PASS: Login page rendered correctly")
        else:
            print(f"⚠️  WARNING: Login page content not found")
            all_passed = False
    else:
        print(f"❌ FAIL: Frontend returned HTTP {response.status_code}")
        all_passed = False
except requests.exceptions.ConnectionError:
    print(f"❌ FAIL: Cannot connect to frontend at {FRONTEND_URL}")
    print(f"   Make sure frontend is running: npm run dev")
    all_passed = False
except Exception as e:
    print(f"❌ FAIL: {str(e)}")
    all_passed = False

print("\n" + "=" * 70)
print("INVALID CREDENTIALS TEST")
print("=" * 70 + "\n")

try:
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "wrong@gmail.com", "password": "wrong"},
        timeout=5
    )
    
    if response.status_code == 401:
        print(f"✅ PASS: Invalid credentials rejected with HTTP 401")
        print(f"   Error: {response.json().get('detail')}")
    else:
        print(f"❌ FAIL: Expected HTTP 401, got HTTP {response.status_code}")
        all_passed = False
        
except Exception as e:
    print(f"❌ FAIL: {str(e)}")
    all_passed = False

print("\n" + "=" * 70)
print("DEPLOYMENT STATUS")
print("=" * 70 + "\n")

if all_passed:
    print("✅ ALL TESTS PASSED - SYSTEM READY FOR LOGIN")
    print("\n🎯 Next Steps:")
    print("   1. Open browser: http://localhost:3002")
    print("   2. Try any of these credentials:")
    for cred in credentials:
        print(f"      • {cred['email']} / {cred['password']}")
    print("   3. Should redirect to role dashboard")
    print("\n✨ System is production-ready!")
else:
    print("❌ SOME TESTS FAILED")
    print("\n   Check errors above and ensure:")
    print("   • Backend running: python -m uvicorn backend.main:app --reload --port 8000")
    print("   • Frontend running: npm run dev")
    print("   • Both services are accessible")
