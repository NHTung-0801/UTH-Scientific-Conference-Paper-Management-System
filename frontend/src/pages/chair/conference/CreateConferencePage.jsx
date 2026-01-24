import { useState } from 'react';
import { createConference } from '../../../api/conferenceApi';
import { useNavigate } from 'react-router-dom';

const CreateConferencePage = () => {
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async () => {
    await createConference({ name });
    navigate('/chair/conferences');
  };

  return (
    <div>
      <h2>Tạo hội nghị</h2>

      <input
        placeholder="Tên hội nghị"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <button onClick={handleSubmit}>Lưu</button>
    </div>
  );
};

export default CreateConferencePage;
