import { useState, useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";

interface PaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  path: string;
}

const NAV_PAGES: PaletteItem[] = [
  { id: "nav-dashboard", label: "Dashboard", path: "/dashboard" },
  { id: "nav-interfaces", label: "Interfaces", path: "/interfaces" },
  { id: "nav-routing", label: "Routing", path: "/routing" },
  { id: "nav-firewall", label: "Firewall", path: "/firewall" },
  { id: "nav-nat", label: "NAT", path: "/nat" },
  { id: "nav-dhcp", label: "DHCP", path: "/dhcp" },
  { id: "nav-dns", label: "DNS", path: "/dns" },
  { id: "nav-vpn", label: "VPN", path: "/vpn" },
  { id: "nav-diagnostics", label: "Diagnostics", path: "/diagnostics" },
  { id: "nav-connections", label: "Connections", path: "/connections" },
  { id: "nav-services", label: "Services", path: "/services" },
  { id: "nav-logs", label: "Logs", path: "/logs" },
  { id: "nav-audit", label: "Audit Log", path: "/audit" },
  { id: "nav-system", label: "System", path: "/system" },
];

function buildItems(qc: ReturnType<typeof useQueryClient>): PaletteItem[] {
  const items: PaletteItem[] = [...NAV_PAGES];

  // Interfaces from query cache
  const ifaces = qc.getQueryData<{ name: string; description?: string }[]>(["interfaces"]);
  if (Array.isArray(ifaces)) {
    for (const iface of ifaces) {
      items.push({
        id: `iface-${iface.name}`,
        label: iface.name,
        sublabel: iface.description ?? "Interface",
        path: `/interfaces/${iface.name}`,
      });
    }
  }

  // DHCP leases from query cache
  const leases = qc.getQueryData<{ ip: string; hostname?: string }[]>(["dhcp", "leases"]);
  if (Array.isArray(leases)) {
    for (const lease of leases) {
      items.push({
        id: `lease-${lease.ip}`,
        label: lease.ip,
        sublabel: lease.hostname ?? "DHCP Lease",
        path: "/dhcp",
      });
    }
  }

  // Routes from query cache
  const routes = qc.getQueryData<{ prefix: string; nexthop?: string }[]>(["routing", "static"]);
  if (Array.isArray(routes)) {
    for (const route of routes) {
      items.push({
        id: `route-${route.prefix}`,
        label: route.prefix,
        sublabel: "Static Route",
        path: "/routing",
      });
    }
  }

  return items;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen((o) => !o);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const items = buildItems(qc);
  const filtered = query.trim()
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          (item.sublabel ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : items.slice(0, 12);

  function handleSelect(item: PaletteItem) {
    navigate(item.path);
    setOpen(false);
    setQuery("");
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-[18%] z-50 w-full max-w-md -translate-x-1/2 rounded border border-border bg-card shadow-2xl shadow-black/60 overflow-hidden">
          <Dialog.Title className="sr-only">Command Palette</Dialog.Title>
          {/* Top accent */}
          <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="flex items-center border-b border-border px-4 py-2.5 gap-3">
            <Search className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            <input
              autoFocus
              className="flex-1 bg-transparent text-sm font-mono outline-none placeholder:text-muted-foreground/40"
              placeholder="Search pages, interfaces, routes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground/60">
              ESC
            </kbd>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-xs font-mono text-muted-foreground">No results found.</li>
            )}
            {filtered.map((item) => (
              <li key={item.id}>
                <button
                  className="flex w-full items-center gap-3 px-4 py-2 hover:bg-accent transition-colors text-left"
                  onClick={() => handleSelect(item)}
                >
                  <span className="text-xs font-mono font-medium text-foreground">{item.label}</span>
                  {item.sublabel && (
                    <span className="text-2xs font-mono text-muted-foreground">{item.sublabel}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
