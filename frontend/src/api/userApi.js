// src/api/userApi.js
import axiosClient from "./axiosClient";

export const updateMe = async (payload) => {
  return axiosClient.put("/identity/api/users/me", payload);
};
