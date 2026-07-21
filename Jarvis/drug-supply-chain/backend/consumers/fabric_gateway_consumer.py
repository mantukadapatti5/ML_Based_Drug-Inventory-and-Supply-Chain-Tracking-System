"""Fabric Gateway consumer: quarantines batches on AI cold-chain alerts."""

import json
import logging
import sys
import threading
from pathlib import Path
from typing import Any, Dict, Optional

try:
    from ..config import settings
    from ..services.fabric_client import fabric_network_client, QUARANTINE_REASONS
    from ..services.outbox_service import confirm_outbox, enqueue_event, mark_outbox_failed
except ImportError:
    _root = Path(__file__).resolve().parents[2]
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from backend.config import settings
    from backend.services.fabric_client import fabric_network_client, QUARANTINE_REASONS
    from backend.services.outbox_service import confirm_outbox, enqueue_event, mark_outbox_failed

logger = logging.getLogger("FabricGatewayConsumer")

ALERTS_TOPIC = "iot.alerts.coldchain"
CONSUMER_GROUP = "blockchain-gate-group"


class FabricGatewayConsumer:
    """Listens for ML anomaly alerts and submits QuarantineAsset to Hyperledger Fabric."""

    def __init__(self) -> None:
        self._consumer = None
        self._enabled = False
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._processed_alerts: set[str] = set()

    def _init_consumer(self) -> None:
        try:
            from kafka import KafkaConsumer

            self._consumer = KafkaConsumer(
                ALERTS_TOPIC,
                bootstrap_servers=settings.kafka_bootstrap_servers,
                auto_offset_reset="latest",
                group_id=CONSUMER_GROUP,
                enable_auto_commit=True,
                value_deserializer=lambda x: json.loads(x.decode("utf-8")),
                consumer_timeout_ms=1000,
                request_timeout_ms=3000,
                connections_max_idle_ms=5000,
            )
            self._enabled = True
            logger.info(
                "Fabric gateway consumer connected to %s on %s",
                settings.kafka_bootstrap_servers,
                ALERTS_TOPIC,
            )
        except ImportError:
            logger.warning("kafka-python not installed — fabric gateway consumer disabled.")
        except Exception as exc:
            logger.warning("Fabric gateway Kafka init failed (%s).", exc)

    @property
    def enabled(self) -> bool:
        return self._enabled and self._consumer is not None

    def _should_quarantine(self, alert_payload: Dict[str, Any]) -> bool:
        reason = str(alert_payload.get("reason", "")).upper()
        if reason in QUARANTINE_REASONS:
            return True
        severity = str(alert_payload.get("severity", "")).lower()
        return severity == "high" or alert_payload.get("title", "").startswith("CRITICAL")

    def process_alert(self, alert_payload: Dict[str, Any]) -> None:
        batch_id = alert_payload.get("batch_id")
        if not batch_id:
            logger.warning("Alert missing batch_id — skipping blockchain quarantine.")
            return

        ikey = alert_payload.get("telemetry_key") or alert_payload.get("idempotency_key")
        if not ikey:
            ikey = f"quarantine:{batch_id}:{alert_payload.get('timestamp', '')}"

        if ikey in self._processed_alerts:
            logger.debug("Alert already processed on this node: %s", ikey)
            return

        if not self._should_quarantine(alert_payload):
            logger.info("Alert for batch %s does not require quarantine lock.", batch_id)
            return

        reason = alert_payload.get("reason", "UNKNOWN_ANOMALY")
        logger.warning(
            "Intercepted AI anomaly alert for batch %s. Submitting to ledger...",
            batch_id,
        )

        outbox_key = f"quarantine:{ikey}"
        enqueue_event(
            aggregate_type="batch",
            aggregate_id=str(batch_id),
            event_type="QUARANTINE_REQUESTED",
            payload={
                "batch_id": batch_id,
                "reason": reason,
                "telemetry_key": ikey,
                "alert": alert_payload,
            },
            idempotency_key=outbox_key,
        )

        try:
            contract = fabric_network_client.get_contract(
                channel_name=settings.fabric_channel,
                chaincode_name=settings.fabric_chaincode,
            )
            tx_result = contract.submit_transaction(
                "QuarantineAsset",
                str(batch_id),
                str(reason),
                str(ikey),
            )

            tx_id = tx_result.get("tx_id", "UNKNOWN_TX_ID")
            logger.info(
                "CRITICAL COMPLIANCE LOCKED! Batch %s marked QUARANTINED on ledger.",
                batch_id,
            )
            logger.info("Immutable blockchain Tx ID: %s (mode=%s)", tx_id, tx_result.get("mode"))

            confirm_outbox(outbox_key, tx_id)
            self._processed_alerts.add(ikey)

            try:
                from ..services.websocket_server import realtime_broadcaster
            except ImportError:
                from backend.services.websocket_server import realtime_broadcaster

            realtime_broadcaster.schedule_quarantine(
                {
                    "batch_id": batch_id,
                    "status": "QUARANTINED",
                    "reason": reason,
                    "fabric_tx_id": tx_id,
                    "telemetry_key": ikey,
                }
            )

        except Exception as blockchain_error:
            mark_outbox_failed(outbox_key)
            logger.error(
                "REGULATORY FAILURE: Could not write lock record for batch %s: %s",
                batch_id,
                blockchain_error,
            )
            logger.error(
                "Action required: verify Fabric peer status and MSP credentials (FABRIC_CERT_PATH)."
            )

    def _consume_loop(self) -> None:
        if not self.enabled:
            return
        logger.info("Trust engine live. Monitoring %s for regulatory lock actions...", ALERTS_TOPIC)
        while self._running:
            try:
                for message in self._consumer:
                    if not self._running:
                        break
                    try:
                        self.process_alert(message.value)
                    except Exception as exc:
                        logger.error("Fabric gate processing error: %s", exc)
            except Exception as exc:
                if self._running:
                    logger.error("Fabric gateway consumer loop error: %s", exc)

    def start_background(self) -> None:
        if self._thread is not None:
            return
        self._init_consumer()
        if not self.enabled:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._consume_loop,
            name="fabric-gateway-consumer",
            daemon=True,
        )
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._consumer is not None:
            try:
                self._consumer.close()
            except Exception:
                pass
            self._consumer = None
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None
        self._enabled = False


fabric_gateway_consumer = FabricGatewayConsumer()


def run_standalone() -> None:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    logging.basicConfig(level=logging.INFO)
    import asyncio

    async def _boot():
        await fabric_network_client.connect()

    asyncio.run(_boot())

    consumer = FabricGatewayConsumer()
    consumer._init_consumer()
    if not consumer.enabled:
        raise SystemExit(
            f"Kafka unavailable — check KAFKA_SERVERS ({settings.kafka_bootstrap_servers})."
        )
    consumer._running = True
    logger.info("Fabric gateway consumer running (standalone)...")
    try:
        for message in consumer._consumer:
            consumer.process_alert(message.value)
    except KeyboardInterrupt:
        logger.info("Fabric gateway consumer stopped.")


if __name__ == "__main__":
    run_standalone()
