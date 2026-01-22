import axiosClient from './axiosClient';

const BASE_URL = process.env.REACT_APP_NOTIFICATION_URL;

const notificationApi = {
  getMyNotifications: () => {
    return axiosClient.get(`${BASE_URL}/notifications/my-notifications`);
  },

  markAsRead: (id) => {
    return axiosClient.put(`${BASE_URL}/notifications/${id}/read`);
  }
};

export default notificationApi;