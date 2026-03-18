import { useState, useMemo, useCallback } from "react";
import { useIDSSummary, useSuricataAlerts } from "../hooks/useVyos";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useThemeStore } from "../store/theme";
import { Loader2, ShieldAlert, RefreshCw, TrendingUp, Activity, Network } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule, type ColDef } from "ag-grid-community";
import ReactApexChart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";

ModuleRegistry.registerModules([AllCommunityModule]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Alert {
  timestamp: string;
  src_ip: string;
  src_port: number;
  dest_ip: string;
  dest_port: number;
  proto: string;
  interface: string;
  direction: string;
  app_proto: string;
  signature: string;
  category: string;
  severity: number;
  action: string;
  signature_id: number;
}

interface Summary {
  total: number;
  severity_counts: Record<string, number>;
  action_counts: Record<string, number>;
  interface_counts: Record<string, number>;
  protocol_counts: Record<string, number>;
  app_proto_counts: Record<string, number>;
  timeline: { slot: string; count: number }[];
  top_signatures: { signature: string; severity: number; count: number }[];
  top_src_ips: { ip: string; count: number }[];
  top_dest_ips: { ip: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITY_LABEL: Record<number, string> = { 1: "High", 2: "Medium", 3: "Low" };
const SEVERITY_CLASS: Record<number, string> = {
  1: "bg-destructive/15 text-destructive border border-destructive/30",
  2: "bg-warning/15 text-warning border border-warning/30",
  3: "bg-muted text-muted-foreground border border-border",
};
const ACTION_CLASS: Record<string, string> = {
  allowed: "bg-muted text-muted-foreground border border-border",
  blocked: "bg-destructive/15 text-destructive border border-destructive/30",
  drop:    "bg-destructive/15 text-destructive border border-destructive/30",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="stat-card">
      <CardContent className="pt-4 pb-3">
        <p className="section-label mb-1">{label}</p>
        <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground font-mono">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline chart
// ---------------------------------------------------------------------------

function TimelineChart({ timeline, isDark }: { timeline: Summary["timeline"]; isDark: boolean }) {
  const series = [{ name: "Alerts", data: timeline.map((t) => t.count) }];
  const categories = timeline.map((t) => {
    const [date, time] = t.slot.split("T");
    return `${date.slice(5)} ${time}`;
  });

  const options: ApexOptions = {
    chart: {
      type: "area",
      toolbar: { show: false },
      background: "transparent",
      animations: { enabled: false },
      sparkline: { enabled: false },
    },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 2 },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.35,
        opacityTo: 0.02,
        stops: [0, 90, 100],
      },
    },
    colors: ["hsl(199 95% 52%)"],
    xaxis: {
      categories,
      labels: {
        style: { colors: "hsl(215 16% 58%)", fontSize: "10px", fontFamily: "JetBrains Mono" },
        rotate: -30,
        trim: true,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "hsl(215 16% 58%)", fontSize: "10px", fontFamily: "JetBrains Mono" },
        formatter: (v: number) => String(Math.round(v)),
      },
    },
    grid: {
      borderColor: isDark ? "hsl(220 18% 21%)" : "hsl(215 20% 86%)",
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
    },
    tooltip: {
      theme: isDark ? "dark" : "light",
      x: { show: true },
    },
  };

  return (
    <ReactApexChart
      type="area"
      series={series}
      options={options}
      height={180}
    />
  );
}

// ---------------------------------------------------------------------------
// Donut chart for interface / protocol split
// ---------------------------------------------------------------------------

