import { jwtDecode } from "jwt-decode";

// Định nghĩa key lưu trong localStorage để dùng chung, tránh gõ sai
const TOKEN_KEY = 'access_token';

// 1. Lấy Token (Dùng cho axiosClient và kiểm tra đăng nhập)
export const getToken = () => {
    return localStorage.getItem(TOKEN_KEY);
};

// 2. Lưu Token (Dùng sau khi Login thành công)
export const setToken = (token) => {
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    }
};

// 3. Xóa Token (Dùng khi Logout hoặc Token hết hạn)
export const removeToken = () => {
    localStorage.removeItem(TOKEN_KEY);
};

// 4. Lấy Role của User (Logic của bạn)
export const getUserRole = () => {
    const token = getToken();
    if (!token) return null;

    try {
        const decoded = jwtDecode(token);
        const roles = Array.isArray(decoded.roles) ? decoded.roles : [decoded.roles];


        if (roles.includes("Admin")) return "Admin";
        if (roles.includes("Chair")) return "Chair";
        if (roles.includes("Reviewer")) return "Reviewer";
        if (roles.includes("Author")) return "Author";

        return "Author";

    } catch (error) {
        console.error("Lỗi giải mã token:", error);
        return null;
    }
};

// 5. Lấy toàn bộ thông tin User (Email, ID...) nếu cần hiển thị lên Header
export const getUserInfo = () => {
    const token = getToken();
    if (!token) return null;
    try {
        return jwtDecode(token);
    } catch (error) {
        return null;
    }
};

// 6. Kiểm tra xem User đã đăng nhập và Token còn hạn không
export const isAuthenticated = () => {
    const token = getToken();
    if (!token) return false;

    try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        if (decoded.exp < currentTime) {
            removeToken();
            return false;
        }
        return true;
    } catch (error) {
        return false;
    }
};

// 7. Hàm Logout
export const logout = () => {
    removeToken();
    window.location.href = '/login';
};