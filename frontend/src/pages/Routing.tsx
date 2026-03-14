import { useState } from "react";
import { useStaticRoutes, useRoutingTable, useAddStaticRoute, useDeleteStaticRoute } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import { Plus, Trash2, Loader2 } from "lucide-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import DataGrid from "../components/shared/DataGrid";

interface StaticRoute {
  prefix: string;
  next_hop: string;
  distance: number;
  description: string;
}

interface RouteEntry {
  prefix: string;
  protocol: string;
  distance: number;
  next_hops: string[];
  interface: string;
  uptime: string;
}

export default function Routing() {
  const { data: staticRoutes, isLoading: staticLoading } = useStaticRoutes();
  const { data: ribRoutes, isLoading: ribLoading } = useRoutingTable();
  const addRoute = useAddStaticRoute();
  const deleteRoute = useDeleteStaticRoute();

  const [form, setForm] = useState({ prefix: "", next_hop: "", distance: "1", description: "" });
  const [showForm, setShowForm] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await addRoute.mutateAsync({ ...form, distance: Number(form.distance) });
    setForm({ prefix: "", next_hop: "", distance: "1", description: "" });
    setShowForm(false);
  }

  function DeleteRouteCell({ data }: ICellRendererParams<StaticRoute>) {
    if (!data) return null;
    return (
      <ConfirmDialog
        trigger={<button className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
        title="Delete static route?"
        description={`Remove route to ${data.prefix} via ${data.next_hop}. This will be committed immediately.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteRoute.mutate(data.prefix)}
      />
    );
  }

  const staticColumnDefs: ColDef<StaticRoute>[] = [
    { field: "prefix", headerName: "Prefix", cellClass: "font-mono text-sm", sort: "asc" },
    { field: "next_hop", headerName: "Next Hop", cellClass: "font-mono" },
    { field: "distance", headerName: "Distance", maxWidth: 100 },
    { field: "description", headerName: "Description", cellClass: "text-muted-foreground", valueFormatter: ({ value }) => (value as string) || "—" },
    { headerName: "", maxWidth: 50, cellRenderer: DeleteRouteCell, sortable: false },
  ];

  const ribColumnDefs: ColDef<RouteEntry>[] = [
    { field: "prefix", headerName: "Prefix", cellClass: "font-mono text-sm", sort: "asc" },
    { field: "protocol", headerName: "Protocol", maxWidth: 110, cellClass: "text-muted-foreground" },
    {
      headerName: "Via",
      cellClass: "font-mono text-xs",
      valueGetter: ({ data: row }) => {
        if (!row) return "—";
        const hops = row.next_hops?.join(", ");
        return hops || row.interface || "—";
      },
      sortable: false,
    },
    { field: "distance", headerName: "Distance", maxWidth: 100 },
    { field: "uptime", headerName: "Uptime", maxWidth: 110, cellClass: "text-muted-foreground", valueFormatter: ({ value }) => (value as string) || "—" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Routing</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Static Routes</CardTitle>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" /> Add Route
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showForm && (
            <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3 rounded-md border p-3 md:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Prefix (e.g. 10.0.0.0/8)</Label>
                <Input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} required placeholder="10.0.0.0/8" className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Next Hop</Label>
                <Input value={form.next_hop} onChange={(e) => setForm({ ...form, next_hop: e.target.value })} required placeholder="192.168.1.1" className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Distance</Label>
                <Input value={form.distance} onChange={(e) => setForm({ ...form, distance: e.target.value })} type="number" min="1" max="255" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="optional" />
              </div>
              <div className="col-span-2 flex gap-2 md:col-span-4">
                <Button type="submit" size="sm" disabled={addRoute.isPending}>
                  {addRoute.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          )}
          {staticLoading ? (
            <div className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
          ) : !staticRoutes?.length ? (
            <p className="py-8 text-center text-muted-foreground">No static routes configured</p>
          ) : (
            <DataGrid<StaticRoute>
              columnDefs={staticColumnDefs}
              rowData={staticRoutes ?? []}
              compact
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Routing Table (RIB)</CardTitle></CardHeader>
        <CardContent>
          {ribLoading ? (
            <div className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
          ) : !ribRoutes?.length ? (
            <p className="py-8 text-center text-muted-foreground">No routes in table</p>
          ) : (
            <DataGrid<RouteEntry>
              columnDefs={ribColumnDefs}
              rowData={ribRoutes ?? []}
              compact
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
