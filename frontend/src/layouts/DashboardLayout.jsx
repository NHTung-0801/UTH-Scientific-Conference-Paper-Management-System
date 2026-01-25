import { Outlet } from "react-router-dom";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";
import Footer from "../components/layout/Footer";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-[#f8f6f6]">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6"/>
        <div className="font-black text-slate-900">UTH-ConfMS</div>

      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>

      <Footer />
    </div>
  );
}
