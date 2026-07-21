"""Background relay: forwards PENDING outbox rows from PostgreSQL to Redpanda/Kafka."""

import json
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Optional

from ..config import settings
from ..database import SessionLocal
from ..models.outbox_event import OutboxEvent

logger = logging.getLogger("OutboxRelay")


class OutboxRelayService:
    def __init__(self, kafka_bootstrap_servers: Optional[str] = None) -> None:
        self.bootstrap_servers = kafka_bootstrap_servers or settings.kafka_bootstrap_servers
        self._producer = None
        self._enabled = False
        self._thread: Optional[threading.Thread] = None
        self._running = False
        # NOTE: producer init is deferred to start_background() to avoid blocking import

    def _init_producer(self) -> None:
        try:
            from kafka import KafkaProducer

            self._producer = KafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
                acks="all",
                retries=3,
                request_timeout_ms=3000,
                max_block_ms=3000,
            )
            self._enabled = True
            logger.info("Outbox relay connected to Kafka at %s", self.bootstrap_servers)
        except ImportError:
            logger.warning("kafka-python not installed — outbox relay disabled.")
        except Exception as exc:
            logger.warning("Kafka producer unavailable (%s). Outbox relay disabled.", exc)

    @property
    def enabled(self) -> bool:
        return self._enabled and self._producer is not None

    def process_pending_events(self) -> int:
        """Find PENDING items and publish them to the event bus. Returns count forwarded."""
        if not self.enabled:
            return 0

        db = SessionLocal()
        forwarded = 0
        try:
            pending_events = (
                db.query(OutboxEvent)
                .filter(OutboxEvent.status == "PENDING")
                .order_by(OutboxEvent.created_at.asc())
                .limit(50)
                .all()
            )

            for event in pending_events:
                topic = f"supplychain.{event.aggregate_type.lower()}"
                try:
                    future = self._producer.send(
                        topic,
                        key=event.idempotency_key,
                        value=event.payload,
                    )
                    future.get(timeout=10)
                    event.status = "PUBLISHED"
                    event.published_at = datetime.now(timezone.utc)
                    db.commit()
                    forwarded += 1
                    logger.info(
                        "Forwarded outbox event %s to topic %s",
                        event.id,
                        topic,
                    )
                except Exception as exc:
                    db.rollback()
                    db.refresh(event)
                    event.status = "FAILED"
                    db.commit()
                    logger.error("Failed to forward outbox event %s: %s", event.id, exc)
        finally:
            db.close()

        return forwarded

    def _relay_loop(self) -> None:
        logger.info("Outbox relay monitor started.")
        while self._running:
            try:
                self.process_pending_events()
            except Exception as exc:
                logger.error("Outbox relay loop error: %s", exc)
            time.sleep(2)

    def start_background(self) -> None:
        if self._thread is not None:
            return
        self._init_producer()
        if not self.enabled:
            return
        self._running = True
        self._thread = threading.Thread(target=self._relay_loop, daemon=True, name="outbox-relay")
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None
        if self._producer is not None:
            try:
                self._producer.flush(timeout=5)
                self._producer.close(timeout=5)
            except Exception:
                pass
            self._producer = None


outbox_relay = OutboxRelayService()
