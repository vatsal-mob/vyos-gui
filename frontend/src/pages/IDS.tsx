import { useState } from "react";
import { useSuricataAlerts } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Loader2, ShieldAlert, RefreshCw } from "lucide-react";

interface Alert {
  timestamp: string;
  src_ip: string;
  src_port: number;
  dest_ip: string;
  dest_port: number;
  proto: string;
  interface: string;
  direction: string;
  signature: string;
  category: string;
  severity: number;
  action: string;
  signature_id: number;
}

const SEVERITY_CLASSES: Record<number, string> = {
  1: "bg-destructive/20 text-destructive",
  2: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
  3: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
};

const SEVERITY_LABELS: Record<number, string> = {
  1: "High",
  2: "Medium",
  3: "Low",
};

export default function IDS() {
  const [lines, setLines] = useState(200);
  const [filter, setFilter] = useState("");
  const { data, isLoading, refetch, isFetching } = useSuricataAlerts(lines);

  const alerts: Alert[] = data?.alerts ?? [];
  const filtered = filter
    ? alerts.filter(
        (a) =>
          a.src_ip.includes(filter) ||
          a.dest_ip.includes(filter) ||
          a.signature.toLowerCase().includes(filter.toLowerCase()) ||
          a.category.toLowerCase().includes(filter.toLowerCase())
      )
    : alerts;

  function formatTime(ts: string) {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-6 w-6" />
          IDS Alerts
        </h1>
        <div className="flex items-center gap-2">
          <select
            className="rounded border bg-background px-2 py-1.5 text-sm"
            value={lines}
            onChange={(e) => setLines(Number(e.target.value))}
          >
            <option value={50}>Last 50</option>
            <option value={200}>Last 200</option>
            <option value={500}>Last 500</option>
            <option value={1000}>Last 1000</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        {[1, 2, 3].map((sev) => {
          const count = alerts.filter((a) => a.severity === sev).length;
          return (
            <div key={sev} className={`rounded-lg px-4 py-2 text-sm font-medium ${SEVERITY_CLASSES[sev]}`}>
              {SEVERITY_LABELS[sev]}: {count}
            </div>
          );
        })}
        <div className="rounded-lg px-4 py-2 text-sm font-medium bg-muted text-muted-foreground">
          Total: {alerts.length}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <CardTitle className="text-base">Alert Feed</CardTitle>
          <Input
            className="max-w-xs h-8 text-sm"
            placeholder="Filter by IP, signature, category…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !filtered.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {filter ? "No alerts match the filter." : "No Suricata alerts found."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Time</th>
                    <th className="py-2 pr-3 font-medium">Sev</th>
                    <th className="py-2 pr-3 font-medium">Iface</th>
                    <th className="py-2 pr-3 font-medium">Src</th>
                    <th className="py-2 pr-3 font-medium">Dst</th>
                    <th className="py-2 pr-3 font-medium">Proto</th>
                    <th className="py-2 pr-3 font-medium">Action</th>
                    <th className="py-2 font-medium">Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">
                        {formatTime(a.timestamp)}
                      </td>
                      <td className="py-1.5 pr-3">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SEVERITY_CLASSES[a.severity] ?? "bg-muted"}`}>
                          {SEVERITY_LABELS[a.severity] ?? a.severity}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 font-mono text-muted-foreground">{a.interface || "—"}</td>
                      <td className="py-1.5 pr-3 font-mono whitespace-nowrap">
                        {a.src_ip}{a.src_port ? `:${a.src_port}` : ""}
                      </td>
                      <td className="py-1.5 pr-3 font-mono whitespace-nowrap">
                        {a.dest_ip}{a.dest_port ? `:${a.dest_port}` : ""}
                      </td>
                      <td className="py-1.5 pr-3 font-mono text-muted-foreground">{a.proto}</td>
                      <td className="py-1.5 pr-3">
                        <span className={`rounded px-1.5 py-0.5 text-xs ${a.action === "allowed" ? "bg-muted text-muted-foreground" : "bg-destructive/20 text-destructive"}`}>
                          {a.action}
                        </span>
                      </td>
                      <td className="py-1.5 text-muted-foreground max-w-xs truncate" title={a.signature}>
                        {a.signature}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
