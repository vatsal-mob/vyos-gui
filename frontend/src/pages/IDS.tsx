import { useState, useRef } from "react";
import { useSuricataAlerts } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Loader2, ShieldAlert, RefreshCw } from "lucide-react";
import type { ColDef, GridApi, ICellRendererParams } from "ag-grid-community";
import DataGrid from "../components/shared/DataGrid";

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

function SeverityBadge({ value }: ICellRendererParams) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SEVERITY_CLASSES[value as number] ?? "bg-muted"}`}>
      {SEVERITY_LABELS[value as number] ?? value}
    </span>
  );
}

function ActionBadge({ value }: ICellRendererParams) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs ${value === "allowed" ? "bg-muted text-muted-foreground" : "bg-destructive/20 text-destructive"}`}>
      {value}
    </span>
  );
}

function SrcCell({ data }: ICellRendererParams<Alert>) {
  if (!data) return null;
  return <span className="font-mono text-xs">{data.src_ip}{data.src_port ? `:${data.src_port}` : ""}</span>;
}

function DstCell({ data }: ICellRendererParams<Alert>) {
  if (!data) return null;
  return <span className="font-mono text-xs">{data.dest_ip}{data.dest_port ? `:${data.dest_port}` : ""}</span>;
}

function formatTime(ts: string) {
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

const columnDefs: ColDef<Alert>[] = [
  {
    field: "timestamp",
    headerName: "Time",
    minWidth: 160,
    valueFormatter: ({ value }) => formatTime(value as string),
    cellClass: "text-muted-foreground whitespace-nowrap text-xs",
  },
  { field: "severity", headerName: "Sev", maxWidth: 90, cellRenderer: SeverityBadge },
  { field: "interface", headerName: "Iface", maxWidth: 90, cellClass: "font-mono text-muted-foreground text-xs" },
  { headerName: "Src", cellRenderer: SrcCell, sortable: false, minWidth: 140 },
  { headerName: "Dst", cellRenderer: DstCell, sortable: false, minWidth: 140 },
  { field: "proto", headerName: "Proto", maxWidth: 80, cellClass: "font-mono text-muted-foreground text-xs" },
  { field: "action", headerName: "Action", maxWidth: 100, cellRenderer: ActionBadge },
  {
    field: "signature",
    headerName: "Signature",
    flex: 2,
    cellClass: "text-muted-foreground text-xs truncate",
    tooltipField: "signature",
  },
];

export default function IDS() {
  const [lines, setLines] = useState(200);
  const { data, isLoading, refetch, isFetching } = useSuricataAlerts(lines);
  const gridApiRef = useRef<GridApi<Alert> | null>(null);

  const alerts: Alert[] = data?.alerts ?? [];

  function handleFilterChange(e: React.ChangeEvent<HTMLInputElement>) {
    gridApiRef.current?.setGridOption("quickFilterText", e.target.value);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
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
            onChange={handleFilterChange}
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No Suricata alerts found.</p>
          ) : (
            <DataGrid<Alert>
              columnDefs={columnDefs}
              rowData={alerts}
              pagination
              pageSize={50}
              onGridReady={(params) => { gridApiRef.current = params.api; }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
