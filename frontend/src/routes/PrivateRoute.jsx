import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const PrivateRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div>Đang tải...</div>;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const hasPermission = user.roles.some(role => allowedRoles.includes(role));

  if (allowedRoles && !hasPermission) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px', color: 'red' }}>
        <h1>403 - FORBIDDEN</h1>
        <p>Tài khoản {user.sub} không có quyền truy cập trang này.</p>
      </div>
    );
  }

  return <Outlet />;
};

export default PrivateRoute;