"""AdGuard Home container management."""
import logging
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient

router = APIRouter(prefix="/api/adguard", tags=["adguard"])
logger = logging.getLogger(__name__)

_CONTAINER = "adguard"
_BASE = ["container", "name", _CONTAINER]

# Default container config applied on first enable
_DEFAULT_COMMANDS = [
    {"op": "set", "path": _BASE + ["image"], "value": "docker.io/adguard/adguardhome:latest"},
    {"op": "set", "path": _BASE + ["allow-host-networks"]},
    {"op": "set", "path": _BASE + ["port", "http", "source"], "value": "3000"},
    {"op": "set", "path": _BASE + ["port", "http", "destination"], "value": "3000"},
    {"op": "set", "path": _BASE + ["port", "http", "protocol"], "value": "tcp"},
    {"op": "set", "path": _BASE + ["port", "dns-udp", "source"], "value": "53"},
    {"op": "set", "path": _BASE + ["port", "dns-udp", "destination"], "value": "53"},
    {"op": "set", "path": _BASE + ["port", "dns-udp", "protocol"], "value": "udp"},
    {"op": "set", "path": _BASE + ["port", "dns-tcp", "source"], "value": "53"},
    {"op": "set", "path": _BASE + ["port", "dns-tcp", "destination"], "value": "53"},
    {"op": "set", "path": _BASE + ["port", "dns-tcp", "protocol"], "value": "tcp"},
    {"op": "set", "path": _BASE + ["volume", "config", "source"], "value": "/config/adguard"},
    {"op": "set", "path": _BASE + ["volume", "config", "destination"], "value": "/opt/adguardhome/conf"},
    {"op": "set", "path": _BASE + ["restart"], "value": "on-failure"},
]


def _parse_config(raw) -> dict:
    """
    Parse AdGuard container config from either a REST dict or SSH text commands.
    Returns a normalised config dict.
    """
    cfg = {
        "image": "docker.io/adguard/adguardhome:latest",
        "web_port": 3000,
        "dns_port": 53,
        "allow_host_networks": False,
        "config_volume_source": "/config/adguard",
        "config_volume_destination": "/opt/adguardhome/conf",
        "restart": "on-failure",
        "ports": [],
    }

    if isinstance(raw, dict):
        # Unwrap REST envelope e.g. {"adguard": {...}}
        data = raw.get(_CONTAINER, raw)
        if not isinstance(data, dict):
            return cfg
        cfg["image"] = data.get("image", cfg["image"])
        cfg["allow_host_networks"] = "allow-host-networks" in data
        cfg["restart"] = data.get("restart", cfg["restart"])

        ports = data.get("port", {})
        if isinstance(ports, dict):
            for _name, pd in ports.items():
                if not isinstance(pd, dict):
                    continue
                cfg["ports"].append({
                    "name": _name,
                    "source": int(pd.get("source", 0)),
                    "destination": int(pd.get("destination", 0)),
                    "protocol": pd.get("protocol", "tcp"),
                })
                # Infer web_port / dns_port from port names
                if "http" in _name or "web" in _name:
                    cfg["web_port"] = int(pd.get("destination", 3000))
                elif "dns" in _name and pd.get("protocol") == "udp":
                    cfg["dns_port"] = int(pd.get("destination", 53))

        vols = data.get("volume", {})
        if isinstance(vols, dict) and "config" in vols:
            v = vols["config"]
            if isinstance(v, dict):
                cfg["config_volume_source"] = v.get("source", cfg["config_volume_source"])
                cfg["config_volume_destination"] = v.get("destination", cfg["config_volume_destination"])

    elif isinstance(raw, str):
        # Parse SSH text commands like:
        # set container name adguard image 'docker.io/...'
        def _grab(pattern):
            m = re.search(pattern, raw)
            return m.group(1).strip("'\"") if m else None

        img = _grab(r"set container name adguard image '?([^\s']+)")
        if img:
            cfg["image"] = img
        cfg["allow_host_networks"] = "allow-host-networks" in raw
        restart = _grab(r"set container name adguard restart '?([^\s']+)")
        if restart:
            cfg["restart"] = restart

        # Ports — iterate over lines
        for line in raw.splitlines():
            m = re.match(
                r"set container name adguard port (\S+) source '?(\d+)'?", line
            )
            if m:
                pname, src = m.group(1), int(m.group(2))
                dm = re.search(
                    rf"set container name adguard port {re.escape(pname)} destination '?(\d+)'?",
                    raw,
                )
                pm = re.search(
                    rf"set container name adguard port {re.escape(pname)} protocol '?(\w+)'?",
                    raw,
                )
                dst = int(dm.group(1)) if dm else src
                proto = pm.group(1) if pm else "tcp"
                cfg["ports"].append({"name": pname, "source": src, "destination": dst, "protocol": proto})
                if "http" in pname or "web" in pname:
                    cfg["web_port"] = dst
                elif "dns" in pname and proto == "udp":
                    cfg["dns_port"] = dst

        vs = _grab(r"set container name adguard volume config source '?([^\s']+)")
        if vs:
            cfg["config_volume_source"] = vs
        vd = _grab(r"set container name adguard volume config destination '?([^\s']+)")
        if vd:
            cfg["config_volume_destination"] = vd

    return cfg


