"""DNS forwarding configuration."""
import logging
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient
from vyos.models import DNSForwarding

router = APIRouter(prefix="/api/dns", tags=["dns"])
logger = logging.getLogger(__name__)

_IP_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
_DOMAIN_RE = re.compile(r"^[\w\-\.]+$")


def _parse_forwarding(raw: dict) -> DNSForwarding:
    """
    VyOS rolling structure:
      forwarding.name-server: {"1.1.1.1": {}, "9.9.9.9": {}}  (dict of IP -> {})
      forwarding.listen-address: "10.10.10.1" or ["10.10.10.1", ...]
    """
    fwd = raw.get("forwarding", raw) if isinstance(raw, dict) else {}
    if not isinstance(fwd, dict):
        return DNSForwarding()

    # name-server: dict or list or string
    ns_raw = fwd.get("name-server", {})
    if isinstance(ns_raw, dict):
        ns = list(ns_raw.keys())
    elif isinstance(ns_raw, list):
        ns = ns_raw
    elif isinstance(ns_raw, str):
        ns = [ns_raw]
    else:
        ns = []

    # listen-address: string or list
    listen_raw = fwd.get("listen-address", [])
    if isinstance(listen_raw, str):
        listen = [listen_raw]
    elif isinstance(listen_raw, list):
        listen = listen_raw
    else:
        listen = []

    # domain overrides: domain.{name}.server or authoritative-domain
    domains: dict[str, str] = {}
    for domain, data in fwd.get("domain", {}).items():
        if isinstance(data, dict):
            domains[domain] = data.get("server", "")
        elif isinstance(data, str):
            domains[domain] = data

    return DNSForwarding(
        nameservers=ns,
        listen_addresses=listen,
        cache_size=int(fwd.get("cache-size", 10000)),
        domain_overrides=domains,
    )


