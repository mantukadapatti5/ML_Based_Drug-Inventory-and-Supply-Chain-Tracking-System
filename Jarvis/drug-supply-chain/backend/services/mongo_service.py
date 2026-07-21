"""MongoDB connector for raw IoT payloads and dashboard notification history."""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from ..config import settings

logger = logging.getLogger(__name__)


class MongoService:
    def __init__(self) -> None:
        self._client = None
        self._db = None
        self._enabled = False
        self._init_client()

    def _init_client(self) -> None:
        if not settings.mongodb_url:
            logger.warning("MongoDB URL not configured.")
            return
        try:
            from pymongo import MongoClient
            from pymongo.errors import ConfigurationError

            self._client = MongoClient(
                settings.mongodb_url,
                serverSelectionTimeoutMS=5000,
            )
            self._client.admin.command("ping")
            self._db = self._client[settings.mongo_db]
            self._ensure_indexes()
            self._enabled = True
            logger.info("MongoDB connected: db=%s", settings.mongo_db)
        except ConfigurationError as exc:
            logger.warning("MongoDB configuration error (%s).", exc)
        except Exception as exc:
            logger.warning("MongoDB unavailable (%s). Raw IoT logging disabled.", exc)

    def _ensure_indexes(self) -> None:
        if self._db is None:
            return
        try:
            self._db["raw_iot_logs"].create_index(
                "idempotency_key",
                unique=True,
                sparse=True,
                name="uniq_idempotency_key",
            )
        except Exception as exc:
            logger.warning("MongoDB index setup skipped: %s", exc)

    @property
    def enabled(self) -> bool:
        return self._enabled

    def is_already_processed(self, idempotency_key: Optional[str]) -> bool:
        """Authoritative deduplication check before writing to any downstream store."""
        if not self._enabled or self._db is None or not idempotency_key:
            return False
        try:
            existing = self._db["raw_iot_logs"].find_one(
                {"idempotency_key": idempotency_key},
                {"_id": 1},
            )
            return existing is not None
        except Exception as exc:
            logger.error("MongoDB deduplication lookup failed: %s", exc)
            return False

    def log_raw_iot_payload(self, payload: Dict[str, Any]) -> Optional[str]:
        """Persist a raw clone of an incoming edge message for compliance tracking."""
        if not self._enabled or self._db is None:
            return None
        try:
            document = {
                **payload,
                "ingested_at": datetime.now(timezone.utc),
            }
            result = self._db["raw_iot_logs"].insert_one(document)
            return str(result.inserted_id)
        except Exception as exc:
            if "duplicate key" in str(exc).lower() or getattr(exc, "code", None) == 11000:
                logger.warning(
                    "Duplicate idempotency_key rejected at insert: %s",
                    payload.get("idempotency_key"),
                )
                return None
            logger.error("MongoDB raw IoT insert failed: %s", exc)
            return None

    def trigger_dashboard_notification(self, alert_data: Dict[str, Any]) -> Optional[str]:
        """Store alert history for portal dashboard modules."""
        if not self._enabled or self._db is None:
            return None
        try:
            document = {
                **alert_data,
                "created_at": alert_data.get("created_at", datetime.now(timezone.utc)),
            }
            result = self._db["notifications"].insert_one(document)
            return str(result.inserted_id)
        except Exception as exc:
            logger.error("MongoDB notification insert failed: %s", exc)
            return None


mongo_service = MongoService()
