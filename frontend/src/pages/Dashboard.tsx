import SystemStats from "../components/dashboard/SystemStats";
import InterfaceTraffic from "../components/dashboard/InterfaceTraffic";
import TopTalkers from "../components/dashboard/TopTalkers";
import FirewallFeed from "../components/dashboard/FirewallFeed";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
      <SystemStats />
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">Interface Traffic</h2>
        <InterfaceTraffic />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopTalkers />
        <FirewallFeed />
      </div>
    </div>
  );
}
