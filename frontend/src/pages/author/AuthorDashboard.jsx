import { logout } from '../utils/auth';

const AuthorDashboard = () => {
    return (
        <div className="container mt-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="text-success">Author (Tác Giả)</h2>
                <button onClick={logout} className="btn btn-outline-danger">Đăng xuất</button>
            </div>

            <div className="row">
                <div className="col-md-4">
                    <div className="card text-white bg-success mb-3">
                        <div className="card-header">Bài báo của tôi</div>
                        <div className="card-body">
                            <h5 className="card-title">0 Bài báo</h5>
                            <p className="card-text">Bạn chưa nộp bài báo nào.</p>
                            <button className="btn btn-light text-success fw-bold">Nộp bài mới (+)</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="alert alert-info">
                Đây là nơi bạn nộp bài, theo dõi trạng thái bài báo của mình.
            </div>
        </div>
    );
};

export default AuthorDashboard;