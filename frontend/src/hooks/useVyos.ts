import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";

// --- System ---
export function useSystemInfo() {
  return useQuery({
    queryKey: ["system", "info"],
    queryFn: () => api.get("/system/info").then((r) => r.data),
    refetchInterval: 5000,
  });
}

export function useReachable() {
  return useQuery({
    queryKey: ["system", "reachable"],
    queryFn: () => api.get("/system/reachable").then((r) => r.data),
    refetchInterval: 10000,
  });
}

// --- Interfaces ---
export function useInterfaces() {
  return useQuery({
    queryKey: ["interfaces"],
    queryFn: () => api.get("/interfaces/").then((r) => r.data),
    refetchInterval: 5000,
  });
}

export function useInterface(name: string) {
  return useQuery({
    queryKey: ["interfaces", name],
    queryFn: () => api.get(`/interfaces/${name}`).then((r) => r.data),
    enabled: !!name,
  });
}

export function useUpdateInterface() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, commands }: { name: string; commands: object[] }) =>
      api.patch(`/interfaces/${name}`, { commands }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interfaces"] }),
  });
}

// --- Routing ---
export function useRoutingTable() {
  return useQuery({
    queryKey: ["routing", "table"],
    queryFn: () => api.get("/routing/table").then((r) => r.data),
  });
}

export function useStaticRoutes() {
  return useQuery({
    queryKey: ["routing", "static"],
    queryFn: () => api.get("/routing/static").then((r) => r.data),
  });
}

export function useAddStaticRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (route: object) =>
      api.post("/routing/static", route).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routing"] }),
  });
}

export function useDeleteStaticRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefix: string) =>
      api.delete(`/routing/static/${encodeURIComponent(prefix)}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routing"] }),
  });
}

// --- Firewall ---
export function useFirewallChains() {
  return useQuery({
    queryKey: ["firewall", "chains"],
    queryFn: () => api.get("/firewall/chains").then((r) => r.data),
  });
}

export function useFirewallRules(chain: string) {
  return useQuery({
    queryKey: ["firewall", "rules", chain],
    queryFn: () => api.get(`/firewall/rules/${chain}`).then((r) => r.data),
    enabled: !!chain,
  });
}

export function useFirewallGroups() {
  return useQuery({
    queryKey: ["firewall", "groups"],
    queryFn: () => api.get("/firewall/groups").then((r) => r.data),
  });
}

export function useAddFirewallRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chain, rule }: { chain: string; rule: object }) =>
      api.post(`/firewall/rules/${chain}`, rule).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["firewall"] }),
  });
}

export function useDeleteFirewallRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ chain, ruleNumber }: { chain: string; ruleNumber: number }) => {
      const { data } = await api.post(`/firewall/rules/${chain}/${ruleNumber}/confirm-token`);
      return api
        .delete(`/firewall/rules/${chain}/${ruleNumber}`, {
          data: { confirm_token: data.confirm_token },
        })
        .then((r) => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["firewall"] }),
  });
}

// --- NAT ---
export function useNATRules(type: "source" | "destination") {
  return useQuery({
    queryKey: ["nat", type],
    queryFn: () => api.get(`/nat/${type}`).then((r) => r.data),
  });
}

export function useAddNATRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, rule }: { type: string; rule: object }) =>
      api.post(`/nat/${type}`, rule).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nat"] }),
  });
}

export function useDeleteNATRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, ruleNumber }: { type: string; ruleNumber: number }) =>
      api.delete(`/nat/${type}/${ruleNumber}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nat"] }),
  });
}

// --- DHCP ---
export function useDHCPPools() {
  return useQuery({
    queryKey: ["dhcp", "pools"],
    queryFn: () => api.get("/dhcp/pools").then((r) => r.data),
  });
}

export function useDHCPLeases() {
  return useQuery({
    queryKey: ["dhcp", "leases"],
    queryFn: () => api.get("/dhcp/leases").then((r) => r.data),
    refetchInterval: 30000,
  });
}

export function useCreateDHCPPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pool: object) => api.post("/dhcp/pools", pool).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dhcp"] }),
  });
}

export function useDeleteDHCPPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.delete(`/dhcp/pools/${name}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dhcp"] }),
  });
}

export function useStaticMappings() {
  return useQuery({
    queryKey: ["dhcp", "static-mappings"],
    queryFn: () => api.get("/dhcp/static-mappings").then((r) => r.data),
  });
}

export function useDeleteStaticMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pool, name }: { pool: string; name: string }) =>
      api.delete(`/dhcp/static-mapping/${pool}/${name}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dhcp"] }),
  });
}

