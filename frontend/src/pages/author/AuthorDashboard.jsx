import React from 'react';
import { useAuth } from '../../context/AuthContext'; 

const AuthorDashboard = () => {
    const { user, logout } = useAuth();

    return (
        <div className="container mt-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="text-success">Dashboard Tác Giả</h2>
                    <p className="text-muted">Xin chào, {user?.full_name || user?.sub}!</p>
                </div>
                <button onClick={logout} className="btn btn-outline-danger">Đăng xuất</button>
            </div>

            <div className="row">
                <div className="col-md-6">
                    <div className="card text-white bg-success mb-3">
                        <div className="card-header">Bài báo của tôi</div>
                        <div className="card-body">
                            <h5 className="card-title">0 Bài báo</h5>
                            <p className="card-text">Bạn chưa nộp bài báo nào vào hệ thống.</p>
                            <button className="btn btn-light text-success fw-bold">Nộp bài mới (+)</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="alert alert-info">
                ℹ️ Đây là khu vực dành riêng cho tác giả để nộp bài và theo dõi phản biện.
            </div>
        </div>
    );
};

export default AuthorDashboard;