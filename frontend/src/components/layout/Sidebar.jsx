import React, { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../utils/constants";

const linkBase =
  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors";
const linkInactive = "text-slate-600 hover:bg-slate-50";
const linkActive = "bg-rose-50 text-rose-700 border border-rose-100 font-bold";

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const roles = useMemo(() => {
    return Array.isArray(user?.roles)
      ? user.roles.map((r) => String(r).toUpperCase())
      : [];
  }, [user?.roles]);

  const hasRole = (role) => roles.includes(role);

  // =========================
  // 1) SIDEBAR CHO AUTHOR (giống ảnh + tông đỏ nhạt)
  // =========================
  const isAuthorArea = location.pathname.startsWith("/author");
  if (hasRole(ROLES.AUTHOR) && isAuthorArea) {
    const authorMenu = [
      { to: "/author", label: "🏠 Trang chủ" },
      { to: "/author/submissions", label: "📄 Bài báo của tôi" },
      { to: "/author/submit", label: "⬆️ Nộp bài mới" },
      { to: "/author/profile", label: "👤 Hồ sơ cá nhân" },
      { to: "/author/settings", label: "⚙️ Cài đặt" },
    ];

    return (
      <aside className="w-72 bg-white border-r border-slate-200 min-h-[calc(100vh-56px)] hidden lg:flex flex-col">
        <div className="p-4 flex flex-col gap-6">
          {/* Profile box */}
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center font-black text-rose-700">
              {String(user?.full_name || user?.email || "A")
                .slice(0, 1)
                .toUpperCase()}
            </div>
            <div className="flex flex-col overflow-hidden">
              <h1 className="text-slate-900 text-sm font-bold truncate">
                {user?.full_name || user?.email || "Tác giả"}
              </h1>
              <p className="text-slate-500 text-xs font-medium">Tác giả</p>
            </div>
          </div>

          {/* Links */}
          <nav className="flex flex-col gap-2">
            {authorMenu.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/author"}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? linkActive : linkInactive}`
                }
              >
                <span className="w-5 inline-flex justify-center">
                  {item.label.split(" ")[0]}
                </span>
                <span className="font-semibold">{item.label.split(" ").slice(1).join(" ")}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Support + Logout */}
        <div className="mt-auto p-4">
          <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
            <div className="text-rose-700 text-xs font-bold mb-1">
              Hỗ trợ kỹ thuật
            </div>
            <div className="text-slate-600 text-xs leading-relaxed">
              Gặp vấn đề khi nộp bài? Liên hệ support@uth.edu.vn
            </div>
          </div>

          <button
            onClick={logout}
            className="mt-4 w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-rose-600 hover:bg-rose-50 font-bold"
          >
            <span className="w-5 inline-flex justify-center">⎋</span>
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    );
  }

  // =========================
  // 2) SIDEBAR CHUNG (giống menu bạn gửi)
  // =========================
  const menu = [
    { to: "/", label: "🏠 Trang chủ" },

    ...(hasRole(ROLES.AUTHOR)
      ? [
          { to: "/author", label: "🏠 Tổng quan" },
          { to: "/author/submissions", label: "📄 Bài báo của tôi" },
          { to: "/author/submissions/new", label: "⬆️ Nộp bài báo mới" },
          
        ]
      : []),

    ...(hasRole(ROLES.REVIEWER) || hasRole(ROLES.ADMIN)
      ? [{ to: "/reviewer", label: "🧪 Reviewer Dashboard" }]
      : []),

    ...(hasRole(ROLES.CHAIR) ? [{ to: "/chair", label: "🎛️ Chair Dashboard" }] : []),

    ...(hasRole(ROLES.ADMIN) ? [{ to: "/admin", label: "🛡️ Admin Dashboard" }] : []),
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-56px)] p-4">
      <div className="mb-4">
        <div className="text-xs text-slate-500">Đăng nhập:</div>
        <div className="font-bold text-slate-900 truncate">
          {user?.full_name || user?.sub || user?.email || "---"}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          Roles: <b className="text-slate-700">{roles.join(", ") || "N/A"}</b>
        </div>
      </div>

      <nav className="space-y-1">
        {menu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm font-semibold transition ${
                isActive
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "text-slate-700 hover:bg-slate-100"
              }`
            }
            end={item.to === "/"}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={logout}
        className="mt-6 w-full px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 font-bold"
      >
        ⎋ Đăng xuất
      </button>
    </aside>
  );
};

export default Sidebar;
