// src/api/notificationApi.js
import axiosClient from "./axiosClient";

const NOTI_PREFIX = process.env.REACT_APP_NOTIFICATION_PREFIX || "/notification";

<<<<<<< HEAD
=======
// ⚠️ Khuyến nghị: đừng set interceptor ở đây (vì file này có thể import nhiều lần)
// Nhưng nếu bạn chưa có interceptor global ở axiosClient thì có thể giữ.
>>>>>>> 759202c549372e4218642f44358647d121691d56
axiosClient.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken");

  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const notificationApi = {
  getMyInbox: async () => {
    const res = await axiosClient.get(`${NOTI_PREFIX}/api/notifications/me`);
    return res?.data ?? res;
  },

  markRead: async (id) => {
    const res = await axiosClient.put(`${NOTI_PREFIX}/api/notifications/${id}/read`);
    return res?.data ?? res;
  },
<<<<<<< HEAD
=======

>>>>>>> 759202c549372e4218642f44358647d121691d56
  getUnreadCount: async () => {
    const items = await notificationApi.getMyInbox();
    return Array.isArray(items) ? items.filter((x) => !x.is_read).length : 0;
  },
<<<<<<< HEAD
=======

  // ✅ prefs
  getMyPrefs: async () => {
    const res = await axiosClient.get(`${NOTI_PREFIX}/api/notifications/prefs/me`);
    return res?.data ?? res;
  },

  updateMyPrefs: async (payload) => {
    const res = await axiosClient.put(`${NOTI_PREFIX}/api/notifications/prefs/me`, payload);
    return res?.data ?? res;
  },
>>>>>>> 759202c549372e4218642f44358647d121691d56
};

export default notificationApi;

