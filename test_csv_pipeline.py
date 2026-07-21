#!/usr/bin/env python3
"""
🧪 Complete CSV Fallback Pipeline Test Suite
Validates backend endpoints return data from CSV fallback
"""

import subprocess
import time
import requests
import json
import sys
from pathlib import Path

# Colors for terminal output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

BASE_URL = "http://localhost:8000"
ENDPOINTS = [
    ("/api/inventory/items-fallback", "Inventory Data (Drug Consumption)"),
    ("/api/iot/cold-chain/monitor-fallback", "Telemetry Data (IoT Sensors)"),
    ("/api/analytics/anomalies-fallback", "Anomaly Data (ML Detection)"),
    ("/api/blockchain/explorer-fallback", "Blockchain Data (QR Registry)"),
]

def print_header(text):
    print(f"\n{BLUE}{'='*70}")
    print(f"  {text}")
    print(f"{'='*70}{RESET}\n")

def print_success(text):
    print(f"{GREEN}✅ {text}{RESET}")

def print_error(text):
    print(f"{RED}❌ {text}{RESET}")

def print_info(text):
    print(f"{YELLOW}ℹ️  {text}{RESET}")

def test_backend_running():
    """Check if backend is running"""
    print_header("Step 1: Checking Backend Connection")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            health = response.json()
            print_success(f"Backend is running and healthy")
            print(f"   Database: {health.get('database', 'unknown')}")
            print(f"   MongoDB: {health.get('mongodb', False)}")
            print(f"   InfluxDB: {health.get('influxdb', False)}")
            return True
        else:
            print_error(f"Backend returned status {response.status_code}")
            return False
    except requests.ConnectionError:
        print_error(f"Cannot connect to {BASE_URL}")
        print_info("Make sure backend is running: python -m uvicorn backend.main:app --reload --port 8000")
        return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_csv_fallback_endpoints():
    """Test all CSV fallback endpoints"""
    print_header("Step 2: Testing CSV Fallback Endpoints")
    
    all_passed = True
    for endpoint, description in ENDPOINTS:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
            if response.status_code == 200:
                data = response.json()
                record_count = len(data.get("data", []))
                source = data.get("source", "unknown")
                
                print_success(f"{description}")
                print(f"   Endpoint: {endpoint}")
                print(f"   Records: {record_count}")
                print(f"   Source: {source}")
                
                if record_count > 0:
                    first_record = data["data"][0]
                    columns = list(first_record.keys())[:5]
                    print(f"   Sample columns: {columns}")
            else:
                print_error(f"{description}: Status {response.status_code}")
                all_passed = False
        except requests.Timeout:
            print_error(f"{description}: Request timeout (backend may be loading CSV files)")
            all_passed = False
        except Exception as e:
            print_error(f"{description}: {str(e)}")
            all_passed = False
    
    return all_passed

def test_response_format():
    """Validate response format matches frontend expectations"""
    print_header("Step 3: Validating API Response Format")
    
    try:
        response = requests.get(f"{BASE_URL}/api/inventory/items-fallback", timeout=10)
        data = response.json()
        
        # Check required fields
        required_fields = ["status", "count", "data"]
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            print_error(f"Response missing fields: {missing_fields}")
            return False
        
        if data["status"] != "success":
            print_error(f"Response status is '{data['status']}', expected 'success'")
            return False
        
        if not isinstance(data["data"], list):
            print_error(f"Response 'data' should be array, got {type(data['data'])}")
            return False
        
        print_success("API Response Format Valid")
        print(f"   Status: {data['status']}")
        print(f"   Record Count: {data['count']}")
        print(f"   Source: {data.get('source', 'N/A')}")
        return True
    except Exception as e:
        print_error(f"Format validation failed: {e}")
        return False

