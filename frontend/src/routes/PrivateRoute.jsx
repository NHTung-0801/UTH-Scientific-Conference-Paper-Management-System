import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated, getUserRole } from '../utils/auth';

const PrivateRoute = ({ allowedRoles }) => {
  const isAuth = isAuthenticated();
  const userRole = getUserRole();

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  const normalizedUserRole = (userRole || '').toUpperCase();
  const normalizedAllowed = (allowedRoles || []).map(r => (r || '').toUpperCase());

  if (normalizedAllowed.length > 0 && !normalizedAllowed.includes(normalizedUserRole)) {
  return <div className="alert alert-danger">Bạn không có quyền truy cập trang này!</div>;
}

  return <Outlet />;
};

export default PrivateRoute;
