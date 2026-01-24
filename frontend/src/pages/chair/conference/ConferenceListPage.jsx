import { useEffect, useState } from 'react';
import { getAllConferences } from '../../../api/conferenceApi';
import { Link } from 'react-router-dom';

const ConferenceListPage = () => {
  const [conferences, setConferences] = useState([]);

  useEffect(() => {
    getAllConferences().then(res => {
      setConferences(res.data);
    });
  }, []);

  return (
    <div>
      <h2>Danh sách hội nghị</h2>

      <Link to="/chair/conferences/create">➕ Tạo hội nghị</Link>

      <ul>
        {conferences.map(conf => (
          <li key={conf.id}>
            <Link to={`/chair/conferences/${conf.id}`}>
              {conf.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ConferenceListPage;
