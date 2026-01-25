import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const NavItem = ({ to, icon, label }) => {
  const isActive = ({ isActive }) =>
    isActive
      ? "flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary font-bold"
      : "flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors";

  return (
    <NavLink to={to} className={isActive} end>
      <span className="material-symbols-outlined text-xl">{icon}</span>
      <span className="text-sm">{label}</span>
    </NavLink>
  );
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fullName =
    user?.full_name || user?.name || user?.email || `Reviewer #${user?.id ?? ""}`;

  return (
    <aside className="w-72 bg-white border-r border-slate-200 flex flex-col justify-between p-6 fixed h-full">
      <div className="flex flex-col gap-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="size-10 bg-primary rounded-lg flex items-center justify-center text-white">
            <span className="material-symbols-outlined">school</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-primary text-lg font-bold leading-none">
              UTH-ConfMS
            </h1>
            <p className="text-slate-500 text-xs mt-1">Hệ quản lý Hội nghị</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-2">
          <NavItem to="/reviewer" icon="dashboard" label="Tổng quan" />
          <NavItem to="/reviewer/assignments" icon="description" label="Bài báo chấm điểm" />
          <NavItem to="/reviewer/coi" icon="gavel" label="Khai báo COI" />
        </nav>
      </div>

      {/* Profile & Logout */}
      <div className="flex flex-col gap-4 border-t border-slate-200 pt-6">
        <div className="flex items-center gap-3 px-2">
          <div className="size-10 rounded-full bg-slate-200 flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-600">
              person
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-bold truncate w-44">{fullName}</p>
            <p className="text-xs text-slate-500">Reviewer</p>
          </div>
        </div>

        <button
          onClick={() => {
            // nếu context bạn có logout thì dùng, không có thì navigate /login
            if (typeof logout === "function") logout();
            navigate("/login");
          }}
          className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-lg text-sm font-bold hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
