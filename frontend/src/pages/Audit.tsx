import { useAuditLogs } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Loader2 } from "lucide-react";

interface AuditEntry {
  time?: string;
  event?: string;
  [key: string]: unknown;
}

export default function Audit() {
  const { data, isLoading, isFetching } = useAuditLogs(200);
  const entries: AuditEntry[] = Array.isArray(data) ? data : [];
  const sorted = [...entries].reverse(); // most recent first

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Audit Log</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Events</CardTitle>
            {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading audit log…
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No audit events recorded yet.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">Time</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Event</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((entry, i) => {
                    const { time, event, ...rest } = entry;
                    const details = Object.entries(rest)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ");
                    return (
                      <tr key={i} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-2 px-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {time ?? "—"}
                        </td>
                        <td className="py-2 px-2">
                          <span className="inline-flex rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {event ?? "unknown"}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-xs text-muted-foreground font-mono">{details || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {entries.length} events. Auto-refreshes every 5s.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
