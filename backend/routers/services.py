"""Service status and toggle endpoints."""
import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient

router = APIRouter(prefix="/api/services", tags=["services"])
logger = logging.getLogger(__name__)

# Service name -> config path
# Only paths that return HTTP 200 from this VyOS instance's REST API.
# Paths returning 400 (dhcpv6-server, conntrack-sync, router-advert, tftp-server,
# ipoe-server, mdns-repeater, stunnel, telnet, ids) are excluded.
SERVICES: dict[str, list[str]] = {
    "ssh":              ["service", "ssh"],
    "dhcp-server":      ["service", "dhcp-server"],
    "dns-forwarding":   ["service", "dns", "forwarding"],
    "http-api":         ["service", "https", "api"],
    "ntp":              ["service", "ntp"],
    "snmp":             ["service", "snmp"],
    "lldp":             ["service", "lldp"],
    "webproxy":         ["service", "webproxy"],
    "pppoe-server":     ["service", "pppoe-server"],
    "suricata":         ["service", "suricata"],
}


@router.get("/")
async def list_services(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """Return status of all managed services."""
    async def check(name: str, path: list[str]) -> dict:
        try:
            raw = await client.retrieve(path)
            # SSH returns "" for missing paths; REST returns None — bool() handles both
            return {"name": name, "enabled": bool(raw)}
        except Exception:
            return {"name": name, "enabled": False}

    return await asyncio.gather(*[check(name, path) for name, path in SERVICES.items()])


@router.post("/{service}/enable")
async def enable_service(
    service: str,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail=f"Unknown service: {service}")
    path = SERVICES[service]
    try:
        await client.configure([{"op": "set", "path": path}])
        logger.info('{"event": "service_enable", "service": "%s"}', service)
        return {"status": "ok", "service": service, "enabled": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{service}/disable")
async def disable_service(
    service: str,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail=f"Unknown service: {service}")
    path = SERVICES[service]
    try:
        await client.configure([{"op": "delete", "path": path}])
        logger.info('{"event": "service_disable", "service": "%s"}', service)
        return {"status": "ok", "service": service, "enabled": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
