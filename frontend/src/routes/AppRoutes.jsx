// src/routes/AppRoutes.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";
import { ROLES } from "../utils/constants";

// Layouts
import PublicLayout from "../layouts/PublicLayout";
import DashboardLayout from "../layouts/DashboardLayout";
import AdminLayout from "../layouts/AdminLayout"; // ✅ Mới thêm

// Public Pages
import HomePage from "../pages/public/HomePage";
import ConferenceDetail from "../pages/public/ConferenceDetail";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";

// Dashboard Pages
import AuthorDashboard from "../pages/author/AuthorDashboard"; 
import MySubmissions from "../pages/author/MySubmissions";    
import SubmitPaper from "../pages/author/SubmitPaper";        

import ChairDashboard from "../pages/chair/ChairDashboard";
import ReviewerDashboard from "../pages/reviewer/ReviewerDashboard";

// Admin Pages
import AdminDashboard from "../pages/admin/AdminDashboard"; // Đây là file chứa bảng User (Code cũ)
import DashboardOverview from "../pages/admin/DashboardOverview"; // ✅ Trang tổng quan mới

// Reviewer - Review Service pages
import ReviewWorkspace from "../pages/reviewer/ReviewWorkspace";
import ReviewDiscussion from "../pages/reviewer/ReviewDiscussion";

const AppRoutes = () => {
  return (
    <Routes>
      {/* 1) PUBLIC ROUTES */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/conference/:id" element={<ConferenceDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* 2) GENERAL DASHBOARD (Author, Chair, Reviewer) */}
      {/* Giữ nguyên DashboardLayout cũ cho các role này */}
      <Route element={<DashboardLayout />}>
        
        {/* AUTHOR */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.AUTHOR]} />}>
          <Route path="/author" element={<AuthorDashboard />} />
          <Route path="/author/submissions" element={<MySubmissions />} />
          <Route path="/author/submissions/new" element={<SubmitPaper />} />
          <Route path="/author/submissions/:paperId" element={<MySubmissions />} />
          <Route
            path="/author/submit"
            element={<Navigate to="/author/submissions/new" replace />}
          />
        </Route>

        {/* CHAIR */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.CHAIR]} />}>
          <Route path="/chair" element={<ChairDashboard />} />
        </Route>

        {/* REVIEWER */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.REVIEWER, ROLES.ADMIN]} />}>
          <Route path="/reviewer" element={<ReviewerDashboard />} />
          <Route path="/reviewer/review/:assignmentId" element={<ReviewWorkspace />} />
          <Route path="/reviewer/discussion/:paperId" element={<ReviewDiscussion />} />
        </Route>
      </Route>

      {/* 3) ADMIN DASHBOARD (New Layout) */}
      {/* ✅ Tách riêng Admin ra dùng AdminLayout mới để có Sidebar chuyên biệt */}
      <Route element={<PrivateRoute allowedRoles={[ROLES.ADMIN]} />}>
        <Route path="/admin" element={<AdminLayout />}>
           {/* Mặc định vào /admin sẽ nhảy sang dashboard */}
           <Route index element={<Navigate to="dashboard" replace />} />
           
           {/* Trang Tổng quan (Biểu đồ) */}
           <Route path="dashboard" element={<DashboardOverview />} />
           
           {/* Trang Quản lý User (File AdminDashboard cũ của bạn) */}
           <Route path="users" element={<AdminDashboard />} />

           {/* Các trang chưa làm (Placeholder) */}
           <Route path="conferences" element={<div className="p-10 font-bold text-gray-500">Quản lý Hội nghị (Đang phát triển)</div>} />
           <Route path="settings" element={<div className="p-10 font-bold text-gray-500">Cấu hình hệ thống (Đang phát triển)</div>} />
           <Route path="audit" element={<div className="p-10 font-bold text-gray-500">Nhật ký hệ thống (Đang phát triển)</div>} />
        </Route>
      </Route>

      {/* 4) 404 Not Found */}
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