import { useState, useEffect } from "react";
import {
  useAdGuardStatus,
  useAdGuardConfig,
  useEnableAdGuard,
  useDisableAdGuard,
  useUpdateAdGuardConfig,
} from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import { Loader2, ShieldCheck, ExternalLink, Settings, CircleDot } from "lucide-react";

interface AdGuardConfig {
  image: string;
  web_port: number;
  dns_port: number;
  allow_host_networks: boolean;
  config_volume_source: string;
  restart: string;
  ports: { name: string; source: number; destination: number; protocol: string }[];
}

function StatusBadge({ running, running_status }: { running: boolean; running_status: string }) {
  const color = running
    ? "bg-green-500/15 text-green-700 dark:text-green-400"
    : "bg-muted text-muted-foreground";
  return (
    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${color}`}>
      <CircleDot className="h-3 w-3" />
      {running ? "Running" : running_status === "not-found" ? "Not started" : running_status}
    </span>
  );
}

export default function AdGuard() {
  const { data: status, isLoading: statusLoading } = useAdGuardStatus();
  const { data: configData, isLoading: configLoading } = useAdGuardConfig();
  const enableAdGuard = useEnableAdGuard();
  const disableAdGuard = useDisableAdGuard();
  const updateConfig = useUpdateAdGuardConfig();

  const configured: boolean = status?.configured ?? false;

  const [form, setForm] = useState({
    image: "docker.io/adguard/adguardhome:latest",
    web_port: "3000",
    dns_port: "53",
    config_volume_source: "/config/adguard",
    restart: "on-failure",
    allow_host_networks: true,
  });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync form with fetched config
  useEffect(() => {
    if (configData && !dirty) {
      setForm({
        image: configData.image ?? form.image,
        web_port: String(configData.web_port ?? 3000),
        dns_port: String(configData.dns_port ?? 53),
        config_volume_source: configData.config_volume_source ?? form.config_volume_source,
        restart: configData.restart ?? form.restart,
        allow_host_networks: configData.allow_host_networks ?? true,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configData]);

  function handleChange(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
    setSaved(false);
  }

  async function handleSave() {
    await updateConfig.mutateAsync({
      image: form.image,
      web_port: Number(form.web_port),
      dns_port: Number(form.dns_port),
      config_volume_source: form.config_volume_source,
      restart: form.restart,
      allow_host_networks: form.allow_host_networks,
    });
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (statusLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  // ── Not configured: show enable prompt ──────────────────────────────────
  if (!configured) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" />
          AdGuard Home
        </h1>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="text-base">AdGuard Home is not enabled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              AdGuard Home is a network-wide DNS ad blocker and privacy filter.
              Enabling it will create a VyOS container with the following defaults:
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
              <li>Image: <span className="font-mono">adguard/adguardhome:latest</span></li>
              <li>Web UI: port <span className="font-mono">3000</span></li>
              <li>DNS: ports <span className="font-mono">53</span> (TCP + UDP)</li>
              <li>Config volume: <span className="font-mono">/config/adguard</span></li>
              <li>Host networking enabled</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              You can adjust all settings after enabling.
            </p>
            <Button
              onClick={() => enableAdGuard.mutate()}
              disabled={enableAdGuard.isPending}
            >
              {enableAdGuard.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enable AdGuard Home
            </Button>
            {enableAdGuard.isError && (
              <p className="text-xs text-destructive">{String(enableAdGuard.error)}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Configured: show status + config ────────────────────────────────────
  const webUrl = `http://${status?.host ?? window.location.hostname}:${status?.web_port ?? 3000}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" />
          AdGuard Home
        </h1>
        <div className="flex items-center gap-3">
          <StatusBadge running={status?.running ?? false} running_status={status?.running_status ?? "unknown"} />
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                Disable
              </Button>
            }
            title="Disable AdGuard Home?"
            description="This will delete the AdGuard container configuration from VyOS. The container will stop and its VyOS config will be removed."
            confirmLabel="Disable"
            destructive
            onConfirm={() => disableAdGuard.mutate()}
          />
        </div>
      </div>

      {/* Quick access */}
      <Card>
        <CardHeader><CardTitle className="text-base">Quick Access</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <a
            href={webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Open AdGuard UI
            <span className="text-xs text-muted-foreground font-mono">:{status?.web_port ?? 3000}</span>
          </a>
          <div className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm text-muted-foreground">
            DNS:
            <span className="font-mono text-foreground">
              {status?.host ?? window.location.hostname}:{status?.dns_port ?? 53}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Port mappings (read-only summary) */}
      <Card>
        <CardHeader><CardTitle className="text-base">Port Mappings</CardTitle></CardHeader>
        <CardContent>
          {configLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Host Port</th>
                  <th className="py-2 pr-4 font-medium">Container Port</th>
                  <th className="py-2 font-medium">Protocol</th>
                </tr>
              </thead>
              <tbody>
                {(configData as AdGuardConfig)?.ports?.map((p) => (
                  <tr key={`${p.name}-${p.protocol}`} className="border-b last:border-0">
                    <td className="py-1.5 pr-4 font-mono text-xs">{p.name}</td>
                    <td className="py-1.5 pr-4 font-mono">{p.source}</td>
                    <td className="py-1.5 pr-4 font-mono">{p.destination}</td>
                    <td className="py-1.5 text-muted-foreground uppercase text-xs">{p.protocol}</td>
                  </tr>
                ))}
                {!((configData as AdGuardConfig)?.ports?.length) && (
                  <tr><td colSpan={4} className="py-4 text-muted-foreground">No ports configured</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Editable configuration */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Container Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {configLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Container Image</Label>
                  <Input
                    value={form.image}
                    onChange={(e) => handleChange("image", e.target.value)}
                    className="font-mono"
                    placeholder="docker.io/adguard/adguardhome:latest"
                  />
                  <p className="text-xs text-muted-foreground">Change tag to pin a specific version (e.g. <span className="font-mono">:v0.107.52</span>)</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Web UI Port</Label>
                  <Input
                    type="number"
                    value={form.web_port}
                    onChange={(e) => handleChange("web_port", e.target.value)}
                    min={1}
                    max={65535}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">DNS Port</Label>
                  <Input
                    type="number"
                    value={form.dns_port}
                    onChange={(e) => handleChange("dns_port", e.target.value)}
                    min={1}
                    max={65535}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Config Volume Path (host)</Label>
                  <Input
                    value={form.config_volume_source}
                    onChange={(e) => handleChange("config_volume_source", e.target.value)}
                    className="font-mono"
                    placeholder="/config/adguard"
                  />
                  <p className="text-xs text-muted-foreground">Directory on the VyOS filesystem where AdGuard stores its configuration</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Restart Policy</Label>
                  <select
                    className="w-full rounded border bg-background px-2 py-2 text-sm"
                    value={form.restart}
                    onChange={(e) => handleChange("restart", e.target.value)}
                  >
                    <option value="on-failure">on-failure</option>
                    <option value="always">always</option>
                    <option value="unless-stopped">unless-stopped</option>
                    <option value="no">no</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-5">
                  <button
                    role="switch"
                    aria-checked={form.allow_host_networks}
                    onClick={() => handleChange("allow_host_networks", !form.allow_host_networks)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      form.allow_host_networks ? "bg-green-500" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      form.allow_host_networks ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                  <Label className="text-sm cursor-pointer" onClick={() => handleChange("allow_host_networks", !form.allow_host_networks)}>
                    Allow host networks
                  </Label>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={!dirty || updateConfig.isPending}
                  size="sm"
                >
                  {updateConfig.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Changes
                </Button>
                {saved && <span className="text-xs text-green-600 dark:text-green-400">Saved</span>}
                {updateConfig.isError && (
                  <span className="text-xs text-destructive">{String(updateConfig.error)}</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
