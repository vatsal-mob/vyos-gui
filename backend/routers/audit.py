"""Audit log read endpoint."""
from fastapi import APIRouter

from core.audit import get_recent

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/logs")
async def get_audit_logs(limit: int = 200):
    """Return recent audit log entries."""
    return get_recent(limit)
