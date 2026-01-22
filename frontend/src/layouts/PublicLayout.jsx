import { Outlet } from 'react-router-dom';

const PublicLayout = () => {
  return (
    <div className="public-layout">
      {/* Header công khai có thể để ở đây */}
      <main>
        <Outlet /> {/* Nơi nội dung con hiển thị */}
      </main>
    </div>
  );
};
export default PublicLayout;