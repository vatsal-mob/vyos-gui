import { useInterfaces } from "../../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import ReactApexChart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { useEffect, useRef, useState } from "react";

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
      const rxDelta = Math.max(0, rxBytes - prev.current.rx);
      const txDelta = Math.max(0, txBytes - prev.current.tx);
      setHistory((h) => [...h.slice(-19), { rx: rxDelta / 5, tx: txDelta / 5 }]);
    }
    prev.current = { rx: rxBytes, tx: txBytes };
  }, [rxBytes, txBytes]);

  const series = [
    { name: "RX", data: history.map((p) => p.rx) },
    { name: "TX", data: history.map((p) => p.tx) },
  ];

  const options: ApexOptions = {
    chart: {
      type: "area",
      sparkline: { enabled: true },
      toolbar: { show: false },
      animations: { enabled: false },
      background: "transparent",
    },
    theme: { mode: "dark" },
    stroke: { curve: "smooth", width: 1.5, colors: ["#22d3ee", "#f59e0b"] },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.25,
        opacityTo: 0,
        stops: [0, 95],
      },
    },
    colors: ["#22d3ee", "#f59e0b"],
    tooltip: {
      theme: "dark",
      y: { formatter: (val: number) => `${formatBytes(val)}/s` },
      x: { show: false },
    },
    dataLabels: { enabled: false },
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{name}</CardTitle>
      </CardHeader>
      <CardContent>
        <ReactApexChart
          type="area"
          series={series}
          options={options}
          height={80}
        />
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
