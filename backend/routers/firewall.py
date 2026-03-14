"""Firewall rules and groups — VyOS rolling (ipv4.input/forward/output.filter structure)."""
import logging
import re
import secrets
import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient
from vyos.models import FirewallRule, FirewallGroup, ConfigureBatch

router = APIRouter(prefix="/api/firewall", tags=["firewall"])
logger = logging.getLogger(__name__)

_CHAIN_RE = re.compile(r"^[\w\-]+$")
_confirm_tokens: dict[str, float] = {}
CONFIRM_TTL = 60


def _issue_token() -> str:
    token = secrets.token_hex(16)
    _confirm_tokens[token] = time.time() + CONFIRM_TTL
    return token


def _consume_token(token: str) -> bool:
    expiry = _confirm_tokens.pop(token, None)
    return expiry is not None and time.time() <= expiry


def _parse_rules(rule_dict: dict) -> list[FirewallRule]:
    rules = []
    for rule_num, rule_data in rule_dict.items():
        if not isinstance(rule_data, dict):
            continue
        rules.append(
            FirewallRule(
                rule_number=int(rule_num),
                action=rule_data.get("action", "drop"),
                description=rule_data.get("description", ""),
                source=str(rule_data.get("source", {}).get("address", "") if isinstance(rule_data.get("source"), dict) else ""),
                destination=str(rule_data.get("destination", {}).get("address", "") if isinstance(rule_data.get("destination"), dict) else ""),
                protocol=rule_data.get("protocol", ""),
                state=rule_data.get("state", {}),
                log="log" in rule_data,
            )
        )
    return sorted(rules, key=lambda r: r.rule_number)


def _get_all_chains(raw: dict) -> dict[str, dict]:
    """
    Flatten VyOS rolling firewall structure into {chain_name: rule_dict}.
    New structure: ipv4.{input,forward,output}.filter.rule and ipv4.name.{chain}.rule
    Old structure: name.{chain}.rule (legacy)
    """
    chains: dict[str, dict] = {}
    if not isinstance(raw, dict):
        return chains

    ipv4 = raw.get("ipv4", {})
    if isinstance(ipv4, dict):
        # Built-in hooks: input/forward/output
        for direction in ("input", "forward", "output"):
            hook = ipv4.get(direction, {})
            if isinstance(hook, dict):
                filt = hook.get("filter", {})
                if isinstance(filt, dict) and "rule" in filt:
                    chains[f"ipv4/{direction}/filter"] = filt["rule"]

        # Named chains
        for chain_name, chain_data in ipv4.get("name", {}).items():
            if isinstance(chain_data, dict) and "rule" in chain_data:
                chains[chain_name] = chain_data["rule"]

    # Legacy structure fallback
    for chain_name, chain_data in raw.get("name", {}).items():
        if isinstance(chain_data, dict) and "rule" in chain_data:
            chains[chain_name] = chain_data["rule"]

    return chains


@router.get("/chains")
async def list_chains(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    try:
        raw = await client.retrieve(["firewall"])
        return list(_get_all_chains(raw if isinstance(raw, dict) else {}).keys())
    except Exception as e:
        logger.error("list_chains failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rules/{chain:path}")
async def get_rules(chain: str, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    try:
        raw = await client.retrieve(["firewall"])
        all_chains = _get_all_chains(raw if isinstance(raw, dict) else {})
        rule_dict = all_chains.get(chain, {})
        return _parse_rules(rule_dict)
    except Exception as e:
        logger.error("get_rules failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rules/{chain:path}")
async def add_rule(chain: str, rule: FirewallRule, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    # Build config path from chain name
    # "ipv4/input/filter" → ["firewall","ipv4","input","filter","rule","N"]
    # "WAN-to-LAN"        → ["firewall","ipv4","name","WAN-to-LAN","rule","N"]
    parts = chain.split("/")
    if len(parts) == 3 and parts[0] == "ipv4":
        base = ["firewall", "ipv4", parts[1], parts[2], "rule", str(rule.rule_number)]
    else:
        base = ["firewall", "ipv4", "name", chain, "rule", str(rule.rule_number)]

    commands = [{"op": "set", "path": base + ["action"], "value": rule.action}]
    if rule.description:
        commands.append({"op": "set", "path": base + ["description"], "value": rule.description})
    if rule.source:
        commands.append({"op": "set", "path": base + ["source", "address"], "value": rule.source})
    if rule.destination:
        commands.append({"op": "set", "path": base + ["destination", "address"], "value": rule.destination})
    if rule.protocol:
        commands.append({"op": "set", "path": base + ["protocol"], "value": rule.protocol})
    if rule.log:
        commands.append({"op": "set", "path": base + ["log"], "value": "enable"})
    try:
        await client.configure(commands)
        logger.info('{"event": "firewall_rule_add", "chain": "%s", "rule": %d}', chain, rule.rule_number)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rules/{chain:path}/{rule_number}/confirm-token")
async def request_delete_token(chain: str, rule_number: int, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    return {"confirm_token": _issue_token(), "expires_in": CONFIRM_TTL}


@router.delete("/rules/{chain:path}/{rule_number}")
async def delete_rule(
    chain: str,
    rule_number: int,
    payload: dict,
    client: Annotated[VyOSClient, Depends(get_vyos_client)],
):
    if not _consume_token(payload.get("confirm_token", "")):
        raise HTTPException(status_code=403, detail="Missing or expired confirmation token")

    parts = chain.split("/")
    if len(parts) == 3 and parts[0] == "ipv4":
        path = ["firewall", "ipv4", parts[1], parts[2], "rule", str(rule_number)]
    else:
        path = ["firewall", "ipv4", "name", chain, "rule", str(rule_number)]

    try:
        await client.configure([{"op": "delete", "path": path}])
        logger.info('{"event": "firewall_rule_delete", "chain": "%s", "rule": %d}', chain, rule_number)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/groups", response_model=list[FirewallGroup])
async def list_groups(client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    groups = []
    try:
        raw = await client.retrieve(["firewall"])
        if not isinstance(raw, dict):
            return groups
        group_section = raw.get("group", raw.get("ipv4", {}).get("group", {}))
        if not isinstance(group_section, dict):
            return groups
        for group_type, group_data in group_section.items():
            if not isinstance(group_data, dict):
                continue
            for name, data in group_data.items():
                members = []
                if isinstance(data, dict):
                    members = data.get("address", data.get("port", data.get("network", [])))
                    if isinstance(members, str):
                        members = [members]
                    elif isinstance(members, dict):
                        members = list(members.keys())
                groups.append(FirewallGroup(name=name, type=group_type, members=members or []))
        return groups
    except Exception as e:
        logger.error("list_groups failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
