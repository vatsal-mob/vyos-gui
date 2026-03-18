"""Audit log read endpoint."""
from typing import Annotated

from fastapi import APIRouter, Depends

from core.audit import get_recent
from core.dependencies import get_vyos_client
from vyos.client import VyOSClient

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/logs")
async def get_audit_logs(
    _: Annotated[VyOSClient, Depends(get_vyos_client)],
    limit: int = 200,
):
    """Return recent audit log entries."""
    return get_recent(limit)
