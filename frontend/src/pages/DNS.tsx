import { useState } from "react";
import {
  useDNSForwarding,
  useSetNameservers,
  useAddDomainOverride,
  useDeleteDomainOverride,
  useDNSAuthoritativeRecords,
  useAddDNSRecord,
  useDeleteDNSRecord,
} from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import { Plus, Trash2, Loader2, Save } from "lucide-react";

interface DNSRecord {
  domain: string;
  type: string;
  name: string;
  value: string;
}

interface DNSForwarding {
  nameservers: string[];
  listen_addresses: string[];
  cache_size: number;
  domain_overrides: Record<string, string>;
}

export default function DNS() {
  const { data: forwarding, isLoading } = useDNSForwarding();
  const setNS = useSetNameservers();
  const addDomain = useAddDomainOverride();
  const deleteDomain = useDeleteDomainOverride();

  const { data: authData, isLoading: authLoading } = useDNSAuthoritativeRecords();
  const addRecord = useAddDNSRecord();
  const deleteRecord = useDeleteDNSRecord();

  const [nsText, setNsText] = useState<string | null>(null);
  const [domainForm, setDomainForm] = useState({ domain: "", server: "" });
  const [recordForm, setRecordForm] = useState({ domain: "", type: "A", name: "@", value: "" });

  const authRecords: DNSRecord[] = authData?.records ?? [];

  async function handleAddRecord(e: React.FormEvent) {
    e.preventDefault();
    await addRecord.mutateAsync(recordForm);
    setRecordForm({ domain: "", type: "A", name: "@", value: "" });
  }

  const data: DNSForwarding = forwarding ?? { nameservers: [], listen_addresses: [], cache_size: 10000, domain_overrides: {} };

  async function saveNameservers() {
    const servers = (nsText ?? data.nameservers.join("\n"))
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    await setNS.mutateAsync(servers);
    setNsText(null);
  }

  async function handleAddDomain(e: React.FormEvent) {
    e.preventDefault();
    await addDomain.mutateAsync(domainForm);
    setDomainForm({ domain: "", server: "" });
  }

  if (isLoading) return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  const displayNS = nsText ?? data.nameservers.join("\n");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">DNS</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Nameservers */}
        <Card>
          <CardHeader><CardTitle className="text-base">Nameservers</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm resize-none"
              rows={4}
              value={displayNS}
              onChange={(e) => setNsText(e.target.value)}
              placeholder="8.8.8.8&#10;8.8.4.4"
            />
            <Button size="sm" onClick={saveNameservers} disabled={setNS.isPending}>
              {setNS.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </CardContent>
        </Card>

        {/* Listen addresses */}
        <Card>
          <CardHeader><CardTitle className="text-base">Listen Addresses</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {data.listen_addresses.map((a: string) => (
                <li key={a} className="font-mono text-sm">{a}</li>
              ))}
              {!data.listen_addresses.length && <li className="text-sm text-muted-foreground">None configured</li>}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Cache size: {data.cache_size}</p>
          </CardContent>
        </Card>
      </div>

      {/* Domain overrides */}
      <Card>
        <CardHeader><CardTitle className="text-base">Domain Overrides</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAddDomain} className="flex gap-2">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Domain</Label>
              <Input
                value={domainForm.domain}
                onChange={(e) => setDomainForm({ ...domainForm, domain: e.target.value })}
                placeholder="example.local"
                required
                className="font-mono"
              />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">DNS Server</Label>
              <Input
                value={domainForm.server}
                onChange={(e) => setDomainForm({ ...domainForm, server: e.target.value })}
                placeholder="192.168.1.53"
                required
                className="font-mono"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" size="sm" disabled={addDomain.isPending}>
                {addDomain.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </Button>
            </div>
          </form>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="py-2 pr-4">Domain</th>
                <th className="py-2 pr-4">Server</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.domain_overrides).map(([domain, server]) => (
                <tr key={domain} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2 pr-4 font-mono">{domain}</td>
                  <td className="py-2 pr-4 font-mono">{server}</td>
                  <td className="py-2">
                    <ConfirmDialog
                      trigger={<button className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                      title="Delete domain override?"
                      description={`Remove DNS override for ${domain}?`}
                      confirmLabel="Delete"
                      destructive
                      onConfirm={() => deleteDomain.mutate(domain)}
                    />
                  </td>
                </tr>
              ))}
              {!Object.keys(data.domain_overrides).length && (
                <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">No domain overrides</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {/* Authoritative DNS Records */}
      <Card>
        <CardHeader><CardTitle className="text-base">Authoritative DNS Records</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAddRecord} className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Domain</Label>
              <Input
                value={recordForm.domain}
                onChange={(e) => setRecordForm({ ...recordForm, domain: e.target.value })}
                placeholder="example.lan"
                required
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <select
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                value={recordForm.type}
                onChange={(e) => setRecordForm({ ...recordForm, type: e.target.value })}
              >
                {["A", "AAAA", "CNAME", "MX", "TXT", "NS", "PTR"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={recordForm.name}
                onChange={(e) => setRecordForm({ ...recordForm, name: e.target.value })}
                placeholder="@ or subdomain"
                required
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Value (IP / target)</Label>
              <Input
                value={recordForm.value}
                onChange={(e) => setRecordForm({ ...recordForm, value: e.target.value })}
                placeholder="10.10.10.1"
                required
                className="font-mono"
              />
            </div>
            <div className="col-span-2 flex items-end gap-2 md:col-span-4">
              <Button type="submit" size="sm" disabled={addRecord.isPending}>
                {addRecord.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Record
              </Button>
            </div>
          </form>

          {authLoading ? (
            <div className="py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="py-2 pr-4">Domain</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Value</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {authRecords.map((r) => (
                  <tr key={`${r.domain}/${r.type}/${r.name}`} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 pr-4 font-mono text-xs">{r.domain}</td>
                    <td className="py-2 pr-4">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{r.type}</span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.value || "—"}</td>
                    <td className="py-2">
                      <ConfirmDialog
                        trigger={<button className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                        title="Delete DNS record?"
                        description={`Remove ${r.type} record "${r.name}" from ${r.domain}?`}
                        confirmLabel="Delete"
                        destructive
                        onConfirm={() => deleteRecord.mutate({ domain: r.domain, type: r.type, name: r.name })}
                      />
                    </td>
                  </tr>
                ))}
                {!authRecords.length && (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No authoritative records configured</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
