"""System info, metrics, reachability, and configuration."""
import logging
import re
import secrets
import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient
from vyos.models import SystemInfo

router = APIRouter(prefix="/api/system", tags=["system"])
logger = logging.getLogger(__name__)

_confirm_tokens: dict[str, float] = {}
CONFIRM_TTL = 60

_HOSTNAME_RE = re.compile(r"^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$")
_IP_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
_FQDN_RE = re.compile(r"^[a-zA-Z0-9]([a-zA-Z0-9\.\-]{0,253}[a-zA-Z0-9])?$")
_USERNAME_RE = re.compile(r"^[a-z][a-z0-9_\-]{0,31}$")


def _issue_confirm_token() -> str:
    token = secrets.token_hex(16)
    _confirm_tokens[token] = time.time() + CONFIRM_TTL
    return token


def _consume_confirm_token(token: str) -> bool:
    expiry = _confirm_tokens.pop(token, None)
    return expiry is not None and time.time() <= expiry


@router.get("/info", response_model=SystemInfo)
async def get_system_info(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    try:
        raw = await client.get_system_info()
        return SystemInfo(**raw, reachable=True)
    except Exception as e:
        logger.error("System info failed: %s", e)
        return SystemInfo(reachable=False)


@router.get("/reachable")
async def check_reachable(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    reachable = await client.health_check()
    return {"reachable": reachable}


# --- Hostname ---

@router.get("/hostname")
async def get_hostname(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    try:
        raw = await client.retrieve(["system", "host-name"])
        hostname = raw if isinstance(raw, str) else (raw or {}).get("host-name", "")
        return {"hostname": hostname}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/hostname")
async def set_hostname(
    payload: dict,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    hostname = payload.get("hostname", "")
    if not _HOSTNAME_RE.match(hostname):
        raise HTTPException(status_code=400, detail=f"Invalid hostname: {hostname!r}")
    try:
        await client.configure([{"op": "set", "path": ["system", "host-name"], "value": hostname}])
        logger.info('{"event": "hostname_set", "hostname": "%s"}', hostname)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- NTP ---

@router.get("/ntp")
async def get_ntp(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    try:
        raw = await client.retrieve(["system", "ntp"])
        if not isinstance(raw, dict):
            return {"servers": []}
        ntp_data = raw.get("ntp", raw)
        servers_raw = ntp_data.get("server", {})
        if isinstance(servers_raw, dict):
            servers = list(servers_raw.keys())
        elif isinstance(servers_raw, list):
            servers = servers_raw
        elif isinstance(servers_raw, str):
            servers = [servers_raw]
        else:
            servers = []
        return {"servers": servers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/ntp")
async def set_ntp(
    payload: dict,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    servers = payload.get("servers", [])
    for s in servers:
        if not _FQDN_RE.match(s):
            raise HTTPException(status_code=400, detail=f"Invalid NTP server: {s!r}")
    commands = [{"op": "delete", "path": ["system", "ntp", "server"]}]
    for s in servers:
        commands.append({"op": "set", "path": ["system", "ntp", "server", s]})
    try:
        await client.configure(commands)
        logger.info('{"event": "ntp_update", "count": %d}', len(servers))
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Users ---

@router.get("/users")
async def list_users(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    try:
        raw = await client.retrieve(["system", "login", "user"])
        if not isinstance(raw, dict):
            return []
        users_data = raw.get("user", raw)
        users = []
        for username, data in users_data.items():
            if not isinstance(data, dict):
                continue
            users.append({
                "username": username,
                "level": data.get("level", "operator"),
                "full_name": data.get("full-name", ""),
            })
        return users
    except Exception as e:
        logger.error("list_users failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users")
async def create_user(
    payload: dict,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    username = payload.get("username", "")
    password = payload.get("password", "")
    level = payload.get("level", "operator")
    if not _USERNAME_RE.match(username):
        raise HTTPException(status_code=400, detail=f"Invalid username: {username!r}")
    if level not in ("admin", "operator"):
        raise HTTPException(status_code=400, detail="level must be 'admin' or 'operator'")
    commands = [
        {"op": "set", "path": ["system", "login", "user", username, "level"], "value": level},
        {"op": "set", "path": ["system", "login", "user", username, "authentication", "plaintext-password"], "value": password},
    ]
    try:
        await client.configure(commands)
        logger.info('{"event": "user_create", "username": "%s"}', username)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/users/{username}")
async def delete_user(
    username: str,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    if not _USERNAME_RE.match(username):
        raise HTTPException(status_code=400, detail=f"Invalid username: {username!r}")
    commands = [{"op": "delete", "path": ["system", "login", "user", username]}]
    try:
        await client.configure(commands)
        logger.info('{"event": "user_delete", "username": "%s"}', username)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Reboot / Poweroff ---

@router.post("/reboot/confirm-token")
async def request_reboot_token(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    token = _issue_confirm_token()
    logger.info('{"event": "reboot_token_issued"}')
    return {"confirm_token": token, "expires_in": CONFIRM_TTL}


@router.post("/reboot")
async def reboot_router(
    payload: dict,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    if not _consume_confirm_token(payload.get("confirm_token", "")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing or expired confirmation token")
    logger.info('{"event": "reboot_requested"}')
    await client.reboot()
    return {"status": "rebooting"}


@router.post("/poweroff/confirm-token")
async def request_poweroff_token(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    token = _issue_confirm_token()
    logger.info('{"event": "poweroff_token_issued"}')
    return {"confirm_token": token, "expires_in": CONFIRM_TTL}


@router.post("/poweroff")
async def poweroff_router(
    payload: dict,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    if not _consume_confirm_token(payload.get("confirm_token", "")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing or expired confirmation token")
    logger.info('{"event": "poweroff_requested"}')
    await client.poweroff()
    return {"status": "powering off"}


@router.get("/logs")
async def get_logs(
    lines: int = 100,
    filter_str: str = "",
    client: Annotated[VyOSClient, Depends(get_vyos_client)] = None,
):
    """Return recent log lines."""
    try:
        output = await client.get_logs(lines, filter_str)
        return {"lines": output.splitlines() if output else []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/firewall-log")
async def get_firewall_log(
    lines: int = 30,
    client: Annotated[VyOSClient, Depends(get_vyos_client)] = None,
):
    """Return recent firewall log lines."""
    try:
        output = await client.get_firewall_log(lines)
        return {"lines": output.splitlines() if output else []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
