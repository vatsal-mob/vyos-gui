"""Paramiko SSH client with connection pooling and VyOS config-mode helpers."""
import json
import logging
import re
import threading
import time
from typing import Any

import paramiko

from vyos.models import VyOSCredentials

logger = logging.getLogger(__name__)

# Module-level connection pool: key = (host, port, user)
_pool: dict[tuple, paramiko.SSHClient] = {}
_pool_lock = threading.Lock()

# Allowed characters in VyOS config paths/values (injection guard)
_SAFE_PATH_RE = re.compile(r"^[\w\-\.\/\:]+$")


def _validate_path_component(component: str) -> str:
    if not _SAFE_PATH_RE.match(component):
        raise ValueError(f"Unsafe path component: {component!r}")
    return component


class SSHClientError(Exception):
    pass


class VyOSSSHClient:
    def __init__(self, creds: VyOSCredentials):
        self.creds = creds
        self._pool_key = (creds.host, creds.port, creds.ssh_user)

    def _get_connection(self) -> paramiko.SSHClient:
        with _pool_lock:
            client = _pool.get(self._pool_key)
            if client and client.get_transport() and client.get_transport().is_active():
                return client
            # Create new connection
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            try:
                client.connect(
                    hostname=self.creds.host,
                    port=self.creds.port,
                    username=self.creds.ssh_user,
                    password=self.creds.ssh_password,
                    timeout=10,
                    allow_agent=False,
                    look_for_keys=False,
                )
            except Exception as e:
                raise SSHClientError(f"SSH connection failed: {e}") from e
            _pool[self._pool_key] = client
            logger.info("SSH connected to %s", self.creds.host)
            return client

    def _exec(self, command: str, timeout: int = 30) -> str:
        """Execute a single command and return stdout."""
        client = self._get_connection()
        try:
            _, stdout, stderr = client.exec_command(command, timeout=timeout)
            out = stdout.read().decode(errors="replace").strip()
            err = stderr.read().decode(errors="replace").strip()
            if err and not out:
                logger.warning("SSH stderr: %s", err)
            return out
        except Exception as e:
            # Remove stale connection from pool
            with _pool_lock:
                _pool.pop(self._pool_key, None)
            raise SSHClientError(f"SSH exec failed: {e}") from e

    def show(self, path: list[str]) -> str:
        """Run a 'show' operational command."""
        safe_path = [_validate_path_component(p) for p in path]
        cmd = "show " + " ".join(safe_path)
        return self._exec(cmd)

    def show_json(self, path: list[str]) -> Any:
        """Run 'show ... | json' and parse result."""
        safe_path = [_validate_path_component(p) for p in path]
        cmd = "show " + " ".join(safe_path) + " | json"
        raw = self._exec(cmd)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw

    def retrieve(self, path: list[str]) -> Any:
        """Retrieve a config node value."""
        safe_path = [_validate_path_component(p) for p in path]
        cmd = "show configuration commands | grep '^set " + " ".join(safe_path) + "'"
        raw = self._exec(cmd)
        return raw

    def configure(self, commands: list[dict[str, Any]]) -> bool:
        """
        Execute a batch of set/delete commands in config mode, then commit + save.
        commands: [{"op": "set"|"delete", "path": [...], "value": "..."}, ...]
        """
        lines = ["configure"]
        for cmd in commands:
            op = cmd["op"]
            if op not in ("set", "delete"):
                raise ValueError(f"Unknown op: {op}")
            safe_path = [_validate_path_component(p) for p in cmd["path"]]
            # Quote any path component that contains '/' (e.g. CIDR subnets like 10.0.0.0/24)
            quoted_path = [f"'{p}'" if "/" in p else p for p in safe_path]
            line = f"{op} " + " ".join(quoted_path)
            if op == "set" and cmd.get("value"):
                val = _validate_path_component(cmd["value"])
                line += f" '{val}'"
            lines.append(line)
        lines.extend(["commit", "save", "exit"])

        # Execute each line via a single session channel
        client = self._get_connection()
        try:
            channel = client.invoke_shell()
            time.sleep(0.5)
            channel.recv(65535)  # drain banner

            output_parts = []
            for line in lines:
                channel.send(line + "\n")
                time.sleep(0.3)
                if channel.recv_ready():
                    output_parts.append(channel.recv(65535).decode(errors="replace"))

            # Wait for final output
            time.sleep(1.0)
            while channel.recv_ready():
                output_parts.append(channel.recv(65535).decode(errors="replace"))

            channel.close()
            full_output = "".join(output_parts)
            logger.info("Configure output: %s", full_output[:500])

            if "error" in full_output.lower() or "invalid" in full_output.lower():
                raise SSHClientError(f"Configure error: {full_output[:300]}")
            return True
        except SSHClientError:
            raise
        except Exception as e:
            raise SSHClientError(f"Configure session failed: {e}") from e

    def save(self) -> bool:
        """Save running config."""
        out = self._exec("save")
        return "Saving configuration" in out or "Done" in out

    def reboot(self, delay_seconds: int = 5) -> bool:
        """Schedule a router reboot."""
        self._exec(f"reboot in {delay_seconds // 60 or 1}")
        return True

    def get_system_info(self) -> dict[str, Any]:
        """Collect system metrics via SSH."""
        info: dict[str, Any] = {}

        # Hostname
        info["hostname"] = self._exec("hostname").strip()

        # VyOS version
        ver_raw = self._exec("cat /etc/os-release | grep PRETTY_NAME")
        info["version"] = ver_raw.replace("PRETTY_NAME=", "").strip().strip('"')

        # Uptime
        info["uptime"] = self._exec("uptime -p").strip()

        # CPU
        cpu_raw = self._exec(
            "top -bn1 | grep 'Cpu(s)' | awk '{print $2}'"
        )
        try:
            info["cpu_percent"] = float(cpu_raw.replace("%", "").replace(",", "."))
        except ValueError:
            info["cpu_percent"] = 0.0

        # Memory
        mem_raw = self._exec("free -b | awk 'NR==2{print $2,$3}'")
        try:
            total, used = mem_raw.split()
            info["memory_total"] = int(total)
            info["memory_used"] = int(used)
            info["memory_percent"] = round(int(used) / int(total) * 100, 1)
        except (ValueError, ZeroDivisionError):
            info["memory_total"] = 0
            info["memory_used"] = 0
            info["memory_percent"] = 0.0

        # Load average
        load_raw = self._exec("cat /proc/loadavg")
        try:
            parts = load_raw.split()
            info["load_average"] = [float(parts[0]), float(parts[1]), float(parts[2])]
        except (ValueError, IndexError):
            info["load_average"] = [0.0, 0.0, 0.0]

        # NTP servers
        ntp_raw = self._exec(
            "show configuration commands | grep 'system ntp server' | awk '{print $NF}'"
        )
        info["ntp_servers"] = [s.strip("'") for s in ntp_raw.splitlines() if s.strip()]

        return info

    def get_interface_counters(self) -> dict[str, dict[str, int]]:
        """Read per-interface byte/packet counters from /proc/net/dev."""
        raw = self._exec("cat /proc/net/dev")
        counters: dict[str, dict[str, int]] = {}
        for line in raw.splitlines():
            line = line.strip()
            if ":" not in line:
                continue
            iface, rest = line.split(":", 1)
            iface = iface.strip()
            nums = rest.split()
            if len(nums) < 9:
                continue
            try:
                counters[iface] = {
                    "rx_bytes": int(nums[0]),
                    "rx_packets": int(nums[1]),
                    "tx_bytes": int(nums[8]),
                    "tx_packets": int(nums[9]),
                }
            except (ValueError, IndexError):
                pass
        return counters

    def ping(self, host: str, count: int = 4) -> str:
        """Run ping from the router."""
        safe_host = re.sub(r"[^\w\.\-]", "", host)[:64]
        return self._exec(f"ping {safe_host} count {count}", timeout=30)

    def traceroute(self, host: str) -> str:
        """Run traceroute from the router."""
        safe_host = re.sub(r"[^\w\.\-]", "", host)[:64]
        return self._exec(f"traceroute {safe_host}", timeout=60)

    def show_arp(self) -> str:
        """Show ARP table."""
        return self._exec("show arp")

    def poweroff(self, delay_seconds: int = 5) -> bool:
        """Schedule a router poweroff."""
        self._exec(f"poweroff in {delay_seconds // 60 or 1}")
        return True

    def load_config(self) -> str:
        """Show the running configuration as text."""
        return self._exec("show configuration")

    def show_wireguard(self) -> str:
        """Show WireGuard interface status."""
        return self._exec("show interfaces wireguard")

    def show_conntrack(self) -> str:
        return self._exec("show conntrack table ipv4", timeout=15)

    def get_logs(self, lines: int = 100, filter_str: str = "") -> str:
        safe_filter = re.sub(r"[^\w\s\.\-]", "", filter_str)[:50]
        if safe_filter:
            return self._exec(f"show log | grep '{safe_filter}' | tail -n {lines}", timeout=15)
        return self._exec(f"show log | tail -n {lines}", timeout=15)

    def get_firewall_log(self, lines: int = 30) -> str:
        return self._exec(f"show log firewall | tail -n {lines}", timeout=15)

    def show_ipsec_sa(self) -> str:
        return self._exec("show vpn ipsec sa")

    def show_openvpn(self) -> str:
        return self._exec("show openvpn status")

    def restore_config(self, config_text: str) -> bool:
        """Write config to /tmp via SFTP then load/commit/save via SSH."""
        import io
        client = self._get_connection()
        sftp = client.open_sftp()
        sftp.putfo(io.BytesIO(config_text.encode()), "/tmp/vyos_restore.conf")
        sftp.close()
        channel = client.invoke_shell()
        time.sleep(0.5)
        channel.recv(65535)
        for line in ["configure", "load /tmp/vyos_restore.conf", "commit", "save", "exit"]:
            channel.send(line + "\n")
            time.sleep(0.5)
            if channel.recv_ready():
                channel.recv(65535)
        time.sleep(1.0)
        while channel.recv_ready():
            channel.recv(65535)
        channel.close()
        return True

    def show_containers(self) -> str:
        """List running containers (podman ps equivalent)."""
        return self._exec("show container", timeout=10)

    def get_container_running_status(self, name: str) -> str:
        """Return the container State.Status (running/stopped/not found)."""
        safe = re.sub(r"[^\w\-]", "", name)[:64]
        return self._exec(
            f"sudo podman inspect {safe} --format '{{{{.State.Status}}}}' 2>/dev/null || echo 'not-found'",
            timeout=10,
        ).strip()

    def get_suricata_alerts(self, lines: int = 200) -> str:
        """Read last N lines of Suricata eve.json log."""
        return self._exec(f"sudo tail -n {lines} /var/log/suricata/eve.json 2>/dev/null || echo ''", timeout=10)

    def show_flow_accounting(self) -> str:
        """Show netflow/flow-accounting table."""
        return self._exec("show flow-accounting", timeout=15)

    def disconnect(self) -> None:
        with _pool_lock:
            client = _pool.pop(self._pool_key, None)
        if client:
            try:
                client.close()
            except Exception:
                pass


def clear_pool() -> None:
    """Close all pooled connections (useful for tests)."""
    with _pool_lock:
        for client in _pool.values():
            try:
                client.close()
            except Exception:
                pass
        _pool.clear()
