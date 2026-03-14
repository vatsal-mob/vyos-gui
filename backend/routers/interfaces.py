"""Interface management endpoints."""
import logging
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient
from vyos.models import ConfigureBatch, InterfaceInfo

router = APIRouter(prefix="/api/interfaces", tags=["interfaces"])
logger = logging.getLogger(__name__)


def _parse_interfaces(raw: dict) -> list[InterfaceInfo]:
    """
    Parse showConfig output at path ["interfaces"].
    Structure: {iface_type: {iface_name: {address, description, hw-id, mtu, ...}}}
    """
    interfaces = []
    if not isinstance(raw, dict):
        return interfaces

    for iface_type, iface_group in raw.items():
        if not isinstance(iface_group, dict):
            continue
        for name, data in iface_group.items():
            if not isinstance(data, dict):
                data = {}

            # Address: can be a string or list
            addr = data.get("address", [])
            if isinstance(addr, str):
                addresses = [addr]
            elif isinstance(addr, list):
                addresses = addr
            else:
                addresses = []

            interfaces.append(
                InterfaceInfo(
                    name=name,
                    type=iface_type,
                    description=data.get("description", ""),
                    addresses=addresses,
                    state="up",  # assume up if present in config; real state from show
                    mac=data.get("hw-id", ""),
                    mtu=int(data["mtu"]) if data.get("mtu") else None,
                )
            )

    # Sort: ethernet first, then others alphabetically
    order = {"ethernet": 0, "dummy": 1, "loopback": 2, "pppoe": 3, "wireguard": 4}
    interfaces.sort(key=lambda i: (order.get(i.type, 99), i.name))
    return interfaces


def _parse_show_interfaces(text: str, interfaces: list[InterfaceInfo]) -> list[InterfaceInfo]:
    """
    Overlay up/down state from 'show interfaces' text output.
    Line format: "eth0  10.10.10.1/24  bc:24:11:...  default  1500  u/u  Description"
    State column: u/u=up, D=admin-down
    """
    by_name = {i.name: i for i in interfaces}
    for line in text.splitlines():
        parts = line.split()
        if not parts or parts[0].startswith("-") or parts[0].startswith("I") or parts[0].startswith("C"):
            continue
        iface_name = parts[0]
        if iface_name not in by_name:
            continue
        # Find the S/L column (e.g. u/u or D/D)
        for part in parts:
            if "/" in part and len(part) <= 5:
                state_part = part.lower()
                if state_part.startswith("u"):
                    by_name[iface_name].state = "up"
                elif "d" in state_part:
                    by_name[iface_name].state = "down"
                break
    return interfaces


@router.get("/", response_model=list[InterfaceInfo])
async def list_interfaces(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    try:
        raw = await client.retrieve(["interfaces"])
        interfaces = _parse_interfaces(raw if isinstance(raw, dict) else {})
        # Overlay live up/down state
        try:
            show_text = await client.show(["interfaces"])
            if isinstance(show_text, str):
                interfaces = _parse_show_interfaces(show_text, interfaces)
        except Exception:
            pass
        # Overlay live byte counters from /proc/net/dev
        try:
            counters = await client.get_interface_counters()
            for iface in interfaces:
                c = counters.get(iface.name, {})
                iface.rx_bytes = c.get("rx_bytes", 0)
                iface.tx_bytes = c.get("tx_bytes", 0)
                iface.rx_packets = c.get("rx_packets", 0)
                iface.tx_packets = c.get("tx_packets", 0)
        except Exception:
            pass
        return interfaces
    except Exception as e:
        logger.error("list_interfaces failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{name}", response_model=InterfaceInfo)
async def get_interface(name: str, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    if not re.match(r"^[\w\-\.]+$", name):
        raise HTTPException(status_code=400, detail="Invalid interface name")
    try:
        raw = await client.retrieve(["interfaces"])
        interfaces = _parse_interfaces(raw if isinstance(raw, dict) else {})
        for iface in interfaces:
            if iface.name == name:
                return iface
        raise HTTPException(status_code=404, detail="Interface not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_interface failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{name}")
async def update_interface(
    name: str,
    payload: ConfigureBatch,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    if not re.match(r"^[\w\-\.]+$", name):
        raise HTTPException(status_code=400, detail="Invalid interface name")
    commands = [cmd.model_dump() for cmd in payload.commands]
    try:
        await client.configure(commands)
        logger.info('{"event": "interface_update", "interface": "%s", "commands": %d}', name, len(commands))
        return {"status": "ok"}
    except Exception as e:
        logger.error("update_interface failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
