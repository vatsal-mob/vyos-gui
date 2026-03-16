import { useFirewallLog } from "../../hooks/useVyos";
import { Loader2, RefreshCw } from "lucide-react";

function getLineBadge(line: string): { label: string; className: string } {
  const lower = line.toLowerCase();
  if (lower.includes("block") || lower.includes("drop") || lower.includes("reject") || lower.includes("denied")) {
    return { label: "DROP", className: "text-destructive bg-destructive/10 border border-destructive/20" };
  }
  if (lower.includes("accept") || lower.includes("allow") || lower.includes("permit")) {
    return { label: "PASS", className: "text-success bg-success/10 border border-success/20" };
  }
  return { label: "INFO", className: "text-muted-foreground bg-muted border border-border" };
}

export default function FirewallFeed() {
  const { data, isLoading, isFetching } = useFirewallLog(30);
  const lines: string[] = data?.lines ?? [];

  return (
    <div className="rounded border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-display text-sm font-medium">Firewall Events</span>
        <div className="flex items-center gap-1.5 text-2xs font-mono text-muted-foreground/50">
          {isFetching
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <RefreshCw className="h-2.5 w-2.5" />
          }
          10s
        </div>
      </div>

      <div className="max-h-72 overflow-auto">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground p-4">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : lines.length === 0 ? (
          <p className="text-xs text-muted-foreground font-mono p-4">No firewall log entries.</p>
        ) : (
          <div className="divide-y divide-border/40">
            {lines.map((line, i) => {
              const badge = getLineBadge(line);
              return (
                <div key={i} className="flex items-start gap-2.5 px-4 py-2 hover:bg-accent/40 transition-colors">
                  <span className={`shrink-0 mt-0.5 inline-flex rounded-sm px-1.5 py-0.5 text-2xs font-mono font-semibold ${badge.className}`}>
                    {badge.label}
                  </span>
                  <span className="text-2xs font-mono text-muted-foreground/80 break-all leading-relaxed">{line}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
