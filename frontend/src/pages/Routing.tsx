import { useState } from "react";
import { useStaticRoutes, useRoutingTable, useAddStaticRoute, useDeleteStaticRoute } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import { Plus, Trash2, Loader2 } from "lucide-react";

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

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-semibold tracking-tight">Routing</h1>

      {/* Static routes */}
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="py-2 pr-4">Prefix</th>
                <th className="py-2 pr-4">Next Hop</th>
                <th className="py-2 pr-4">Distance</th>
                <th className="py-2 pr-4">Description</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {staticLoading && <tr><td colSpan={5} className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>}
              {(staticRoutes ?? []).map((r: StaticRoute) => (
                <tr key={`${r.prefix}-${r.next_hop}`} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono">{r.prefix}</td>
                  <td className="py-2 pr-4 font-mono">{r.next_hop}</td>
                  <td className="py-2 pr-4">{r.distance}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{r.description || "—"}</td>
                  <td className="py-2">
                    <ConfirmDialog
                      trigger={<button className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                      title="Delete static route?"
                      description={`Remove route to ${r.prefix} via ${r.next_hop}. This will be committed immediately.`}
                      confirmLabel="Delete"
                      destructive
                      onConfirm={() => deleteRoute.mutate(r.prefix)}
                    />
                  </td>
                </tr>
              ))}
              {!staticLoading && !staticRoutes?.length && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No static routes configured</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* RIB */}
      <Card>
        <CardHeader><CardTitle className="text-base">Routing Table (RIB)</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="py-2 pr-4">Prefix</th>
                <th className="py-2 pr-4">Protocol</th>
                <th className="py-2 pr-4">Next Hops</th>
                <th className="py-2 pr-4">Distance</th>
                <th className="py-2">Uptime</th>
              </tr>
            </thead>
            <tbody>
              {ribLoading && <tr><td colSpan={5} className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>}
              {(ribRoutes ?? []).map((r: RouteEntry, i: number) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono">{r.prefix}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{r.protocol}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{r.next_hops.join(", ") || "—"}</td>
                  <td className="py-2 pr-4">{r.distance}</td>
                  <td className="py-2 text-muted-foreground">{r.uptime || "—"}</td>
                </tr>
              ))}
              {!ribLoading && !ribRoutes?.length && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No routes in table</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
