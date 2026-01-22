import axiosClient from './axiosClient';

const authApi = {
  // 1. Đăng ký tài khoản
  register: (data) => {
    return axiosClient.post('/auth/register', data);
  },

  // 2. Đăng nhập (Dùng URLSearchParams cho chuẩn OAuth2 của FastAPI)
  login: (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email); 
    formData.append('password', password);

    return axiosClient.post('/auth/token', formData);
  },

  getMe: () => {
    return axiosClient.get('/users/me');
  },
  logout: () => {
    return axiosClient.post('/auth/logout');
  }
};

export default authApi;