// src/routes/AppRoutes.jsx
import { Routes, Route } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";
import { ROLES } from "../utils/constants";

// Layouts
import PublicLayout from "../layouts/PublicLayout";
import DashboardLayout from "../layouts/DashboardLayout";

// Public Pages
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import HomePage from "../pages/public/HomePage";

// Dashboard Pages
import AuthorDashboard from "../pages/author/AuthorDashboard";
import ChairDashboard from "../pages/chair/ChairDashboard";
import ReviewerDashboard from "../pages/reviewer/ReviewerDashboard";
import AdminDashboard from "../pages/admin/AdminDashboard";

// Reviewer - Review Service pages
import ReviewWorkspace from "../pages/reviewer/ReviewWorkspace";
import ReviewDiscussion from "../pages/reviewer/ReviewDiscussion";

const AppRoutes = () => {
  return (
    <Routes>
      {/* 1. PUBLIC ROUTES (Ai cũng xem được) */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* 2. PROTECTED ROUTES (Cần đăng nhập) */}
      <Route element={<DashboardLayout />}>
        {/* --- Khu vực AUTHOR --- */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.AUTHOR]} />}>
          <Route path="/author" element={<AuthorDashboard />} />
          {/* Ví dụ mở rộng sau này: <Route path="/author/submit" element={<SubmitPaper />} /> */}
        </Route>

        {/* --- Khu vực CHAIR --- */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.CHAIR]} />}>
          <Route path="/chair" element={<ChairDashboard />} />
        </Route>

        {/* --- Khu vực ADMIN --- */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        {/* --- Khu vực REVIEWER --- */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.REVIEWER, ROLES.ADMIN]} />}>
          <Route path="/reviewer" element={<ReviewerDashboard />} />
          <Route path="/reviewer/review/:assignmentId" element={<ReviewWorkspace />} />
          <Route path="/reviewer/discussion/:paperId" element={<ReviewDiscussion />} />
        </Route>
      </Route>

      {/* 3. CATCH ALL (Trang 404) */}
      <Route
        path="*"
        element={
          <div className="text-center mt-5" style={{ padding: "50px" }}>
            <h1>404 - Không tìm thấy trang</h1>
            <p>Đường dẫn bạn truy cập không tồn tại.</p>
            <a href="/" className="btn btn-primary">
              Về trang chủ
            </a>
          </div>
        }
      />
    </Routes>
  );
};

export default AppRoutes;
