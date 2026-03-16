import { useInterfaces } from "../../hooks/useVyos";
import { useEffect, useRef, useState } from "react";
import { Sparkline } from "./Sparkline";

interface DataPoint {
  rx: number;
  tx: number;
}

function formatBytes(b: number) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
}

function InterfaceSparkline({ name, rxBytes, txBytes }: { name: string; rxBytes: number; txBytes: number }) {
  const [history, setHistory] = useState<DataPoint[]>([]);
  const prev = useRef<{ rx: number; tx: number } | null>(null);

  useEffect(() => {
    if (prev.current) {
      const rxDelta = Math.max(0, rxBytes - prev.current.rx) / 5;
      const txDelta = Math.max(0, txBytes - prev.current.tx) / 5;
      setHistory((h) => [...h.slice(-19), { rx: rxDelta, tx: txDelta }]);
    }
    prev.current = { rx: rxBytes, tx: txBytes };
  }, [rxBytes, txBytes]);

  const rxData = history.map((h) => h.rx);
  const txData = history.map((h) => h.tx);

  return (
    <div className="stat-card rounded border border-border bg-card p-3 card-hover">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs font-medium text-foreground">{name}</span>
      </div>

      <div className="relative h-14">
        <div className="absolute inset-0">
          <Sparkline data={rxData.length > 1 ? rxData : [0, 0]} color="#22d3ee" fillOpacity={0.12} height={56} />
        </div>
        <div className="absolute inset-0">
          <Sparkline data={txData.length > 1 ? txData : [0, 0]} color="#f59e0b" fillOpacity={0.10} height={56} />
        </div>
      </div>

      <div className="flex justify-between text-2xs font-mono mt-1.5">
        <span className="text-primary/80">↓ {formatBytes(rxBytes)}</span>
        <span className="text-warning/80">↑ {formatBytes(txBytes)}</span>
      </div>
    </div>
  );
}

export default function InterfaceTraffic() {
  const { data: interfaces, isLoading } = useInterfaces();

  if (isLoading) return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 rounded border border-border bg-card animate-pulse" />
      ))}
    </div>
  );

  if (!interfaces?.length)
    return <p className="text-xs text-muted-foreground font-mono">No interfaces found.</p>;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {interfaces.map((iface: { name: string; rx_bytes: number; tx_bytes: number }) => (
        <InterfaceSparkline key={iface.name} name={iface.name} rxBytes={iface.rx_bytes} txBytes={iface.tx_bytes} />
      ))}
    </div>
  );
}
