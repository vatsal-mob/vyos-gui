"""Network diagnostics — ping, traceroute, ARP table, conntrack, logs."""
import logging
import re
from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient
from vyos.models import ARPEntry, DiagResult

router = APIRouter(prefix="/api/diag", tags=["diagnostics"])
logger = logging.getLogger(__name__)

_HOST_RE = re.compile(r"^[\w\.\-]+$")


def _validate_host(host: str) -> str:
    if not _HOST_RE.match(host) or len(host) > 253:
        raise HTTPException(status_code=400, detail=f"Invalid host: {host!r}")
    return host


def _parse_arp(raw: str) -> list[ARPEntry]:
    entries: list[ARPEntry] = []
    if not isinstance(raw, str):
        return entries
    for line in raw.splitlines():
        # Format: IP address       HW type     Flags       HW address            Mask     Device
        # or: Address    HWtype  HWaddress   Flags Iface
        parts = line.split()
        if len(parts) >= 3 and re.match(r"^\d{1,3}(\.\d{1,3}){3}$", parts[0]):
            ip = parts[0]
            # Try to find MAC (6 groups of 2 hex digits separated by colons)
            mac = ""
            iface = ""
            for p in parts[1:]:
                if re.match(r"^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$", p):
                    mac = p
                elif re.match(r"^[a-z][a-z0-9\.\-]+$", p) and "." not in p:
                    iface = p
            entries.append(ARPEntry(ip=ip, mac=mac, interface=iface))
    return entries


@router.get("/ping")
async def ping(
    host: str,
    count: int = 4,
    client: Annotated[VyOSClient, Depends(get_vyos_client)] = None,
):
    _validate_host(host)
    if count < 1 or count > 20:
        raise HTTPException(status_code=400, detail="count must be 1–20")
    try:
        output = await client.ping(host, count)
        success = "bytes from" in output or "64 bytes" in output
        logger.info('{"event": "ping", "host": "%s"}', host)
        return DiagResult(host=host, output=output, success=success)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/traceroute")
async def traceroute(
    host: str,
    client: Annotated[VyOSClient, Depends(get_vyos_client)] = None,
):
    _validate_host(host)
    try:
        output = await client.traceroute(host)
        logger.info('{"event": "traceroute", "host": "%s"}', host)
        return DiagResult(host=host, output=output)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/arp", response_model=list[ARPEntry])
async def get_arp(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    try:
        raw = await client.show_arp()
        return _parse_arp(raw if isinstance(raw, str) else "")
    except Exception as e:
        logger.error("get_arp failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


def _parse_conntrack(raw: str) -> list[dict]:
    """Parse conntrack table output into structured records."""
    entries = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) < 3:
            continue
        proto = parts[0] if parts else "unknown"
        # find state (usually uppercase word)
        state = ""
        for p in parts:
            if p.isupper() and len(p) > 2 and not p.startswith("src=") and not p.startswith("dst="):
                state = p
                break
        src_m = re.search(r"src=([\d\.]+)", line)
        dst_m = re.search(r"dst=([\d\.]+)", line)
        bytes_m = re.search(r"bytes=(\d+)", line)
        pkts_m = re.search(r"packets=(\d+)", line)
        sport_m = re.search(r"sport=(\d+)", line)
        dport_m = re.search(r"dport=(\d+)", line)
        if src_m and dst_m:
            entries.append({
                "protocol": proto,
                "src": src_m.group(1),
                "dst": dst_m.group(1),
                "sport": sport_m.group(1) if sport_m else "",
                "dport": dport_m.group(1) if dport_m else "",
                "state": state,
                "bytes": int(bytes_m.group(1)) if bytes_m else 0,
                "packets": int(pkts_m.group(1)) if pkts_m else 0,
            })
    return entries


def _parse_top_talkers(raw: str) -> list[dict]:
    counts: dict = defaultdict(lambda: {"connections": 0, "bytes": 0})
    for line in raw.splitlines():
        src_m = re.search(r"src=([\d\.]+)", line)
        bytes_m = re.search(r"bytes=(\d+)", line)
        if src_m:
            ip = src_m.group(1)
            counts[ip]["connections"] += 1
            if bytes_m:
                counts[ip]["bytes"] += int(bytes_m.group(1))
    return sorted(
        [{"ip": k, **v} for k, v in counts.items()],
        key=lambda x: x["connections"],
        reverse=True
    )[:10]


@router.get("/conntrack")
async def get_conntrack(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """Return parsed conntrack table."""
    try:
        raw = await client.show_conntrack()
        return {"entries": _parse_conntrack(raw if isinstance(raw, str) else "")}
    except Exception as e:
        logger.error("get_conntrack failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/top-talkers")
async def get_top_talkers(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """Return top 10 source IPs by connection count."""
    try:
        raw = await client.show_conntrack()
        return {"talkers": _parse_top_talkers(raw if isinstance(raw, str) else "")}
    except Exception as e:
        logger.error("get_top_talkers failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
