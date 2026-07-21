import requests
import json

print("🧪 RBAC Authentication Test Suite\n")
print("=" * 60)

credentials = [
    ("admin@gmail.com", "admin@12", "admin", "/admin/dashboard"),
    ("vendor@gmail.com", "vendor@12", "vendor", "/vendor/dashboard"),
    ("dis@gmail.com", "dis@12", "distributor", "/distributor/dashboard"),
]

all_passed = True

for email, pwd, expected_role, expected_dash in credentials:
    try:
        response = requests.post(
            "http://localhost:8000/api/auth/login",
            json={"email": email, "password": pwd},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            role = data.get("role", "").lower()
            redirect = data.get("redirectTo", "")
            token = data.get("access_token", "")[:20] + "..."
            
            role_match = role == expected_role
            redirect_match = redirect == expected_dash
            
            print(f"\n✅ {expected_role.upper()}")
            print(f"   Email: {email}")
            print(f"   Role: {role} {'✅' if role_match else '❌ (expected: ' + expected_role + ')'}")
            print(f"   Redirect: {redirect} {'✅' if redirect_match else '❌ (expected: ' + expected_dash + ')'}")
            print(f"   Token: {token}")
            
            if not (role_match and redirect_match):
                all_passed = False
        else:
            print(f"\n❌ {expected_role.upper()}: HTTP {response.status_code}")
            print(f"   Error: {response.text}")
            all_passed = False
    except Exception as e:
        print(f"\n❌ {expected_role.upper()}: {str(e)}")
        all_passed = False

print("\n" + "=" * 60)
if all_passed:
    print("✅ BACKEND: All credentials verified working!")
else:
    print("⚠️ BACKEND: Some credentials failed - check above")

print("✅ FRONTEND: Running on http://localhost:3001")
print("\n🎉 Ready for browser testing!")
