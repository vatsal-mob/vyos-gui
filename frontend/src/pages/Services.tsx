import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useServices, useEnableService, useDisableService, useAdGuardStatus, useEnableAdGuard, useDisableAdGuard } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import { Loader2, Package, ExternalLink, ChevronDown, ChevronUp, ShieldCheck, ArrowRight } from "lucide-react";

interface ServiceStatus {
  name: string;
  enabled: boolean;
}

const SERVICE_LABELS: Record<string, string> = {
  "ssh": "SSH Server",
  "dhcp-server": "DHCP Server",
  "dns-forwarding": "DNS Forwarding",
  "http-api": "HTTP API",
  "ntp": "NTP",
};

// ---------------------------------------------------------------------------
// Plugin catalog
// ---------------------------------------------------------------------------

type InstallMethod = "native" | "container" | "apt";

interface Plugin {
  name: string;
  description: string;
  method: InstallMethod;
  category: string;
  command?: string;
  docsUrl?: string;
}

const METHOD_STYLES: Record<InstallMethod, string> = {
  native:    "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  container: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  apt:       "bg-orange-500/15 text-orange-700 dark:text-orange-400",
};

const METHOD_LABELS: Record<InstallMethod, string> = {
  native:    "Native VyOS",
  container: "Container",
  apt:       "APT Package",
};

