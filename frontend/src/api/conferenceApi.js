// src/api/conferenceApi.js
import axiosClient from "./axiosClient";
import proceedingsPublicApi from "./proceedingsPublicApi"; 

const SERVICE_PREFIX = "/conference/api/conferences";
const ASSIGNMENTS_PREFIX = "/conference/api/conference-assignments";
const PHASE_PREFIX = (conferenceId) => `${SERVICE_PREFIX}/${conferenceId}`;

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8080";

const unwrap = (res) => (res?.data !== undefined ? res.data : res);

const normalizeTime = (t) => {
  if (!t) return "";
  return t.length === 5 ? `${t}:00` : t; // HH:MM -> HH:MM:SS
};

function toPublicFileUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  let p = String(raw).trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (!p.startsWith("/uploads/")) p = `/uploads${p}`;
  return `${API_BASE}${encodeURI(p)}`;
}

function normalizeConferenceList(payload) {
  // backend có thể trả mảng [] hoặc object {items: []} hoặc {data: []}
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

const conferenceApi = {
  createConference: async (data) => {
    const formData = new FormData();

    formData.append("name", data.name);
    formData.append("description", data.description || "");
    formData.append("start_date", data.startDate);
    formData.append("start_time", normalizeTime(data.startTime));
    formData.append("end_date", data.endDate);
    formData.append("end_time", normalizeTime(data.endTime));

    if (data.logo instanceof File) formData.append("logo", data.logo);

    const res = await axiosClient.post(`${SERVICE_PREFIX}/`, formData);
    return unwrap(res);
  },

  getAllConferences: async () => {
    const res = await axiosClient.get(`${SERVICE_PREFIX}/`);
    return unwrap(res);
  },

  getConferenceById: async (id) => {
    const res = await axiosClient.get(`${SERVICE_PREFIX}/${id}`);
    return unwrap(res);
  },

  getAllAssignments: async () => {
    const res = await axiosClient.get(`${ASSIGNMENTS_PREFIX}/`);
    return unwrap(res);
  },

  updateConference: async (id, data) => {
    const formData = new FormData();

    if (data.name !== undefined) formData.append("name", data.name);
    if (data.description !== undefined) formData.append("description", data.description);

    if (data.start_date !== undefined) formData.append("start_date", data.start_date);
    if (data.start_time !== undefined) formData.append("start_time", data.start_time);

    if (data.end_date !== undefined) formData.append("end_date", data.end_date);
    if (data.end_time !== undefined) formData.append("end_time", data.end_time);

    if (data.logo instanceof File) formData.append("logo", data.logo);

    const res = await axiosClient.put(`${SERVICE_PREFIX}/${id}`, formData);
    return unwrap(res);
  },

  deleteConference: async (id) => {
    const res = await axiosClient.delete(`${SERVICE_PREFIX}/${id}`);
    return unwrap(res);
  },

  getTracksByConference: async (conferenceId) => {
    const res = await axiosClient.get(`/conference/api/tracks/conference/${conferenceId}`);
    return unwrap(res);
  },

  getConferencePhase: async (conferenceId) => {
    const res = await axiosClient.get(`${PHASE_PREFIX(conferenceId)}/phase`);
    return unwrap(res);
  },

  // ✅ chỉ giữ 1 bộ open/close camera ready (tránh bị đè)
  openCameraReady: async (conferenceId, deadline = null) => {
    const res = await axiosClient.put(`${PHASE_PREFIX(conferenceId)}/camera-ready/open`, {
      deadline: deadline || null,
    });
    return unwrap(res);
  },

  closeCameraReady: async (conferenceId) => {
    const res = await axiosClient.put(`${PHASE_PREFIX(conferenceId)}/camera-ready/close`);
    return unwrap(res);
  },

  getPhase: async (id) => {
    const res = await axiosClient.get(`${SERVICE_PREFIX}/${id}/phase`);
    return unwrap(res);
  },

  // =========================================================
  // ✅ NEW: list kỷ yếu đã publish để hiển thị tab Kỷ yếu ở Home
  // =========================================================
  /**
   * Trả về danh sách "proceedings" đã publish để render HomePage.
   * - Lấy danh sách conferences
   * - Với mỗi conference, gọi proceedingsPublicApi.getMeta(conferenceId)
   *   (nếu 404 => chưa publish => bỏ qua)
   *
   * Output item:
   * {
   *  conference_id,
   *  conference_name,
   *  start_date, end_date,
   *  logo_url,
   *  proceedings_title,
   *  published_date,
   *  cover_image_url,
   *  isbn_issn, publisher, volume
   * }
   */
  getPublishedProceedingsForHome: async () => {
    const confPayload = await conferenceApi.getAllConferences();
    const confs = normalizeConferenceList(confPayload);

    const jobs = confs.map(async (c) => {
      const conferenceId = Number(c?.id);
      if (!conferenceId) return null;

      try {
        const meta = await proceedingsPublicApi.getMeta(conferenceId);

        return {
          conference_id: conferenceId,
          conference_name: c?.name || `Conference #${conferenceId}`,
          start_date: c?.start_date || c?.startDate || null,
          end_date: c?.end_date || c?.endDate || null,
          logo_url: toPublicFileUrl(c?.logo_url || c?.logo || c?.logo_path || ""),

          proceedings_title: meta?.title || "Proceedings",
          published_date: meta?.published_date || null,
          cover_image_url: meta?.cover_image_url || "",
          isbn_issn: meta?.isbn_issn || "",
          publisher: meta?.publisher || "",
          volume: meta?.volume || "",
        };
      } catch (e) {
        // 404 / chưa publish => bỏ qua
        return null;
      }
    });

    const settled = await Promise.allSettled(jobs);
    const list = settled
      .filter((x) => x.status === "fulfilled" && x.value)
      .map((x) => x.value);

    list.sort((a, b) => new Date(b.published_date || 0) - new Date(a.published_date || 0));
    return list;
  },
};

export default conferenceApi;
