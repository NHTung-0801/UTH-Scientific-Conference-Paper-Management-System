import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient'; // Đảm bảo đúng đường dẫn
import { getUserRole, setToken } from '../../utils/auth'; // Import thêm setToken

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(''); // Reset lỗi cũ
        
        try {
            // --- KHẮC PHỤC LỖI 422 (FastAPI Requirement) ---
            // FastAPI mong đợi dữ liệu dạng 'application/x-www-form-urlencoded'
            // và trường định danh phải tên là 'username' (dù ta nhập email)
            const formData = new URLSearchParams();
            formData.append('username', email); 
            formData.append('password', password);

            // Gọi API Login
            // Axios sẽ tự động set Header Content-Type chính xác khi dùng URLSearchParams
            const res = await axiosClient.post('/auth/token', formData);
            
            // --- XỬ LÝ KẾT QUẢ ---
            // 1. Lưu token bằng hàm helper (Centralized logic)
            // Lưu ý: res.data chứa access_token trả về từ backend
            const token = res.data.access_token;
            setToken(token);

            // 2. Lấy role để điều hướng
            // Lúc này token đã nằm trong localStorage nên getUserRole sẽ hoạt động
            const role = getUserRole(); 
            
            console.log("✅ Đăng nhập thành công! Role:", role);

            // 3. Phân luồng điều hướng
            switch (role) {
                case 'Admin':
                    navigate('/admin');
                    break;
                case 'Chair':
                    navigate('/chair');
                    break;
                case 'Reviewer':
                    navigate('/reviewer');
                    break;
                case 'Author':
                    navigate('/author');
                    break;
                default:
                    // Nếu có token nhưng không xác định được role, đưa về trang default
                    navigate('/author');
            }

        } catch (err) {
            console.error("Lỗi đăng nhập:", err);
            
            // Xử lý hiển thị lỗi
            if (err.response && err.response.status === 401) {
                setError('Sai email hoặc mật khẩu! Vui lòng kiểm tra lại.');
            } else if (err.response && err.response.status === 422) {
                setError('Dữ liệu không hợp lệ (Lỗi 422). Vui lòng liên hệ Admin.');
            } else {
                setError('Không thể kết nối đến server. Vui lòng thử lại sau.');
            }
        }
    };

    return (
        <div className="container d-flex justify-content-center align-items-center vh-100">
            <div className="card shadow p-4" style={{ width: '400px', borderRadius: '10px' }}>
                <h2 className="text-center mb-4 text-primary">Đăng Nhập</h2>
                
                {error && <div className="alert alert-danger text-center" role="alert">{error}</div>}
                
                <form onSubmit={handleLogin}>
                    <div className="mb-3">
                        <label className="form-label fw-bold">Email:</label>
                        <input 
                            type="email" 
                            className="form-control" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            required 
                            placeholder="name@example.com"
                        />
                    </div>
                    <div className="mb-3">
                        <label className="form-label fw-bold">Mật khẩu:</label>
                        <input 
                            type="password" 
                            className="form-control" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                            placeholder="******"
                        />
                    </div>
                    
                    <button type="submit" className="btn btn-primary w-100 py-2 mb-3">
                        Đăng Nhập
                    </button>
                    
                    <div className="text-center">
                        <small>
                            Chưa có tài khoản? <Link to="/register" className="text-decoration-none">Đăng ký tại đây</Link>
                        </small>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;