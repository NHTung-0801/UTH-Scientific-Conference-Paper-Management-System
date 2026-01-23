import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const HomePage = () => {
  const { user } = useAuth();

  return (
    <div className="container p-5 text-center">
      <h1 className="display-4 text-primary fw-bold mb-4">Hệ thống Quản lý Hội nghị Khoa học</h1>
      <p className="lead mb-5">Nền tảng trực tuyến hỗ trợ nộp bài, phản biện và tổ chức hội nghị chuyên nghiệp.</p>
      
      <div className="d-flex justify-content-center gap-3">
        {user ? (
          <div className="alert alert-success">
            Bạn đã đăng nhập với vai trò: <strong>{user.roles?.join(', ')}</strong>
          </div>
        ) : (
          <>
            <Link to="/login" className="btn btn-primary btn-lg px-4">Đăng Nhập</Link>
            <Link to="/register" className="btn btn-outline-secondary btn-lg px-4">Đăng Ký</Link>
          </>
        )}
      </div>
    </div>
  );
};

export default HomePage;