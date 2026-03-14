import { useState, useMemo } from "react";
import {
  useFirewallChains,
  useFirewallRules,
  useFirewallGroups,
  useAddFirewallRule,
  useDeleteFirewallRule,
} from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import { Plus, Trash2, Loader2 } from "lucide-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import DataGrid from "../components/shared/DataGrid";

interface FirewallRule {
  rule_number: number;
  action: string;
  description: string;
  source: string;
  destination: string;
  protocol: string;
  log: boolean;
}

interface FirewallGroup {
  name: string;
  type: string;
  members: string[];
}

const actionColor: Record<string, string> = {
  accept: "text-emerald-400",
  drop: "text-red-400",
  reject: "text-amber-400",
};

function ActionCell({ value }: ICellRendererParams) {
  return (
    <span className={`font-medium ${actionColor[value as string] ?? ""}`}>{value}</span>
  );
}

function makeDeleteCell(chain: string, onDelete: (ruleNumber: number) => void) {
  return function DeleteCell({ data }: ICellRendererParams<FirewallRule>) {
    if (!data) return null;
    return (
      <ConfirmDialog
        trigger={<button className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
        title="Delete firewall rule?"
        description={`Delete rule ${data.rule_number} (${data.action}) from chain ${chain}?`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => onDelete(data.rule_number)}
      />
    );
  };
}

function ChainRules({ chain }: { chain: string }) {
  const { data: rules, isLoading } = useFirewallRules(chain);
  const addRule = useAddFirewallRule();
  const deleteRule = useDeleteFirewallRule();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    rule_number: "",
    action: "accept",
    description: "",
    source: "",
    destination: "",
    protocol: "",
    log: false,
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await addRule.mutateAsync({ chain, rule: { ...form, rule_number: Number(form.rule_number) } });
    setForm({ rule_number: "", action: "accept", description: "", source: "", destination: "", protocol: "", log: false });
    setShowForm(false);
  }

  const DeleteCell = useMemo(
    () => makeDeleteCell(chain, (ruleNumber) => deleteRule.mutate({ chain, ruleNumber })),
    [chain, deleteRule.mutate]
  );

  const columnDefs = useMemo<ColDef<FirewallRule>[]>(() => [
    { field: "rule_number", headerName: "#", maxWidth: 70 },
    { field: "action", headerName: "Action", maxWidth: 100, cellRenderer: ActionCell },
    { field: "protocol", headerName: "Protocol", maxWidth: 100, valueFormatter: ({ value }) => (value as string) || "any", cellClass: "text-muted-foreground" },
    { field: "source", headerName: "Source", cellClass: "font-mono text-xs", valueFormatter: ({ value }) => (value as string) || "any" },
    { field: "destination", headerName: "Destination", cellClass: "font-mono text-xs", valueFormatter: ({ value }) => (value as string) || "any" },
    { field: "description", headerName: "Description", cellClass: "text-muted-foreground", valueFormatter: ({ value }) => (value as string) || "—" },
    { headerName: "", maxWidth: 50, cellRenderer: DeleteCell, sortable: false },
  ], [DeleteCell]);

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3.5 w-3.5" /> Add Rule
        </Button>
      </div>
      {showForm && (
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-2 rounded-md border p-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Rule #</Label>
            <Input value={form.rule_number} onChange={(e) => setForm({ ...form, rule_number: e.target.value })} required type="number" min="1" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Action</Label>
            <select
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="accept">accept</option>
              <option value="drop">drop</option>
              <option value="reject">reject</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Protocol</Label>
            <Input value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })} placeholder="tcp/udp/icmp" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Source</Label>
            <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="0.0.0.0/0" className="font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Destination</Label>
            <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="0.0.0.0/0" className="font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="col-span-2 flex gap-2 md:col-span-3">
            <Button type="submit" size="sm" disabled={addRule.isPending}>
              {addRule.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}
      {isLoading ? (
        <div className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
      ) : !rules?.length ? (
        <p className="py-6 text-center text-muted-foreground">No rules</p>
      ) : (
        <DataGrid<FirewallRule>
          columnDefs={columnDefs}
          rowData={rules ?? []}
          compact
        />
      )}
    </div>
  );
}

export default function Firewall() {
  const { data: chains, isLoading } = useFirewallChains();
  const { data: groups } = useFirewallGroups();
  const [selectedChain, setSelectedChain] = useState<string | null>(null);

  const allChains: string[] = chains ?? [];
  const activeChain = selectedChain ?? allChains[0] ?? null;

  const groupColumnDefs = useMemo<ColDef<FirewallGroup>[]>(() => [
    { field: "name", headerName: "Name", cellClass: "font-medium" },
    { field: "type", headerName: "Type", maxWidth: 120, cellClass: "text-muted-foreground" },
    {
      field: "members",
      headerName: "Members",
      cellClass: "font-mono text-xs",
      valueFormatter: ({ value }) => (value as string[])?.join(", ") || "—",
      sortable: false,
    },
  ], []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Firewall</h1>

      {isLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}

      {!isLoading && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Chains</CardTitle>
              {allChains.length === 0 && <span className="text-sm text-muted-foreground">No chains configured</span>}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {allChains.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedChain(c)}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                    activeChain === c ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </CardHeader>
          {activeChain && (
            <CardContent>
              <ChainRules chain={activeChain} />
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Firewall Groups</CardTitle></CardHeader>
        <CardContent>
          {!groups?.length ? (
            <p className="py-6 text-center text-muted-foreground">No groups configured</p>
          ) : (
            <DataGrid<FirewallGroup>
              columnDefs={groupColumnDefs}
              rowData={groups ?? []}
              compact
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
