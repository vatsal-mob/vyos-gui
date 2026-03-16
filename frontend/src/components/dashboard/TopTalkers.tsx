import { useTopTalkers } from "../../hooks/useVyos";
import { Loader2 } from "lucide-react";

interface TalkerEntry {
  ip: string;
  connections: number;
  bytes: number;
}

function formatBytes(b: number) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
}

export default function TopTalkers() {
  const { data, isLoading, isFetching } = useTopTalkers();
  const talkers: TalkerEntry[] = data?.talkers ?? [];

  return (
    <div className="rounded border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-display text-sm font-medium">Top Talkers</span>
        {isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      <div className="p-0">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground p-4">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : talkers.length === 0 ? (
          <p className="text-xs text-muted-foreground font-mono p-4">No conntrack data available.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 text-2xs font-mono font-medium uppercase tracking-wider text-muted-foreground">#</th>
                <th className="text-left px-4 py-2 text-2xs font-mono font-medium uppercase tracking-wider text-muted-foreground">Source IP</th>
                <th className="text-right px-4 py-2 text-2xs font-mono font-medium uppercase tracking-wider text-muted-foreground">Conns</th>
                <th className="text-right px-4 py-2 text-2xs font-mono font-medium uppercase tracking-wider text-muted-foreground">Bytes</th>
              </tr>
            </thead>
            <tbody>
              {talkers.map((t, i) => (
                <tr key={t.ip} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-2 text-2xs font-mono text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2 text-xs font-mono text-primary">{t.ip}</td>
                  <td className="px-4 py-2 text-right text-xs font-mono">{t.connections}</td>
                  <td className="px-4 py-2 text-right text-xs font-mono">{formatBytes(t.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
