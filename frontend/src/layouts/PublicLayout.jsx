import React from 'react';
import { Outlet, Link } from 'react-router-dom';

const PublicLayout = () => {
  return (
    <div className="d-flex flex-column min-vh-100 font-sans-serif">
      {/* --- 🔴 HEADER / NAVBAR --- */}
      <header className="public-navbar fixed-top">
        <div className="container d-flex align-items-center justify-content-between">
            
            {/* Logo */}
            <Link to="/" className="text-decoration-none">
                <div className="navbar-brand-text">
                    <span>UTH</span> Conference
                </div>
            </Link>

            {/* Navigation Links / Buttons */}
            <nav className="d-flex align-items-center gap-3">
                {/* Các link menu khác nếu có */}
                {/* <Link to="/about" className="fw-bold text-secondary mx-2">Giới thiệu</Link> */}

                <div className="d-flex gap-2 ms-4">
                    <Link to="/login" className="btn btn-outline-primary px-4 rounded-pill">
                        Đăng nhập
                    </Link>
                    <Link to="/register" className="btn btn-primary px-4 rounded-pill shadow-sm">
                        Đăng ký ngay
                    </Link>
                </div>
            </nav>
        </div>
      </header>

      {/* --- MAIN CONTENT (Chừa chỗ cho header cố định) --- */}
      <main className="flex-grow-1" style={{ marginTop: '80px' }}>
        <Outlet />
      </main>

      {/* --- FOOTER --- */}
      <footer className="public-footer text-center">
        <div className="container">
            <div className="row">
                <div className="col-md-12 mb-3">
                    <h5 className="text-uppercase fw-bold" style={{color: 'var(--theme-red-primary)'}}>UTH Scientific Conference</h5>
                    <p className="small text-white-50">Hệ thống quản lý và tổ chức hội nghị khoa học trực tuyến.</p>
                </div>
            </div>
            <hr className="border-secondary" />
            <div className="small text-white-50">
                © {new Date().getFullYear()} UTH. All rights reserved.
            </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;