
import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated, getUserRole } from '../utils/auth';

const PrivateRoute = ({ allowedRoles }) => {
  const isAuth = isAuthenticated();
  const userRole = getUserRole();

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <div className="alert alert-danger">Bạn không có quyền truy cập trang này!</div>;
  }

  return <Outlet />;
};

export default PrivateRoute;