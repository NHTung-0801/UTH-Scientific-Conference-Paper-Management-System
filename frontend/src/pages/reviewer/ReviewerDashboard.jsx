import React from 'react';
import { useAuth } from '../../context/AuthContext';

const ReviewerDashboard = () => {
    const { user, logout } = useAuth();

    return (
        <div className="container mt-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="text-warning text-dark">Dashboard Phản Biện</h2>
                    <p className="text-muted">Xin chào, {user?.full_name || user?.sub}!</p>
                </div>
                <button onClick={logout} className="btn btn-outline-danger">Đăng xuất</button>
            </div>

            <div className="card shadow-sm border-warning">
                <div className="card-header bg-warning text-dark fw-bold">
                    Danh sách bài cần Review
                </div>
                <div className="card-body text-center p-5">
                    <h5 className="text-muted">📭 Hiện tại chưa có bài báo nào được phân công.</h5>
                    <p>Vui lòng quay lại sau khi Trưởng ban phân công bài cho bạn.</p>
                </div>
            </div>
        </div>
    );
};

export default ReviewerDashboard;