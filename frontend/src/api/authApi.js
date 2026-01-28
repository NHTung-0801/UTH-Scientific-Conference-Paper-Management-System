import axiosClient from "./axiosClient";

const authApi = {
  
  login: (data) => {
    return axiosClient.post("/identity/api/auth/login", data);
  },

  register: (data) => {
    return axiosClient.post("/identity/api/auth/register", data);
  },

  getMe: () => {
    return axiosClient.get("/identity/api/users/me");
  },

  forgotPassword: (email) => {
    return axiosClient.post("/identity/api/auth/forgot-password", { email });
  },

  verifyOtp: (data) => {
    return axiosClient.post("/identity/api/auth/verify-otp", data);
  },

  resetPassword: (data) => {
    return axiosClient.post("/identity/api/auth/reset-password", data);
  },
  changePassword: (data) => {
    return axiosClient.post("/identity/api/auth/change-password", data);
  },
  getUserById: (id) => {
    return axiosClient.get(`/identity/api/users/${id}`);
  },
};

export default authApi;