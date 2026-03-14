"""Pydantic models for VyOS API requests and responses."""
from typing import Any
from pydantic import BaseModel, Field


class VyOSCredentials(BaseModel):
    host: str = "10.10.10.1"
    port: int = 22
    ssh_user: str = "vyos"
    ssh_password: str = "vyos"
    api_key: str = ""
    api_url: str = "https://10.10.10.1"
    tls_verify: bool = False


class VyOSResponse(BaseModel):
    success: bool
    data: Any = None
    error: str | None = None


class ConfigureCommand(BaseModel):
    op: str  # "set" | "delete"
    path: list[str]
    value: str | None = None


class ConfigureBatch(BaseModel):
    commands: list[ConfigureCommand]


# --- Interface models ---
class InterfaceAddress(BaseModel):
    address: str
    prefix_length: int | None = None


class InterfaceInfo(BaseModel):
    name: str
    type: str
    description: str = ""
    addresses: list[str] = []
    state: str = "unknown"  # up | down | unknown
    mac: str = ""
    mtu: int | None = None
    speed: str = ""
    rx_bytes: int = 0
    tx_bytes: int = 0
    rx_packets: int = 0
    tx_packets: int = 0


# --- Routing models ---
class StaticRoute(BaseModel):
    prefix: str
    next_hop: str
    distance: int = 1
    description: str = ""


class RouteEntry(BaseModel):
    prefix: str
    protocol: str
    distance: int = 0
    metric: int = 0
    next_hops: list[str] = []
    interface: str = ""
    uptime: str = ""


# --- Firewall models ---
class FirewallRule(BaseModel):
    rule_number: int
    action: str  # accept | drop | reject
    description: str = ""
    source: str = ""
    destination: str = ""
    protocol: str = ""
    state: dict[str, str] = {}
    log: bool = False


class FirewallGroup(BaseModel):
    name: str
    type: str  # address-group | port-group | network-group
    members: list[str] = []
    description: str = ""


# --- NAT models ---
class NATRule(BaseModel):
    rule_number: int
    type: str  # source | destination
    description: str = ""
    source_address: str = ""
    source_port: str = ""
    destination_address: str = ""
    destination_port: str = ""
    translation_address: str = ""
    translation_port: str = ""
    outbound_interface: str = ""
    inbound_interface: str = ""
    protocol: str = ""


# --- DHCP models ---
class DHCPStaticMapping(BaseModel):
    pool: str
    name: str
    ip: str
    mac: str


class DHCPPool(BaseModel):
    name: str
    subnet: str
    range_start: str = ""
    range_stop: str = ""
    default_router: str = ""
    dns_servers: list[str] = []
    lease: int = 86400
    description: str = ""


class DHCPLease(BaseModel):
    ip: str
    mac: str
    hostname: str = ""
    expiry: str = ""
    pool: str = ""
    state: str = ""


# --- DNS models ---
class DNSForwarding(BaseModel):
    nameservers: list[str] = []
    listen_addresses: list[str] = []
    cache_size: int = 10000
    domain_overrides: dict[str, str] = {}


# --- System models ---
class SystemInfo(BaseModel):
    hostname: str = ""
    version: str = ""
    uptime: str = ""
    cpu_percent: float = 0.0
    memory_total: int = 0
    memory_used: int = 0
    memory_percent: float = 0.0
    load_average: list[float] = []
    ntp_servers: list[str] = []
    reachable: bool = True


class ARPEntry(BaseModel):
    ip: str
    mac: str = ""
    interface: str = ""
    state: str = ""


class DiagResult(BaseModel):
    host: str
    output: str
    success: bool = True


# --- WireGuard models ---
class WireGuardPeer(BaseModel):
    name: str
    public_key: str
    preshared_key: str = ""
    allowed_ips: list[str] = []
    endpoint: str = ""
    persistent_keepalive: int = 0


class WireGuardInterface(BaseModel):
    name: str
    description: str = ""
    address: str = ""
    port: int = 51820
    private_key: str = ""
    peers: list[WireGuardPeer] = []
