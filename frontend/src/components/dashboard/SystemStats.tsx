import { useEffect } from "react";
import { useSystemInfo } from "../../hooks/useVyos";
import { useMetricsStore } from "../../store/metrics";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Cpu, MemoryStick, Clock, Server } from "lucide-react";
import ReactApexChart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function MiniChart({
  data,
  color,
  label,
}: {
  data: { time: number; value: number }[];
  color: string;
  label: string;
}) {
  const series = [{ name: label, data: data.map((p) => p.value) }];

  const options: ApexOptions = {
    chart: {
      type: "area",
      sparkline: { enabled: false },
      toolbar: { show: false },
      animations: { enabled: false },
      background: "transparent",
    },
    theme: { mode: "dark" },
    stroke: { curve: "smooth", width: 2, colors: [color] },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.3,
        opacityTo: 0,
        stops: [0, 95],
        colorStops: [
          { offset: 0, color, opacity: 0.3 },
          { offset: 95, color, opacity: 0 },
        ],
      },
    },
    colors: [color],
    xaxis: { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { min: 0, max: 100, labels: { show: false } },
    grid: { show: false },
    tooltip: {
      theme: "dark",
      y: { formatter: (val: number) => `${val.toFixed(1)}%` },
      x: { show: false },
    },
    dataLabels: { enabled: false },
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <ReactApexChart
          type="area"
          series={series}
          options={options}
          height={100}
        />
        <p className="text-right text-xs text-muted-foreground mt-1">
          {data.length > 0 ? `${data[data.length - 1].value.toFixed(1)}%` : "—"}
        </p>
      </CardContent>
    </Card>
  );
}

export default function SystemStats() {
  const { data, isLoading, isError } = useSystemInfo();
  const { pushCpu, pushMemory, cpu, memory } = useMetricsStore();

  useEffect(() => {
    if (data) {
      if (typeof data.cpu_percent === "number") pushCpu(data.cpu_percent);
      if (typeof data.memory_percent === "number") pushMemory(data.memory_percent);
    }
  }, [data]);

  if (isLoading)
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-28 animate-pulse bg-muted" />
        ))}
      </div>
    );
  if (isError || !data)
    return <p className="text-destructive text-sm">Failed to load system info.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Hostname" value={data.hostname || "—"} icon={Server} subtitle={data.version} />
        <StatCard
          title="CPU"
          value={`${data.cpu_percent?.toFixed(1) ?? 0}%`}
          icon={Cpu}
          subtitle={`Load: ${data.load_average?.join(", ") ?? "—"}`}
        />
        <StatCard
          title="Memory"
          value={`${data.memory_percent?.toFixed(1) ?? 0}%`}
          icon={MemoryStick}
          subtitle={`${((data.memory_used ?? 0) / 1024 / 1024).toFixed(0)} MB / ${((data.memory_total ?? 0) / 1024 / 1024).toFixed(0)} MB`}
        />
        <StatCard title="Uptime" value={data.uptime || "—"} icon={Clock} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MiniChart data={cpu} color="#22d3ee" label="CPU History" />
        <MiniChart data={memory} color="#34d399" label="Memory History" />
      </div>
    </div>
  );
}
