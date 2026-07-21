#!/usr/bin/env python3
"""
Phase 4 RBAC Authentication - Complete End-to-End Test
========================================================

Tests all three static credentials and validates:
1. Login endpoint returns correct JWT token
2. Token contains proper role information
3. Redirect path is explicit and correct
4. Invalid credentials are rejected
"""

import requests
import json
from datetime import datetime
import jwt
from base64 import urlsafe_b64decode

# Configuration
BACKEND_URL = "http://localhost:8000"
API_LOGIN_ENDPOINT = f"{BACKEND_URL}/api/auth/login"

# Static RBAC credentials
CREDENTIALS = {
    "ADMIN": {
        "email": "admin@gmail.com",
        "password": "admin@12",
        "expected_redirect": "/admin/dashboard",
        "expected_role": "ADMIN"
    },
    "VENDOR": {
        "email": "vendor@gmail.com",
        "password": "vendor@12",
        "expected_redirect": "/vendor/dashboard",
        "expected_role": "VENDOR"
    },
    "DISTRIBUTOR": {
        "email": "dis@gmail.com",
        "password": "dis@12",
        "expected_redirect": "/distributor/dashboard",
        "expected_role": "DISTRIBUTOR"
    }
}

def print_header(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}\n")

def decode_jwt_payload(token):
    """Decode JWT token without verification (for inspection)"""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        
        # Add padding if needed
        payload = parts[1]
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding
        
        decoded = urlsafe_b64decode(payload)
        return json.loads(decoded)
    except Exception as e:
        print(f"Error decoding JWT: {e}")
        return None

def test_login(role, cred):
    """Test login for a specific role"""
    print(f"Testing {role} Login...")
    print(f"  Email: {cred['email']}")
    print(f"  Password: {cred['password']}")
    
    try:
        response = requests.post(
            API_LOGIN_ENDPOINT,
            json={
                "email": cred['email'],
                "password": cred['password']
            }
        )
        
        if response.status_code != 200:
            print(f"  ❌ FAILED: HTTP {response.status_code}")
            print(f"  Error: {response.json().get('detail', 'Unknown error')}")
            return False
        
        data = response.json()
        
        # Validate response fields
        required_fields = ['access_token', 'token_type', 'email', 'role', 'redirectTo']
        for field in required_fields:
            if field not in data or data[field] is None:
                print(f"  ❌ FAILED: Missing field '{field}'")
                return False
        
        # Validate response values
        if data['role'] != cred['expected_role']:
            print(f"  ❌ FAILED: Expected role '{cred['expected_role']}', got '{data['role']}'")
            return False
        
        if data['redirectTo'] != cred['expected_redirect']:
            print(f"  ❌ FAILED: Expected redirect '{cred['expected_redirect']}', got '{data['redirectTo']}'")
            return False
        
        if data['email'] != cred['email']:
            print(f"  ❌ FAILED: Email mismatch")
            return False
        
        # Decode and validate JWT
        jwt_payload = decode_jwt_payload(data['access_token'])
        if not jwt_payload:
            print(f"  ❌ FAILED: Invalid JWT token")
            return False
        
        if jwt_payload.get('role') != cred['expected_role']:
            print(f"  ❌ FAILED: JWT role mismatch. Expected '{cred['expected_role']}', got '{jwt_payload.get('role')}'")
            return False
        
        if jwt_payload.get('sub') != cred['email']:
            print(f"  ❌ FAILED: JWT sub (email) mismatch")
            return False
        
        # All validations passed
        print(f"  ✅ SUCCESS")
        print(f"     Role: {data['role']}")
        print(f"     Email: {data['email']}")
        print(f"     Redirect: {data['redirectTo']}")
        print(f"     Token Type: {data['token_type']}")
        print(f"     User ID: {data['user_id']}")
        print(f"     JWT Sub: {jwt_payload.get('sub')}")
        print(f"     JWT Role: {jwt_payload.get('role')}")
        print(f"     Token: {data['access_token'][:40]}...")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print(f"  ❌ FAILED: Cannot connect to backend at {BACKEND_URL}")
        print(f"     Make sure backend is running: python -m uvicorn backend.main:app --reload --port 8000")
        return False
    except Exception as e:
        print(f"  ❌ FAILED: {str(e)}")
        return False

def test_invalid_credentials():
    """Test that invalid credentials are rejected"""
    print("Testing Invalid Credentials...")
    print(f"  Email: wrong@gmail.com")
    print(f"  Password: wrong")
    
    try:
        response = requests.post(
            API_LOGIN_ENDPOINT,
            json={
                "email": "wrong@gmail.com",
                "password": "wrong"
            }
        )
        
        if response.status_code == 401:
            print(f"  ✅ SUCCESS: Correctly rejected with HTTP 401")
            print(f"     Error: {response.json().get('detail')}")
            return True
        else:
            print(f"  ❌ FAILED: Expected HTTP 401, got HTTP {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"  ❌ FAILED: Cannot connect to backend")
        return False
    except Exception as e:
        print(f"  ❌ FAILED: {str(e)}")
        return False

def main():
    print_header("Phase 4 RBAC Authentication - Complete Test Suite")
    
    results = {}
    
    # Test each role
    for role, cred in CREDENTIALS.items():
        results[role] = test_login(role, cred)
    
    # Test invalid credentials
    results["INVALID"] = test_invalid_credentials()
    
    # Summary
    print_header("Test Summary")
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}: {test_name}")
    
    print_header("Deployment Status")
    
    if passed == total:
        print("✅ ALL TESTS PASSED - READY FOR DEPLOYMENT")
        print("\nNext Steps:")
        print("1. Start Backend: python -m uvicorn backend.main:app --reload --port 8000")
        print("2. Start Frontend: npm run dev (from frontend directory)")
        print("3. Open http://localhost:3001 in browser")
        print("4. Try login with credentials above")
        return 0
    else:
        print("❌ SOME TESTS FAILED - CHECK ERRORS ABOVE")
        return 1

if __name__ == "__main__":
    exit(main())
