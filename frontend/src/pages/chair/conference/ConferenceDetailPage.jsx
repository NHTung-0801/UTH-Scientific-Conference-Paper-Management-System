import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  getConferenceById,
  getTracksByConference,
  createTrack
} from '../../../api/conferenceApi';

const ConferenceDetailPage = () => {
  const { id } = useParams();
  const [conference, setConference] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [trackName, setTrackName] = useState('');

  useEffect(() => {
    getConferenceById(id).then(res => setConference(res.data));
    getTracksByConference(id).then(res => setTracks(res.data));
  }, [id]);

  const handleAddTrack = async () => {
    await createTrack(id, { name: trackName });
    const res = await getTracksByConference(id);
    setTracks(res.data);
    setTrackName('');
  };

  if (!conference) return <div>Loading...</div>;

  return (
    <div>
      <h2>{conference.name}</h2>

      <h3>Tracks</h3>
      <ul>
        {tracks.map(t => (
          <li key={t.id}>{t.name}</li>
        ))}
      </ul>

      <input
        placeholder="Tên track"
        value={trackName}
        onChange={e => setTrackName(e.target.value)}
      />
      <button onClick={handleAddTrack}>➕ Thêm track</button>
    </div>
  );
};

export default ConferenceDetailPage;