const PLUGINS: Plugin[] = [
  // Security
  {
    name: "CrowdSec",
    category: "Security",
    description: "Collaborative IPS that parses logs and blocks attacking IPs via nftables. Shares threat intelligence with a global community.",
    method: "apt",
    command: "sudo apt install crowdsec crowdsec-firewall-bouncer-nftables",
    docsUrl: "https://vyos.dev/T4639",
  },
  {
    name: "Fail2ban",
    category: "Security",
    description: "Monitors logs for brute-force attacks (SSH, HTTP) and dynamically bans offending IPs using nftables rules.",
    method: "apt",
    command: "sudo apt install fail2ban",
    docsUrl: "https://vyos.dev/T380",
  },
  {
    name: "Snort",
    category: "Security",
    description: "The original open-source IDS/IPS with a massive ruleset. Alternative to Suricata with Snort-specific rule format support.",
    method: "apt",
    command: "sudo apt install snort",
  },
  {
    name: "Wazuh Agent",
    category: "Security",
    description: "Host-based IDS (HIDS) that monitors logs, file integrity, rootkits, and policy compliance. Reports to a central Wazuh server.",
    method: "container",
    command: "set container name wazuh-agent image docker.io/wazuh/wazuh-agent",
  },
  {
    name: "SSH Dynamic Protection",
    category: "Security",
    description: "Built-in SSHguard integration that automatically blocks IPs after repeated failed SSH login attempts.",
    method: "native",
    command: "set service ssh dynamic-protection block-time 3600\nset service ssh dynamic-protection detect-time 1800\nset service ssh dynamic-protection threshold 30",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/service/ssh.html",
  },
  // Monitoring
  {
    name: "Prometheus Node Exporter",
    category: "Monitoring",
    description: "Exposes hardware and OS metrics (CPU, memory, disk, network interfaces) for scraping by Prometheus and Grafana dashboards.",
    method: "native",
    command: "set service monitoring prometheus-client port 9100\nset service monitoring prometheus-client listen-address 0.0.0.0",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/service/monitoring.html",
  },
  {
    name: "Telegraf",
    category: "Monitoring",
    description: "Metrics collection agent with rich VyOS-specific plugins. Outputs to InfluxDB, Prometheus, Splunk, and many more.",
    method: "native",
    command: "set service monitoring telegraf influxdb url http://influxdb:8086\nset service monitoring telegraf influxdb bucket vyos",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/service/monitoring.html",
  },
  {
    name: "ntopng",
    category: "Monitoring",
    description: "Real-time DPI-based traffic analyser. Identifies applications (YouTube, Netflix), top talkers, and per-host bandwidth usage via a web UI.",
    method: "container",
    command: "set container name ntopng image docker.io/ntop/ntopng\nset container name ntopng port 0 source 3000 destination 3000",
    docsUrl: "https://lev-0.com/2024/06/21/vyos-for-home-use-part-5-traffic-monitoring-with-ntopng/",
  },
  {
    name: "Netdata",
    category: "Monitoring",
    description: "Zero-config real-time performance monitoring with a built-in web dashboard. Instant visibility into CPU, memory, network, and more.",
    method: "container",
    command: "set container name netdata image docker.io/netdata/netdata\nset container name netdata port 0 source 19999 destination 19999",
  },
  {
    name: "Zabbix Agent",
    category: "Monitoring",
    description: "Lightweight agent that reports system and network metrics to a Zabbix server for centralised monitoring and alerting.",
    method: "container",
    command: "set container name zabbix-agent image docker.io/zabbix/zabbix-agent2\nset container name zabbix-agent environment ZBX_SERVER_HOST value 192.168.1.50",
  },
  {
    name: "NetFlow / IPFIX Export",
    category: "Monitoring",
    description: "Exports per-flow records (src/dst IP, port, bytes, packets) to a NetFlow collector such as ntopng, Graylog, or SolarWinds.",
    method: "native",
    command: "set system flow-accounting interface eth0\nset system flow-accounting netflow version 9\nset system flow-accounting netflow server 192.168.1.100 port 2055",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/system/flow-accounting.html",
  },
  {
    name: "sFlow",
    category: "Monitoring",
    description: "Samples packets at wire speed and exports to an sFlow collector. More scalable than NetFlow for high-traffic environments.",
    method: "native",
    command: "set system sflow interface eth0\nset system sflow server 192.168.1.100 port 6343\nset system sflow sampling-rate 512",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/system/sflow.html",
  },
  // DNS / Ad-blocking
  {
    name: "AdGuard Home",
    category: "DNS / Ad-blocking",
    description: "DNS-level ad blocker and privacy filter for the whole network. Blocks ads, trackers, and malicious domains with a polished web UI.",
    method: "container",
    command: "set container name adguard image docker.io/adguard/adguardhome\nset container name adguard port 0 source 3000 destination 3000\nset container name adguard port 1 source 53 destination 53 protocol udp",
    docsUrl: "https://www.tarball.ca/posts/vyos-adguard-container/",
  },
  {
    name: "Pi-hole",
    category: "DNS / Ad-blocking",
    description: "The original network-wide DNS sinkhole. Filters ads and trackers at the DNS level with an extensive blocklist ecosystem.",
    method: "container",
    command: "set container name pihole image docker.io/pihole/pihole\nset container name pihole port 0 source 53 destination 53 protocol udp\nset container name pihole port 1 source 8080 destination 80",
    docsUrl: "https://forum.vyos.io/t/pihole-running-on-docker/9607",
  },
  {
    name: "Dynamic DNS",
    category: "DNS / Ad-blocking",
    description: "Automatically updates a public DNS record when your WAN IP changes. Supports Cloudflare, No-IP, DynDNS, Route53, and many others.",
    method: "native",
    command: "set service dns dynamic address pppoe0 service cloudflare\nset service dns dynamic address pppoe0 service cloudflare host-name home.example.com",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/service/dns.html",
  },
  // Proxy / Load Balancing
  {
    name: "Squid Web Proxy",
    category: "Proxy / LB",
    description: "HTTP/HTTPS caching and forward proxy. Reduces WAN bandwidth usage by caching content locally. Supports URL filtering via SquidGuard.",
    method: "native",
    command: "set service webproxy listen-address 192.168.1.1 port 3128\nset service webproxy cache-size 100",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/service/webproxy.html",
  },
  {
    name: "HAProxy / Reverse Proxy",
    category: "Proxy / LB",
    description: "High-availability L4/L7 load balancer and reverse proxy built into VyOS. SSL termination, health checks, and multiple backends.",
    method: "native",
    command: "set load-balancing reverse-proxy service https port 443\nset load-balancing reverse-proxy backend servers server web1 address 192.168.1.10\nset load-balancing reverse-proxy backend servers server web1 port 80",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/loadbalancing/haproxy.html",
  },
  // Network Services
  {
    name: "mDNS Repeater",
    category: "Network",
    description: "Repeats mDNS (Bonjour/Avahi) announcements across VLANs so AirPlay, Chromecast, and printers are discoverable across network segments.",
    method: "native",
    command: "set service mdns repeater interface eth0\nset service mdns repeater interface eth1",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/service/mdns.html",
  },
  {
    name: "TFTP Server",
    category: "Network",
    description: "Serves files over TFTP for PXE booting, network OS upgrades (Cisco, Juniper gear), and IP phone provisioning.",
    method: "native",
    command: "set service tftp-server directory /config/tftpboot\nset service tftp-server listen-address 192.168.1.1",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/service/tftp.html",
  },
  {
    name: "PPPoE Server",
    category: "Network",
    description: "Turns VyOS into a PPPoE concentrator. Useful for simulating ISP environments or managing DSL/fibre CPE in a homelab.",
    method: "native",
    command: "set service pppoe-server access-concentrator vyos\nset service pppoe-server client-ip-pool start 10.0.0.2",
  },
  // High Availability
  {
    name: "VRRP",
    category: "High Availability",
    description: "Virtual Router Redundancy Protocol. Two VyOS routers share a VIP — if the master fails, the backup takes over automatically.",
    method: "native",
    command: "set high-availability vrrp group LAN vrid 10\nset high-availability vrrp group LAN interface eth0\nset high-availability vrrp group LAN virtual-address 192.168.1.1/24\nset high-availability vrrp group LAN priority 200",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/highavailability/index.html",
  },
  {
    name: "WAN Load Balancing / Failover",
    category: "High Availability",
    description: "Distributes outbound traffic across multiple WAN links or auto-switches to a backup ISP on failure.",
    method: "native",
    command: "set load-balancing wan interface-health eth0 nexthop 1.2.3.1\nset load-balancing wan rule 1 interface eth0 weight 50\nset load-balancing wan rule 1 interface eth1 weight 50",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/loadbalancing/wan.html",
  },
  // Routing
  {
    name: "BGP (FRRouting)",
    category: "Routing",
    description: "Border Gateway Protocol via FRR. Used for multi-homing, route reflectors, BGP communities, and EVPN/VXLAN control planes in advanced homelabs.",
    method: "native",
    command: "set protocols bgp system-as 65001\nset protocols bgp neighbor 192.168.1.2 remote-as 65002\nset protocols bgp address-family ipv4-unicast network 10.0.0.0/24",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/protocols/bgp.html",
  },
  {
    name: "OSPF",
    category: "Routing",
    description: "Open Shortest Path First — link-state IGP for dynamic interior routing across multiple routers and segments.",
    method: "native",
    command: "set protocols ospf area 0 network 192.168.0.0/24\nset protocols ospf parameters router-id 1.1.1.1",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/protocols/ospf.html",
  },
  {
    name: "VXLAN + EVPN",
    category: "Routing",
    description: "Overlay network for extending L2 segments over an L3 underlay — between homelab sites or hypervisors. BGP EVPN provides the control plane.",
    method: "native",
    command: "set interfaces vxlan vxlan0 vni 100\nset interfaces vxlan vxlan0 group 239.0.0.100\nset interfaces vxlan vxlan0 source-interface eth0",
    docsUrl: "https://blog.vyos.io/evpn-vxlan-vyos",
  },
  {
    name: "MPLS / LDP",
    category: "Routing",
    description: "Multi-Protocol Label Switching for label-based forwarding. Useful for ISP/carrier network simulation and L3VPN testing in homelabs.",
    method: "native",
    command: "set protocols mpls interface eth0\nset protocols mpls ldp interface eth0\nset protocols mpls ldp router-id 1.1.1.1",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/protocols/mpls.html",
  },
  // Automation
  {
    name: "Salt Minion",
    category: "Automation",
    description: "Connects VyOS to a SaltStack master for event-driven, centralised configuration management and remote execution at scale.",
    method: "native",
    command: "set service salt-minion master 192.168.1.200\nset service salt-minion id vyos-router-01",
    docsUrl: "https://docs.vyos.io/en/latest/automation/vyos-salt.html",
  },
  {
    name: "PKI / Internal CA",
    category: "Automation",
    description: "VyOS acts as its own internal certificate authority. Generate, sign, and distribute X.509 certs for VPN, HTTPS, and other services without an external CA.",
    method: "native",
    command: "run generate pki ca install homelab-ca\nrun generate pki certificate sign homelab-ca install router-cert",
    docsUrl: "https://docs.vyos.io/en/latest/configuration/pki/index.html",
  },
];

