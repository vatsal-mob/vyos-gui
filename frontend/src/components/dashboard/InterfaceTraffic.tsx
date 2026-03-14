import { useInterfaces } from "../../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useEffect, useRef, useState } from "react";

interface DataPoint {
  t: string;
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
    const now = new Date().toLocaleTimeString();
    if (prev.current) {
      const rxDelta = Math.max(0, rxBytes - prev.current.rx);
      const txDelta = Math.max(0, txBytes - prev.current.tx);
      setHistory((h) => [...h.slice(-19), { t: now, rx: rxDelta / 5, tx: txDelta / 5 }]);
    }
    prev.current = { rx: rxBytes, tx: txBytes };
  }, [rxBytes, txBytes]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{name}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={history} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
            <defs>
              <linearGradient id={`rx-${name}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`tx-${name}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis hide />
            <Tooltip
              formatter={(val: number, key: string) => [formatBytes(val) + "/s", key === "rx" ? "RX" : "TX"]}
              labelFormatter={() => ""}
            />
            <Area type="monotone" dataKey="rx" stroke="#22d3ee" fill={`url(#rx-${name})`} strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="tx" stroke="#f59e0b" fill={`url(#tx-${name})`} strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span className="text-cyan-400">RX: {formatBytes(rxBytes)}</span>
          <span className="text-amber-500">TX: {formatBytes(txBytes)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InterfaceTraffic() {
  const { data: interfaces, isLoading } = useInterfaces();

  if (isLoading) return null;
  if (!interfaces?.length) return <p className="text-sm text-muted-foreground">No interfaces found.</p>;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {interfaces.map((iface: { name: string; rx_bytes: number; tx_bytes: number }) => (
        <InterfaceSparkline key={iface.name} name={iface.name} rxBytes={iface.rx_bytes} txBytes={iface.tx_bytes} />
      ))}
    </div>
  );
}
