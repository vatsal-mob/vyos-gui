import SystemStats from "../components/dashboard/SystemStats";
import InterfaceTraffic from "../components/dashboard/InterfaceTraffic";
import TopTalkers from "../components/dashboard/TopTalkers";
import FirewallFeed from "../components/dashboard/FirewallFeed";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3">
        <h1 className="font-display text-xl font-semibold tracking-tight">Dashboard</h1>
        <span className="text-2xs font-mono text-muted-foreground/50 uppercase tracking-wider">
          System Overview
        </span>
      </div>

      <SystemStats />

      <div>
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="section-label">Interface Traffic</h2>
        </div>
        <InterfaceTraffic />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TopTalkers />
        <FirewallFeed />
      </div>
    </div>
  );
}
