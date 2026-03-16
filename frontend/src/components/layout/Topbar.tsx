import { useReachable } from "../../hooks/useVyos";
import { useAuthStore } from "../../store/auth";
import { useThemeStore } from "../../store/theme";
import { Moon, Sun, User } from "lucide-react";

export default function Topbar() {
  const username = useAuthStore((s) => s.username);
  const { data } = useReachable();
  const reachable = data?.reachable ?? null;
  const { theme, toggle } = useThemeStore();

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card px-5 shrink-0">
      {/* Left side — placeholder for breadcrumbs */}
      <div />

      {/* Right side — status + user + theme */}
      <div className="flex items-center gap-3">
        {/* Router connection status */}
        {reachable !== null && (
          <div
            className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-2xs font-mono font-medium border ${
              reachable
                ? "text-success border-success/20 bg-success/5"
                : "text-destructive border-destructive/20 bg-destructive/5"
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                reachable ? "bg-success status-dot-live" : "bg-destructive"
              }`}
            />
            {reachable ? "Connected" : "Unreachable"}
          </div>
        )}

        {/* Username */}
        {username && (
          <div className="flex items-center gap-1.5 text-2xs font-mono text-muted-foreground">
            <User className="h-3 w-3" />
            {username}
          </div>
        )}

        {/* Divider */}
        <div className="h-4 w-px bg-border" />

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="flex items-center justify-center rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark"
            ? <Sun className="h-3.5 w-3.5" />
            : <Moon className="h-3.5 w-3.5" />
          }
        </button>
      </div>
    </header>
  );
}