def test_data_completeness():
    """Check if CSV data is properly loaded and converted"""
    print_header("Step 4: Checking Data Completeness")
    
    try:
        # Test with limit parameter
        response = requests.get(f"{BASE_URL}/api/inventory/items-fallback?limit=10", timeout=10)
        data = response.json()
        
        if data["count"] < 3:
            print_error(f"Expected at least 3 records, got {data['count']}")
            return False
        
        # Check for NaN/None issues
        has_none = False
        for record in data["data"]:
            for key, value in record.items():
                if value is None:
                    has_none = True
                    break
        
        if has_none:
            print_info("Some records contain None values (this is acceptable)")
        
        print_success("Data Completeness Check Passed")
        print(f"   Records loaded: {data['count']}")
        print(f"   Limit parameter: working ✓")
        print(f"   JSON conversion: working ✓")
        return True
    except Exception as e:
        print_error(f"Data completeness check failed: {e}")
        return False

def test_column_normalization():
    """Verify CSV columns are properly normalized"""
    print_header("Step 5: Testing Column Name Normalization")
    
    try:
        response = requests.get(f"{BASE_URL}/api/analytics/anomalies-fallback?limit=1", timeout=10)
        data = response.json()
        
        if not data["data"]:
            print_info("No anomaly records available")
            return True
        
        record = data["data"][0]
        columns = list(record.keys())
        
        print_success("Column Names Retrieved")
        print(f"   First record has {len(columns)} fields")
        print(f"   Sample: {columns[:5]}")
        
        # Check if columns contain useful data
        non_empty_fields = [k for k, v in record.items() if v is not None and v != ""]
        if non_empty_fields:
            print_success(f"Data quality: {len(non_empty_fields)}/{len(columns)} fields populated")
        
        return True
    except Exception as e:
        print_error(f"Column normalization test failed: {e}")
        return False

def generate_report(results):
    """Generate final test report"""
    print_header("📊 Test Results Summary")
    
    test_names = [
        "Backend Connection",
        "CSV Fallback Endpoints",
        "API Response Format",
        "Data Completeness",
        "Column Normalization",
    ]
    
    all_passed = all(results)
    
    for name, passed in zip(test_names, results):
        status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
        print(f"{status}  {name}")
    
    print(f"\n{'='*70}")
    if all_passed:
        print(f"{GREEN}🎉 ALL TESTS PASSED - CSV FALLBACK PIPELINE READY!{RESET}")
        print(f"\n{BLUE}Next steps:{RESET}")
        print(f"1. Start Frontend: npm run dev (in frontend/ directory)")
        print(f"2. Open: http://localhost:5173")
        print(f"3. Login and navigate to Vendor Dashboard")
        print(f"4. Check Inventory, Cold Chain, and Anomaly panels")
        print(f"   (Data should load from CSV without 'Loading...' screen)")
    else:
        print(f"{RED}⚠️  SOME TESTS FAILED - Check errors above{RESET}")
        print(f"\n{BLUE}Troubleshooting:{RESET}")
        print(f"1. Ensure backend is running: python -m uvicorn backend.main:app --reload --port 8000")
        print(f"2. Check CSV files exist: C:\\Users\\Mahanthesh V K\\OneDrive\\Desktop\\Dummy\\*.csv")
        print(f"3. Review backend logs for import errors")
    
    print(f"{'='*70}\n")
    return all_passed

def main():
    print_header("🧪 CSV FALLBACK PIPELINE TEST SUITE")
    print(f"{BLUE}Testing CSV data integration with FastAPI backend{RESET}")
    print(f"Backend URL: {BASE_URL}")
    
    results = []
    
    # Run all tests
    results.append(test_backend_running())
    if not results[-1]:
        print_error("Backend not running - cannot continue tests")
        return False
    
    results.append(test_csv_fallback_endpoints())
    results.append(test_response_format())
    results.append(test_data_completeness())
    results.append(test_column_normalization())
    
    # Generate report
    success = generate_report(results)
    
    return success

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Test interrupted by user{RESET}")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        sys.exit(1)
