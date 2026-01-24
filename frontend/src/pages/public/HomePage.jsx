import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import conferenceApi from '../../api/conferenceApi';

const HomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(true);

  // Giả lập dữ liệu thông báo (Hoặc gọi API nếu có)
  const notifications = [
    { id: 1, title: "Thông báo gia hạn nộp bài tóm tắt đến 20/10", date: "05/10/2025" },
    { id: 2, title: "Hướng dẫn định dạng bài báo chuẩn IEEE", date: "01/10/2025" },
  ];

  // Fetch dữ liệu hội nghị từ Database khi vào trang
  useEffect(() => {
    const fetchConferences = async () => {
      try {
        // Gọi API lấy danh sách (Giả sử backend đã có)
        // Nếu chưa có backend, ta dùng dữ liệu giả ở dưới catch để test giao diện
        const res = await conferenceApi.getAll({ limit: 3 });
        setConferences(res.data || res); 
      } catch (error) {
        console.error("Lỗi tải hội nghị:", error);
        // Dữ liệu giả lập để bạn xem giao diện trước khi nối API
        setConferences([
            { id: 1, title: "Hội nghị CNTT & Chuyển đổi số 2025", location: "Hội trường A, UTH", date: "2025-11-20", topic: "AI & Big Data" },
            { id: 2, title: "Hội thảo Khoa học Giao thông Vận tải", location: "Hội trường C", date: "2025-12-15", topic: "Logistics" },
            { id: 3, title: "Diễn đàn Công nghệ Phần mềm", location: "Online (Zoom)", date: "2026-01-10", topic: "Software Engineering" },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchConferences();
  }, []);

  const handleSubmitPaper = (confId) => {
      if (!user) {
          alert("Vui lòng đăng nhập để nộp bài!");
          navigate('/login');
      } else {
          // Chuyển hướng đến trang nộp bài kèm ID hội nghị
          navigate(`/author/submit?conferenceId=${confId}`);
      }
  };

  return (
    <div>
        {/* 1. HERO SECTION (Banner) */}
        <section className="bg-red-light py-5">
            <div className="container py-5 text-center">
                <h1 className="display-4 fw-bolder mb-3" style={{color: '#d32f2f'}}>
                    HỆ THỐNG QUẢN LÝ HỘI NGHỊ KHOA HỌC
                </h1>
                <p className="lead text-muted mb-4">
                    Kết nối nhà nghiên cứu - Chia sẻ tri thức - Thúc đẩy sáng tạo
                </p>
                {!user && (
                    <Link to="/register" className="btn btn-primary btn-lg px-5 rounded-pill shadow">
                        Tham gia ngay
                    </Link>
                )}
            </div>
        </section>

        {/* 2. THÔNG BÁO MỚI NHẤT */}
        <section className="container mt-5">
            <div className="d-flex align-items-center mb-3">
                <div className="bg-danger text-white px-3 py-1 rounded me-3 fw-bold">Thông báo</div>
                <div className="flex-grow-1 border-bottom border-danger"></div>
            </div>
            <ul className="list-group list-group-flush shadow-sm">
                {notifications.map(notif => (
                    <li key={notif.id} className="list-group-item d-flex justify-content-between align-items-center action-hover">
                        <a href="#" className="text-decoration-none text-dark fw-medium hover-red">
                            <i className="bi bi-megaphone me-2 text-danger"></i> {notif.title}
                        </a>
                        <span className="badge bg-light text-secondary rounded-pill">{notif.date}</span>
                    </li>
                ))}
            </ul>
        </section>

        {/* 3. HỘI NGHỊ ĐANG DIỄN RA (Lấy từ DB) */}
        <section className="py-5 bg-white">
            <div className="container">
                <h2 className="text-center fw-bold mb-5" style={{color: '#b71c1c'}}>
                    <i className="bi bi-calendar-check me-2"></i>Hội Nghị Đang Diễn Ra
                </h2>
                
                <div className="row g-4">
                    {loading ? <p className="text-center">Đang tải dữ liệu...</p> : conferences.map((conf) => (
                        <div key={conf.id} className="col-md-4">
                            <div className="card h-100 shadow-sm border-0 hover-lift">
                                {/* Ảnh giả lập */}
                                <div style={{height: '150px', backgroundColor: '#ffebee', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                    <i className="bi bi-display fs-1 text-danger"></i>
                                </div>
                                <div className="card-body">
                                    <h5 className="card-title fw-bold text-dark">{conf.title}</h5>
                                    <p className="card-text small text-muted mb-2">
                                        <i className="bi bi-geo-alt-fill me-1 text-danger"></i> {conf.location}
                                    </p>
                                    <p className="card-text small text-muted">
                                        <i className="bi bi-clock-fill me-1 text-danger"></i> {conf.date}
                                    </p>
                                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill">
                                        {conf.topic}
                                    </span>
                                </div>
                                <div className="card-footer bg-white border-top-0 d-flex justify-content-between pb-3">
                                    <Link to={`/conference/${conf.id}`} className="btn btn-outline-secondary btn-sm">
                                        <i className="bi bi-eye me-1"></i>Xem chi tiết
                                    </Link>
                                    <button 
                                        onClick={() => handleSubmitPaper(conf.id)}
                                        className="btn btn-primary btn-sm"
                                    >
                                        <i className="bi bi-file-earmark-arrow-up me-1"></i>Nộp bài
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="text-center mt-4">
                    <button className="btn btn-link text-danger">Xem tất cả hội nghị &rarr;</button>
                </div>
            </div>
        </section>

        {/* 4. HƯỚNG DẪN NỘP BÀI (File yêu cầu) */}
        <section className="py-5" style={{backgroundColor: '#fff5f5'}}>
            <div className="container">
                <div className="row align-items-center">
                    <div className="col-lg-6">
                        <h3 className="fw-bold mb-4 text-danger">Quy định & Hướng dẫn Nộp bài</h3>
                        <div className="alert bg-white border shadow-sm">
                            <h5 className="fw-bold"><i className="bi bi-file-earmark-word me-2 text-primary"></i>Yêu cầu định dạng</h5>
                            <p className="small mb-2">Bài báo phải được soạn thảo bằng Microsoft Word hoặc LaTeX theo mẫu quy định của UTH.</p>
                            <ul className="small text-muted mb-3">
                                <li>Độ dài: 6-10 trang A4.</li>
                                <li>Font chữ: Times New Roman, size 12.</li>
                                <li>Không chứa thông tin tác giả (để phản biện kín).</li>
                            </ul>
                            <div className="d-flex gap-2">
                                <button className="btn btn-sm btn-outline-danger">
                                    <i className="bi bi-download me-1"></i>Tải Template Word
                                </button>
                                <button className="btn btn-sm btn-outline-dark">
                                    <i className="bi bi-download me-1"></i>Tải Template LaTeX
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="col-lg-6">
                         {/* Có thể thêm ảnh minh họa quy trình nộp bài ở đây */}
                         <div className="p-4 border rounded bg-white text-center">
                            <h5 className="fw-bold mb-3">Quy trình xử lý</h5>
                            <div className="d-flex justify-content-between small text-center">
                                <div>
                                    <div className="badge bg-danger rounded-circle p-3 mb-2">1</div>
                                    <br/>Nộp bài
                                </div>
                                <div className="align-self-center text-muted">&rarr;</div>
                                <div>
                                    <div className="badge bg-secondary rounded-circle p-3 mb-2">2</div>
                                    <br/>Sơ duyệt
                                </div>
                                <div className="align-self-center text-muted">&rarr;</div>
                                <div>
                                    <div className="badge bg-secondary rounded-circle p-3 mb-2">3</div>
                                    <br/>Phản biện
                                </div>
                                <div className="align-self-center text-muted">&rarr;</div>
                                <div>
                                    <div className="badge bg-success rounded-circle p-3 mb-2">4</div>
                                    <br/>Kết quả
                                </div>
                            </div>
                         </div>
                    </div>
                </div>
            </div>
        </section>

        {/* 5. MỐC THỜI GIAN */}
        <section className="py-5 bg-white">
            <div className="container text-center py-3">
                <h3 className="fw-bold mb-4 text-dark">Mốc Thời Gian Quan Trọng</h3>
                <div className="row justify-content-center">
                    <div className="col-md-3 mb-3">
                        <div className="p-3 border-start border-4 border-danger bg-light text-start h-100">
                            <h4 className="text-danger fw-bold">15/10</h4>
                            <span className="text-muted">Hạn chót nộp Abstract</span>
                        </div>
                    </div>
                    <div className="col-md-3 mb-3">
                        <div className="p-3 border-start border-4 border-warning bg-light text-start h-100">
                            <h4 className="text-warning text-dark fw-bold">01/11</h4>
                            <span className="text-muted">Thông báo Sơ duyệt</span>
                        </div>
                    </div>
                    <div className="col-md-3 mb-3">
                        <div className="p-3 border-start border-4 border-success bg-light text-start h-100">
                            <h4 className="text-success fw-bold">20/11</h4>
                            <span className="text-muted">Hạn chót Full Paper</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </div>
  );
};

export default HomePage;