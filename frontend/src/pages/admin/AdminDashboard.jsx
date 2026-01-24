import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../api/axiosClient";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../utils/constants";

const ROLE_ORDER = [ROLES.AUTHOR, ROLES.REVIEWER, ROLES.CHAIR, ROLES.ADMIN];

const roleLabel = (r) => {
  const x = (r || "").toUpperCase();
  switch (x) {
    case ROLES.ADMIN:
      return "ADMIN (Quản trị)";
    case ROLES.CHAIR:
      return "CHAIR (Trưởng ban)";
    case ROLES.REVIEWER:
      return "REVIEWER (Phản biện)";
    case ROLES.AUTHOR:
    default:
      return "AUTHOR (Tác giả)";
  }
};

const badgeClass = (roleName) => {
  switch ((roleName || "").toUpperCase()) {
    case ROLES.ADMIN:
      return "bg-primary/10 text-primary ring-primary/20";
    case ROLES.CHAIR:
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/20";
    case ROLES.REVIEWER:
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20";
    case ROLES.AUTHOR:
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20";
    default:
      return "bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-slate-500/20";
  }
};

const normalizeUsers = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.users)) return raw.users;
  return [];
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ FIX: thêm "/" cuối để tránh 307 redirect loop qua gateway
  const USERS_API = useMemo(() => "/identity/api/users/", []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      console.log("📡 Fetch users ->", USERS_API);
      const res = await axiosClient.get(USERS_API);

      const data = res?.data ?? res; // phòng interceptor trả thẳng data
      const list = normalizeUsers(data);

      console.log("✅ Users response:", data);
      setUsers(list);
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;

      console.error("❌ fetchUsers error:", status, err?.response?.data || err);

      if (status === 401) {
        setError("⛔ Token không hợp lệ hoặc đã hết hạn (401). Vui lòng đăng nhập lại.");
      } else if (status === 403) {
        setError("⛔ Bạn không có quyền ADMIN để xem danh sách user (403).");
      } else if (status === 307) {
        setError("⚠️ Backend đang redirect 307 (lỗi slash). Hãy gọi /identity/api/users/ (có / cuối).");
      } else if (status) {
        setError(`❌ Lỗi server (${status})${detail ? `: ${detail}` : ""}`);
      } else {
        setError("❌ Không thể kết nối đến server. Kiểm tra gateway (8080) và identity-service.");
      }

      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [USERS_API]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleChangeRole = async (userId, newRole) => {
    const role = (newRole || "").toUpperCase();
    if (!role) return;

    if (!window.confirm(`Bạn có chắc muốn đổi quyền user này thành ${role}?`)) return;

    try {
      await axiosClient.put(`${USERS_API}${userId}/role`, { role_name: role });
      toast.success(`✅ Đã cập nhật quyền thành: ${role}`);
      fetchUsers();
    } catch (err) {
      console.error("❌ update role error:", err?.response?.status, err?.response?.data || err);
      const msg = err?.response?.data?.detail || "Lỗi cập nhật quyền!";
      toast.error(msg);
    }
  };

  const adminName = user?.full_name || user?.sub || user?.email || "---";

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display transition-colors duration-200">
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-40 py-8">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
              <li className="inline-flex items-center">
                <span className="inline-flex items-center text-sm font-medium text-slate-500 dark:text-slate-400">
                  Bảng điều khiển
                </span>
              </li>
              <li>
                <div className="flex items-center">
                  <span className="material-symbols-outlined text-slate-400 mx-1" style={{ fontSize: 16 }}>
                    chevron_right
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">Quản trị hệ thống</span>
                </div>
              </li>
            </ol>
          </nav>

          {/* Heading */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                Quản trị hệ thống
              </h1>
              <p className="text-slate-500 dark:text-slate-400">
                Xin chào Admin: <span className="font-bold text-slate-900 dark:text-white">{adminName}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchUsers}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-700 dark:text-slate-100 text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-60"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  refresh
                </span>
                {loading ? "Đang tải..." : "Reload"}
              </button>

              <button
                onClick={logout}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-rose-700 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  logout
                </span>
                Đăng xuất
              </button>
            </div>
          </div>

          {/* Error */}
          {error ? (
            <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-rose-200/70 dark:border-rose-900/40 p-5">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>
                  error
                </span>
                <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>
              </div>
            </div>
          ) : null}

          {/* Card */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>
                  group
                </span>
                <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white">
                  Danh sách người dùng
                </h2>
              </div>

              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Tổng: {users.length}
              </span>
            </div>

            {/* Table */}
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="text-left font-bold px-5 py-3 whitespace-nowrap">ID</th>
                    <th className="text-left font-bold px-5 py-3 whitespace-nowrap">Email / Username</th>
                    <th className="text-left font-bold px-5 py-3 whitespace-nowrap">Tên hiển thị</th>
                    <th className="text-left font-bold px-5 py-3 whitespace-nowrap">Vai trò</th>
                    <th className="text-left font-bold px-5 py-3 whitespace-nowrap">Thay đổi quyền</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center">
                        <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
                          <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>
                            progress_activity
                          </span>
                          Đang tải dữ liệu từ server...
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-slate-500 dark:text-slate-400">
                        Không có dữ liệu user (hoặc bạn chưa có quyền / API lỗi).
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const currentRole = (u?.roles?.[0]?.role_name || "").toUpperCase();
                      const safeRole = ROLE_ORDER.includes(currentRole) ? currentRole : ROLES.AUTHOR;

                      const isProtected =
                        (u?.email || "").toLowerCase() === "admin@uth.edu.vn" ||
                        u?.id === user?.user_id ||
                        u?.id === user?.id;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-slate-500 dark:text-slate-400 font-bold">#{u.id}</span>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="font-semibold text-slate-900 dark:text-white">{u.email}</div>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="text-slate-700 dark:text-slate-200">{u.full_name || "---"}</div>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <span
                              className={[
                                "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset",
                                badgeClass(safeRole),
                              ].join(" ")}
                            >
                              {safeRole}
                            </span>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <select
                              value={safeRole}
                              disabled={isProtected}
                              onChange={(e) => handleChangeRole(u.id, e.target.value)}
                              className={[
                                "w-[220px] rounded-lg border px-3 py-2 text-sm font-bold",
                                "bg-white dark:bg-transparent",
                                "border-slate-200 dark:border-slate-700",
                                "text-slate-800 dark:text-slate-100",
                                "focus:outline-none focus:ring-2 focus:ring-primary/60",
                                isProtected ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                              ].join(" ")}
                            >
                              <option value={ROLES.AUTHOR}>{roleLabel(ROLES.AUTHOR)}</option>
                              <option value={ROLES.REVIEWER}>{roleLabel(ROLES.REVIEWER)}</option>
                              <option value={ROLES.CHAIR}>{roleLabel(ROLES.CHAIR)}</option>
                              <option value={ROLES.ADMIN}>{roleLabel(ROLES.ADMIN)}</option>
                            </select>

                            {isProtected ? (
                              <div className="mt-1 text-xs text-slate-400">
                                Tài khoản này được bảo vệ (không đổi quyền).
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pb-8 text-center text-xs text-slate-400 dark:text-slate-500">
            Tip: nếu gặp 307 thì kiểm tra endpoint có dấu “/” cuối: <span className="font-semibold">/identity/api/users/</span>
          </div>
        </div>
      </main>
    </div>
  );
}
