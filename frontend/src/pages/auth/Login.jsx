import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

import authApi from '../../api/authApi';
import { setToken, getUserRole } from '../../utils/auth';

import '../../assets/styles/css/App.css';

const Login = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: 'admin@uth.edu.vn',
    password: '123456',
  });

  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const redirectByRole = (role) => {
    // Normalize role để tránh lệch hoa/thường
    const r = (role || '').toString().toUpperCase();

    switch (r) {
      case 'ADMIN':
        navigate('/admin', { replace: true });
        break;
      case 'CHAIR':
        navigate('/chair', { replace: true });
        break;
      case 'REVIEWER':
        navigate('/reviewer', { replace: true });
        break;
      case 'AUTHOR':
      default:
        navigate('/author', { replace: true });
        break;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.warning('Vui lòng nhập email và mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      // ✅ Backend của bạn nhận JSON: { email, password }
      const res = await authApi.login(formData.email, formData.password);

      // Backend thường trả { access_token, token_type }
      const token = res?.data?.access_token;

      if (!token) {
        // In ra response để debug nếu backend trả format khác
        console.error('Login response:', res?.data);
        toast.error('Đăng nhập thất bại: Server không trả access_token.');
        return;
      }

      setToken(token);

      // Nếu token có role thì điều hướng theo role
      const role = getUserRole();
      toast.success('✅ Đăng nhập thành công!');

      // Nếu không lấy được role thì vẫn cho vào trang default để test
      if (!role) {
        navigate('/author', { replace: true });
        return;
      }

      redirectByRole(role);

    } catch (err) {
      console.error('Login error:', err);

      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 401) {
        toast.error('Sai email hoặc mật khẩu!');
        return;
      }

      if (status === 422) {
        // FastAPI thường có data.detail
        const detail = data?.detail;
        if (typeof detail === 'string') {
          toast.error(`Dữ liệu không hợp lệ: ${detail}`);
        } else {
          toast.error('Dữ liệu đăng nhập không hợp lệ (422).');
        }
        return;
      }

      if (status) {
        toast.error(`Lỗi server (${status}). Vui lòng thử lại.`);
      } else {
        toast.error('Không thể kết nối đến server. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Đăng Nhập</h2>
          <p>Vui lòng đăng nhập để tiếp tục</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="admin@uth.edu.vn"
              disabled={loading}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label>Mật khẩu</label>

            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Nhập mật khẩu"
                disabled={loading}
                required
                autoComplete="current-password"
                style={{ paddingRight: 60 }}
              />

              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                disabled={loading}
                aria-label="toggle password"
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: '#1a73e8',
                  fontWeight: 600,
                }}
              >
                {showPw ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? <span className="spinner">⏳ Đang đăng nhập...</span> : 'Đăng Nhập'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Chưa có tài khoản? <Link to="/register">Đăng ký tại đây</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