@router.get("/status")
async def get_status(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """Return whether AdGuard is configured in VyOS and whether the container is running."""
    try:
        raw = await client.retrieve(_BASE)
        configured = raw is not None and raw != "" and raw != {}
        running_status = "unknown"
        if configured:
            running_status = await client.get_container_running_status(_CONTAINER)
        cfg = _parse_config(raw) if configured else {}
        return {
            "configured": configured,
            "running": running_status == "running",
            "running_status": running_status,
            **cfg,
        }
    except Exception as e:
        logger.error("adguard get_status failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config")
async def get_config(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """Return current AdGuard container configuration."""
    try:
        raw = await client.retrieve(_BASE)
        if not raw:
            raise HTTPException(status_code=404, detail="AdGuard is not configured")
        return _parse_config(raw)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("adguard get_config failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/enable")
async def enable_adguard(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """Create AdGuard container with default configuration."""
    try:
        await client.configure(_DEFAULT_COMMANDS)
        logger.info('{"event": "adguard_enable"}')
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disable")
async def disable_adguard(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """Remove AdGuard container configuration."""
    try:
        await client.configure([{"op": "delete", "path": _BASE}])
        logger.info('{"event": "adguard_disable"}')
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/config")
async def update_config(payload: dict, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    """
    Update AdGuard container configuration.
    Accepted fields: image, web_port, dns_port, config_volume_source, restart, allow_host_networks.
    """
    _IMG_RE = re.compile(r"^[\w\.\-/:]+$")
    _PORT_RE = re.compile(r"^\d{1,5}$")
    _PATH_RE = re.compile(r"^/[\w\.\-/]+$")

    commands = []

    if "image" in payload:
        img = str(payload["image"])
        if not _IMG_RE.match(img):
            raise HTTPException(status_code=400, detail="Invalid image name")
        commands.append({"op": "set", "path": _BASE + ["image"], "value": img})

    if "web_port" in payload:
        port = str(payload["web_port"])
        if not _PORT_RE.match(port):
            raise HTTPException(status_code=400, detail="Invalid web_port")
        commands += [
            {"op": "set", "path": _BASE + ["port", "http", "source"], "value": port},
            {"op": "set", "path": _BASE + ["port", "http", "destination"], "value": port},
            {"op": "set", "path": _BASE + ["port", "http", "protocol"], "value": "tcp"},
        ]

    if "dns_port" in payload:
        port = str(payload["dns_port"])
        if not _PORT_RE.match(port):
            raise HTTPException(status_code=400, detail="Invalid dns_port")
        commands += [
            {"op": "set", "path": _BASE + ["port", "dns-udp", "source"], "value": port},
            {"op": "set", "path": _BASE + ["port", "dns-udp", "destination"], "value": port},
            {"op": "set", "path": _BASE + ["port", "dns-udp", "protocol"], "value": "udp"},
            {"op": "set", "path": _BASE + ["port", "dns-tcp", "source"], "value": port},
            {"op": "set", "path": _BASE + ["port", "dns-tcp", "destination"], "value": port},
            {"op": "set", "path": _BASE + ["port", "dns-tcp", "protocol"], "value": "tcp"},
        ]

    if "config_volume_source" in payload:
        path = str(payload["config_volume_source"])
        if not _PATH_RE.match(path):
            raise HTTPException(status_code=400, detail="Invalid volume source path")
        commands.append({"op": "set", "path": _BASE + ["volume", "config", "source"], "value": path})

    if "restart" in payload:
        val = str(payload["restart"])
        if val not in ("on-failure", "always", "unless-stopped", "no"):
            raise HTTPException(status_code=400, detail="Invalid restart policy")
        commands.append({"op": "set", "path": _BASE + ["restart"], "value": val})

    if "allow_host_networks" in payload:
        if payload["allow_host_networks"]:
            commands.append({"op": "set", "path": _BASE + ["allow-host-networks"]})
        else:
            commands.append({"op": "delete", "path": _BASE + ["allow-host-networks"]})

    if not commands:
        raise HTTPException(status_code=400, detail="No valid fields provided")

    try:
        await client.configure(commands)
        logger.info('{"event": "adguard_config_update"}')
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
