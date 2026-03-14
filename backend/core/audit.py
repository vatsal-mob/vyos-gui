"""Audit log handler — captures structured JSON log events into an in-memory deque."""
import json
import logging
import time
from collections import deque

_audit_deque: deque = deque(maxlen=500)


class AuditHandler(logging.Handler):
    """Logging handler that captures JSON event messages into a deque."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = record.getMessage()
            if msg.startswith("{") and '"event"' in msg:
                entry = json.loads(msg)
                entry["time"] = time.strftime(
                    "%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)
                )
                _audit_deque.append(entry)
        except Exception:
            pass


_handler_installed = False


def install() -> None:
    """Attach the AuditHandler to the root logger (idempotent)."""
    global _handler_installed
    if _handler_installed:
        return
    handler = AuditHandler()
    handler.setLevel(logging.INFO)
    logging.getLogger().addHandler(handler)
    _handler_installed = True


def get_recent(limit: int = 200) -> list[dict]:
    """Return the most recent audit entries up to *limit*."""
    entries = list(_audit_deque)
    return entries[-limit:] if len(entries) > limit else entries
