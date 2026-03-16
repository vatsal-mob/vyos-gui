import { useState } from "react";
import {
  useWireGuard,
  useWireGuardStatus,
  useAddWireGuardPeer,
  useDeleteWireGuardPeer,
  useIPsecStatus,
  useOpenVPNStatus,
} from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";

interface Peer {
  name: string;
  public_key: string;
  allowed_ips: string[];
  endpoint: string;
  persistent_keepalive: number;
}

interface WGInterface {
  name: string;
  description: string;
  address: string;
  port: number;
  peers: Peer[];
}

function PeerRow({
  peer,
  onDelete,
  deleting,
}: {
  peer: Peer;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-start justify-between rounded border px-3 py-2 text-sm">
      <div className="space-y-0.5">
        <div className="font-medium">{peer.name}</div>
        <div className="text-xs text-muted-foreground font-mono break-all">{peer.public_key}</div>
        {peer.endpoint && (
          <div className="text-xs text-muted-foreground">Endpoint: {peer.endpoint}</div>
        )}
        {peer.allowed_ips.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Allowed IPs: {peer.allowed_ips.join(", ")}
          </div>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={onDelete} disabled={deleting}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function AddPeerForm({
  iface,
  onClose,
}: {
  iface: string;
  onClose: () => void;
}) {
  const addPeer = useAddWireGuardPeer();
  const [form, setForm] = useState({
    name: "",
    public_key: "",
    allowed_ips: "",
    endpoint: "",
    persistent_keepalive: "25",
  });

  function handleSubmit() {
    addPeer.mutate(
      {
        iface,
        peer: {
          ...form,
          allowed_ips: form.allowed_ips.split(",").map((s) => s.trim()).filter(Boolean),
          persistent_keepalive: parseInt(form.persistent_keepalive) || 0,
        },
      },
      { onSuccess: onClose }
    );
  }

  return (
    <div className="rounded border bg-muted/40 p-4 space-y-3">
      <p className="text-sm font-medium">Add Peer</p>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Peer name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          placeholder="Public key"
          value={form.public_key}
          onChange={(e) => setForm((f) => ({ ...f, public_key: e.target.value }))}
        />
        <Input
          placeholder="Allowed IPs (comma separated)"
          value={form.allowed_ips}
          onChange={(e) => setForm((f) => ({ ...f, allowed_ips: e.target.value }))}
        />
        <Input
          placeholder="Endpoint (host:port)"
          value={form.endpoint}
          onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
        />
        <Input
          placeholder="Keepalive (seconds)"
          value={form.persistent_keepalive}
          onChange={(e) => setForm((f) => ({ ...f, persistent_keepalive: e.target.value }))}
        />
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={!form.name || !form.public_key || addPeer.isPending}
        >
          {addPeer.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          Add Peer
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
      {addPeer.isError && (
        <p className="text-xs text-destructive">{String(addPeer.error)}</p>
      )}
    </div>
  );
}

function CollapsibleStatusCard({
  title,
  status,
  isLoading,
}: {
  title: string;
  status?: string;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : status ? (
            <pre className="max-h-64 overflow-auto rounded border bg-muted p-3 text-xs font-mono">
              {status}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">No status available.</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function VPN() {
  const { data: interfaces, isLoading } = useWireGuard();
  const { data: statusData, isLoading: statusLoading } = useWireGuardStatus();
  const { data: ipsecData, isLoading: ipsecLoading } = useIPsecStatus();
  const { data: ovpnData, isLoading: ovpnLoading } = useOpenVPNStatus();
  const deletePeer = useDeleteWireGuardPeer();
  const [addingPeer, setAddingPeer] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (isLoading)
    return <p className="text-sm text-muted-foreground p-8">Loading WireGuard configuration…</p>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-semibold tracking-tight">VPN</h1>

      {(!interfaces || interfaces.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No WireGuard interfaces configured on this router.
          </CardContent>
        </Card>
      )}

      {(interfaces as WGInterface[] ?? []).map((iface) => (
        <Card key={iface.name}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{iface.name}</CardTitle>
                {iface.description && (
                  <p className="text-sm text-muted-foreground">{iface.description}</p>
                )}
              </div>
              <div className="text-right text-sm text-muted-foreground">
                {iface.address && <div>Address: {iface.address}</div>}
                <div>Port: {iface.port}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                className="flex items-center gap-1 text-sm font-medium"
                onClick={() =>
                  setExpanded((e) => ({ ...e, [iface.name]: !e[iface.name] }))
                }
              >
                {expanded[iface.name] ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {iface.peers.length} peer{iface.peers.length !== 1 ? "s" : ""}
              </button>
              <Button size="sm" onClick={() => setAddingPeer(iface.name)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Peer
              </Button>
            </div>

            {expanded[iface.name] && (
              <div className="space-y-2">
                {iface.peers.map((peer) => (
                  <PeerRow
                    key={peer.name}
                    peer={peer}
                    onDelete={() =>
                      deletePeer.mutate({ iface: iface.name, peerName: peer.name })
                    }
                    deleting={deletePeer.isPending}
                  />
                ))}
              </div>
            )}

            {addingPeer === iface.name && (
              <AddPeerForm iface={iface.name} onClose={() => setAddingPeer(null)} />
            )}
          </CardContent>
        </Card>
      ))}

      {/* Live WireGuard Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live WireGuard Status</CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : statusData?.status ? (
            <pre className="max-h-64 overflow-auto rounded border bg-muted p-3 text-xs font-mono">
              {statusData.status}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">No WireGuard status available.</p>
          )}
        </CardContent>
      </Card>

      {/* IPsec Status (collapsible) */}
      <CollapsibleStatusCard
        title="IPsec Status"
        status={ipsecData?.status}
        isLoading={ipsecLoading}
      />

      {/* OpenVPN Status (collapsible) */}
      <CollapsibleStatusCard
        title="OpenVPN Status"
        status={ovpnData?.status}
        isLoading={ovpnLoading}
      />
    </div>
  );
}
