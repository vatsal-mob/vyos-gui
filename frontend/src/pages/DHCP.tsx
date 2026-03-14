import { useState } from "react";
import { useDHCPPools, useDHCPLeases, useCreateDHCPPool, useDeleteDHCPPool, useCreateStaticMapping, useStaticMappings, useDeleteStaticMapping } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import { Plus, Trash2, Loader2, Pin } from "lucide-react";

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
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Subnet</th>
                  <th className="py-2 pr-4">Range</th>
                  <th className="py-2 pr-4">Router</th>
                  <th className="py-2 pr-4">DNS</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {(pools ?? []).map((p: DHCPPool) => (
                  <tr key={p.name} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 pr-4 font-medium">{p.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.subnet}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.range_start} – {p.range_stop}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.default_router || "—"}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.dns_servers.join(", ") || "—"}</td>
                    <td className="py-2">
                      <ConfirmDialog
                        trigger={<button className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                        title="Delete DHCP pool?"
                        description={`Delete pool "${p.name}" (${p.subnet})?`}
                        confirmLabel="Delete"
                        destructive
                        onConfirm={() => deletePool.mutate(p.name)}
                      />
                    </td>
                  </tr>
                ))}
                {!pools?.length && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No pools configured</td></tr>}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Static Mappings */}
      <Card>
        <CardHeader><CardTitle className="text-base">Static Mappings</CardTitle></CardHeader>
        <CardContent>
          {mappingsLoading ? (
            <div className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Pool</th>
                  <th className="py-2 pr-4">IP</th>
                  <th className="py-2 pr-4">MAC</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {(staticMappings ?? []).map((m: { pool: string; name: string; ip: string; mac: string }) => (
                  <tr key={`${m.pool}/${m.name}`} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 pr-4 font-medium">{m.name}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{m.pool}</td>
                    <td className="py-2 pr-4 font-mono">{m.ip || "—"}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{m.mac || "—"}</td>
                    <td className="py-2">
                      <ConfirmDialog
                        trigger={<button className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                        title="Delete static mapping?"
                        description={`Remove reservation "${m.name}" (${m.ip}) from pool "${m.pool}"?`}
                        confirmLabel="Delete"
                        destructive
                        onConfirm={() => deleteStaticMapping.mutate({ pool: m.pool, name: m.name })}
                      />
                    </td>
                  </tr>
                ))}
                {!staticMappings?.length && (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No static mappings configured</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Leases */}
      <Card>
        <CardHeader><CardTitle className="text-base">Active Leases</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {leasesLoading ? (
            <div className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="py-2 pr-4">IP</th>
                  <th className="py-2 pr-4">MAC</th>
                  <th className="py-2 pr-4">Hostname</th>
                  <th className="py-2 pr-4">Expiry</th>
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {(leases ?? []).map((l: DHCPLease, i: number) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 pr-4 font-mono">{l.ip}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{l.mac}</td>
                    <td className="py-2 pr-4">{l.hostname || "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{l.expiry || "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{l.state || "—"}</td>
                    <td className="py-2">
                      <button
                        title="Add as static mapping"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() =>
                          setMappingForm({
                            leaseIp: l.ip,
                            leaseMac: l.mac,
                            leasePool: l.pool,
                            name: l.hostname || l.ip.replace(/\./g, "-"),
                          })
                        }
                      >
                        <Pin className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!leases?.length && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No active leases</td></tr>}
              </tbody>
            </table>
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
