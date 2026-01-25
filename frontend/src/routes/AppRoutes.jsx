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

import ChairDashboard from "../pages/chair/ChairDashboard";
import ReviewerDashboard from "../pages/reviewer/ReviewerDashboard";
import AdminDashboard from "../pages/admin/AdminDashboard";

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

      {/* 2) PROTECTED ROUTES */}
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

        {/* ADMIN */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        {/* REVIEWER (Reviewer + Admin) */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.REVIEWER, ROLES.ADMIN]} />}>
          <Route path="/reviewer" element={<ReviewerDashboard />} />
          <Route path="/reviewer/review/:assignmentId" element={<ReviewWorkspace />} />
          <Route path="/reviewer/discussion/:paperId" element={<ReviewDiscussion />} />
        </Route>
      </Route>

      {/* 3) 404 */}
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
