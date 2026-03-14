"""DHCP pools and leases."""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient
from vyos.models import DHCPPool, DHCPLease, DHCPStaticMapping

router = APIRouter(prefix="/api/dhcp", tags=["dhcp"])
logger = logging.getLogger(__name__)


def _parse_pools(raw: dict) -> list[DHCPPool]:
    """
    Structure: shared-network-name.{pool}.subnet.{cidr}.{option, range, ...}
    """
    pools = []
    if not isinstance(raw, dict):
        return pools
    for pool_name, pool_data in raw.items():
        if not isinstance(pool_data, dict):
            continue
        for subnet_cidr, subnet_info in pool_data.get("subnet", {}).items():
            if not isinstance(subnet_info, dict):
                continue
            opts = subnet_info.get("option", {})
            if not isinstance(opts, dict):
                opts = {}

            # DNS servers: option.name-server (string or dict of {ip: {}})
            dns_raw = opts.get("name-server", [])
            if isinstance(dns_raw, str):
                dns = [dns_raw]
            elif isinstance(dns_raw, dict):
                dns = list(dns_raw.keys())
            elif isinstance(dns_raw, list):
                dns = dns_raw
            else:
                dns = []

            # Range
            range_data = subnet_info.get("range", {})
            range_start = range_stop = ""
            if isinstance(range_data, dict) and range_data:
                first_range = next(iter(range_data.values()), {})
                range_start = first_range.get("start", "")
                range_stop = first_range.get("stop", "")

            pools.append(DHCPPool(
                name=pool_name,
                subnet=subnet_cidr,
                range_start=range_start,
                range_stop=range_stop,
                default_router=opts.get("default-router", ""),
                dns_servers=dns,
                lease=int(subnet_info.get("lease", 86400)),
                description=pool_data.get("description", ""),
            ))
    return pools


def _parse_leases(raw: str) -> list[DHCPLease]:
    """Parse text output of 'show dhcp server leases'.

    VyOS rolling column order:
      0: IP Address
      1: Hardware Address (MAC)
      2: State
      3: Lease Start date
      4: Lease Start time
      5: Lease Expiration date
      6: Lease Expiration time
      7: Remaining
      8: Pool
      9: Hostname (optional)
    """
    leases = []
    if not isinstance(raw, str):
        return leases
    for line in raw.splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[0][0].isdigit():
            leases.append(DHCPLease(
                ip=parts[0],
                mac=parts[1] if len(parts) > 1 else "",
                state=parts[2] if len(parts) > 2 else "",
                expiry=" ".join(parts[5:7]) if len(parts) > 6 else "",
                pool=parts[8] if len(parts) > 8 else "",
                hostname=parts[9] if len(parts) > 9 else "",
            ))
    return leases


