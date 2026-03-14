import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import Login from "./pages/Login";
import { useAuthStore } from "./store/auth";
import Layout from "./components/layout/Layout";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Interfaces = lazy(() => import("./pages/Interfaces"));
const InterfaceDetail = lazy(() => import("./pages/InterfaceDetail"));
const Routing = lazy(() => import("./pages/Routing"));
const Firewall = lazy(() => import("./pages/Firewall"));
const NAT = lazy(() => import("./pages/NAT"));
const DHCP = lazy(() => import("./pages/DHCP"));
const DNS = lazy(() => import("./pages/DNS"));
const VPN = lazy(() => import("./pages/VPN"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const System = lazy(() => import("./pages/System"));
const Services = lazy(() => import("./pages/Services"));
const Connections = lazy(() => import("./pages/Connections"));
const Logs = lazy(() => import("./pages/Logs"));
const Audit = lazy(() => import("./pages/Audit"));
const IDS = lazy(() => import("./pages/IDS"));
const FlowAccounting = lazy(() => import("./pages/FlowAccounting"));
const AdGuard = lazy(() => import("./pages/AdGuard"));

const Loading = () => <div className="p-8 text-muted-foreground">Loading…</div>;

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function wrap(element: React.ReactNode) {
  return <Suspense fallback={<Loading />}>{element}</Suspense>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={wrap(<Dashboard />)} />
          <Route path="interfaces" element={wrap(<Interfaces />)} />
          <Route path="interfaces/:name" element={wrap(<InterfaceDetail />)} />
          <Route path="routing" element={wrap(<Routing />)} />
          <Route path="firewall" element={wrap(<Firewall />)} />
          <Route path="nat" element={wrap(<NAT />)} />
          <Route path="dhcp" element={wrap(<DHCP />)} />
          <Route path="dns" element={wrap(<DNS />)} />
          <Route path="vpn" element={wrap(<VPN />)} />
          <Route path="diagnostics" element={wrap(<Diagnostics />)} />
          <Route path="system" element={wrap(<System />)} />
          <Route path="services" element={wrap(<Services />)} />
          <Route path="connections" element={wrap(<Connections />)} />
          <Route path="logs" element={wrap(<Logs />)} />
          <Route path="audit" element={wrap(<Audit />)} />
          <Route path="ids" element={wrap(<IDS />)} />
          <Route path="flow" element={wrap(<FlowAccounting />)} />
          <Route path="adguard" element={wrap(<AdGuard />)} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