export function useCreateStaticMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mapping: { pool: string; name: string; ip: string; mac: string }) =>
      api.post("/dhcp/static-mapping", mapping).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dhcp"] }),
  });
}

// --- DNS ---
export function useDNSForwarding() {
  return useQuery({
    queryKey: ["dns", "forwarding"],
    queryFn: () => api.get("/dns/forwarding").then((r) => r.data),
  });
}

export function useSetNameservers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (servers: string[]) =>
      api.put("/dns/forwarding/nameservers", { servers }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dns"] }),
  });
}

export function useAddDomainOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domain, server }: { domain: string; server: string }) =>
      api.post("/dns/forwarding/domain", { domain, server }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dns"] }),
  });
}

export function useDeleteDomainOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) =>
      api.delete(`/dns/forwarding/domain/${domain}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dns"] }),
  });
}

// --- Configure (batch commit) ---
export function useBatchConfigure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commands: object[]) =>
      api.post("/vyos/configure", { commands }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// --- System management ---
export function useHostname() {
  return useQuery({
    queryKey: ["system", "hostname"],
    queryFn: () => api.get("/system/hostname").then((r) => r.data),
  });
}

export function useSetHostname() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hostname: string) =>
      api.put("/system/hostname", { hostname }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system"] }),
  });
}

export function useNTPServers() {
  return useQuery({
    queryKey: ["system", "ntp"],
    queryFn: () => api.get("/system/ntp").then((r) => r.data),
  });
}

export function useSetNTP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (servers: string[]) =>
      api.put("/system/ntp", { servers }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system", "ntp"] }),
  });
}

export function useSystemUsers() {
  return useQuery({
    queryKey: ["system", "users"],
    queryFn: () => api.get("/system/users").then((r) => r.data),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { username: string; password: string; level: string }) =>
      api.post("/system/users", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system", "users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (username: string) =>
      api.delete(`/system/users/${username}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system", "users"] }),
  });
}

export function useReboot() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/system/reboot/confirm-token");
      return api.post("/system/reboot", { confirm_token: data.confirm_token }).then((r) => r.data);
    },
  });
}

export function usePoweroff() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/system/poweroff/confirm-token");
      return api.post("/system/poweroff", { confirm_token: data.confirm_token }).then((r) => r.data);
    },
  });
}

export function useConfig() {
  return useQuery({
    queryKey: ["vyos", "config"],
    queryFn: () => api.get("/vyos/config").then((r) => r.data),
    enabled: false, // only fetch on demand
  });
}

// --- Diagnostics ---
export function usePing(host: string, count = 4) {
  return useQuery({
    queryKey: ["diag", "ping", host],
    queryFn: () => api.get("/diag/ping", { params: { host, count } }).then((r) => r.data),
    enabled: false,
  });
}

export function useTraceroute(host: string) {
  return useQuery({
    queryKey: ["diag", "traceroute", host],
    queryFn: () => api.get("/diag/traceroute", { params: { host } }).then((r) => r.data),
    enabled: false,
  });
}

export function useARPTable() {
  return useQuery({
    queryKey: ["diag", "arp"],
    queryFn: () => api.get("/diag/arp").then((r) => r.data),
    refetchInterval: 30000,
  });
}

// --- VPN / WireGuard ---
export function useWireGuard() {
  return useQuery({
    queryKey: ["vpn", "wireguard"],
    queryFn: () => api.get("/vpn/wireguard").then((r) => r.data),
  });
}

export function useWireGuardStatus() {
  return useQuery({
    queryKey: ["vpn", "wireguard", "status"],
    queryFn: () => api.get("/vpn/wireguard/status").then((r) => r.data),
    refetchInterval: 10000,
  });
}

export function useAddWireGuardPeer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ iface, peer }: { iface: string; peer: object }) =>
      api.post(`/vpn/wireguard/${iface}/peer`, peer).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vpn"] }),
  });
}

