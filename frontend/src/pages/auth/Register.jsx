import { useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useNavigate, Link } from 'react-router-dom';

const Register = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
        organization: '' // Thêm trường này nếu Backend có
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        try {
            // Đăng ký thì gửi JSON bình thường
            await axiosClient.post('/auth/register', formData, {
                headers: { 'Content-Type': 'application/json' }
            });
            alert("Đăng ký thành công! Vui lòng đăng nhập.");
            navigate('/login');
        } catch (err) {
            // Lấy lỗi chi tiết từ backend trả về
            const msg = err.response?.data?.detail || "Đăng ký thất bại!";
            setError(msg);
        }
    };

    return (
        <div className="container d-flex justify-content-center align-items-center vh-100">
            <div className="card shadow p-4" style={{ width: '400px' }}>
                <h3 className="text-center mb-4 text-primary">Đăng Ký Tài Khoản</h3>
                
                {error && <div className="alert alert-danger p-2">{error}</div>}
                
                <form onSubmit={handleRegister}>
                    <div className="mb-3">
                        <label className="form-label">Email:</label>
                        <input type="email" name="email" className="form-control" 
                               required onChange={handleChange} />
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Họ và tên:</label>
                        <input type="text" name="full_name" className="form-control" 
                               required onChange={handleChange} />
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Mật khẩu:</label>
                        <input type="password" name="password" className="form-control" 
                               required onChange={handleChange} />
                    </div>
                    
                    <button type="submit" className="btn btn-primary w-100 mb-3">Đăng Ký</button>
                    
                    <div className="text-center">
                        <small>Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link></small>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Register;