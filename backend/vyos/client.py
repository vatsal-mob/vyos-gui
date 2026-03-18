"""
Unified VyOS client: REST-first, SSH fallback.
All methods are async; SSH calls run in a thread executor.
"""
import asyncio
import logging
from functools import partial
from typing import Any

from vyos.models import VyOSCredentials, VyOSResponse
from vyos.rest_client import VyOSRESTClient, RESTClientError
from vyos.ssh_client import VyOSSSHClient, SSHClientError

logger = logging.getLogger(__name__)


def _use_rest(creds: VyOSCredentials) -> bool:
    return bool(creds.api_key)


class VyOSClient:
    def __init__(self, creds: VyOSCredentials):
        self.creds = creds
        self._rest = VyOSRESTClient(creds) if _use_rest(creds) else None
        self._ssh = VyOSSSHClient(creds)

    async def _run_ssh(self, fn, *args, **kwargs):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, partial(fn, *args, **kwargs))

    async def retrieve(self, path: list[str]) -> Any:
        """Get a config value at path."""
        if self._rest:
            try:
                resp = await self._rest.show_config(path)
                # Return data for both success:true (dict) and success:false (None =
                # path exists in schema but not configured). Only fall back to SSH on
                # exceptions (connection error, 400, etc.).
                return resp.data
            except RESTClientError as e:
                logger.warning("REST retrieve failed, falling back to SSH: %s", e)
        return await self._run_ssh(self._ssh.retrieve, path)

    async def show(self, path: list[str]) -> Any:
        """Operational show command."""
        if self._rest:
            try:
                resp = await self._rest.show(path)
                if resp.success:
                    return resp.data
            except RESTClientError as e:
                logger.warning("REST show failed, falling back to SSH: %s", e)
        return await self._run_ssh(self._ssh.show, path)

    async def show_json(self, path: list[str]) -> Any:
        """Show command with JSON output."""
        if self._rest:
            try:
                resp = await self._rest.show(path)
                if resp.success:
                    return resp.data
            except RESTClientError as e:
                logger.warning("REST show_json failed, falling back to SSH: %s", e)
        return await self._run_ssh(self._ssh.show_json, path)

    async def configure(self, commands: list[dict[str, Any]]) -> bool:
        """Apply a batch of set/delete commands, commit, and save."""
        if self._rest:
            try:
                resp = await self._rest.configure(commands)
                if resp.success:
                    await self._rest.save()
                    return True
                raise RESTClientError(resp.error or "configure failed")
            except RESTClientError as e:
                logger.warning("REST configure failed, falling back to SSH: %s", e)
        return await self._run_ssh(self._ssh.configure, commands)

    async def save(self) -> bool:
        if self._rest:
            try:
                resp = await self._rest.save()
                return resp.success
            except RESTClientError as e:
                logger.warning("REST save failed, falling back to SSH: %s", e)
        return await self._run_ssh(self._ssh.save)

    async def reboot(self) -> bool:
        if self._rest:
            try:
                resp = await self._rest.reboot()
                return resp.success
            except RESTClientError as e:
                logger.warning("REST reboot failed, falling back to SSH: %s", e)
        return await self._run_ssh(self._ssh.reboot)

    async def get_system_info(self) -> dict[str, Any]:
        """System metrics — always via SSH (REST has no equivalent)."""
        return await self._run_ssh(self._ssh.get_system_info)

    async def get_interface_counters(self) -> dict:
        return await self._run_ssh(self._ssh.get_interface_counters)

    async def ping(self, host: str, count: int = 4) -> str:
        return await self._run_ssh(self._ssh.ping, host, count)

    async def traceroute(self, host: str) -> str:
        return await self._run_ssh(self._ssh.traceroute, host)

    async def show_arp(self) -> str:
        raw = await self.show(["arp"])
        return raw if isinstance(raw, str) else str(raw or "")

    async def poweroff(self) -> bool:
        return await self._run_ssh(self._ssh.poweroff)

    async def load_config(self) -> str:
        return await self._run_ssh(self._ssh.load_config)

    async def show_wireguard(self) -> str:
        raw = await self.show(["interfaces", "wireguard"])
        return raw if isinstance(raw, str) else str(raw or "")

    async def show_conntrack(self) -> str:
        raw = await self.show(["conntrack", "table", "ipv4"])
        return raw if isinstance(raw, str) else str(raw or "")

    async def get_logs(self, lines: int = 100, filter_str: str = "") -> str:
        import re
        raw = await self.show(["log"])
        raw = raw if isinstance(raw, str) else str(raw or "")
        all_lines = raw.splitlines()
        if filter_str:
            safe = re.sub(r"[^\w\s\.\-]", "", filter_str)[:50]
            all_lines = [ln for ln in all_lines if safe.lower() in ln.lower()]
        return "\n".join(all_lines[-lines:])

    async def get_firewall_log(self, lines: int = 30) -> str:
        raw = await self.show(["log", "firewall"])
        raw = raw if isinstance(raw, str) else str(raw or "")
        return "\n".join(raw.splitlines()[-lines:])

    async def show_ipsec_sa(self) -> str:
        raw = await self.show(["vpn", "ipsec", "sa"])
        return raw if isinstance(raw, str) else str(raw or "")

    async def show_openvpn(self) -> str:
        raw = await self.show(["openvpn", "status"])
        return raw if isinstance(raw, str) else str(raw or "")

    async def restore_config(self, config_text: str) -> bool:
        from functools import partial
        return await self._run_ssh(partial(self._ssh.restore_config, config_text))

    async def get_container_running_status(self, name: str) -> str:
        return await self._run_ssh(self._ssh.get_container_running_status, name)

    async def get_suricata_alerts(self, lines: int = 200) -> str:
        return await self._run_ssh(self._ssh.get_suricata_alerts, lines)

    async def show_flow_accounting(self) -> str:
        raw = await self.show(["flow-accounting"])
        if isinstance(raw, str) and raw.strip():
            return raw
        return await self._run_ssh(self._ssh.show_flow_accounting)

    async def health_check(self) -> bool:
        """Ping the router — try REST, then SSH."""
        if self._rest:
            try:
                return await self._rest.health_check()
            except RESTClientError:
                pass
        try:
            hostname = await self._run_ssh(self._ssh._exec, "hostname")
            return bool(hostname)
        except SSHClientError:
            return False
