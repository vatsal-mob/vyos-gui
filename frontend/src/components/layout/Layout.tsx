import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import CommitBanner from "../shared/CommitBanner";
import CommandPalette from "../shared/CommandPalette";

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto p-6 pb-20">
          <Outlet />
        </main>
        <CommitBanner />
      </div>
      <CommandPalette />
    </div>
  );
}
