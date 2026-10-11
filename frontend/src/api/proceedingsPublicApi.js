import axiosClient from "./axiosClient";

const BASE = "/submission/submissions";

const proceedingsPublicApi = {
  getMeta: (conferenceId) =>
    axiosClient.get(`${BASE}/public/conference/${conferenceId}/proceedings`),

  getPapers: (conferenceId) =>
    axiosClient.get(`${BASE}/public/conference/${conferenceId}/proceedings/papers`),

  exportFile: (conferenceId, format = "csv") =>
    axiosClient.get(
      `${BASE}/public/conference/${conferenceId}/proceedings/export?format=${format}`,
      { responseType: "blob" }
    ),

  exportPdf: (conferenceId) =>
    axiosClient.get(
      `${BASE}/public/conference/${conferenceId}/proceedings/export?format=pdf`,
      { responseType: "blob", headers: { Accept: "application/pdf" } }
    ),

};

export default proceedingsPublicApi;
