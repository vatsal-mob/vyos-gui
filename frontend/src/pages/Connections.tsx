import { useConntrack } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Loader2 } from "lucide-react";

interface ConntrackEntry {
  protocol: string;
  src: string;
  dst: string;
  sport: string;
  dport: string;
  state: string;
  bytes: number;
  packets: number;
}

export default function Connections() {
  const { data, isLoading, isFetching } = useConntrack();
  const entries: ConntrackEntry[] = data?.entries ?? [];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-semibold tracking-tight">Connection Tracker</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Active Connections (IPv4)</CardTitle>
            {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading conntrack table…
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No active connections found.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Protocol</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Source</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Destination</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">State</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Bytes</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Packets</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={i} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-2 px-2 font-mono uppercase text-xs">{e.protocol}</td>
                      <td className="py-2 px-2 font-mono text-xs">
                        {e.src}{e.sport ? `:${e.sport}` : ""}
                      </td>
                      <td className="py-2 px-2 font-mono text-xs">
                        {e.dst}{e.dport ? `:${e.dport}` : ""}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                          e.state === "ESTABLISHED"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : e.state === "TIME_WAIT"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {e.state || "—"}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-xs">{e.bytes.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right font-mono text-xs">{e.packets.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {entries.length} entries. Auto-refreshes every 5s.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
