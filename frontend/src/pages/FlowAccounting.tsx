import { useFlowAccounting } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Loader2, Activity, RefreshCw } from "lucide-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import DataGrid from "../components/shared/DataGrid";

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

interface HostStat {
  ip: string;
  flows: number;
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

function BytesCell({ value }: ICellRendererParams) {
  return <span className="font-medium font-mono text-xs">{formatBytes(value as number)}</span>;
}

function SrcCell({ data }: ICellRendererParams<Flow>) {
  if (!data) return null;
  return <span className="font-mono text-xs">{data.src_ip}{data.src_port ? `:${data.src_port}` : ""}</span>;
}

function DstCell({ data }: ICellRendererParams<Flow>) {
  if (!data) return null;
  return <span className="font-mono text-xs">{data.dst_ip}{data.dst_port ? `:${data.dst_port}` : ""}</span>;
}

const hostColumnDefs: ColDef<HostStat>[] = [
  { field: "ip", headerName: "Source IP", cellClass: "font-mono text-xs" },
  { field: "flows", headerName: "Flows", maxWidth: 90, cellClass: "text-muted-foreground text-xs" },
  {
    field: "bytes",
    headerName: "Bytes",
    maxWidth: 120,
    sort: "desc",
    cellRenderer: BytesCell,
  },
];

const flowColumnDefs: ColDef<Flow>[] = [
  { field: "interface", headerName: "Iface", maxWidth: 80, cellClass: "text-muted-foreground text-xs" },
  { headerName: "Src", cellRenderer: SrcCell, sortable: false, minWidth: 130 },
  { headerName: "Dst", cellRenderer: DstCell, sortable: false, minWidth: 130 },
  {
    field: "protocol",
    headerName: "Proto",
    maxWidth: 80,
    valueFormatter: ({ value }) => PROTO_MAP[value as string] ?? (value as string),
    cellClass: "text-muted-foreground text-xs",
  },
  { field: "packets", headerName: "Pkts", maxWidth: 80, cellClass: "text-muted-foreground text-xs" },
  {
    field: "bytes",
    headerName: "Bytes",
    maxWidth: 120,
    sort: "desc",
    cellRenderer: BytesCell,
  },
];

export default function FlowAccounting() {
  const { data, isLoading, refetch, isFetching } = useFlowAccounting();
  const flows: Flow[] = data?.flows ?? [];

  const hostStats = flows.reduce<Record<string, { bytes: number; flows: number }>>((acc, f) => {
    const key = f.src_ip;
    if (!acc[key]) acc[key] = { bytes: 0, flows: 0 };
    acc[key].bytes += f.bytes;
    acc[key].flows += 1;
    return acc;
  }, {});

  const topHosts: HostStat[] = Object.entries(hostStats)
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, 10)
    .map(([ip, s]) => ({ ip, ...s }));

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
              <DataGrid<HostStat>
                columnDefs={hostColumnDefs}
                rowData={topHosts}
                compact
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Recent Flows{" "}
              <span className="text-xs font-normal text-muted-foreground">(sorted by bytes)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : !flows.length ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No flows. Is flow-accounting configured?
              </p>
            ) : (
              <DataGrid<Flow>
                columnDefs={flowColumnDefs}
                rowData={flows.slice(0, 100)}
                height={384}
                compact
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
