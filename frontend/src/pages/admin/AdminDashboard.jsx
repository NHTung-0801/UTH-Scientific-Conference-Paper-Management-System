import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../utils/constants';

const AdminDashboard = () => {
  const { user, logout } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ FIX: thêm "/" cuối để tránh FastAPI 307 redirect loop qua gateway
  const USERS_API = useMemo(() => '/identity/api/users/', []);

  const getBadgeColor = (roleName) => {
    switch ((roleName || '').toUpperCase()) {
      case ROLES.ADMIN: return 'bg-danger';
      case ROLES.CHAIR: return 'bg-primary';
      case ROLES.REVIEWER: return 'bg-warning text-dark';
      case ROLES.AUTHOR: return 'bg-success';
      default: return 'bg-secondary';
    }
  };

  // ✅ helper: normalize response về array
  const normalizeUsers = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.users)) return raw.users; // trường hợp { users: [...] }
    return [];
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('📡 Fetch users ->', USERS_API);
      const res = await axiosClient.get(USERS_API);

      // axios bình thường: res.data
      // nhưng nếu interceptor của bạn trả thẳng data: res
      const data = res?.data ?? res;
      const list = normalizeUsers(data);

      console.log('✅ Users response:', data);
      setUsers(list);
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;

      console.error('❌ fetchUsers error:', status, err?.response?.data || err);

      if (status === 401) {
        setError('⛔ Token không hợp lệ hoặc đã hết hạn (401). Vui lòng đăng nhập lại.');
      } else if (status === 403) {
        setError('⛔ Bạn không có quyền ADMIN để xem danh sách user (403).');
      } else if (status === 307) {
        setError('⚠️ Backend đang redirect 307 (lỗi slash). Hãy gọi /identity/api/users/ (có / cuối).');
      } else if (status) {
        setError(`❌ Lỗi server (${status})${detail ? `: ${detail}` : ''}`);
      } else {
        setError('❌ Không thể kết nối đến server. Kiểm tra gateway (8080) và identity-service.');
      }

      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [USERS_API]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleChangeRole = async (userId, newRole) => {
    const role = (newRole || '').toUpperCase();
    if (!role) return;

    if (!window.confirm(`Bạn có chắc muốn đổi quyền user này thành ${role}?`)) return;

    try {
      await axiosClient.put(`${USERS_API}${userId}/role`, { role_name: role });
      toast.success(`✅ Đã cập nhật quyền thành: ${role}`);
      fetchUsers();
    } catch (err) {
      console.error('❌ update role error:', err?.response?.status, err?.response?.data || err);
      const msg = err?.response?.data?.detail || 'Lỗi cập nhật quyền!';
      toast.error(msg);
    }
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="text-danger fw-bold">Quản Trị Hệ Thống</h2>
          <p className="text-muted">
            Xin chào Admin:{' '}
            <strong>{user?.full_name || user?.sub || user?.email || '---'}</strong>
          </p>
        </div>

        <button onClick={logout} className="btn btn-outline-danger">
          <i className="bi bi-box-arrow-right me-2"></i>Đăng xuất
        </button>
      </div>

      {error && <div className="alert alert-danger shadow-sm fw-bold">{error}</div>}

      <div className="card shadow border-0">
        <div className="card-header bg-danger text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">📋 Danh Sách Người Dùng</h5>
          <button className="btn btn-light btn-sm" onClick={fetchUsers} disabled={loading}>
            {loading ? 'Đang tải...' : 'Reload'}
          </button>
        </div>

        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-striped table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th className="ps-4">ID</th>
                  <th>Email / Username</th>
                  <th>Tên hiển thị</th>
                  <th>Vai trò hiện tại</th>
                  <th>Thay đổi quyền</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="5" className="text-center py-5">
                      <div className="spinner-border text-danger" role="status"></div>
                      <p className="mt-2 text-muted">Đang tải dữ liệu từ server...</p>
                    </td>
                  </tr>
                )}

                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-muted">
                      Không có dữ liệu user (hoặc bạn chưa có quyền / API lỗi).
                    </td>
                  </tr>
                )}

                {!loading &&
                  users.map((u) => {
                    const currentRole = (u?.roles?.[0]?.role_name || 'N/A').toUpperCase();

                    const isProtected =
                      (u?.email || '').toLowerCase() === 'admin@uth.edu.vn' ||
                      u?.id === user?.user_id ||
                      u?.id === user?.id;

                    return (
                      <tr key={u.id}>
                        <td className="ps-4 fw-bold text-muted">#{u.id}</td>
                        <td className="fw-medium">{u.email}</td>
                        <td>{u.full_name || '---'}</td>
                        <td>
                          <span className={`badge ${getBadgeColor(currentRole)} px-3 py-2 rounded-pill`}>
                            {currentRole}
                          </span>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm border-secondary"
                            style={{ width: 200, cursor: isProtected ? 'not-allowed' : 'pointer' }}
                            value={currentRole}
                            onChange={(e) => handleChangeRole(u.id, e.target.value)}
                            disabled={isProtected}
                          >
                            <option value={ROLES.AUTHOR}>AUTHOR (Tác giả)</option>
                            <option value={ROLES.REVIEWER}>REVIEWER (Phản biện)</option>
                            <option value={ROLES.CHAIR}>CHAIR (Trưởng ban)</option>
                            <option value={ROLES.ADMIN}>ADMIN (Quản trị)</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
