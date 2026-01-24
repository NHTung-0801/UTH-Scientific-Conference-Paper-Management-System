import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getTracksByConference,
  createTrack,
  deleteTrack
} from '../../../api/trackApi';

const TrackListPage = () => {
  const { conferenceId } = useParams();
  const navigate = useNavigate();

  const [tracks, setTracks] = useState([]);
  const [name, setName] = useState('');

  const fetchTracks = async () => {
    const res = await getTracksByConference(conferenceId);
    setTracks(res.data);
  };

  useEffect(() => {
    fetchTracks();
  }, [conferenceId]);

  const handleCreate = async () => {
    if (!name) return alert('Tên track không được rỗng');

    await createTrack(conferenceId, { name });
    setName('');
    fetchTracks();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Xóa track này?')) {
      await deleteTrack(id);
      fetchTracks();
    }
  };

  return (
    <div>
      <h2>📂 Danh sách Track</h2>

      <div>
        <input
          placeholder="Tên track"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <button onClick={handleCreate}>➕ Tạo Track</button>
      </div>

      <ul>
        {tracks.map(t => (
          <li key={t.id}>
            {t.name}
            <button onClick={() =>
              navigate(`/chair/tracks/${t.id}/topics`)
            }>
              📌 Topic
            </button>
            <button onClick={() => handleDelete(t.id)}>❌</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TrackListPage;
