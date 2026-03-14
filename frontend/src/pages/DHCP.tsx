import { useState, useMemo, useCallback } from "react";
import { useDHCPPools, useDHCPLeases, useCreateDHCPPool, useDeleteDHCPPool, useCreateStaticMapping, useStaticMappings, useDeleteStaticMapping } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import { Plus, Trash2, Loader2, Pin } from "lucide-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import DataGrid from "../components/shared/DataGrid";

interface DHCPPool {
  name: string;
  subnet: string;
  range_start: string;
  range_stop: string;
  default_router: string;
  dns_servers: string[];
  lease: number;
  description: string;
}

interface DHCPLease {
  ip: string;
  mac: string;
  hostname: string;
  expiry: string;
  pool: string;
  state: string;
}

interface StaticMapping {
  pool: string;
  name: string;
  ip: string;
  mac: string;
}

interface StaticMappingForm {
  leaseIp: string;
  leaseMac: string;
  leasePool: string;
  name: string;
}

export default function DHCP() {
  const { data: pools, isLoading: poolsLoading } = useDHCPPools();
  const { data: leases, isLoading: leasesLoading } = useDHCPLeases();
  const createPool = useCreateDHCPPool();
  const deletePool = useDeleteDHCPPool();
  const createStaticMapping = useCreateStaticMapping();
  const { data: staticMappings, isLoading: mappingsLoading } = useStaticMappings();
  const deleteStaticMapping = useDeleteStaticMapping();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", subnet: "", range_start: "", range_stop: "",
    default_router: "", dns_servers: "", lease: "86400", description: "",
  });
  const [mappingForm, setMappingForm] = useState<StaticMappingForm | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createPool.mutateAsync({
      ...form,
      dns_servers: form.dns_servers ? form.dns_servers.split(",").map((s) => s.trim()) : [],
      lease: Number(form.lease),
    });
    setForm({ name: "", subnet: "", range_start: "", range_stop: "", default_router: "", dns_servers: "", lease: "86400", description: "" });
    setShowForm(false);
  }

  const DeletePoolCell = useCallback(({ data }: ICellRendererParams<DHCPPool>) => {
    if (!data) return null;
    return (
      <ConfirmDialog
        trigger={<button className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
        title="Delete DHCP pool?"
        description={`Delete pool "${data.name}" (${data.subnet})?`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deletePool.mutate(data.name)}
      />
    );
  }, [deletePool.mutate]);

  const DeleteMappingCell = useCallback(({ data }: ICellRendererParams<StaticMapping>) => {
    if (!data) return null;
    return (
      <ConfirmDialog
        trigger={<button className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
        title="Delete static mapping?"
        description={`Remove reservation "${data.name}" (${data.ip}) from pool "${data.pool}"?`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteStaticMapping.mutate({ pool: data.pool, name: data.name })}
      />
    );
  }, [deleteStaticMapping.mutate]);

  const PinLeaseCell = useCallback(({ data }: ICellRendererParams<DHCPLease>) => {
    if (!data) return null;
    return (
      <button
        title="Add as static mapping"
        className="text-muted-foreground hover:text-primary"
        onClick={() =>
          setMappingForm({
            leaseIp: data.ip,
            leaseMac: data.mac,
            leasePool: data.pool,
            name: data.hostname || data.ip.replace(/\./g, "-"),
          })
        }
      >
        <Pin className="h-4 w-4" />
      </button>
    );
  }, [setMappingForm]);

  const poolColumnDefs = useMemo<ColDef<DHCPPool>[]>(() => [
    { field: "name", headerName: "Name", cellClass: "font-medium" },
    { field: "subnet", headerName: "Subnet", cellClass: "font-mono text-xs" },
    {
      headerName: "Range",
      cellClass: "font-mono text-xs",
      valueGetter: ({ data }) => data ? `${data.range_start} – ${data.range_stop}` : "",
      sortable: false,
    },
    { field: "default_router", headerName: "Router", cellClass: "font-mono text-xs", valueFormatter: ({ value }) => (value as string) || "—" },
    {
      field: "dns_servers",
      headerName: "DNS",
      cellClass: "font-mono text-xs",
      valueFormatter: ({ value }) => (value as string[])?.join(", ") || "—",
      sortable: false,
    },
    { headerName: "", maxWidth: 50, cellRenderer: DeletePoolCell, sortable: false },
  ], [DeletePoolCell]);

  const mappingColumnDefs = useMemo<ColDef<StaticMapping>[]>(() => [
    { field: "name", headerName: "Name", cellClass: "font-medium" },
    { field: "pool", headerName: "Pool", cellClass: "text-muted-foreground" },
    { field: "ip", headerName: "IP", cellClass: "font-mono" },
    { field: "mac", headerName: "MAC", cellClass: "font-mono text-xs" },
    { headerName: "", maxWidth: 50, cellRenderer: DeleteMappingCell, sortable: false },
  ], [DeleteMappingCell]);

  const leaseColumnDefs = useMemo<ColDef<DHCPLease>[]>(() => [
    { field: "ip", headerName: "IP", cellClass: "font-mono" },
    { field: "mac", headerName: "MAC", cellClass: "font-mono text-xs" },
    { field: "hostname", headerName: "Hostname", valueFormatter: ({ value }) => (value as string) || "—" },
    { field: "expiry", headerName: "Expiry", cellClass: "text-muted-foreground", valueFormatter: ({ value }) => (value as string) || "—" },
    { field: "state", headerName: "State", maxWidth: 100, cellClass: "text-muted-foreground" },
    { headerName: "", maxWidth: 50, cellRenderer: PinLeaseCell, sortable: false },
  ], [PinLeaseCell]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">DHCP</h1>

      {/* Pools */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">DHCP Pools</CardTitle>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" /> Add Pool
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showForm && (
            <form onSubmit={handleCreate} className="grid grid-cols-2 gap-2 rounded-md border p-3 md:grid-cols-4">
              <div className="space-y-1"><Label className="text-xs">Pool Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="space-y-1"><Label className="text-xs">Subnet (CIDR)</Label><Input value={form.subnet} onChange={(e) => setForm({ ...form, subnet: e.target.value })} required placeholder="192.168.1.0/24" className="font-mono" /></div>
              <div className="space-y-1"><Label className="text-xs">Range Start</Label><Input value={form.range_start} onChange={(e) => setForm({ ...form, range_start: e.target.value })} placeholder="192.168.1.100" className="font-mono" /></div>
              <div className="space-y-1"><Label className="text-xs">Range Stop</Label><Input value={form.range_stop} onChange={(e) => setForm({ ...form, range_stop: e.target.value })} placeholder="192.168.1.200" className="font-mono" /></div>
              <div className="space-y-1"><Label className="text-xs">Default Router</Label><Input value={form.default_router} onChange={(e) => setForm({ ...form, default_router: e.target.value })} placeholder="192.168.1.1" className="font-mono" /></div>
              <div className="space-y-1"><Label className="text-xs">DNS Servers (comma-sep)</Label><Input value={form.dns_servers} onChange={(e) => setForm({ ...form, dns_servers: e.target.value })} placeholder="8.8.8.8, 8.8.4.4" className="font-mono" /></div>
              <div className="space-y-1"><Label className="text-xs">Lease (seconds)</Label><Input value={form.lease} onChange={(e) => setForm({ ...form, lease: e.target.value })} type="number" /></div>
              <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="col-span-2 flex gap-2 md:col-span-4">
                <Button type="submit" size="sm" disabled={createPool.isPending}>{createPool.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          )}
          {poolsLoading ? (
            <div className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
          ) : !pools?.length ? (
            <p className="py-8 text-center text-muted-foreground">No pools configured</p>
          ) : (
            <DataGrid<DHCPPool> columnDefs={poolColumnDefs} rowData={pools ?? []} compact />
          )}
        </CardContent>
      </Card>

      {/* Static Mappings */}
      <Card>
        <CardHeader><CardTitle className="text-base">Static Mappings</CardTitle></CardHeader>
        <CardContent>
          {mappingsLoading ? (
            <div className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
          ) : !staticMappings?.length ? (
            <p className="py-6 text-center text-muted-foreground">No static mappings configured</p>
          ) : (
            <DataGrid<StaticMapping> columnDefs={mappingColumnDefs} rowData={staticMappings ?? []} compact />
          )}
        </CardContent>
      </Card>

      {/* Leases */}
      <Card>
        <CardHeader><CardTitle className="text-base">Active Leases</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {leasesLoading ? (
            <div className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
          ) : !leases?.length ? (
            <p className="py-6 text-center text-muted-foreground">No active leases</p>
          ) : (
            <DataGrid<DHCPLease> columnDefs={leaseColumnDefs} rowData={leases ?? []} compact />
          )}

          {/* Static mapping inline form */}
          {mappingForm && (
            <div className="rounded-md border bg-muted/40 p-4 space-y-3">
              <p className="text-sm font-medium">
                Reserve <span className="font-mono">{mappingForm.leaseIp}</span> as static mapping
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Mapping name</Label>
                  <Input
                    value={mappingForm.name}
                    onChange={(e) => setMappingForm({ ...mappingForm, name: e.target.value })}
                    placeholder="my-device"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Pool</Label>
                  <select
                    className="w-full rounded border px-2 py-2 text-sm bg-background"
                    value={mappingForm.leasePool}
                    onChange={(e) => setMappingForm({ ...mappingForm, leasePool: e.target.value })}
                  >
                    {(pools ?? []).map((p: DHCPPool) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground font-mono">
                <span>IP: {mappingForm.leaseIp}</span>
                <span>MAC: {mappingForm.leaseMac}</span>
              </div>
              {createStaticMapping.isError && (
                <p className="text-xs text-destructive">{String(createStaticMapping.error)}</p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!mappingForm.name || !mappingForm.leasePool || createStaticMapping.isPending}
                  onClick={() =>
                    createStaticMapping.mutate(
                      {
                        pool: mappingForm.leasePool,
                        name: mappingForm.name,
                        ip: mappingForm.leaseIp,
                        mac: mappingForm.leaseMac,
                      },
                      { onSuccess: () => setMappingForm(null) }
                    )
                  }
                >
                  {createStaticMapping.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Pin className="h-4 w-4 mr-1" />
                  )}
                  Reserve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMappingForm(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
