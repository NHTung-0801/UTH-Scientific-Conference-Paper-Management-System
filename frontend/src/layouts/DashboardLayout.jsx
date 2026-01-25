import { Outlet } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Footer from "../components/layout/Footer";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-[#f8f6f6] flex flex-col">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 shrink-0">
        <div className="font-black text-slate-900">UTH-ConfMS</div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="shrink-0">
          <Sidebar />
        </aside>
        <main className="flex-1 min-w-0 p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      <Footer />
    </div>
  );
}
