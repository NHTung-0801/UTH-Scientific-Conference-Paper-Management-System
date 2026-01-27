import axiosClient from "./axiosClient";

const SERVICE_PREFIX = "/conference/tracks"; 
// ⬅️ API gateway map conference-service/tracks

const unwrap = (res) => (res?.data !== undefined ? res.data : res);

const trackApi = {
  createTrack: async (data) => {
  const formData = new FormData();
  formData.append("name", data.name);
  formData.append("description", data.description);
  formData.append("conference_id", data.conferenceId);

  const res = await axiosClient.post(
    "/conference/tracks/",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return res.data;
},


getTrackById: async (id) => {
  const res = await axiosClient.get(`/conference/tracks/${id}`);
  return res.data;
},

updateTrack: async (id, data) => {
  const formData = new FormData();
  formData.append("name", data.name);
  formData.append("description", data.description || "");

  const res = await axiosClient.put(
    `/conference/tracks/${id}`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
  return res.data;
},


deleteTrack: async (trackId) => {
  const res = await axiosClient.delete(
    `/conference/tracks/${trackId}`
  );
  return res.data;
},



};




export default trackApi;
