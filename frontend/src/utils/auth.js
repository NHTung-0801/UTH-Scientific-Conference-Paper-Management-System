// src/utils/auth.js
import { jwtDecode } from "jwt-decode"; 

export const getUserRole = () => {
    const token = localStorage.getItem('access_token');
    if (!token) return null;
    
    try {
        const decoded = jwtDecode(token);
        const roles = decoded.roles || [];

        // --- SỬA ĐOẠN NÀY ---
        // Kiểm tra theo thứ tự ưu tiên (Role nào to nhất thì lấy)
        // Để khớp với switch-case bên Login.jsx
        if (roles.includes("Admin")) return "Admin";
        if (roles.includes("Chair")) return "Chair";
        if (roles.includes("Reviewer")) return "Reviewer";
        if (roles.includes("Author")) return "Author";
        
        // Mặc định nếu không tìm thấy quyền nào khớp
        return "Author"; 
        
    } catch (error) {
        return null;
    }
};

export const logout = () => {
    localStorage.removeItem('access_token');
    window.location.href = '/login';
};