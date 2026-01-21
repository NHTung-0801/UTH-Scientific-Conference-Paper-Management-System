import { Routes, Route } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import { ROLES } from '../utils/constants';

// Layouts (Bạn cần tạo 2 file rỗng cho Layouts này trước)
import PublicLayout from '../layouts/PublicLayout'; 
import DashboardLayout from '../layouts/DashboardLayout';

// Pages
import LoginPage from '../pages/auth/Login';
import HomePage from '../pages/public/HomePage';

const AppRoutes = () => {
  return (
    <Routes>
      {/* 1. PUBLIC (Ai cũng vào được) */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* 2. PROTECTED (Phải đăng nhập) */}
      <Route element={<DashboardLayout />}>
        
        {/* Author */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.AUTHOR]} />}>
          <Route path="/author/dashboard" element={<h1>Dashboard Tác Giả</h1>} />
        </Route>

        {/* Chair */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.CHAIR]} />}>
          <Route path="/chair/dashboard" element={<h1>Dashboard Trưởng Ban</h1>} />
        </Route>

        {/* Admin */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route path="/admin/dashboard" element={<h1>Dashboard Admin</h1>} />
        </Route>

        {/* Reviewer */}
        <Route element={<PrivateRoute allowedRoles={[ROLES.REVIEWER]} />}>
          <Route path="/reviewer/dashboard" element={<h1>Dashboard Reviewer</h1>} />
        </Route>

      </Route>
    </Routes>
  );
};

export default AppRoutes;