"""WireGuard VPN configuration and status."""
import logging
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient
from vyos.models import WireGuardInterface, WireGuardPeer

router = APIRouter(prefix="/api/vpn", tags=["vpn"])
logger = logging.getLogger(__name__)

_IFACE_RE = re.compile(r"^wg\d+$")


def _parse_wg_interfaces(raw: dict) -> list[WireGuardInterface]:
    """Parse VyOS wireguard interface config."""
    interfaces: list[WireGuardInterface] = []
    if not isinstance(raw, dict):
        return interfaces

    wg_section = raw.get("wireguard", {})
    if not isinstance(wg_section, dict):
        return interfaces

    for iface_name, iface_data in wg_section.items():
        if not isinstance(iface_data, dict):
            continue

        # Address: string or list
        addr_raw = iface_data.get("address", "")
        if isinstance(addr_raw, list):
            address = addr_raw[0] if addr_raw else ""
        else:
            address = addr_raw

        peers: list[WireGuardPeer] = []
        for peer_name, peer_data in iface_data.get("peer", {}).items():
            if not isinstance(peer_data, dict):
                continue
            allowed_raw = peer_data.get("allowed-ips", [])
            if isinstance(allowed_raw, str):
                allowed = [allowed_raw]
            elif isinstance(allowed_raw, dict):
                allowed = list(allowed_raw.keys())
            elif isinstance(allowed_raw, list):
                allowed = allowed_raw
            else:
                allowed = []
            peers.append(WireGuardPeer(
                name=peer_name,
                public_key=peer_data.get("public-key", ""),
                preshared_key="**REDACTED**" if peer_data.get("preshared-key") else "",
                allowed_ips=allowed,
                endpoint=peer_data.get("address", ""),
                persistent_keepalive=int(peer_data.get("persistent-keepalive", 0)),
            ))

        interfaces.append(WireGuardInterface(
            name=iface_name,
            description=iface_data.get("description", ""),
            address=address,
            port=int(iface_data.get("port", 51820)),
            private_key="**REDACTED**" if iface_data.get("private-key") else "",
            peers=peers,
        ))
    return interfaces


@router.get("/wireguard", response_model=list[WireGuardInterface])
async def list_wireguard(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    try:
        raw = await client.retrieve(["interfaces", "wireguard"])
        if isinstance(raw, dict) and "wireguard" not in raw:
            raw = {"wireguard": raw}
        return _parse_wg_interfaces(raw if isinstance(raw, dict) else {})
    except Exception as e:
        logger.error("list_wireguard failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/wireguard/status")
async def wireguard_status(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """Get live WireGuard status (handshakes, traffic, etc.)."""
    try:
        output = await client.show_wireguard()
        return {"status": output}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ipsec")
async def get_ipsec_status(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """Get IPsec SA status."""
    try:
        output = await client.show_ipsec_sa()
        return {"status": output}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/openvpn")
async def get_openvpn_status(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """Get OpenVPN status."""
    try:
        output = await client.show_openvpn()
        return {"status": output}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/wireguard/{name}/peer")
async def add_peer(
    name: str,
    peer: WireGuardPeer,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    if not _IFACE_RE.match(name):
        raise HTTPException(status_code=400, detail="Interface name must match wgN")
    base = ["interfaces", "wireguard", name, "peer", peer.name]
    commands = [
        {"op": "set", "path": base + ["public-key"], "value": peer.public_key},
    ]
    for cidr in peer.allowed_ips:
        commands.append({"op": "set", "path": base + ["allowed-ips", cidr]})
    if peer.endpoint:
        commands.append({"op": "set", "path": base + ["address"], "value": peer.endpoint})
    if peer.persistent_keepalive:
        commands.append({"op": "set", "path": base + ["persistent-keepalive"], "value": str(peer.persistent_keepalive)})
    if peer.preshared_key:
        commands.append({"op": "set", "path": base + ["preshared-key"], "value": peer.preshared_key})
    try:
        await client.configure(commands)
        logger.info('{"event": "wg_peer_add", "iface": "%s", "peer": "%s"}', name, peer.name)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/wireguard/{name}/peer/{peer_name}")
async def delete_peer(
    name: str,
    peer_name: str,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    if not _IFACE_RE.match(name):
        raise HTTPException(status_code=400, detail="Interface name must match wgN")
    commands = [{"op": "delete", "path": ["interfaces", "wireguard", name, "peer", peer_name]}]
    try:
        await client.configure(commands)
        logger.info('{"event": "wg_peer_delete", "iface": "%s", "peer": "%s"}', name, peer_name)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
