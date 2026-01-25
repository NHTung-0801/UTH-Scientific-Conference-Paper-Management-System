import { Outlet, useNavigate } from "react-router-dom";
import { logout } from "../utils/auth";

export default function DashboardLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };


  return (
    <div className="min-h-screen bg-[#f8f6f6]">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        <div className="font-black text-slate-900">UTH-ConfMS</div>

        <div className="flex items-center gap-4 text-sm font-semibold text-slate-600">
          <button onClick={() => navigate("/")} className="hover:text-primary">
            Trang chủ
          </button>
          <button onClick={() => navigate("/reviewer")} className="hover:text-primary">
            Reviewer
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg bg-primary text-white font-bold hover:bg-rose-700"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="min-h-[calc(100vh-56px)]">
        <Outlet />
      </main>
    </div>
  );
}
