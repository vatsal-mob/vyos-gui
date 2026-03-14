import { useConntrack } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Loader2 } from "lucide-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import DataGrid from "../components/shared/DataGrid";

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

function StateBadge({ value }: ICellRendererParams) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const cls =
    value === "ESTABLISHED"
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : value === "TIME_WAIT"
      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {value}
    </span>
  );
}

function SrcCell({ data }: ICellRendererParams<ConntrackEntry>) {
  if (!data) return null;
  return <span className="font-mono text-xs">{data.src}{data.sport ? `:${data.sport}` : ""}</span>;
}

function DstCell({ data }: ICellRendererParams<ConntrackEntry>) {
  if (!data) return null;
  return <span className="font-mono text-xs">{data.dst}{data.dport ? `:${data.dport}` : ""}</span>;
}

const columnDefs: ColDef<ConntrackEntry>[] = [
  {
    field: "protocol",
    headerName: "Protocol",
    maxWidth: 100,
    cellRenderer: ({ value }: ICellRendererParams) => (
      <span className="font-mono uppercase text-xs">{value}</span>
    ),
  },
  { headerName: "Source", cellRenderer: SrcCell, sortable: false },
  { headerName: "Destination", cellRenderer: DstCell, sortable: false },
  { field: "state", headerName: "State", maxWidth: 160, cellRenderer: StateBadge },
  {
    field: "bytes",
    headerName: "Bytes",
    maxWidth: 120,
    type: "numericColumn",
    valueFormatter: ({ value }) => (value as number)?.toLocaleString() ?? "—",
    cellClass: "font-mono text-xs text-right",
  },
  {
    field: "packets",
    headerName: "Packets",
    maxWidth: 120,
    type: "numericColumn",
    valueFormatter: ({ value }) => (value as number)?.toLocaleString() ?? "—",
    cellClass: "font-mono text-xs text-right",
  },
];

export default function Connections() {
  const { data, isLoading, isFetching } = useConntrack();
  const entries: ConntrackEntry[] = data?.entries ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Connection Tracker</h1>

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
            <DataGrid<ConntrackEntry>
              columnDefs={columnDefs}
              rowData={entries}
              pagination
              pageSize={50}
            />
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {entries.length} entries. Auto-refreshes every 5s.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