@router.get("/pools", response_model=list[DHCPPool])
async def list_pools(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    try:
        raw = await client.retrieve(["service", "dhcp-server", "shared-network-name"])
        # REST API may wrap result with the last path component
        if isinstance(raw, dict) and "shared-network-name" in raw:
            raw = raw["shared-network-name"]
        return _parse_pools(raw if isinstance(raw, dict) else {})
    except Exception as e:
        logger.error("list_pools failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/leases", response_model=list[DHCPLease])
async def list_leases(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    try:
        raw = await client.show(["dhcp", "server", "leases"])
        return _parse_leases(raw if isinstance(raw, str) else "")
    except Exception as e:
        logger.error("list_leases failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pools")
async def create_pool(pool: DHCPPool, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    base = ["service", "dhcp-server", "shared-network-name", pool.name, "subnet", pool.subnet]
    commands = []
    if pool.range_start and pool.range_stop:
        commands += [
            {"op": "set", "path": base + ["range", "0", "start"], "value": pool.range_start},
            {"op": "set", "path": base + ["range", "0", "stop"], "value": pool.range_stop},
        ]
    if pool.default_router:
        commands.append({"op": "set", "path": base + ["option", "default-router"], "value": pool.default_router})
    for dns in pool.dns_servers:
        commands.append({"op": "set", "path": base + ["option", "name-server"], "value": dns})
    commands.append({"op": "set", "path": base + ["lease"], "value": str(pool.lease)})
    try:
        await client.configure(commands)
        logger.info('{"event": "dhcp_pool_create", "pool": "%s"}', pool.name)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/pools/{name}")
async def delete_pool(name: str, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    commands = [{"op": "delete", "path": ["service", "dhcp-server", "shared-network-name", name]}]
    try:
        await client.configure(commands)
        logger.info('{"event": "dhcp_pool_delete", "pool": "%s"}', name)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/static-mappings")
async def list_static_mappings(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """Return all static DHCP mappings across all pools."""
    raw = await client.retrieve(["service", "dhcp-server", "shared-network-name"])
    if isinstance(raw, dict) and "shared-network-name" in raw:
        raw = raw["shared-network-name"]
    if not isinstance(raw, dict):
        return []
    results = []
    for pool_name, pool_data in raw.items():
        if not isinstance(pool_data, dict):
            continue
        for subnet_cidr, subnet_info in pool_data.get("subnet", {}).items():
            if not isinstance(subnet_info, dict):
                continue
            for mapping_name, mapping_data in subnet_info.get("static-mapping", {}).items():
                if not isinstance(mapping_data, dict):
                    continue
                results.append({
                    "pool": pool_name,
                    "name": mapping_name,
                    "ip": mapping_data.get("ip-address", ""),
                    "mac": mapping_data.get("mac-address", mapping_data.get("mac", "")),
                })
    return results


@router.post("/static-mapping")
async def create_static_mapping(
    mapping: DHCPStaticMapping,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    """Create a static DHCP mapping (lease reservation) under the given pool."""
    # Look up the subnet CIDR for this pool
    raw = await client.retrieve(["service", "dhcp-server", "shared-network-name"])
    if isinstance(raw, dict) and "shared-network-name" in raw:
        raw = raw["shared-network-name"]
    if not isinstance(raw, dict) or mapping.pool not in raw:
        raise HTTPException(status_code=404, detail=f"Pool {mapping.pool!r} not found")
    pool_data = raw[mapping.pool]
    subnets = pool_data.get("subnet", {}) if isinstance(pool_data, dict) else {}
    if not subnets:
        raise HTTPException(status_code=404, detail=f"Pool {mapping.pool!r} has no subnets")
    subnet_cidr = next(iter(subnets))

    base = [
        "service", "dhcp-server", "shared-network-name", mapping.pool,
        "subnet", subnet_cidr, "static-mapping", mapping.name,
    ]
    commands = [
        {"op": "set", "path": base + ["ip-address"], "value": mapping.ip},
        {"op": "set", "path": base + ["mac"], "value": mapping.mac},
    ]
    try:
        await client.configure(commands)
        logger.info(
            '{"event": "dhcp_static_mapping_create", "pool": "%s", "name": "%s", "ip": "%s"}',
            mapping.pool, mapping.name, mapping.ip,
        )
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/static-mapping/{pool}/{name}")
async def delete_static_mapping(
    pool: str,
    name: str,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    """Delete a static DHCP mapping by pool and mapping name."""
    raw = await client.retrieve(["service", "dhcp-server", "shared-network-name"])
    if isinstance(raw, dict) and "shared-network-name" in raw:
        raw = raw["shared-network-name"]
    if not isinstance(raw, dict) or pool not in raw:
        raise HTTPException(status_code=404, detail=f"Pool {pool!r} not found")
    pool_data = raw[pool]
    subnets = pool_data.get("subnet", {}) if isinstance(pool_data, dict) else {}
    if not subnets:
        raise HTTPException(status_code=404, detail=f"Pool {pool!r} has no subnets")
    subnet_cidr = next(iter(subnets))

    commands = [{
        "op": "delete",
        "path": [
            "service", "dhcp-server", "shared-network-name", pool,
            "subnet", subnet_cidr, "static-mapping", name,
        ],
    }]
    try:
        await client.configure(commands)
        logger.info('{"event": "dhcp_static_mapping_delete", "pool": "%s", "name": "%s"}', pool, name)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
