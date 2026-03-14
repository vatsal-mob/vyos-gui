import { useReachable } from "../../hooks/useVyos";
import { useAuthStore } from "../../store/auth";
import { useThemeStore } from "../../store/theme";
import { Moon, Sun } from "lucide-react";

export default function Topbar() {
  const username = useAuthStore((s) => s.username);
  const { data } = useReachable();
  const reachable = data?.reachable ?? null;
  const { theme, toggle } = useThemeStore();

  return (
    <header className="flex h-11 items-center justify-between border-b bg-card px-5">
      <div />
      <div className="flex items-center gap-4">
        {reachable !== null && (
          <span
            className={`flex items-center gap-1.5 text-xs font-medium ${
              reachable
                ? "text-emerald-500 dark:text-emerald-400"
                : "text-red-500"
            }`}
          >
            {reachable ? (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            ) : (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
            )}
            {reachable ? "Connected" : "Unreachable"}
          </span>
        )}
        <span className="text-xs text-muted-foreground font-mono">{username}</span>
        <button
          onClick={toggle}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>
    </header>
  );
}
