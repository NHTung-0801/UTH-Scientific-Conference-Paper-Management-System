// src/pages/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { logout } from '../utils/auth';

const AdminDashboard = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 1. Load danh sách khi vào trang
    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axiosClient.get('/users/');
            setUsers(res.data);
            setError(null);
        } catch (err) {
            console.error("Lỗi API:", err);
            // Kiểm tra mã lỗi để báo cụ thể
            if (err.response && (err.response.status === 403 || err.response.status === 401)) {
                setError("⛔ BẠN KHÔNG CÓ QUYỀN ADMIN! Vui lòng chạy file 'init_admin.py' ở Backend để cấp quyền.");
            } else {
                setError("❌ Lỗi kết nối Server! Vui lòng kiểm tra xem Backend đã chạy chưa.");
            }
        } finally {
            setLoading(false);
        }
    };

    // 2. Hàm đổi quyền
    const handleChangeRole = async (userId, newRole) => {
        if (!window.confirm(`Bạn có chắc muốn đổi quyền user này thành ${newRole}?`)) return;
        
        try {
            await axiosClient.put(`/users/${userId}/role`, { role_name: newRole });
            alert("Cập nhật quyền thành công!");
            fetchUsers(); // Load lại bảng để thấy thay đổi
        } catch (error) {
            const msg = error.response?.data?.detail || "Lỗi cập nhật quyền!";
            alert(msg);
        }
    };

    return (
        <div className="container mt-4">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="text-primary fw-bold">Quản Trị Hệ Thống (Admin)</h2>
                <button onClick={logout} className="btn btn-danger">Đăng xuất</button>
            </div>

            {/* Thông báo lỗi nếu có */}
            {error && <div className="alert alert-danger shadow-sm fw-bold">{error}</div>}

            {/* Bảng Danh Sách */}
            <div className="card shadow border-0">
                <div className="card-header bg-primary text-white">
                    <h5 className="mb-0">Danh Sách Người Dùng</h5>
                </div>
                <div className="card-body p-0">
                    <table className="table table-striped table-hover mb-0 align-middle">
                        <thead className="table-light">
                            <tr>
                                <th className="ps-3">ID</th>
                                <th>Email</th>
                                <th>Tên hiển thị</th>
                                <th>Quyền hiện tại</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Trạng thái Loading */}
                            {loading && (
                                <tr>
                                    <td colSpan="5" className="text-center py-4">
                                        <div className="spinner-border text-primary" role="status"></div>
                                        <p className="mt-2 text-muted">Đang tải dữ liệu...</p>
                                    </td>
                                </tr>
                            )}

                            {/* Trạng thái Rỗng */}
                            {!loading && users.length === 0 && !error && (
                                <tr>
                                    <td colSpan="5" className="text-center py-3 text-muted">Chưa có user nào trong hệ thống.</td>
                                </tr>
                            )}

                            {/* Danh sách User */}
                            {users.map(user => {
                                const currentRole = user.roles?.[0]?.role_name || "N/A";
                                
                                // Tô màu badge cho đẹp
                                let badgeColor = 'bg-secondary';
                                if (currentRole === 'Admin') badgeColor = 'bg-danger';
                                else if (currentRole === 'Chair') badgeColor = 'bg-primary';
                                else if (currentRole === 'Reviewer') badgeColor = 'bg-warning text-dark';
                                else if (currentRole === 'Author') badgeColor = 'bg-success';

                                // Kiểm tra xem có phải là tài khoản Admin chính không (để chặn sửa)
                                const isSuperAdmin = user.email === 'admin@uth.edu.vn';

                                return (
                                    <tr key={user.id}>
                                        <td className="ps-3 fw-bold text-black-50">#{user.id}</td>
                                        <td className="fw-medium">{user.email}</td>
                                        <td>{user.full_name || "---"}</td>
                                        <td>
                                            <span className={`badge ${badgeColor} px-3 py-2 rounded-pill`}>
                                                {currentRole}
                                            </span>
                                        </td>
                                        <td>
                                            <select 
                                                className="form-select form-select-sm border-primary" 
                                                style={{width: '150px', cursor: isSuperAdmin ? 'not-allowed' : 'pointer'}}
                                                value={currentRole}
                                                onChange={(e) => handleChangeRole(user.id, e.target.value)}
                                                disabled={isSuperAdmin} // Chặn không cho sửa admin chính
                                                title={isSuperAdmin ? "Không thể thay đổi quyền của Admin chính" : "Đổi quyền"}
                                            >
                                                <option value="Admin">Admin</option>
                                                <option value="Author">Author</option>
                                                <option value="Reviewer">Reviewer</option>
                                                <option value="Chair">Chair</option>
                                            </select>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;