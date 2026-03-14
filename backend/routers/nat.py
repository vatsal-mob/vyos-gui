"""Source and destination NAT rules."""
import logging
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import get_vyos_client
from vyos.client import VyOSClient
from vyos.models import NATRule

router = APIRouter(prefix="/api/nat", tags=["nat"])
logger = logging.getLogger(__name__)

_TYPE_RE = re.compile(r"^(source|destination)$")


def _parse_nat_rules(nat_type: str, nat_data: dict) -> list[NATRule]:
    rules = []
    if not isinstance(nat_data, dict):
        return rules
    for rule_num, data in nat_data.get("rule", {}).items():
        if not isinstance(data, dict):
            continue

        # outbound-interface changed in rolling to {"name": "eth0"}
        outbound = data.get("outbound-interface", "")
        if isinstance(outbound, dict):
            outbound = outbound.get("name", "")

        inbound = data.get("inbound-interface", "")
        if isinstance(inbound, dict):
            inbound = inbound.get("name", "")

        src = data.get("source", {})
        dst = data.get("destination", {})
        trans = data.get("translation", {})

        rules.append(NATRule(
            rule_number=int(rule_num),
            type=nat_type,
            description=data.get("description", ""),
            source_address=src.get("address", "") if isinstance(src, dict) else "",
            source_port=str(src.get("port", "")) if isinstance(src, dict) else "",
            destination_address=dst.get("address", "") if isinstance(dst, dict) else "",
            destination_port=str(dst.get("port", "")) if isinstance(dst, dict) else "",
            translation_address=trans.get("address", "") if isinstance(trans, dict) else "",
            translation_port=str(trans.get("port", "")) if isinstance(trans, dict) else "",
            outbound_interface=outbound,
            inbound_interface=inbound,
            protocol=data.get("protocol", ""),
        ))
    return sorted(rules, key=lambda r: r.rule_number)


@router.get("/{nat_type}", response_model=list[NATRule])
async def list_nat_rules(nat_type: str, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    if not _TYPE_RE.match(nat_type):
        raise HTTPException(status_code=400, detail="nat_type must be 'source' or 'destination'")
    try:
        raw = await client.retrieve(["nat"])
        nat_data = raw.get(nat_type, {}) if isinstance(raw, dict) else {}
        return _parse_nat_rules(nat_type, nat_data)
    except Exception as e:
        logger.error("list_nat_rules failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{nat_type}")
async def add_nat_rule(nat_type: str, rule: NATRule, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    if not _TYPE_RE.match(nat_type):
        raise HTTPException(status_code=400, detail="nat_type must be 'source' or 'destination'")
    base = ["nat", nat_type, "rule", str(rule.rule_number)]
    commands = []
    if rule.description:
        commands.append({"op": "set", "path": base + ["description"], "value": rule.description})
    if rule.source_address:
        commands.append({"op": "set", "path": base + ["source", "address"], "value": rule.source_address})
    if rule.source_port:
        commands.append({"op": "set", "path": base + ["source", "port"], "value": rule.source_port})
    if rule.destination_address:
        commands.append({"op": "set", "path": base + ["destination", "address"], "value": rule.destination_address})
    if rule.destination_port:
        commands.append({"op": "set", "path": base + ["destination", "port"], "value": rule.destination_port})
    if rule.translation_address:
        commands.append({"op": "set", "path": base + ["translation", "address"], "value": rule.translation_address})
    if rule.translation_port:
        commands.append({"op": "set", "path": base + ["translation", "port"], "value": rule.translation_port})
    if rule.outbound_interface and nat_type == "source":
        commands.append({"op": "set", "path": base + ["outbound-interface", "name"], "value": rule.outbound_interface})
    if rule.inbound_interface and nat_type == "destination":
        commands.append({"op": "set", "path": base + ["inbound-interface", "name"], "value": rule.inbound_interface})
    if rule.protocol:
        commands.append({"op": "set", "path": base + ["protocol"], "value": rule.protocol})
    if not commands:
        raise HTTPException(status_code=400, detail="No fields to set")
    try:
        await client.configure(commands)
        logger.info('{"event": "nat_rule_add", "type": "%s", "rule": %d}', nat_type, rule.rule_number)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{nat_type}/{rule_number}")
async def delete_nat_rule(nat_type: str, rule_number: int, client: Annotated[VyOSClient, Depends(get_vyos_client)]):
    if not _TYPE_RE.match(nat_type):
        raise HTTPException(status_code=400, detail="nat_type must be 'source' or 'destination'")
    commands = [{"op": "delete", "path": ["nat", nat_type, "rule", str(rule_number)]}]
    try:
        await client.configure(commands)
        logger.info('{"event": "nat_rule_delete", "type": "%s", "rule": %d}', nat_type, rule_number)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
