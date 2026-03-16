import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Network,
  Route,
  Shield,
  ArrowLeftRight,
  Server,
  Globe,
  Settings,
  Activity,
  KeyRound,
  LogOut,
  ToggleLeft,
  ScrollText,
  ClipboardList,
  ShieldAlert,
  Waves,
  ShieldCheck,
  Radio,
} from "lucide-react";
import { cn } from "../../lib/utils";
import api from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { useNavigate } from "react-router-dom";
import { useAdGuardStatus } from "../../hooks/useVyos";

const navGroups = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/connections", icon: Activity, label: "Connections" },
    ],
  },
  {
    label: "Network",
    items: [
      { to: "/interfaces", icon: Network, label: "Interfaces" },
      { to: "/routing", icon: Route, label: "Routing" },
      { to: "/nat", icon: ArrowLeftRight, label: "NAT" },
      { to: "/dhcp", icon: Server, label: "DHCP" },
      { to: "/dns", icon: Globe, label: "DNS" },
      { to: "/vpn", icon: KeyRound, label: "VPN" },
    ],
  },
  {
    label: "Security",
    items: [
      { to: "/firewall", icon: Shield, label: "Firewall" },
      { to: "/ids", icon: ShieldAlert, label: "IDS Alerts" },
    ],
  },
  {
    label: "Observability",
    items: [
      { to: "/flow", icon: Waves, label: "Flow" },
      { to: "/logs", icon: ScrollText, label: "Logs" },
      { to: "/diagnostics", icon: Radio, label: "Diagnostics" },
      { to: "/audit", icon: ClipboardList, label: "Audit Log" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/services", icon: ToggleLeft, label: "Services" },
      { to: "/system", icon: Settings, label: "System" },
    ],
  },
];

export default function Sidebar() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { data: adguardStatus } = useAdGuardStatus();
  const adguardConfigured = adguardStatus?.configured ?? false;

  async function handleLogout() {
    await api.post("/auth/logout").catch(() => {});
    logout();
    navigate("/login");
  }

  return (
    <aside className="flex h-full w-56 flex-col bg-card border-r border-border">
      {/* Logo */}
      <div className="flex h-12 items-center gap-2 px-4 border-b border-border">
        <div className="flex items-center justify-center w-6 h-6 bg-primary/10 border border-primary/30 rounded-sm">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2L6 10L10 2" stroke="hsl(199,95%,52%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="font-display text-sm font-semibold tracking-tight text-primary">VyOS</span>
          <span className="font-display text-sm font-light tracking-tight text-muted-foreground/70">GUI</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group, gi) => (
          <div key={group.label} className={cn("px-2", gi > 0 && "mt-1 pt-1 border-t border-border/60")}>
            <p className="section-label px-2 pt-2 pb-1.5">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "nav-link flex items-center gap-2.5 rounded px-2 py-1.5 text-xs font-medium transition-all duration-150",
                      isActive
                        ? "nav-item-active bg-primary/8 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )
                  }
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {adguardConfigured && (
          <div className="mt-1 pt-1 border-t border-border/60 px-2">
            <p className="section-label px-2 pt-2 pb-1.5">Add-ons</p>
            <div className="space-y-0.5">
              <NavLink
                to="/adguard"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded px-2 py-1.5 text-xs font-medium transition-all duration-150",
                    isActive
                      ? "nav-item-active bg-primary/8 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )
                }
              >
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                AdGuard Home
              </NavLink>
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-destructive transition-all duration-150"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
