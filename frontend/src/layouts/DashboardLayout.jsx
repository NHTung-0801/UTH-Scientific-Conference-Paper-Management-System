import { Outlet } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import React from "react";
import { Outlet, useLocation } from "react-router-dom";

const BreadCrumb = () => {
  const { pathname } = useLocation();

  const map = {
    "/reviewer": "Tổng quan",
    "/reviewer/assignments": "Bài báo chấm điểm",
    "/reviewer/coi": "Khai báo COI",
  };

  const title =
    Object.entries(map).find(([k]) => pathname === k)?.[1] ||
    (pathname.includes("/reviewer/review/") ? "Review Form" : "Trang");

  return (
    <div className="flex items-center gap-2 text-sm text-slate-500">
      <span className="hover:text-primary transition-colors cursor-pointer">
        Trang chủ
      </span>
      <span className="material-symbols-outlined text-xs">chevron_right</span>
      <span className="text-slate-900 font-medium">{title}</span>
    </div>
  );
};

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
    </div>
  );
}
