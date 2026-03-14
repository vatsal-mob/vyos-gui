"""Flow accounting (NetFlow) viewer."""
import logging
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient

router = APIRouter(prefix="/api/flow", tags=["flow"])
logger = logging.getLogger(__name__)

_IP_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


def _parse_flow_accounting(raw: str) -> list[dict]:
    """Parse tabular output of 'show flow-accounting'.

    Column order (VyOS rolling):
      IN_IFACE  SRC_MAC  DST_MAC  SRC_IP  DST_IP  SRC_PORT  DST_PORT  PROTOCOL  TOS  PACKETS  BYTES
    """
    entries = []
    if not isinstance(raw, str):
        return entries
    for line in raw.splitlines():
        parts = line.split()
        if len(parts) < 10:
            continue
        # Validate that column 3 (SRC_IP) looks like an IPv4 address
        if not _IP_RE.match(parts[3]):
            continue
        try:
            entries.append({
                "interface": parts[0],
                "src_mac": parts[1],
                "dst_mac": parts[2],
                "src_ip": parts[3],
                "dst_ip": parts[4],
                "src_port": int(parts[5]),
                "dst_port": int(parts[6]),
                "protocol": parts[7],
                "tos": parts[8],
                "packets": int(parts[9]),
                "bytes": int(parts[10]) if len(parts) > 10 else 0,
            })
        except (ValueError, IndexError):
            continue
    return entries


@router.get("/accounting")
async def get_flow_accounting(
    client: Annotated[VyOSClient, Depends(get_vyos_client)] = None,
):
    """Return parsed flow-accounting table."""
    try:
        raw = await client.show_flow_accounting()
        flows = _parse_flow_accounting(raw if isinstance(raw, str) else "")
        # Sort by bytes descending
        flows.sort(key=lambda f: f["bytes"], reverse=True)
        return {"flows": flows, "total": len(flows)}
    except Exception as e:
        logger.error("get_flow_accounting failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
