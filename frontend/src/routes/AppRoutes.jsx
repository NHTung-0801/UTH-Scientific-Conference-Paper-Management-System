// src/routes/AppRoutes.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";
import { ROLES } from "../utils/constants";

// Layouts
import PublicLayout from "../layouts/PublicLayout";
import DashboardLayout from "../layouts/DashboardLayout";

// Public Pages
import HomePage from "../pages/public/HomePage";
import ConferenceDetail from "../pages/public/ConferenceDetail";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";

// Dashboard Pages
import AuthorDashboard from "../pages/author/AuthorDashboard"; 
import MySubmissions from "../pages/author/MySubmissions";    
import SubmitPaper from "../pages/author/SubmitPaper";   
import PaperDetail from "../pages/author/PaperDetail";   
import AddCoAuthor from "../pages/author/AddCoAuthor";
import EditPaper from "../pages/author/EditPaper";
import EditSubmissionAuthor from "../pages/author/EditSubmissionAuthor";
import Notifications from "../pages/author/Notifications";


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
          <Route path="/author/notifications" element={<Notifications />} />
          <Route path="/author/submissions/:id" element={<PaperDetail />} />
          <Route path="/author/submissions/:id/authors/new" element={<AddCoAuthor />} />
          <Route path="/author/submissions/:id/edit" element={<EditPaper />} />
          <Route path="/author/submissions/:id/authors/:authorId/edit" element={<EditSubmissionAuthor />} />
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

        {/* Admin */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

          {/* các trang admin khác */}
          <Route path="/admin/dashboard" element={<DashboardOverview />} />
          <Route path="/admin/users" element={<AdminDashboard />} />

          <Route path="/admin/conferences" element={<div className="p-10 font-bold text-gray-500">Quản lý Hội nghị (Đang phát triển)</div>} />
          <Route path="/admin/settings" element={<div className="p-10 font-bold text-gray-500">Cấu hình hệ thống (Đang phát triển)</div>} />
          <Route path="/admin/audit" element={<div className="p-10 font-bold text-gray-500">Nhật ký hệ thống (Đang phát triển)</div>} />
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