const CATEGORIES = [...new Set(PLUGINS.map((p) => p.category))];

// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function PluginCard({ plugin }: { plugin: Plugin }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium leading-tight">{plugin.name}</CardTitle>
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${METHOD_STYLES[plugin.method]}`}>
            {METHOD_LABELS[plugin.method]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 flex-1">
        <p className="text-xs text-muted-foreground leading-relaxed">{plugin.description}</p>

        {plugin.command && (
          <div className="rounded border bg-muted/50">
            <div className="flex items-center justify-between border-b px-2 py-1">
              <span className="text-xs text-muted-foreground">Install command</span>
              <div className="flex items-center gap-2">
                <CopyButton text={plugin.command} />
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
            </div>
            {expanded && (
              <pre className="px-2 py-1.5 text-xs font-mono overflow-x-auto text-foreground/80 whitespace-pre-wrap">
                {plugin.command}
              </pre>
            )}
          </div>
        )}

        {plugin.docsUrl && (
          <a
            href={plugin.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Documentation
          </a>
        )}
      </CardContent>
    </Card>
  );
}

export default function Services() {
  const { data, isLoading, isFetching } = useServices();
  const enableService = useEnableService();
  const disableService = useDisableService();
  const { data: adguardStatus, isLoading: agLoading } = useAdGuardStatus();
  const enableAdGuard = useEnableAdGuard();
  const disableAdGuard = useDisableAdGuard();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const services: ServiceStatus[] = data ?? [];

  function handleToggle(service: ServiceStatus) {
    if (service.enabled) {
      disableService.mutate(service.name);
    } else {
      enableService.mutate(service.name);
    }
  }

  const isPendingFor = (name: string) =>
    (enableService.isPending && enableService.variables === name) ||
    (disableService.isPending && disableService.variables === name);

  const filteredPlugins = activeCategory === "All"
    ? PLUGINS
    : PLUGINS.filter((p) => p.category === activeCategory);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-xl font-semibold tracking-tight">Service Manager</h1>

      {/* Active services toggle grid */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">Active Services</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading && (
            <div className="col-span-full flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading services…
            </div>
          )}
          {services.map((svc) => (
            <Card key={svc.name}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {SERVICE_LABELS[svc.name] ?? svc.name}
                  </CardTitle>
                  {isFetching && !isPendingFor(svc.name) && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${svc.enabled ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                    {svc.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <button
                    role="switch"
                    aria-checked={svc.enabled}
                    disabled={isPendingFor(svc.name)}
                    onClick={() => handleToggle(svc)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 ${
                      svc.enabled ? "bg-green-500" : "bg-muted-foreground/30"
                    }`}
                  >
                    {isPendingFor(svc.name) ? (
                      <Loader2 className="h-3 w-3 animate-spin text-white absolute left-1/2 -translate-x-1/2" />
                    ) : (
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                          svc.enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground font-mono">{svc.name}</p>
              </CardContent>
            </Card>
          ))}

          {/* AdGuard Home — container-based service */}
          <Card className={adguardStatus?.configured ? "border-green-500/30" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  AdGuard Home
                </CardTitle>
                {agLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${adguardStatus?.configured ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                  {adguardStatus?.configured
                    ? adguardStatus?.running ? "Running" : "Configured"
                    : "Disabled"}
                </span>
                {adguardStatus?.configured ? (
                  <ConfirmDialog
                    trigger={
                      <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-green-500 transition-colors">
                        <span className="inline-block h-4 w-4 rounded-full bg-white shadow-sm translate-x-6" />
                      </button>
                    }
                    title="Disable AdGuard Home?"
                    description="This removes the AdGuard container configuration from VyOS. The container will stop."
                    confirmLabel="Disable"
                    destructive
                    onConfirm={() => disableAdGuard.mutate()}
                  />
                ) : (
                  <button
                    role="switch"
                    aria-checked={false}
                    disabled={enableAdGuard.isPending}
                    onClick={() => enableAdGuard.mutate()}
                    className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted-foreground/30 transition-colors disabled:opacity-50"
                  >
                    {enableAdGuard.isPending
                      ? <Loader2 className="h-3 w-3 animate-spin text-white absolute left-1/2 -translate-x-1/2" />
                      : <span className="inline-block h-4 w-4 rounded-full bg-white shadow-sm translate-x-1" />
                    }
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono">container · adguard</p>
              {adguardStatus?.configured && (
                <button
                  onClick={() => navigate("/adguard")}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Configure <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Plugin catalog */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Homelab Plugin Catalog
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {PLUGINS.length} plugins · read-only
          </span>
        </div>

        {/* Category filter pills */}
        <div className="mb-4 flex flex-wrap gap-2">
          {["All", ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {cat}
              {cat !== "All" && (
                <span className="ml-1 opacity-70">
                  {PLUGINS.filter((p) => p.category === cat).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlugins.map((plugin) => (
            <PluginCard key={plugin.name} plugin={plugin} />
          ))}
        </div>
      </div>
    </div>
  );
}
