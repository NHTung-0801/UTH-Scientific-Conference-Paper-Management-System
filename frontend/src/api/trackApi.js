import axiosClient from './axiosClient';

export const getTracksByConference = (conferenceId) => {
  return axiosClient.get(`/conferences/${conferenceId}/tracks`);
};

export const createTrack = (conferenceId, data) => {
  return axiosClient.post(`/conferences/${conferenceId}/tracks`, data);
};

export const updateTrack = (trackId, data) => {
  return axiosClient.put(`/tracks/${trackId}`, data);
};

export const deleteTrack = (trackId) => {
  return axiosClient.delete(`/tracks/${trackId}`);
};
