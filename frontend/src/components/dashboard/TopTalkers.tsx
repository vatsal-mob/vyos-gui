import { useTopTalkers } from "../../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Loader2 } from "lucide-react";
import type { ColDef, ValueFormatterParams } from "ag-grid-community";
import DataGrid from "../shared/DataGrid";

interface TalkerEntry {
  ip: string;
  connections: number;
  bytes: number;
}

const columnDefs: ColDef<TalkerEntry>[] = [
  {
    headerName: "#",
    maxWidth: 50,
    valueGetter: ({ node }) => (node?.rowIndex ?? 0) + 1,
    cellClass: "text-xs text-muted-foreground",
    sortable: false,
  },
  { field: "ip", headerName: "Source IP", cellClass: "font-mono text-xs" },
  {
    field: "connections",
    headerName: "Connections",
    maxWidth: 120,
    type: "numericColumn",
    cellClass: "font-mono text-xs text-right",
    sort: "desc",
  },
  {
    field: "bytes",
    headerName: "Bytes",
    maxWidth: 110,
    type: "numericColumn",
    cellClass: "font-mono text-xs text-right",
    valueFormatter: ({ value }: ValueFormatterParams<TalkerEntry>) => (value as number)?.toLocaleString() ?? "—",
  },
];

export default function TopTalkers() {
  const { data, isLoading, isFetching } = useTopTalkers();
  const talkers: TalkerEntry[] = data?.talkers ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Top Talkers</CardTitle>
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : talkers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No conntrack data available.</p>
        ) : (
          <DataGrid<TalkerEntry>
            columnDefs={columnDefs}
            rowData={talkers}
            compact
          />
        )}
      </CardContent>
    </Card>
  );
}
