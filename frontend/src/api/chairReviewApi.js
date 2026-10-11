// src/api/chairReviewApi.js
import axiosClient from "./axiosClient";

const unwrap = (res) => (res?.data !== undefined ? res.data : res);

const chairReviewApi = {
  // ===== Review service =====
  // List all assignments (chair/admin)
  listAssignments: async (params = {}) => {
    const res = await axiosClient.get("/review/assignments/", { params });
    const data = unwrap(res);
    return Array.isArray(data) ? data : [];
  },

  // List reviews by assignment_id
  listReviewsByAssignment: async (assignmentId) => {
    const res = await axiosClient.get("/review/reviews/", {
      params: { assignment_id: assignmentId },
    });
    const data = unwrap(res);
    return Array.isArray(data) ? data : [];
  },

  // ===== Submission service =====
  // Chair có quyền xem paper detail qua submission-service
  getPaperDetail: async (paperId) => {
    const res = await axiosClient.get(`/submission/submissions/${paperId}`);
    return unwrap(res);
  },

  // Ra quyết định paper (chair/admin)
  decidePaper: async (paperId, payload) => {
    // payload: {status: "ACCEPTED"|"REJECTED"|..., note?: string|null}
    const res = await axiosClient.put(`/submission/submissions/${paperId}/decision`, payload);
    return unwrap(res);
  },
};

export default chairReviewApi;
