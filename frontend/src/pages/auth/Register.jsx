import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import authApi from '../../api/authApi';
import { ROLES } from '../../utils/constants'; 
import '../../assets/styles/css/App.css'; // Đảm bảo bạn đã có file CSS này

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // State lưu dữ liệu form
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    confirm_password: '',
    // Role luôn ẩn và mặc định là AUTHOR
    role: ROLES.AUTHOR 
  });

  // Xử lý khi nhập liệu
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Hàm kiểm tra dữ liệu trước khi gửi
  const validateForm = () => {
    const { email, full_name, password, confirm_password } = formData;
    
    if (!email || !full_name || !password) {
      toast.warning("Vui lòng điền đầy đủ thông tin!");
      return false;
    }

    // Regex kiểm tra email cơ bản
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.warning("Địa chỉ Email không hợp lệ!");
      return false;
    }

    if (password.length < 6) {
      toast.warning("Mật khẩu phải có ít nhất 6 ký tự!");
      return false;
    }

    if (password !== confirm_password) {
      toast.error("Mật khẩu xác nhận không khớp!");
      return false;
    }

    return true;
  };

  // Xử lý Submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Validate Client
    if (!validateForm()) return;

    setLoading(true);
    try {
      // 2. Chuẩn bị payload (Chỉ gửi những gì Backend cần)
      const payload = {
        email: formData.email,
        full_name: formData.full_name,
        password: formData.password,
        role: formData.role // Luôn là 'AUTHOR'
      };

      // 3. Gọi API
      await authApi.register(payload);
      
      // 4. Thành công -> Chuyển hướng
      toast.success("🎉 Đăng ký thành công! Hãy đăng nhập ngay.");
      
      // Delay 1 chút để user đọc thông báo rồi mới chuyển trang
      setTimeout(() => {
        navigate('/login');
      }, 1500);

    } catch (error) {
      console.error("Register Error:", error);
      
      // 5. Xử lý lỗi từ Backend trả về
      // Backend FastAPI thường trả lỗi trong: error.response.data.detail
      if (error.response && error.response.data) {
        const { detail } = error.response.data;
        if (detail === 'Email already registered') {
          toast.error("⚠️ Email này đã được sử dụng!");
        } else {
          toast.error(`Lỗi: ${detail || "Không thể đăng ký"}`);
        }
      } else {
        toast.error("🚨 Mất kết nối đến máy chủ. Vui lòng thử lại sau.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Tạo Tài Khoản</h2>
          <p>Tham gia hệ thống quản lý bài báo khoa học UTH</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Họ và tên</label>
            <input 
              type="text" 
              name="full_name" 
              value={formData.full_name} 
              onChange={handleChange} 
              placeholder="Nguyễn Văn A"
              disabled={loading}
              required 
            />
          </div>

          <div className="form-group">
            <label>Email (Tên đăng nhập)</label>
            <input 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              placeholder="example@uth.edu.vn"
              disabled={loading}
              required 
            />
          </div>

          <div className="form-group">
            <label>Mật khẩu</label>
            <input 
              type="password" 
              name="password" 
              value={formData.password} 
              onChange={handleChange} 
              placeholder="Tối thiểu 6 ký tự"
              disabled={loading}
              required 
            />
          </div>

          <div className="form-group">
            <label>Nhập lại mật khẩu</label>
            <input 
              type="password" 
              name="confirm_password" 
              value={formData.confirm_password} 
              onChange={handleChange} 
              placeholder="Xác nhận mật khẩu"
              disabled={loading}
              required 
            />
          </div>

          <button 
            type="submit" 
            className="btn-auth"
            disabled={loading}
          >
            {loading ? <span className="spinner">⏳ Đang xử lý...</span> : 'Đăng Ký Ngay'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Bạn đã có tài khoản? <Link to="/login">Đăng nhập tại đây</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Register;