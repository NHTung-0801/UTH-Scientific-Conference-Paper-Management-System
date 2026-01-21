import { logout } from '../utils/auth';

const ReviewerDashboard = () => {
    return (
        <div className="container mt-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="text-warning">Reviewer (Phản Biện)</h2>
                <button onClick={logout} className="btn btn-outline-danger">Đăng xuất</button>
            </div>

            <div className="card shadow-sm">
                <div className="card-header bg-warning text-dark fw-bold">
                    Danh sách bài cần Review
                </div>
                <div className="card-body">
                    <p>Hiện tại chưa có bài báo nào được phân công cho bạn.</p>
                </div>
            </div>
        </div>
    );
};

export default ReviewerDashboard;