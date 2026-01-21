import { logout } from '../utils/auth';

const ChairDashboard = () => {
    return (
        <div className="container mt-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="text-primary">Chair(Trưởng Ban)</h2>
                <button onClick={logout} className="btn btn-outline-danger">Đăng xuất</button>
            </div>

            <div className="row">
                <div className="col-md-6">
                    <div className="card mb-3 border-primary">
                        <div className="card-body text-primary">
                            <h5 className="card-title">Thống kê hội nghị</h5>
                            <p className="card-text">Tổng số bài nộp: 15</p>
                        </div>
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="card mb-3 border-primary">
                        <div className="card-body text-primary">
                            <h5 className="card-title">Phân công Review</h5>
                            <p className="card-text">Có 3 bài chưa được phân công.</p>
                            <button className="btn btn-primary btn-sm">Xem ngay</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChairDashboard;