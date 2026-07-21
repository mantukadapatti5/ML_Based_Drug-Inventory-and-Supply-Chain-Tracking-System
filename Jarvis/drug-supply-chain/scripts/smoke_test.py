#!/usr/bin/env python3
"""Offline smoke test — no Docker required. Run from repo root: python scripts/smoke_test.py"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main() -> int:
    print("=== Drug Supply Chain — Smoke Test ===\n")
    failed = 0

    # 1. Config
    try:
        from backend.config import settings

        print(f"[OK] Config loaded (Kafka={settings.kafka_bootstrap_servers})")
    except Exception as e:
        print(f"[FAIL] Config: {e}")
        failed += 1

    # 2. ML security engine
    try:
        from backend.ml.anomaly_detector import calibrate_security_detector, score_telemetry_payload

        calibrate_security_detector()
        normal = score_telemetry_payload(
            {"temperature_c": 4.2, "humidity_pct": 55, "weight_g": 500, "batch_id": "BATCH-TEST"}
        )
        breach = score_telemetry_payload(
            {"temperature_c": 11.0, "humidity_pct": 55, "weight_g": 500, "batch_id": "BATCH-TEST"}
        )
        assert not normal["is_anomaly"], normal
        assert breach["is_anomaly"], breach
        assert breach["reason"] == "CRITICAL_TEMPERATURE_BREACH"
        print(f"[OK] ML engine (normal score={normal['score']}, breach={breach['reason']})")
    except Exception as e:
        print(f"[FAIL] ML: {e}")
        failed += 1

    # 3. Fabric mock quarantine
    try:
        from backend.services.fabric_client import fabric_network_client

        tx = fabric_network_client.quarantine_asset_sync(
            "BATCH-SMOKE-001", "CRITICAL_TEMPERATURE_BREACH", "smoke-key-1"
        )
        assert tx["status"] == "QUARANTINED"
        print(f"[OK] Fabric mock quarantine (tx={tx['tx_id'][:18]}...)")
    except Exception as e:
        print(f"[FAIL] Fabric: {e}")
        failed += 1

    # 4. GxP signature
    try:
        from backend.models.gxp_audit_trail import GxPAuditTrail
        from backend.config import settings

        payload = {"batch_id": "BATCH-SMOKE", "action": "TEST"}
        sig = GxPAuditTrail.generate_signature_hash(
            "test@pharma.com", "SMOKE_TEST", payload, settings.gxp_signature_salt
        )
        assert len(sig) == 64
        print(f"[OK] GxP signature hash ({sig[:16]}...)")
    except Exception as e:
        print(f"[FAIL] GxP: {e}")
        failed += 1

    # 5. Optional live services
    print("\n--- Optional connectivity (Docker services) ---")
    for name, check in [
        ("MQTT :1883", _check_port("localhost", 1883)),
        ("Kafka :19092", _check_port("localhost", 19092)),
        ("API :8000", _check_http("http://localhost:8000/health")),
    ]:
        status = "UP" if check else "down"
        print(f"  {name}: {status}")

    print()
    if failed:
        print(f"FAILED: {failed} core check(s)")
        return 1
    print("All core checks passed. Start Docker + uvicorn for full E2E.")
    return 0


def _check_port(host: str, port: int) -> bool:
    import socket

    try:
        with socket.create_connection((host, port), timeout=2):
            return True
    except OSError:
        return False


def _check_http(url: str) -> bool:
    try:
        import urllib.request

        with urllib.request.urlopen(url, timeout=3) as r:
            return r.status == 200
    except Exception:
        return False


if __name__ == "__main__":
    sys.exit(main())
