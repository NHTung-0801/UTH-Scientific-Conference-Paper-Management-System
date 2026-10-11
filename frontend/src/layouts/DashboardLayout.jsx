import { Outlet } from "react-router-dom";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";
import useFcm from "../hooks/useFcm";

export default function DashboardLayout() {
  useFcm();

  return (
    <div
      className="h-screen bg-[#f8f6f6] flex flex-col overflow-hidden"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <Header />

      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 p-6 overflow-y-auto relative scroll-smooth">
          <Outlet />
        </main>
      </div>
    </div>
  );
}