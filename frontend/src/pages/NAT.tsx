import { useState } from "react";
import { useNATRules, useAddNATRule, useDeleteNATRule } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface NATRule {
  rule_number: number;
  type: string;
  description: string;
  source_address: string;
  source_port: string;
  destination_address: string;
  destination_port: string;
  translation_address: string;
  translation_port: string;
  outbound_interface: string;
  inbound_interface: string;
  protocol: string;
}

function NATTable({ type }: { type: "source" | "destination" }) {
  const { data: rules, isLoading } = useNATRules(type);
  const addRule = useAddNATRule();
  const deleteRule = useDeleteNATRule();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    rule_number: "",
    description: "",
    source_address: "",
    destination_address: "",
    translation_address: "",
    outbound_interface: "",
    inbound_interface: "",
    protocol: "",
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await addRule.mutateAsync({ type, rule: { ...form, rule_number: Number(form.rule_number), type } });
    setForm({ rule_number: "", description: "", source_address: "", destination_address: "", translation_address: "", outbound_interface: "", inbound_interface: "", protocol: "" });
    setShowForm(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base capitalize">{type} NAT</CardTitle>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" /> Add Rule
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <form onSubmit={handleAdd} className="grid grid-cols-2 gap-2 rounded-md border p-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Rule #</Label>
              <Input value={form.rule_number} onChange={(e) => setForm({ ...form, rule_number: e.target.value })} required type="number" min="1" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Source Address</Label>
              <Input value={form.source_address} onChange={(e) => setForm({ ...form, source_address: e.target.value })} placeholder="0.0.0.0/0" className="font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Destination Address</Label>
              <Input value={form.destination_address} onChange={(e) => setForm({ ...form, destination_address: e.target.value })} className="font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Translation Address</Label>
              <Input value={form.translation_address} onChange={(e) => setForm({ ...form, translation_address: e.target.value })} className="font-mono" />
            </div>
            {type === "source" ? (
              <div className="space-y-1">
                <Label className="text-xs">Outbound Interface</Label>
                <Input value={form.outbound_interface} onChange={(e) => setForm({ ...form, outbound_interface: e.target.value })} placeholder="eth0" />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Inbound Interface</Label>
                <Input value={form.inbound_interface} onChange={(e) => setForm({ ...form, inbound_interface: e.target.value })} placeholder="eth0" />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Protocol</Label>
              <Input value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })} placeholder="tcp/udp" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="col-span-2 flex gap-2 md:col-span-4">
              <Button type="submit" size="sm" disabled={addRule.isPending}>
                {addRule.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        )}
        {isLoading ? (
          <div className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Destination</th>
                <th className="py-2 pr-3">Translation</th>
                <th className="py-2 pr-3">Interface</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {(rules ?? []).map((r: NATRule) => (
                <tr key={r.rule_number} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2 pr-3">{r.rule_number}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.source_address || "any"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.destination_address || "any"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.translation_address || "—"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.outbound_interface || r.inbound_interface || "—"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.description || "—"}</td>
                  <td className="py-2">
                    <ConfirmDialog
                      trigger={<button className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                      title="Delete NAT rule?"
                      description={`Delete ${type} NAT rule ${r.rule_number}?`}
                      confirmLabel="Delete"
                      destructive
                      onConfirm={() => deleteRule.mutate({ type, ruleNumber: r.rule_number })}
                    />
                  </td>
                </tr>
              ))}
              {!rules?.length && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No rules configured</td></tr>}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export default function NAT() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">NAT</h1>
      <NATTable type="source" />
      <NATTable type="destination" />
    </div>
  );
}
