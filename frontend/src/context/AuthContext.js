// Ghi nhớ phiên đăng nhập

import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from "jwt-decode"; 
import authApi from '../api/authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleToken = (token) => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser(decoded);
        localStorage.setItem('access_token', token);
      } catch (e) {
        console.error("Token lỗi:", e);
        logout();
      }
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
    try {
      const res = await authApi.login(email, password);
      const { access_token } = res; 
      handleToken(access_token);
      return true;
    } catch (error) {
      throw error;
    }
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