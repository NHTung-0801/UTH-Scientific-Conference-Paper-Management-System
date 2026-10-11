// src/api/proceedingsApi.js
import axiosClient from "./axiosClient";

const BASE = "/submission/submissions"; // ✅ đúng với router prefix="/submissions" qua gateway

const unwrap = (res) => (res?.data !== undefined ? res.data : res);

const proceedingsApi = {
  listCameraReady: async (conferenceId) => {
    const res = await axiosClient.get(`${BASE}/conference/${conferenceId}/camera-ready`);
    return unwrap(res);
  },

  listCameraReadyStatus: async (conferenceId) => {
    const res = await axiosClient.get(
      `${BASE}/conference/${conferenceId}/camera-ready-status`
    );
    return unwrap(res);
  },

  getProceedings: async (conferenceId) => {
    const res = await axiosClient.get(`${BASE}/conference/${conferenceId}/proceedings`);
    return unwrap(res);
  },

  listCameraReadyStatusAll: async () => {
  const res = await axiosClient.get(`${BASE}/camera-ready-status/all`);
  return unwrap(res);
  },
  
  getPaperPublicDetailForChair: async (paperId) => {
      const res = await axiosClient.get(`${BASE}/chair/papers/${paperId}`);
      return unwrap(res);
    },

  exportProceedings: (conferenceId, format = "csv") =>
    axiosClient.get(
      `${BASE}/conference/${conferenceId}/proceedings/export?format=${format}`,
      { responseType: "blob" }
    ),

  exportProceedingsPublic: (conferenceId, format = "csv") =>
    axiosClient.get(
      `${BASE}/public/conference/${conferenceId}/proceedings/export?format=${format}`,
      { responseType: "blob" }
    ),
};

export default proceedingsApi;
