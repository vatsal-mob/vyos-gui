import { useEffect } from "react";
import { useSystemInfo } from "../../hooks/useVyos";
import { useMetricsStore } from "../../store/metrics";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Cpu, MemoryStick, Clock, Server } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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
  const chartData = data.map((p) => ({
    t: new Date(p.time).toLocaleTimeString(),
    v: p.value,
  }));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              formatter={(val: number) => [`${val.toFixed(1)}%`, label]}
              labelFormatter={() => ""}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              fill={`url(#grad-${label})`}
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
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
