import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Component bảo vệ
import PrivateRoute from './PrivateRoute';
// Hằng số Role
import { ROLES } from '../utils/constants';

// Layouts
import PublicLayout from '../layouts/PublicLayout'; 
import DashboardLayout from '../layouts/DashboardLayout';

// Pages
import Login from '../pages/auth/Login'; // Lưu ý tên file Login.jsx
// import HomePage from '../pages/public/HomePage'; // (Nếu chưa có file này thì comment lại để tránh lỗi)

// Component Placeholder cho Home (Xóa đi khi bạn có file thật)
const HomePage = () => <div className="text-center mt-5"><h1>Trang Chủ Hệ Thống</h1><a href="/login">Đến trang đăng nhập</a></div>;

const AppRoutes = () => {
  return (
    <Routes>
      {/* 1. PUBLIC ROUTES (Ai cũng vào được) */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        {/* Route đăng ký nếu có: <Route path="/register" element={<RegisterPage />} /> */}
      </Route>

      {/* 2. PROTECTED ROUTES (Phải đăng nhập mới vào được) */}
      <Route element={<DashboardLayout />}>
        
        {/* --- Khu vực AUTHOR --- */}
        {/* Khớp với navigate('/author') bên Login.jsx */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.AUTHOR]} />}>
          <Route path="/author" element={<h1>👋 Chào mừng Tác giả (Author Dashboard)</h1>} />
          {/* Các route con khác của author: /author/submit-paper ... */}
        </Route>

        {/* --- Khu vực CHAIR --- */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.CHAIR]} />}>
          <Route path="/chair" element={<h1>👋 Chào mừng Trưởng ban (Chair Dashboard)</h1>} />
        </Route>

        {/* --- Khu vực ADMIN --- */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route path="/admin" element={<h1>👋 Chào mừng Admin</h1>} />
        </Route>

        {/* --- Khu vực REVIEWER --- */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.REVIEWER]} />}>
          <Route path="/reviewer" element={<h1>👋 Chào mừng Người phản biện (Reviewer)</h1>} />
        </Route>

      </Route>

      {/* 3. CATCH ALL (Trang 404) */}
      <Route path="*" element={<div className="text-center mt-5"><h1>404 - Không tìm thấy trang</h1></div>} />

    </Routes>
  );
};

export default AppRoutes;