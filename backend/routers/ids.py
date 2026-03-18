"""Suricata IDS alert viewer — parses EVE JSON from syslog via REST show log."""
import json
import logging
import time
from collections import Counter
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient

router = APIRouter(prefix="/api/ids", tags=["ids"])
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 60-second in-memory cache — one REST show-log call per minute maximum
# ---------------------------------------------------------------------------
_cache: dict[str, Any] = {"alerts": None, "ts": 0.0}
_CACHE_TTL = 60


async def _get_alerts(client: VyOSClient) -> list[dict]:
    """Return parsed Suricata EVE alerts, cached for 60 seconds."""
    now = time.monotonic()
    if _cache["alerts"] is not None and (now - _cache["ts"]) < _CACHE_TTL:
        return _cache["alerts"]

    # Single REST call — show log. No SSH, no extra router load.
    raw = await client.get_logs(lines=5000)
    alerts = []
    for line in raw.splitlines():
        if "suricata" not in line.lower():
            continue
        try:
            json_start = line.index('{"timestamp"')
            evt = json.loads(line[json_start:])
            if evt.get("event_type") != "alert":
                continue
            alert_info = evt.get("alert", {})
            alerts.append({
                "timestamp":    evt.get("timestamp", ""),
                "src_ip":       evt.get("src_ip", ""),
                "src_port":     evt.get("src_port", 0),
                "dest_ip":      evt.get("dest_ip", ""),
                "dest_port":    evt.get("dest_port", 0),
                "proto":        evt.get("proto", ""),
                "interface":    evt.get("in_iface", ""),
                "direction":    evt.get("direction", ""),
                "app_proto":    evt.get("app_proto", ""),
                "signature":    alert_info.get("signature", ""),
                "category":     alert_info.get("category", ""),
                "severity":     alert_info.get("severity", 0),
                "action":       alert_info.get("action", ""),
                "signature_id": alert_info.get("signature_id", 0),
            })
        except (ValueError, json.JSONDecodeError):
            pass

    _cache["alerts"] = alerts
    _cache["ts"] = now
    logger.info("ids: parsed %d alerts from syslog (cache refreshed)", len(alerts))
    return alerts


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/alerts")
async def get_alerts(
    lines: int = 200,
    client: Annotated[VyOSClient, Depends(get_vyos_client)] = None,
):
    """Return the most recent Suricata alerts (newest first)."""
    if lines < 1 or lines > 2000:
        lines = 200
    try:
        alerts = await _get_alerts(client)
        return {"alerts": list(reversed(alerts))[:lines], "total": len(alerts)}
    except Exception as e:
        logger.error("get_alerts failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_summary(
    client: Annotated[VyOSClient, Depends(get_vyos_client)] = None,
):
    """Return aggregated analytics — all computed in-process, no extra router calls."""
    try:
        alerts = await _get_alerts(client)

        if not alerts:
            return {
                "total": 0,
                "severity_counts": {},
                "action_counts": {},
                "interface_counts": {},
                "protocol_counts": {},
                "app_proto_counts": {},
                "timeline": [],
                "top_signatures": [],
                "top_src_ips": [],
                "top_dest_ips": [],
            }

        severity_counts  = Counter(a["severity"]  for a in alerts)
        action_counts    = Counter(a["action"]     for a in alerts)
        interface_counts = Counter(a["interface"]  for a in alerts)
        protocol_counts  = Counter(a["proto"]      for a in alerts)
        app_proto_counts = Counter(a["app_proto"]  for a in alerts if a["app_proto"])

        sig_counts = Counter((a["signature"], a["severity"]) for a in alerts)
        top_signatures = [
            {"signature": sig, "severity": sev, "count": cnt}
            for (sig, sev), cnt in sig_counts.most_common(10)
        ]

        top_src_ips = [
            {"ip": ip, "count": cnt}
            for ip, cnt in Counter(a["src_ip"] for a in alerts).most_common(10)
        ]
        top_dest_ips = [
            {"ip": ip, "count": cnt}
            for ip, cnt in Counter(a["dest_ip"] for a in alerts).most_common(10)
        ]

        # Bucket into 30-minute timeline slots
        slot_counts: Counter = Counter()
        for a in alerts:
            ts = a["timestamp"]
            if len(ts) >= 16:
                hour = int(ts[11:13])
                minute = int(ts[14:16])
                slot = f"{ts[:11]}{hour:02d}:{(minute // 30) * 30:02d}"
                slot_counts[slot] += 1
        timeline = [
            {"slot": slot, "count": cnt}
            for slot, cnt in sorted(slot_counts.items())
        ]

        return {
            "total":            len(alerts),
            "severity_counts":  dict(severity_counts),
            "action_counts":    dict(action_counts),
            "interface_counts": dict(interface_counts),
            "protocol_counts":  dict(protocol_counts),
            "app_proto_counts": dict(app_proto_counts),
            "timeline":         timeline,
            "top_signatures":   top_signatures,
            "top_src_ips":      top_src_ips,
            "top_dest_ips":     top_dest_ips,
        }
    except Exception as e:
        logger.error("get_summary failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
