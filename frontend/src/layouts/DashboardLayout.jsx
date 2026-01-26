import { Outlet } from "react-router-dom";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";
import Footer from "../components/layout/Footer";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-[#f8f6f6] flex flex-col overflow-x-hidden">
      <Header />

      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <Footer />
    </div>
  );
}

