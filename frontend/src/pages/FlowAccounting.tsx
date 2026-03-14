import { useFlowAccounting } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Loader2, Activity, RefreshCw } from "lucide-react";

interface Flow {
  interface: string;
  src_ip: string;
  dst_ip: string;
  src_port: number;
  dst_port: number;
  protocol: string;
  packets: number;
  bytes: number;
}

const PROTO_MAP: Record<string, string> = {
  "6": "TCP",
  "17": "UDP",
  "1": "ICMP",
  "47": "GRE",
  "50": "ESP",
};

function formatBytes(b: number): string {
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  if (b >= 1_000) return `${(b / 1_000).toFixed(1)} KB`;
  return `${b} B`;
}

export default function FlowAccounting() {
  const { data, isLoading, refetch, isFetching } = useFlowAccounting();

  const flows: Flow[] = data?.flows ?? [];

  // Aggregate per-host stats
  const hostStats = flows.reduce<Record<string, { bytes: number; flows: number }>>((acc, f) => {
    const key = f.src_ip;
    if (!acc[key]) acc[key] = { bytes: 0, flows: 0 };
    acc[key].bytes += f.bytes;
    acc[key].flows += 1;
    return acc;
  }, {});

  const topHosts = Object.entries(hostStats)
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Activity className="h-6 w-6" />
          Flow Accounting
        </h1>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Flows</p>
          <p className="mt-1 text-2xl font-semibold">{flows.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Bytes</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatBytes(flows.reduce((s, f) => s + f.bytes, 0))}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Unique Sources</p>
          <p className="mt-1 text-2xl font-semibold">{Object.keys(hostStats).length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top hosts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Source IPs</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : !topHosts.length ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No flow data</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Source IP</th>
                    <th className="py-2 pr-4 font-medium">Flows</th>
                    <th className="py-2 font-medium">Bytes</th>
                  </tr>
                </thead>
                <tbody>
                  {topHosts.map(([ip, stats]) => (
                    <tr key={ip} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-1.5 pr-4 font-mono">{ip}</td>
                      <td className="py-1.5 pr-4 text-muted-foreground">{stats.flows}</td>
                      <td className="py-1.5 font-medium">{formatBytes(stats.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Flow table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Flows <span className="text-xs font-normal text-muted-foreground">(sorted by bytes)</span></CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : !flows.length ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No flows. Is flow-accounting configured?</p>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Iface</th>
                      <th className="py-2 pr-3 font-medium">Src</th>
                      <th className="py-2 pr-3 font-medium">Dst</th>
                      <th className="py-2 pr-3 font-medium">Proto</th>
                      <th className="py-2 pr-3 font-medium">Pkts</th>
                      <th className="py-2 font-medium">Bytes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flows.slice(0, 100).map((f, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-1 pr-3 text-muted-foreground">{f.interface}</td>
                        <td className="py-1 pr-3 font-mono whitespace-nowrap">
                          {f.src_ip}{f.src_port ? `:${f.src_port}` : ""}
                        </td>
                        <td className="py-1 pr-3 font-mono whitespace-nowrap">
                          {f.dst_ip}{f.dst_port ? `:${f.dst_port}` : ""}
                        </td>
                        <td className="py-1 pr-3 text-muted-foreground">
                          {PROTO_MAP[f.protocol] ?? f.protocol}
                        </td>
                        <td className="py-1 pr-3 text-muted-foreground">{f.packets}</td>
                        <td className="py-1 font-medium">{formatBytes(f.bytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
