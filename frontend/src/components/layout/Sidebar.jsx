import React, { useMemo } from "react";
import { NavLink, useLocation, matchPath } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../utils/constants";
// --- STYLE ---
const linkBase =
  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer";
const linkInactive =
  "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900";
const linkActive =
  "bg-rose-50 text-rose-700 border border-rose-100 font-bold shadow-sm";

function RoleHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-3 px-2 pt-2">
      <div className="size-8 bg-rose-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-rose-200">
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <span className="text-lg font-black text-gray-900">{title}</span>
    </div>
  );
}

function SidebarShell({ children, showOnLgOnly = true }) {
  return (
    <aside
      className={[
        "w-72 bg-white border-r border-slate-200 hidden lg:flex flex-col sticky top-14 h-[calc(100vh-56px)] overflow-y-auto",
        showOnLgOnly ? "hidden lg:flex" : "flex",
      ].join(" ")}
    >
      <div className="p-4 flex flex-col gap-6 h-full">{children}</div>
    </aside>
  );
}


function MenuNav({ items }) {
  const location = useLocation();

  const isItemActive = (item) => {
    const end = !!item.exact;
    return !!matchPath({ path: item.to, end }, location.pathname);
  };

  return (
    <nav className="flex flex-col gap-1 flex-1 overflow-y-auto custom-scrollbar">
      {items.map((item) => {
        const active = isItemActive(item);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={`${linkBase} ${active ? linkActive : linkInactive}`}
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function LogoutButton({ onLogout }) {
  return (
    <button
      onClick={onLogout}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-rose-600 hover:bg-rose-50 font-bold transition-colors"
    >
      <span className="material-symbols-outlined">logout</span>
      <span>Đăng xuất</span>
    </button>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const roles = useMemo(() => {
    return Array.isArray(user?.roles)
      ? user.roles.map((r) => String(r).toUpperCase())
      : [];
  }, [user?.roles]);

  const hasRole = (role) => roles.includes(role);

  const isAuthorArea = location.pathname.startsWith("/author");
  const isChairArea = location.pathname.startsWith("/chair");
  const isAdminArea = location.pathname.startsWith("/admin");

  // =========================
  // AUTHOR
  // =========================
  if (hasRole(ROLES.AUTHOR) && isAuthorArea) {
    const authorMenu = [
      { to: "/author", label: "Tổng quan", icon: "home", exact: true },
      { to: "/author/submissions", label: "Bài báo của tôi", icon: "article", exact: true }, 
      { to: "/author/submissions/new", label: "Nộp bài mới", icon: "cloud_upload", exact: true },
      { to: "/author/notifications", label: "Thông báo", icon: "notifications", exact: true }, 
      { to: "/author/profile", label: "Hồ sơ cá nhân", icon: "person", exact: true },
      { to: "/author/settings", label: "Cài đặt", icon: "settings", exact: true },
    ];

    return (
      <SidebarShell>
        <RoleHeader icon="school" title="Author Portal" />
        <MenuNav items={authorMenu} />

        <div className="mt-auto">
          <LogoutButton onLogout={logout} />
        </div>
      </SidebarShell>
    );
  }

  // =========================
  // CHAIR
  // =========================
  if (hasRole(ROLES.CHAIR) && isChairArea) {
    const chairMenu = [
      { to: "/chair", label: "Tổng quan", icon: "space_dashboard", end: true },
      { to: "/chair/papers", label: "Bài nộp", icon: "article" },
      { to: "/chair/review-assign", label: "Phân công phản biện", icon: "assignment_ind" },
      { to: "/chair/settings", label: "Cài đặt", icon: "settings" },
    ];

    return (
      <SidebarShell>
        <RoleHeader icon="gavel" title="Chair Portal" />
        <MenuNav items={chairMenu} />

        <div className="mt-auto">
          <LogoutButton onLogout={logout} />
        </div>
      </SidebarShell>
    );
  }

  // =========================
  // ADMIN  
  // =========================
  if (hasRole(ROLES.ADMIN) && isAdminArea) {
    const adminMenu = [
      { to: "/admin/dashboard", label: "Tổng quan hệ thống", icon: "grid_view" },
      { to: "/admin/conferences", label: "Quản lý Hội nghị", icon: "calendar_month" },
      { to: "/admin/users", label: "Quản lý Người dùng", icon: "group" },
      { to: "/admin/settings", label: "Cấu hình hệ thống", icon: "settings" },
      { to: "/admin/audit", label: "Nhật ký hoạt động", icon: "history" },
    ];

    return (
      <SidebarShell>
        <RoleHeader icon="admin_panel_settings" title="Admin Portal" />
        <MenuNav items={adminMenu} />

        <div className="mt-auto">
          <LogoutButton onLogout={logout} />
        </div>
      </SidebarShell>
    );
  }

  // =========================
  // COMMON (fallback)
  // =========================
  const menu = [
    { to: "/", label: "Trang chủ", icon: "home", end: true },

    ...(hasRole(ROLES.AUTHOR)
      ? [
          { to: "/author", label: "Tổng quan", icon: "home" },
          { to: "/author/submissions", label: "Bài báo của tôi", icon: "article" },
          { to: "/author/submissions/new", label: "Nộp bài mới", icon: "cloud_upload" },
          { to: "/author/profile", label: "Hồ sơ cá nhân", icon: "person" },
          { to: "/author/settings", label: "Cài đặt", icon: "settings" },
        ]
      : []),

    ...(hasRole(ROLES.REVIEWER) || hasRole(ROLES.ADMIN)
      ? [{ to: "/reviewer", label: "Reviewer Dashboard", icon: "rate_review" }]
      : []),

    ...(hasRole(ROLES.CHAIR) ? [{ to: "/chair", label: "Chair Dashboard", icon: "gavel" }] : []),

    ...(hasRole(ROLES.ADMIN) ? [{ to: "/admin", label: "Admin Dashboard", icon: "dashboard" }] : []),
  ];

  return (
    <SidebarShell>
      {/* giữ logo chung như cũ */}
      <div className="p-2 flex items-center gap-3">
        <div className="size-10 bg-rose-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-rose-200">
          <span className="material-symbols-outlined text-2xl">account_balance</span>
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tight text-gray-900">UTH-ConfMS</h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
            Hệ thống chung
          </p>
        </div>
      </div>

      <MenuNav items={menu} />

      <div className="mt-auto">
        <LogoutButton onLogout={logout} />
      </div>
    </SidebarShell>
  );
}
