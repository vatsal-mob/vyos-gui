import { useRef, useState } from "react";
import {
  useHostname,
  useSetHostname,
  useNTPServers,
  useSetNTP,
  useSystemUsers,
  useCreateUser,
  useDeleteUser,
  useReboot,
  usePoweroff,
  useConfig,
  useRestoreConfig,
} from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Loader2, Trash2, Plus, RefreshCw, PowerOff, FileText, Download, Upload } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export default function System() {
  // Hostname
  const { data: hostnameData } = useHostname();
  const setHostname = useSetHostname();
  const [hostname, setHostnameInput] = useState("");

  // NTP
  const { data: ntpData } = useNTPServers();
  const setNTP = useSetNTP();
  const [ntpInput, setNtpInput] = useState("");

  // Users
  const { data: users } = useSystemUsers();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const [newUser, setNewUser] = useState({ username: "", password: "", level: "operator" });

  // Reboot / Poweroff
  const reboot = useReboot();
  const poweroff = usePoweroff();

  // Config backup
  const config = useConfig();
  const [showConfig, setShowConfig] = useState(false);

  // Config restore
  const restoreConfig = useRestoreConfig();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreStatus, setRestoreStatus] = useState<string>("");

  function handleAddNTP() {
    const servers = [...(ntpData?.servers ?? []), ntpInput.trim()].filter(Boolean);
    setNTP.mutate(servers, { onSuccess: () => setNtpInput("") });
  }

  function handleRemoveNTP(s: string) {
    const servers = (ntpData?.servers ?? []).filter((x: string) => x !== s);
    setNTP.mutate(servers);
  }

  function handleDownloadConfig() {
    config.refetch().then((result) => {
      const text = result.data?.config ?? "";
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vyos-config.txt";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreStatus("Uploading…");
    restoreConfig.mutate(file, {
      onSuccess: () => setRestoreStatus("Config restored successfully."),
      onError: (err) => setRestoreStatus(`Error: ${String(err)}`),
    });
    // Reset input so the same file can be selected again
    e.target.value = "";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">System</h1>

      {/* Hostname */}
      <Section title="Hostname">
        <p className="text-sm text-muted-foreground">
          Current: <strong>{hostnameData?.hostname ?? "—"}</strong>
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="new-hostname"
            value={hostname}
            onChange={(e) => setHostnameInput(e.target.value)}
          />
          <Button
            onClick={() => setHostname.mutate(hostname, { onSuccess: () => setHostnameInput("") })}
            disabled={!hostname || setHostname.isPending}
          >
            {setHostname.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set"}
          </Button>
        </div>
      </Section>

      {/* NTP */}
      <Section title="NTP Servers">
        <div className="space-y-1">
          {(ntpData?.servers ?? []).map((s: string) => (
            <div key={s} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
              <span>{s}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveNTP(s)}
                disabled={setNTP.isPending}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="pool.ntp.org"
            value={ntpInput}
            onChange={(e) => setNtpInput(e.target.value)}
          />
          <Button onClick={handleAddNTP} disabled={!ntpInput || setNTP.isPending}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </Section>

      {/* Users */}
      <Section title="Login Users">
        <div className="space-y-1">
          {(users ?? []).map((u: { username: string; level: string; full_name: string }) => (
            <div key={u.username} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{u.username}</span>
                <span className="ml-2 text-xs text-muted-foreground">{u.level}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteUser.mutate(u.username)}
                disabled={deleteUser.isPending}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Input
            placeholder="username"
            value={newUser.username}
            onChange={(e) => setNewUser((u) => ({ ...u, username: e.target.value }))}
          />
          <Input
            type="password"
            placeholder="password"
            value={newUser.password}
            onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
          />
          <select
            className="rounded border px-2 py-2 text-sm bg-background"
            value={newUser.level}
            onChange={(e) => setNewUser((u) => ({ ...u, level: e.target.value }))}
          >
            <option value="operator">operator</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <Button
          onClick={() => createUser.mutate(newUser, { onSuccess: () => setNewUser({ username: "", password: "", level: "operator" }) })}
          disabled={!newUser.username || !newUser.password || createUser.isPending}
        >
          {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Create User
        </Button>
      </Section>

      {/* Backup & Restore */}
      <Section title="Backup & Restore">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={handleDownloadConfig}
            disabled={config.isFetching}
          >
            {config.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Download Config
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={restoreConfig.isPending}
          >
            {restoreConfig.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            Restore Config
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.conf"
            className="hidden"
            onChange={handleRestoreFile}
          />
        </div>
        {restoreStatus && (
          <p className={`text-sm ${restoreStatus.startsWith("Error") ? "text-destructive" : "text-green-600"}`}>
            {restoreStatus}
          </p>
        )}
        <Button
          variant="outline"
          onClick={() => {
            setShowConfig(true);
            config.refetch();
          }}
          disabled={config.isFetching}
        >
          {config.isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
          View Config
        </Button>
        {showConfig && config.data && (
          <pre className="mt-2 max-h-96 overflow-auto rounded border bg-muted p-3 text-xs">
            {config.data.config}
          </pre>
        )}
      </Section>

      {/* Reboot / Poweroff */}
      <Section title="Power">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Reboot the router now?")) reboot.mutate();
            }}
            disabled={reboot.isPending}
          >
            {reboot.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Reboot
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Power off the router? It will need manual restart.")) poweroff.mutate();
            }}
            disabled={poweroff.isPending}
          >
            {poweroff.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <PowerOff className="h-4 w-4 mr-1" />}
            Power Off
          </Button>
        </div>
      </Section>
    </div>
  );
}
