import axiosClient from "./axiosClient";

const BASE = "/submission/submissions";

export async function listMySubmissions() {
  const res = await axiosClient.get(BASE);
  return res.data;
}

export async function submitPaper({ metadata, file }) {
  const fd = new FormData();
  fd.append("metadata", JSON.stringify(metadata));
  fd.append("file", file);

  const res = await axiosClient.post(`${BASE}/`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}

export const updatePaperDetails = async (paperId, updateData) => {
  const res = await axiosClient.put(`${BASE}/${paperId}`, updateData);
  return res?.data ?? res;
};

export const getSubmissionById = async (paperId) => {
  const res = await axiosClient.get(`${BASE}/${paperId}`);
  return res?.data ?? res;
};

export const withdrawSubmission = async (paperId) => {
  const res = await axiosClient.post(`${BASE}/${paperId}/withdraw`);
  return res?.data ?? res;
};

export const addSubmissionAuthor = async (paperId, authorData) => {
  const res = await axiosClient.post(`${BASE}/${paperId}/authors`, authorData);
  return res?.data ?? res;
};

export const deleteSubmissionAuthor = async (paperId, authorId) => {
  const res = await axiosClient.delete(`${BASE}/${paperId}/authors/${authorId}`);
  return res?.data ?? res;
};

export const uploadNewVersion = async ({ paperId, file }) => {
  const fd = new FormData();
  fd.append("file", file);

  const res = await axiosClient.post(`${BASE}/${paperId}/file`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res?.data ?? res;
};

// Upload camera-ready -> /{paper_id}/camera-ready (chỉ ACCEPTED)
export const uploadCameraReady = async ({ paperId, file }) => {
  const fd = new FormData();
  fd.append("file", file);

  const res = await axiosClient.post(`${BASE}/${paperId}/camera-ready`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res?.data ?? res;
};

// Update author -> PUT /{paper_id}/authors/{author_id}
export const updateSubmissionAuthor = async (paperId, authorId, authorData) => {
  const res = await axiosClient.put(`${BASE}/${paperId}/authors/${authorId}`, authorData);
  return res?.data ?? res;
};

