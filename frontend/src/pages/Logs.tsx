import { useState } from "react";
import { useLogs } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Loader2, Shield } from "lucide-react";

export default function Logs() {
  const [filterStr, setFilterStr] = useState("");
  const [firewallOnly, setFirewallOnly] = useState(false);
  const [activeFilter, setActiveFilter] = useState("");
  const [activeFirewall, setActiveFirewall] = useState(false);

  const effectiveFilter = activeFirewall ? "firewall" : activeFilter;
  const { data, isLoading, isFetching } = useLogs(100, effectiveFilter);

  function handleApply() {
    setActiveFilter(filterStr);
    setActiveFirewall(firewallOnly);
  }

  const lines: string[] = data?.lines ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Log Viewer</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">System Log</CardTitle>
            {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Filter (grep)…"
              value={filterStr}
              onChange={(e) => setFilterStr(e.target.value)}
              className="max-w-xs"
              onKeyDown={(e) => e.key === "Enter" && handleApply()}
            />
            <Button onClick={handleApply} variant="outline" size="sm">
              Apply
            </Button>
            <Button
              variant={firewallOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setFirewallOnly((v) => !v)}
            >
              <Shield className="h-4 w-4 mr-1" />
              Firewall Only
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading logs…
            </div>
          ) : (
            <pre className="max-h-[600px] overflow-auto rounded border bg-muted p-3 text-xs font-mono whitespace-pre-wrap">
              {lines.length > 0 ? lines.join("\n") : "No log entries found."}
            </pre>
          )}
          <p className="text-xs text-muted-foreground">
            Showing last {lines.length} lines. Auto-refreshes every 10s.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
