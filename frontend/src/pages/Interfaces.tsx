import { useInterfaces } from "../hooks/useVyos";
import StatusBadge from "../components/shared/StatusBadge";
import { Link } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { Loader2 } from "lucide-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import DataGrid from "../components/shared/DataGrid";

interface Iface {
  name: string;
  type: string;
  addresses: string[];
  state: string;
  mac: string;
  mtu: number | null;
}

function StatusCell({ value }: ICellRendererParams) {
  return <StatusBadge status={value as string} />;
}

function AddressCell({ value }: ICellRendererParams<Iface>) {
  const addrs = value as string[];
  if (!addrs?.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="font-mono text-xs">
      {addrs.join(", ")}
    </span>
  );
}

function EditCell({ data }: ICellRendererParams<Iface>) {
  if (!data) return null;
  return (
    <Link to={`/interfaces/${data.name}`} className="text-primary hover:underline text-xs">
      Edit
    </Link>
  );
}

const columnDefs: ColDef<Iface>[] = [
  { field: "name", headerName: "Name", maxWidth: 120, cellClass: "font-mono font-medium text-sm" },
  { field: "type", headerName: "Type", maxWidth: 100, cellClass: "text-muted-foreground" },
  { field: "addresses", headerName: "IP Addresses", cellRenderer: AddressCell, sortable: false },
  { field: "state", headerName: "Status", maxWidth: 110, cellRenderer: StatusCell },
  { field: "mac", headerName: "MAC", cellClass: "font-mono text-xs text-muted-foreground", maxWidth: 160 },
  { field: "mtu", headerName: "MTU", maxWidth: 80, cellClass: "text-muted-foreground" },
  { headerName: "", maxWidth: 60, cellRenderer: EditCell, sortable: false },
];

export default function Interfaces() {
  const { data: interfaces, isLoading, isError } = useInterfaces();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Interfaces</h1>
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}
      {isError && <p className="text-destructive">Failed to load interfaces.</p>}
      {!isLoading && !isError && (
        <Card>
          <CardContent className="p-0">
            {!interfaces?.length ? (
              <p className="px-4 py-8 text-center text-muted-foreground">No interfaces found</p>
            ) : (
              <DataGrid<Iface>
                columnDefs={columnDefs}
                rowData={interfaces ?? []}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
