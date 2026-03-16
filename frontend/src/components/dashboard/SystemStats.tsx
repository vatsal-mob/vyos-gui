import { useEffect } from "react";
import { useSystemInfo } from "../../hooks/useVyos";
import { useMetricsStore } from "../../store/metrics";
import { Cpu, MemoryStick, Clock, Server } from "lucide-react";
import { Sparkline } from "./Sparkline";

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  accent,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <div className="stat-card rounded border border-border bg-card p-4 card-hover">
      <div className="flex items-start justify-between mb-3">
        <span className="section-label">{title}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />
      </div>
      <div className={`font-mono text-xl font-semibold tracking-tight ${accent || "text-foreground"}`}>
        {value}
      </div>
      {subtitle && (
        <p className="mt-1 text-2xs font-mono text-muted-foreground/60 truncate">{subtitle}</p>
      )}
    </div>
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
  const values = data.map((p) => p.value);
  const last = values.length > 0 ? values[values.length - 1] : null;

  return (
    <div className="stat-card rounded border border-border bg-card p-4 card-hover">
      <div className="flex items-center justify-between mb-2">
        <span className="section-label">{label}</span>
        {last !== null && (
          <span className="font-mono text-xs font-medium" style={{ color }}>
            {last.toFixed(1)}%
          </span>
        )}
      </div>
      <Sparkline data={values.length > 0 ? values : [0, 0]} color={color} height={72} />
    </div>
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
          <div key={i} className="h-24 rounded border border-border bg-card animate-pulse" />
        ))}
      </div>
    );

  if (isError || !data)
    return <p className="text-xs text-destructive font-mono">Failed to load system info.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          title="Hostname"
          value={data.hostname || "—"}
          icon={Server}
          subtitle={data.version}
        />
        <StatCard
          title="CPU Usage"
          value={`${data.cpu_percent?.toFixed(1) ?? 0}%`}
          icon={Cpu}
          subtitle={`Load: ${data.load_average?.join(" · ") ?? "—"}`}
          accent={
            (data.cpu_percent ?? 0) > 80
              ? "text-destructive"
              : (data.cpu_percent ?? 0) > 50
              ? "text-warning"
              : "text-primary"
          }
        />
        <StatCard
          title="Memory"
          value={`${data.memory_percent?.toFixed(1) ?? 0}%`}
          icon={MemoryStick}
          subtitle={`${((data.memory_used ?? 0) / 1024 / 1024).toFixed(0)} / ${((data.memory_total ?? 0) / 1024 / 1024).toFixed(0)} MB`}
          accent={
            (data.memory_percent ?? 0) > 85
              ? "text-destructive"
              : (data.memory_percent ?? 0) > 65
              ? "text-warning"
              : "text-success"
          }
        />
        <StatCard
          title="Uptime"
          value={data.uptime || "—"}
          icon={Clock}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <MiniChart data={cpu} color="#22d3ee" label="CPU History" />
        <MiniChart data={memory} color="#34d399" label="Memory History" />
      </div>
    </div>
  );
}
