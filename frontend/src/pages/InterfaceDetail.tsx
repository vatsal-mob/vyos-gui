import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useInterface, useUpdateInterface } from "../hooks/useVyos";
import StatusBadge from "../components/shared/StatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Loader2, ArrowLeft, Plus, Trash2 } from "lucide-react";

export default function InterfaceDetail() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { data: iface, isLoading, isError } = useInterface(name!);
  const updateMutation = useUpdateInterface();

  const [newAddress, setNewAddress] = useState("");
  const [description, setDescription] = useState("");
  const [editDesc, setEditDesc] = useState(false);

  if (isLoading) return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (isError || !iface) return <p className="text-destructive">Interface not found.</p>;

  async function addAddress() {
    if (!newAddress) return;
    await updateMutation.mutateAsync({
      name: name!,
      commands: [{ op: "set", path: ["interfaces", "ethernet", name, "address"], value: newAddress }],
    });
    setNewAddress("");
  }

  async function removeAddress(addr: string) {
    await updateMutation.mutateAsync({
      name: name!,
      commands: [{ op: "delete", path: ["interfaces", "ethernet", name, "address"], value: addr }],
    });
  }

  async function saveDescription() {
    await updateMutation.mutateAsync({
      name: name!,
      commands: [{ op: "set", path: ["interfaces", "ethernet", name, "description"], value: description }],
    });
    setEditDesc(false);
  }

  async function toggleEnable(enable: boolean) {
    const commands = enable
      ? [{ op: "delete", path: ["interfaces", "ethernet", name, "disable"] }]
      : [{ op: "set", path: ["interfaces", "ethernet", name, "disable"] }];
    await updateMutation.mutateAsync({ name: name!, commands });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/interfaces")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-semibold font-mono">{name}</h1>
        <StatusBadge status={iface.state} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span>{iface.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">MAC</span>
              <span className="font-mono">{iface.mac || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">MTU</span>
              <span>{iface.mtu ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Description</span>
              {editDesc ? (
                <div className="flex gap-1">
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-7 w-40 text-xs"
                  />
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={saveDescription}>
                    Save
                  </Button>
                </div>
              ) : (
                <button
                  className="text-primary hover:underline text-xs"
                  onClick={() => { setDescription(iface.description || ""); setEditDesc(true); }}
                >
                  {iface.description || "Edit"}
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Toggle */}
        <Card>
          <CardHeader><CardTitle className="text-base">State</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Button
              size="sm"
              variant={iface.state === "up" ? "default" : "outline"}
              onClick={() => toggleEnable(true)}
              disabled={updateMutation.isPending}
            >
              Enable
            </Button>
            <Button
              size="sm"
              variant={iface.state === "down" ? "destructive" : "outline"}
              onClick={() => toggleEnable(false)}
              disabled={updateMutation.isPending}
            >
              Disable
            </Button>
          </CardContent>
        </Card>

        {/* Addresses */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">IP Addresses</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {iface.addresses.map((addr: string) => (
              <div key={addr} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="font-mono text-sm">{addr}</span>
                <button onClick={() => removeAddress(addr)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="192.168.1.1/24"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="font-mono"
              />
              <Button onClick={addAddress} disabled={updateMutation.isPending || !newAddress} size="sm">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            {updateMutation.isError && (
              <p className="text-sm text-destructive">
                {(updateMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Operation failed"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