@router.get("/forwarding", response_model=DNSForwarding)
async def get_forwarding(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    try:
        raw = await client.retrieve(["service", "dns"])
        return _parse_forwarding(raw if isinstance(raw, dict) else {})
    except Exception as e:
        logger.error("get_forwarding failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/forwarding/nameservers")
async def set_nameservers(payload: dict, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    servers = payload.get("servers", [])
    for s in servers:
        if not _IP_RE.match(s):
            raise HTTPException(status_code=400, detail=f"Invalid nameserver IP: {s!r}")
    commands = [{"op": "delete", "path": ["service", "dns", "forwarding", "name-server"]}]
    for s in servers:
        commands.append({"op": "set", "path": ["service", "dns", "forwarding", "name-server", s]})
    try:
        await client.configure(commands)
        logger.info('{"event": "dns_nameservers_update", "count": %d}', len(servers))
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/forwarding/listen-addresses")
async def set_listen_addresses(payload: dict, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    addresses = payload.get("addresses", [])
    for a in addresses:
        if not _IP_RE.match(a):
            raise HTTPException(status_code=400, detail=f"Invalid address: {a!r}")
    commands = [{"op": "delete", "path": ["service", "dns", "forwarding", "listen-address"]}]
    for a in addresses:
        commands.append({"op": "set", "path": ["service", "dns", "forwarding", "listen-address"], "value": a})
    try:
        await client.configure(commands)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/forwarding/domain")
async def add_domain_override(payload: dict, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    domain = payload.get("domain", "")
    server = payload.get("server", "")
    if not _DOMAIN_RE.match(domain):
        raise HTTPException(status_code=400, detail=f"Invalid domain: {domain!r}")
    if not _IP_RE.match(server):
        raise HTTPException(status_code=400, detail=f"Invalid server IP: {server!r}")
    commands = [{"op": "set", "path": ["service", "dns", "forwarding", "domain", domain, "server"], "value": server}]
    try:
        await client.configure(commands)
        logger.info('{"event": "dns_domain_add", "domain": "%s"}', domain)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/forwarding/domain/{domain}")
async def delete_domain_override(domain: str, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    if not _DOMAIN_RE.match(domain):
        raise HTTPException(status_code=400, detail=f"Invalid domain: {domain!r}")
    commands = [{"op": "delete", "path": ["service", "dns", "forwarding", "domain", domain]}]
    try:
        await client.configure(commands)
        logger.info('{"event": "dns_domain_delete", "domain": "%s"}', domain)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Authoritative DNS records
# ---------------------------------------------------------------------------

_RECORD_TYPE_RE = re.compile(r"^(a|aaaa|cname|mx|txt|srv|ns|ptr)$", re.IGNORECASE)
_RECORD_NAME_RE = re.compile(r"^[@\w\-\.]+$")


def _parse_authoritative(raw: dict) -> list[dict]:
    """
    Parse authoritative-domain records from VyOS config dict.

    Expected structure:
      {domain: {records: {type: {name: {address: value}}}}}
    """
    results = []
    auth = raw.get("authoritative-domain", {})
    if not isinstance(auth, dict):
        return results
    for domain, domain_data in auth.items():
        if not isinstance(domain_data, dict):
            continue
        for rtype, names in domain_data.get("records", {}).items():
            if not isinstance(names, dict):
                continue
            for name, name_data in names.items():
                if not isinstance(name_data, dict):
                    continue
                value = name_data.get("address", name_data.get("target", ""))
                results.append({
                    "domain": domain,
                    "type": rtype.upper(),
                    "name": name,
                    "value": value,
                })
    return results


@router.get("/authoritative")
async def get_authoritative_records(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """List all authoritative DNS domain records."""
    try:
        raw = await client.retrieve(["service", "dns", "forwarding"])
        fwd = raw.get("forwarding", raw) if isinstance(raw, dict) else {}
        return {"records": _parse_authoritative(fwd if isinstance(fwd, dict) else {})}
    except Exception as e:
        logger.error("get_authoritative_records failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/authoritative/record")
async def add_authoritative_record(payload: dict, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """Add an A/AAAA/CNAME record to an authoritative domain."""
    domain = payload.get("domain", "")
    rtype = payload.get("type", "a").lower()
    name = payload.get("name", "")
    value = payload.get("value", "")
    if not _DOMAIN_RE.match(domain):
        raise HTTPException(status_code=400, detail=f"Invalid domain: {domain!r}")
    if not _RECORD_TYPE_RE.match(rtype):
        raise HTTPException(status_code=400, detail=f"Invalid record type: {rtype!r}")
    if not _RECORD_NAME_RE.match(name):
        raise HTTPException(status_code=400, detail=f"Invalid record name: {name!r}")
    commands = [{
        "op": "set",
        "path": ["service", "dns", "forwarding", "authoritative-domain", domain, "records", rtype, name, "address"],
        "value": value,
    }]
    try:
        await client.configure(commands)
        logger.info('{"event": "dns_record_add", "domain": "%s", "type": "%s", "name": "%s"}', domain, rtype, name)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/authoritative/record/{domain}/{rtype}/{name}")
async def delete_authoritative_record(
    domain: str,
    rtype: str,
    name: str,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    """Delete an authoritative DNS record."""
    if not _DOMAIN_RE.match(domain):
        raise HTTPException(status_code=400, detail=f"Invalid domain: {domain!r}")
    if not _RECORD_TYPE_RE.match(rtype):
        raise HTTPException(status_code=400, detail=f"Invalid record type: {rtype!r}")
    if not _RECORD_NAME_RE.match(name):
        raise HTTPException(status_code=400, detail=f"Invalid record name: {name!r}")
    commands = [{
        "op": "delete",
        "path": ["service", "dns", "forwarding", "authoritative-domain", domain, "records", rtype, name],
    }]
    try:
        await client.configure(commands)
        logger.info('{"event": "dns_record_delete", "domain": "%s", "type": "%s", "name": "%s"}', domain, rtype, name)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
