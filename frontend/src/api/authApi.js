import axiosClient from './axiosClient';

const BASE_URL = process.env.REACT_APP_IDENTITY_URL;

const authApi = {
  register: (data) => {
    return axiosClient.post(`${BASE_URL}/api/auth/register`, data);
  },

  login: (email, password) => {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);

    return axiosClient.post(`${BASE_URL}/api/auth/login`, formData);
  },

  getMe: () => {
    return axiosClient.get(`${BASE_URL}/users/me`);
  }
};

export default authApi;