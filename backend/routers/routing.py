"""Static routes and routing table."""
import logging
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient
from vyos.models import StaticRoute, RouteEntry

router = APIRouter(prefix="/api/routing", tags=["routing"])
logger = logging.getLogger(__name__)

_PREFIX_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}/\d{1,2}$")
_NEXTHOP_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


def _validate_prefix(prefix: str) -> str:
    if not _PREFIX_RE.match(prefix):
        raise HTTPException(status_code=400, detail=f"Invalid prefix: {prefix!r}")
    return prefix


def _validate_nexthop(nh: str) -> str:
    if not _NEXTHOP_RE.match(nh):
        raise HTTPException(status_code=400, detail=f"Invalid next-hop: {nh!r}")
    return nh


_ROUTE_LINE_RE = re.compile(
    r"^([A-Za-z*>]+)\s+([\d\.]+/\d+)\s+\[(\d+)/\d+\].*?(?:via\s+([\d\.]+)|directly connected,\s+([\w\.]+)).*?,\s+([\w\.]+h\w*)$"
)
_ROUTE_CONN_RE = re.compile(
    r"^([A-Za-z*>]+)\s+([\d\.]+/\d+)\s+is directly connected,\s+([\w\.]+)"
)
_ROUTE_VIA_RE = re.compile(
    r"^([A-Za-z*>]+)\s+([\d\.]+/\d+)\s+\[(\d+)/\d+\]\s+via\s+([\d\.]+)"
)

_PROTO_MAP = {"S": "static", "C": "connected", "L": "local", "K": "kernel",
              "O": "ospf", "R": "rip", "B": "bgp", "I": "isis"}


def _parse_rib_text(text: str) -> list[RouteEntry]:
    """Parse VyOS 'show ip route' text output."""
    routes = []
    if not isinstance(text, str):
        return routes
    seen: set[tuple] = set()
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("Codes") or line.startswith(" ") or line.startswith("-"):
            continue
        # Extract protocol letter(s) from prefix flags like "S>*", "C>*", "L>*"
        proto_flags = ""
        rest = line
        m = re.match(r"^([A-Za-z]+[>*\s]*)", line)
        if m:
            proto_flags = m.group(1).strip().replace(">", "").replace("*", "")
            rest = line[m.end():].strip()

        proto = _PROTO_MAP.get(proto_flags[0], proto_flags[0].lower()) if proto_flags else "unknown"

        # Extract prefix
        prefix_m = re.match(r"^([\d\.]+/\d+)", rest)
        if not prefix_m:
            continue
        prefix = prefix_m.group(1)
        after_prefix = rest[prefix_m.end():].strip()

        # Distance
        dist_m = re.match(r"\[(\d+)/\d+\]", after_prefix)
        distance = int(dist_m.group(1)) if dist_m else 0

        # Next hop / interface
        via_m = re.search(r"via\s+([\d\.]+)", after_prefix)
        conn_m = re.search(r"directly connected,\s+([\w\.\-]+)", after_prefix)
        intf_m = re.search(r",\s+([\w\.\-]+),", after_prefix)

        nexthops = []
        interface = ""
        if via_m:
            nexthops = [via_m.group(1)]
        if conn_m:
            interface = conn_m.group(1)
        elif intf_m:
            interface = intf_m.group(1)

        # Uptime — last token like "03w5d06h" or "1d18h35m"
        uptime_m = re.search(r"(\d+[wdhms]\S*)\s*$", after_prefix)
        uptime = uptime_m.group(1) if uptime_m else ""

        key = (prefix, proto, tuple(nexthops), interface)
        if key in seen:
            continue
        seen.add(key)

        routes.append(RouteEntry(
            prefix=prefix,
            protocol=proto,
            distance=distance,
            next_hops=nexthops,
            interface=interface,
            uptime=uptime,
        ))
    return routes


@router.get("/table", response_model=list[RouteEntry])
async def get_routing_table(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    try:
        raw = await client.show(["ip", "route"])
        return _parse_rib_text(raw if isinstance(raw, str) else "")
    except Exception as e:
        logger.error("get_routing_table failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/static", response_model=list[StaticRoute])
async def list_static_routes(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    try:
        raw = await client.retrieve(["protocols", "static", "route"])
        routes = []
        if isinstance(raw, dict):
            for prefix, data in raw.items():
                if not isinstance(data, dict):
                    continue
                for nh, nh_data in data.get("next-hop", {}).items():
                    routes.append(
                        StaticRoute(
                            prefix=prefix,
                            next_hop=nh,
                            distance=int((nh_data or {}).get("distance", 1)),
                            description=(nh_data or {}).get("description", ""),
                        )
                    )
        return routes
    except Exception as e:
        logger.error("list_static_routes failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/static")
async def add_static_route(route: StaticRoute, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    _validate_prefix(route.prefix)
    _validate_nexthop(route.next_hop)
    commands = [
        {"op": "set", "path": ["protocols", "static", "route", route.prefix, "next-hop", route.next_hop]},
        {"op": "set", "path": ["protocols", "static", "route", route.prefix, "next-hop", route.next_hop, "distance"], "value": str(route.distance)},
    ]
    if route.description:
        commands.append({"op": "set", "path": ["protocols", "static", "route", route.prefix, "description"], "value": route.description})
    try:
        await client.configure(commands)
        logger.info('{"event": "static_route_add", "prefix": "%s", "next_hop": "%s"}', route.prefix, route.next_hop)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/static/{prefix:path}")
async def delete_static_route(prefix: str, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    _validate_prefix(prefix)
    commands = [{"op": "delete", "path": ["protocols", "static", "route", prefix]}]
    try:
        await client.configure(commands)
        logger.info('{"event": "static_route_delete", "prefix": "%s"}', prefix)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