export function useDeleteWireGuardPeer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ iface, peerName }: { iface: string; peerName: string }) =>
      api.delete(`/vpn/wireguard/${iface}/peer/${peerName}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vpn"] }),
  });
}

export function useIPsecStatus() {
  return useQuery({
    queryKey: ["vpn", "ipsec"],
    queryFn: () => api.get("/vpn/ipsec").then((r) => r.data),
    refetchInterval: 15000,
  });
}

export function useOpenVPNStatus() {
  return useQuery({
    queryKey: ["vpn", "openvpn"],
    queryFn: () => api.get("/vpn/openvpn").then((r) => r.data),
    refetchInterval: 15000,
  });
}

// --- Logs ---
export function useLogs(lines = 100, filterStr = "") {
  return useQuery({
    queryKey: ["system", "logs", lines, filterStr],
    queryFn: () =>
      api.get("/system/logs", { params: { lines, filter_str: filterStr } }).then((r) => r.data),
    refetchInterval: 10000,
  });
}

export function useFirewallLog(lines = 30) {
  return useQuery({
    queryKey: ["system", "firewall-log", lines],
    queryFn: () =>
      api.get("/system/firewall-log", { params: { lines } }).then((r) => r.data),
    refetchInterval: 10000,
  });
}

// --- Conntrack ---
export function useConntrack() {
  return useQuery({
    queryKey: ["diag", "conntrack"],
    queryFn: () => api.get("/diag/conntrack").then((r) => r.data),
    refetchInterval: 5000,
  });
}

export function useTopTalkers() {
  return useQuery({
    queryKey: ["diag", "top-talkers"],
    queryFn: () => api.get("/diag/top-talkers").then((r) => r.data),
    refetchInterval: 15000,
  });
}

// --- Services ---
export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: () => api.get("/services/").then((r) => r.data),
    refetchInterval: 15000,
  });
}

export function useEnableService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (service: string) =>
      api.post(`/services/${service}/enable`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}

export function useDisableService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (service: string) =>
      api.post(`/services/${service}/disable`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}

// --- Config Restore ---
export function useRestoreConfig() {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post("/vyos/config/restore", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }).then((r) => r.data);
    },
  });
}

// --- AdGuard Home ---
export function useAdGuardStatus() {
  return useQuery({
    queryKey: ["adguard", "status"],
    queryFn: () => api.get("/adguard/status").then((r) => r.data),
    refetchInterval: 15000,
  });
}

export function useAdGuardConfig() {
  return useQuery({
    queryKey: ["adguard", "config"],
    queryFn: () => api.get("/adguard/config").then((r) => r.data),
  });
}

export function useEnableAdGuard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/adguard/enable").then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adguard"] }),
  });
}

export function useDisableAdGuard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/adguard/disable").then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adguard"] }),
  });
}

export function useUpdateAdGuardConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cfg: object) => api.put("/adguard/config", cfg).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adguard"] }),
  });
}

// --- IDS / Suricata ---
export function useSuricataAlerts(lines = 200) {
  return useQuery({
    queryKey: ["ids", "alerts", lines],
    queryFn: () => api.get("/ids/alerts", { params: { lines } }).then((r) => r.data),
    refetchOnWindowFocus: false,
  });
}

export function useIDSSummary() {
  return useQuery({
    queryKey: ["ids", "summary"],
    queryFn: () => api.get("/ids/summary").then((r) => r.data),
    refetchOnWindowFocus: false,
  });
}

// --- Flow Accounting ---
export function useFlowAccounting() {
  return useQuery({
    queryKey: ["flow", "accounting"],
    queryFn: () => api.get("/flow/accounting").then((r) => r.data),
    refetchInterval: 30000,
  });
}

// --- DNS Authoritative Records ---
export function useDNSAuthoritativeRecords() {
  return useQuery({
    queryKey: ["dns", "authoritative"],
    queryFn: () => api.get("/dns/authoritative").then((r) => r.data),
  });
}

export function useAddDNSRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: { domain: string; type: string; name: string; value: string }) =>
      api.post("/dns/authoritative/record", record).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dns", "authoritative"] }),
  });
}

export function useDeleteDNSRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domain, type, name }: { domain: string; type: string; name: string }) =>
      api.delete(`/dns/authoritative/record/${encodeURIComponent(domain)}/${type.toLowerCase()}/${encodeURIComponent(name)}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dns", "authoritative"] }),
  });
}

// --- Audit ---
export function useAuditLogs(limit = 200) {
  return useQuery({
    queryKey: ["audit", "logs", limit],
    queryFn: () => api.get("/audit/logs", { params: { limit } }).then((r) => r.data),
    refetchInterval: 5000,
  });
}
