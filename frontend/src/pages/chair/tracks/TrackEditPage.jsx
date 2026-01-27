import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import trackApi from "../../../api/trackApi";

const TrackEditPage = () => {
  const { id } = useParams(); // trackId
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackApi.getTrackById(id).then((res) => {
      setForm({
        name: res.name,
        description: res.description || "",
      });
      setLoading(false);
    });
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await trackApi.updateTrack(id, form);
    alert("✅ Cập nhật Track thành công");
    navigate(-1); // quay lại conference detail
  };

  if (loading) return <p>Đang tải...</p>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-6">Chỉnh sửa Track</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label>Tên Track</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg"
            required
          />
        </div>

        <div>
          <label>Mô tả</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={4}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2"
          >
            Hủy
          </button>
          <button className="bg-primary text-white px-6 py-2 rounded-lg">
            Lưu
          </button>
        </div>
      </form>
    </div>
  );
};

export default TrackEditPage;
