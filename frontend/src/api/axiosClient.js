
import axios from 'axios';
// Import các hàm tiện ích auth (đảm bảo bạn đã tạo file này ở bước trước)
import { getToken, removeToken } from '../utils/auth';

const axiosClient = axios.create({
    // Ưu tiên lấy từ biến môi trường, nếu không có thì dùng localhost
    baseURL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- Interceptor: Xử lý trước khi gửi Request ---
axiosClient.interceptors.request.use(async (config) => {
    // Lấy token từ localStorage thông qua hàm tiện ích
    const token = getToken();

    // Log để debug (có thể comment lại khi lên production)
    console.log(`🚀 Request to: ${config.baseURL}${config.url}`);
    
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log("🔑 Token attached: YES");
    } else {
        console.log("🔑 Token attached: NO");
    }

    return config;
}, (error) => {
    return Promise.reject(error);
});

axiosClient.interceptors.response.use((response) => {
    return response;
}, (error) => {
    const { response } = error;

    if (response && response.status === 401) {
        console.error("⛔ Lỗi 401: Token hết hạn hoặc không hợp lệ. Đang đăng xuất...");
        
        removeToken();
        window.location.href = '/login';
    }

    return Promise.reject(error);
});

export default axiosClient;