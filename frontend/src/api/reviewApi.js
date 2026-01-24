import axiosClient from "./axiosClient";

const reviewApi = {
  listAssignments: ({ reviewerId, paperId } = {}) => {
    return axiosClient.get("/review/assignments/", {
      params: {
        reviewer_id: reviewerId ?? undefined,
        paper_id: paperId ?? undefined,
      },
    });
  },

  getAssignment: (assignmentId) => axiosClient.get(`/review/assignments/${assignmentId}/`),
  updateAssignment: (assignmentId, payload) =>
    axiosClient.patch(`/review/assignments/${assignmentId}/`, payload),

  getPaperPdfUrlByAssignment: (assignmentId) =>
    axiosClient.get(`/review/assignments/${assignmentId}/paper-pdf/`),

  listReviews: ({ assignmentId } = {}) =>
    axiosClient.get("/review/reviews/", {
      params: { assignment_id: assignmentId ?? undefined },
    }),

  createReview: (payload) => axiosClient.post("/review/reviews/", payload),
  getReview: (reviewId) => axiosClient.get(`/review/reviews/${reviewId}/`),
  updateReview: (reviewId, payload) => axiosClient.patch(`/review/reviews/${reviewId}/`, payload),

  addCriteria: (reviewId, payload) =>
    axiosClient.post(`/review/reviews/${reviewId}/criterias/`, payload),

  listDiscussionsByPaper: (paperId) =>
    axiosClient.get(`/review/discussions/paper/${paperId}/`),
  createDiscussion: (payload) => axiosClient.post("/review/discussions/", payload),
};

export default reviewApi;
