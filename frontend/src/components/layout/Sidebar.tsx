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
      { to: "/diagnostics", icon: Activity, label: "Diagnostics" },
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

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2.5 mx-2 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
    isActive
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-accent hover:text-foreground"
  );

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
    <aside className="flex h-full w-52 flex-col border-r bg-card">
      <div className="flex h-12 items-center border-b px-4">
        <span className="font-semibold tracking-tight text-primary text-sm">VyOS</span>
        <span className="ml-1 font-light tracking-tight text-muted-foreground text-sm">GUI</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 space-y-3">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {group.label}
            </p>
            {group.items.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={linkClass}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </NavLink>
            ))}
          </div>
        ))}

        {adguardConfigured && (
          <div>
            <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Add-ons
            </p>
            <NavLink to="/adguard" className={linkClass}>
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              AdGuard Home
            </NavLink>
          </div>
        )}
      </nav>
      <div className="border-t p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