function SplitDonut({
  counts,
  isDark,
  colors,
}: {
  counts: Record<string, number>;
  isDark: boolean;
  colors: string[];
}) {
  const labels = Object.keys(counts);
  const values = Object.values(counts);
  const options: ApexOptions = {
    chart: { type: "donut", background: "transparent", animations: { enabled: false } },
    labels,
    colors,
    dataLabels: {
      enabled: true,
      style: { fontSize: "11px", fontFamily: "JetBrains Mono", colors: [isDark ? "#e2e8f0" : "#1e293b"] },
      dropShadow: { enabled: false },
    },
    legend: {
      position: "bottom",
      labels: { colors: isDark ? "hsl(215 25% 92%)" : "hsl(222 40% 10%)" },
      fontSize: "11px",
      fontFamily: "JetBrains Mono",
    },
    stroke: { width: 1, colors: [isDark ? "hsl(220 24% 13%)" : "#fff"] },
    plotOptions: { pie: { donut: { size: "60%" } } },
    tooltip: { theme: isDark ? "dark" : "light" },
  };
  return <ReactApexChart type="donut" series={values} options={options} height={200} />;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function IDS() {
  const { theme } = useThemeStore();
  const isDark = theme === "dark";
  const [alertLines, setAlertLines] = useState(200);
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "feed">("overview");

  const summaryQuery = useIDSSummary();
  const alertsQuery = useSuricataAlerts(alertLines);

  const summary: Summary | null = summaryQuery.data ?? null;
  const alerts: Alert[] = alertsQuery.data?.alerts ?? [];

  const isFetching = summaryQuery.isFetching || alertsQuery.isFetching;
  const isLoading  = summaryQuery.isLoading  || alertsQuery.isLoading;

  function refresh() {
    summaryQuery.refetch();
    alertsQuery.refetch();
  }

  // ---------------------------------------------------------------------------
  // Filtered alerts
  // ---------------------------------------------------------------------------
  const filtered = useMemo(() => {
    if (!filter) return alerts;
    const q = filter.toLowerCase();
    return alerts.filter(
      (a) =>
        a.src_ip.includes(q) ||
        a.dest_ip.includes(q) ||
        a.signature.toLowerCase().includes(q) ||
        a.proto.toLowerCase().includes(q) ||
        a.interface.toLowerCase().includes(q)
    );
  }, [alerts, filter]);

  // ---------------------------------------------------------------------------
  // AG Grid column defs
  // ---------------------------------------------------------------------------
  const sigColDefs = useMemo<ColDef[]>(() => {
    const max = summary?.top_signatures?.[0]?.count ?? 1;
    return [
      { field: "signature", headerName: "Signature", flex: 2, minWidth: 200 },
      {
        field: "severity",
        headerName: "Sev",
        width: 80,
        cellRenderer: ({ value }: { value: number }) => (
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SEVERITY_CLASS[value] ?? "bg-muted"}`}>
            {SEVERITY_LABEL[value] ?? value}
          </span>
        ),
      },
      {
        field: "count",
        headerName: "Count",
        width: 160,
        cellRenderer: ({ value }: { value: number }) => <MiniBar value={value} max={max} />,
        sort: "desc",
      },
    ];
  }, [summary]);

  const ipColDefs = useCallback(
    (maxCount: number): ColDef[] => [
      { field: "ip", headerName: "IP Address", flex: 1, cellClass: "font-mono" },
      {
        field: "count",
        headerName: "Count",
        width: 160,
        cellRenderer: ({ value }: { value: number }) => <MiniBar value={value} max={maxCount} />,
        sort: "desc",
      },
    ],
    []
  );

  const srcColDefs  = useMemo(() => ipColDefs(summary?.top_src_ips?.[0]?.count ?? 1),  [ipColDefs, summary]);
  const destColDefs = useMemo(() => ipColDefs(summary?.top_dest_ips?.[0]?.count ?? 1), [ipColDefs, summary]);

  const alertColDefs = useMemo<ColDef[]>(() => [
    {
      field: "timestamp",
      headerName: "Time",
      width: 160,
      cellClass: "font-mono text-muted-foreground",
      valueFormatter: ({ value }: { value: string }) => {
        try { return new Date(value).toLocaleTimeString(); } catch { return value; }
      },
    },
    {
      field: "severity",
      headerName: "Sev",
      width: 80,
      cellRenderer: ({ value }: { value: number }) => (
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SEVERITY_CLASS[value] ?? "bg-muted"}`}>
          {SEVERITY_LABEL[value] ?? value}
        </span>
      ),
    },
    { field: "interface", headerName: "Iface", width: 90, cellClass: "font-mono text-muted-foreground" },
    {
      headerName: "Source",
      width: 160,
      cellClass: "font-mono",
      valueGetter: ({ data }: { data: Alert }) => `${data.src_ip}:${data.src_port}`,
    },
    {
      headerName: "Destination",
      width: 160,
      cellClass: "font-mono",
      valueGetter: ({ data }: { data: Alert }) => `${data.dest_ip}:${data.dest_port}`,
    },
    { field: "proto",     headerName: "Proto",  width: 80,  cellClass: "font-mono text-muted-foreground" },
    { field: "app_proto", headerName: "App",    width: 80,  cellClass: "font-mono text-muted-foreground" },
    {
      field: "action",
      headerName: "Action",
      width: 90,
      cellRenderer: ({ value }: { value: string }) => (
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ACTION_CLASS[value] ?? "bg-muted"}`}>
          {value}
        </span>
      ),
    },
    { field: "signature", headerName: "Signature", flex: 1, minWidth: 180 },
  ], []);

  const gridTheme = isDark ? "ag-theme-quartz-dark" : "ag-theme-quartz";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Suricata IDS
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">refresh on demand · 60s cache</span>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isFetching}>
            {isFetching
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stat row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Alerts" value={summary?.total ?? 0} />
            <StatCard
              label="Blocked"
              value={summary?.action_counts?.["drop"] ?? summary?.action_counts?.["blocked"] ?? 0}
              sub="action: drop / block"
            />
            <StatCard
              label="High Severity"
              value={summary?.severity_counts?.[1] ?? 0}
              sub="severity 1"
            />
            <StatCard
              label="Unique Signatures"
              value={summary?.top_signatures?.length ?? 0}
              sub="top 10 shown"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            {(["overview", "feed"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "overview" ? "Overview" : "Alert Feed"}
              </button>
            ))}
          </div>

          {/* ---- OVERVIEW TAB ---- */}
          {activeTab === "overview" && summary && (
            <div className="space-y-4">
              {/* Timeline */}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <CardTitle className="text-sm">Alert Timeline (30-min buckets)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {summary.timeline.length > 0
                    ? <TimelineChart timeline={summary.timeline} isDark={isDark} />
                    : <p className="py-6 text-center text-sm text-muted-foreground">No timeline data</p>
                  }
                </CardContent>
              </Card>

              {/* Interface + Protocol donuts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center gap-2">
                    <Network className="h-3.5 w-3.5 text-muted-foreground" />
                    <CardTitle className="text-sm">Interface Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <SplitDonut
                      counts={summary.interface_counts}
                      isDark={isDark}
                      colors={["hsl(199 95% 52%)", "hsl(38 92% 54%)"]}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                    <CardTitle className="text-sm">Protocol Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <SplitDonut
                      counts={summary.protocol_counts}
                      isDark={isDark}
                      colors={["hsl(199 95% 52%)", "hsl(160 84% 44%)", "hsl(38 92% 54%)"]}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Top signatures */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Top 10 Signatures</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className={`${gridTheme}`} style={{ height: 280 }}>
                    <AgGridReact
                      columnDefs={sigColDefs}
                      rowData={summary.top_signatures}
                      domLayout="normal"
                      suppressCellFocus
                      rowHeight={36}
                      headerHeight={36}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Top IPs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Top Source IPs</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className={`${gridTheme}`} style={{ height: 260 }}>
                      <AgGridReact
                        columnDefs={srcColDefs}
                        rowData={summary.top_src_ips}
                        domLayout="normal"
                        suppressCellFocus
                        rowHeight={36}
                        headerHeight={36}
                      />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Top Destination IPs</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className={`${gridTheme}`} style={{ height: 260 }}>
                      <AgGridReact
                        columnDefs={destColDefs}
                        rowData={summary.top_dest_ips}
                        domLayout="normal"
                        suppressCellFocus
                        rowHeight={36}
                        headerHeight={36}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ---- FEED TAB ---- */}
          {activeTab === "feed" && (
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center gap-3">
                <CardTitle className="text-sm">Alert Feed</CardTitle>
                <Input
                  className="max-w-xs h-8 text-sm"
                  placeholder="Filter IP, signature, proto, iface…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <select
                  className="ml-auto rounded border bg-background px-2 py-1.5 text-xs font-mono"
                  value={alertLines}
                  onChange={(e) => setAlertLines(Number(e.target.value))}
                >
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                </select>
              </CardHeader>
              <CardContent className="pt-0">
                <div className={`${gridTheme}`} style={{ height: 520 }}>
                  <AgGridReact
                    columnDefs={alertColDefs}
                    rowData={filtered}
                    domLayout="normal"
                    suppressCellFocus
                    rowHeight={34}
                    headerHeight={36}
                    pagination
                    paginationPageSize={20}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
