import { Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../utils/auth';

const DashboardLayout = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="d-flex">
      {/* Sidebar giả lập */}
      <aside className="bg-light p-3" style={{width: '200px', minHeight: '100vh'}}>
        <h4>Menu</h4>
        <button onClick={handleLogout} className="btn btn-danger btn-sm w-100 mt-3">Đăng xuất</button>
      </aside>
      
      {/* Nội dung chính */}
      <main className="flex-grow-1 p-4">
        <Outlet />
      </main>
    </div>
  );
};
export default DashboardLayout;