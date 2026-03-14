import { useFirewallLog } from "../../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Loader2 } from "lucide-react";

function getLineBadge(line: string): { label: string; className: string } {
  const lower = line.toLowerCase();
  if (lower.includes("block") || lower.includes("drop") || lower.includes("reject") || lower.includes("denied")) {
    return { label: "BLOCK", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  }
  if (lower.includes("accept") || lower.includes("allow") || lower.includes("permit")) {
    return { label: "ACCEPT", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
  }
  return { label: "INFO", className: "bg-muted text-muted-foreground" };
}

export default function FirewallFeed() {
  const { data, isLoading, isFetching } = useFirewallLog(30);
  const lines: string[] = data?.lines ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Recent Firewall Events</CardTitle>
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No firewall log entries found.</p>
        ) : (
          <pre className="max-h-72 overflow-auto rounded border bg-muted p-3 text-xs font-mono space-y-1">
            {lines.map((line, i) => {
              const badge = getLineBadge(line);
              return (
                <div key={i} className="flex items-start gap-2">
                  <span className={`shrink-0 inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${badge.className}`}>
                    {badge.label}
                  </span>
                  <span className="break-all">{line}</span>
                </div>
              );
            })}
          </pre>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Auto-refreshes every 10s.</p>
      </CardContent>
    </Card>
  );
}
