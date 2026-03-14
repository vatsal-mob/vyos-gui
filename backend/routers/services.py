"""Service status and toggle endpoints."""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient

router = APIRouter(prefix="/api/services", tags=["services"])
logger = logging.getLogger(__name__)

# Service name -> config path
SERVICES: dict[str, list[str]] = {
    "ssh":              ["service", "ssh"],
    "telnet":           ["service", "telnet"],
    "dhcp-server":      ["service", "dhcp-server"],
    "dhcpv6-server":    ["service", "dhcpv6-server"],
    "dns-forwarding":   ["service", "dns", "forwarding"],
    "http-api":         ["service", "https", "api"],
    "ntp":              ["service", "ntp"],
    "snmp":             ["service", "snmp"],
    "lldp":             ["service", "lldp"],
    "mdns-repeater":    ["service", "mdns", "repeater"],
    "webproxy":         ["service", "webproxy"],
    "conntrack-sync":   ["service", "conntrack-sync"],
    "router-advert":    ["service", "router-advert"],
    "tftp-server":      ["service", "tftp-server"],
    "pppoe-server":     ["service", "pppoe-server"],
    "ipoe-server":      ["service", "ipoe-server"],
    "ids":              ["service", "ids"],
    "stunnel":          ["service", "stunnel"],
}


@router.get("/")
async def list_services(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """Return status of all managed services."""
    results = []
    for name, path in SERVICES.items():
        try:
            raw = await client.retrieve(path)
            # raw is not None means the config node exists → service enabled
            enabled = raw is not None
        except Exception:
            enabled = False
        results.append({"name": name, "enabled": enabled})
    return results


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
