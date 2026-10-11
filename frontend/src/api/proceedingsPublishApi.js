import axiosClient from "./axiosClient";

const BASE = "/submission/submissions";

const proceedingsPublishApi = {
  // meta
  getMeta: (conferenceId) =>
    axiosClient.get(`${BASE}/conference/${conferenceId}/proceedings/meta`),

  getPapers: (conferenceId) =>
    axiosClient.get(`${BASE}/public/conference/${conferenceId}/proceedings/papers`),

  saveMeta: (conferenceId, payload) =>
    axiosClient.put(`${BASE}/conference/${conferenceId}/proceedings/meta`, payload),

  // upload cover (multipart)
  uploadCover: (conferenceId, file) => {
    const form = new FormData();
    form.append("file", file);
    return axiosClient.post(
      `${BASE}/conference/${conferenceId}/proceedings/cover`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },

  // set selected papers
  setPapers: (conferenceId, paperIds) =>
    axiosClient.put(`${BASE}/conference/${conferenceId}/proceedings/papers`, {
      paper_ids: paperIds,
    }),

  publish: (conferenceId) =>
    axiosClient.post(`${BASE}/conference/${conferenceId}/proceedings/publish`),

  unpublish: (conferenceId) =>
    axiosClient.post(`${BASE}/conference/${conferenceId}/proceedings/unpublish`),

  // list camera-ready (để tick chọn)
  listCameraReadyStatus: (conferenceId) =>
    axiosClient.get(`${BASE}/conference/${conferenceId}/camera-ready-status`),

  listCameraReadyStatusAll: () =>
  axiosClient.get(`${BASE}/camera-ready-status/all`),

  // export (chair)
  exportFile: (conferenceId, format = "csv", scope = "published") =>
    axiosClient.get(
      `${BASE}/conference/${conferenceId}/proceedings/export?format=${format}&scope=${scope}`,
      { responseType: "blob" }
    ),

    
};

export default proceedingsPublishApi;
