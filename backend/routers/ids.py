"""Suricata IDS alert viewer."""
import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient

router = APIRouter(prefix="/api/ids", tags=["ids"])
logger = logging.getLogger(__name__)


@router.get("/alerts")
async def get_alerts(
    lines: int = 200,
    client: Annotated[VyOSClient, Depends(get_vyos_client)] = None,
):
    """Return parsed Suricata IDS alerts from eve.json."""
    if lines < 1 or lines > 2000:
        lines = 200
    try:
        raw = await client.get_suricata_alerts(lines)
        alerts = []
        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                if event.get("event_type") == "alert":
                    alert_data = event.get("alert", {})
                    alerts.append({
                        "timestamp": event.get("timestamp", ""),
                        "src_ip": event.get("src_ip", ""),
                        "src_port": event.get("src_port", 0),
                        "dest_ip": event.get("dest_ip", ""),
                        "dest_port": event.get("dest_port", 0),
                        "proto": event.get("proto", ""),
                        "interface": event.get("in_iface", ""),
                        "direction": event.get("direction", ""),
                        "signature": alert_data.get("signature", ""),
                        "category": alert_data.get("category", ""),
                        "severity": alert_data.get("severity", 0),
                        "action": alert_data.get("action", ""),
                        "signature_id": alert_data.get("signature_id", 0),
                    })
            except json.JSONDecodeError:
                pass
        return {"alerts": list(reversed(alerts)), "total": len(alerts)}
    except Exception as e:
        logger.error("get_alerts failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
