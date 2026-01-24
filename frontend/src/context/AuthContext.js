// Ghi nhớ phiên đăng nhập

import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from "jwt-decode"; 
import authApi from '../api/authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleToken = (token) => {
    if (!token) return;

    try {
      const decoded = jwtDecode(token);

      const normalizedUser = {
        ...decoded,
        id: decoded.id ?? decoded.user_id ?? decoded.sub, // ✅ thống nhất id
        full_name: decoded.full_name ?? decoded.name ?? decoded.email,
      };

      setUser(normalizedUser);
      localStorage.setItem("access_token", token);
    } catch (e) {
      console.error("Token lỗi:", e);
      logout();
    }
  };



  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      handleToken(token);
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    const access_token = res?.data?.access_token;
    handleToken(access_token);

    if (!access_token) {
      console.error("Login response:", res?.data ?? res);
      throw new Error("Server không trả access_token");
    }

    handleToken(access_token);
    return true;
  };



  const logout = () => {
    localStorage.removeItem('access_token');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);