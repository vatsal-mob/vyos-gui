import { useState } from "react";
import api from "../api/client";
import { useARPTable } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Loader2, Search, GitBranch, Table } from "lucide-react";

interface DiagResult {
  host: string;
  output: string;
  success: boolean;
}

interface ARPEntry {
  ip: string;
  mac: string;
  interface: string;
  state: string;
}

function ToolCard({
  title,
  icon: Icon,
  onRun,
  loading,
  result,
  placeholder,
  buttonLabel,
}: {
  title: string;
  icon: React.ElementType;
  onRun: (host: string) => void;
  loading: boolean;
  result: DiagResult | null;
  placeholder?: string;
  buttonLabel: string;
}) {
  const [host, setHost] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder={placeholder ?? "hostname or IP"}
            value={host}
            onChange={(e) => setHost(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && host && onRun(host)}
          />
          <Button onClick={() => onRun(host)} disabled={!host || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonLabel}
          </Button>
        </div>
        {result && (
          <pre
            className={`max-h-64 overflow-auto rounded border p-3 text-xs font-mono ${
              result.success ? "bg-muted" : "bg-destructive/10 text-destructive"
            }`}
          >
            {result.output || "(no output)"}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

export default function Diagnostics() {
  const { data: arpTable, isLoading: arpLoading, refetch: refetchARP } = useARPTable();

  const [pingResult, setPingResult] = useState<DiagResult | null>(null);
  const [pingLoading, setPingLoading] = useState(false);
  const [traceResult, setTraceResult] = useState<DiagResult | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);

  async function runPing(host: string) {
    setPingLoading(true);
    try {
      const { data } = await api.get("/diag/ping", { params: { host, count: 4 } });
      setPingResult(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setPingResult({ host, output: err?.response?.data?.detail ?? String(e), success: false });
    } finally {
      setPingLoading(false);
    }
  }

  async function runTraceroute(host: string) {
    setTraceLoading(true);
    try {
      const { data } = await api.get("/diag/traceroute", { params: { host } });
      setTraceResult(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setTraceResult({ host, output: err?.response?.data?.detail ?? String(e), success: false });
    } finally {
      setTraceLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-semibold tracking-tight">Diagnostics</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ToolCard
          title="Ping"
          icon={Search}
          onRun={runPing}
          loading={pingLoading}
          result={pingResult}
          placeholder="8.8.8.8 or hostname"
          buttonLabel="Ping"
        />
        <ToolCard
          title="Traceroute"
          icon={GitBranch}
          onRun={runTraceroute}
          loading={traceLoading}
          result={traceResult}
          placeholder="8.8.8.8 or hostname"
          buttonLabel="Trace"
        />
      </div>

      {/* ARP Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Table className="h-4 w-4" />
            ARP Table
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchARP()} disabled={arpLoading}>
            {arpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent>
          {arpLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !arpTable?.length ? (
            <p className="text-sm text-muted-foreground">No ARP entries.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">IP Address</th>
                    <th className="pb-2 pr-4">MAC Address</th>
                    <th className="pb-2">Interface</th>
                  </tr>
                </thead>
                <tbody>
                  {(arpTable as ARPEntry[]).map((entry) => (
                    <tr key={`${entry.ip}-${entry.mac}`} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono">{entry.ip}</td>
                      <td className="py-2 pr-4 font-mono text-muted-foreground">{entry.mac || "—"}</td>
                      <td className="py-2 text-muted-foreground">{entry.interface || "—"}</td>
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
