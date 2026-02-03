// src/pages/chair/conference/ConferenceDetailPage.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import conferenceApi from "../../../api/conferenceApi";
import trackApi from "../../../api/trackApi";
import proceedingsApi from "../../../api/proceedingsApi";

const API_URL = process.env.REACT_APP_API_URL;

// ===== helpers to avoid "Objects are not valid as a React child" =====
const safeArr = (x) => (Array.isArray(x) ? x : []);

const renderAuthors = (authors) => {
  const arr = safeArr(authors);
  if (arr.length === 0) return "";

  const cor = arr.find((a) => a?.is_corresponding || a?.isCorresponding);
  const names = arr
    .map((a) => a?.full_name || a?.fullName || a?.name)
    .filter(Boolean);

  if (cor?.full_name || cor?.fullName) {
    const corName = cor.full_name || cor.fullName;
    const rest = names.filter((n) => n !== corName);
    return [`${corName} (cor.)`, ...rest].join(" • ");
  }

  return names.join(" • ");
};

const normalizeFileUrl = (raw) => {
  if (!raw) return "";
  // Nếu backend đã trả full URL thì dùng luôn
  if (/^https?:\/\//i.test(String(raw))) return String(raw);
  // Nếu là path thì ghép API_URL
  return `${API_URL || ""}${raw}`;
};

const ConferenceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [conference, setConference] = useState(null);
  const [tracks, setTracks] = useState([]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
    logo: null,
  });

  // ===== Camera-ready states =====
  const [phase, setPhase] = useState({
    camera_ready_open: false,
    camera_ready_deadline: null,
  });
  const [deadlineInput, setDeadlineInput] = useState(""); // datetime-local
  const [cameraReadyList, setCameraReadyList] = useState([]);
  const [loadingCameraReady, setLoadingCameraReady] = useState(false);

  const toDatetimeLocal = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  };

  const datetimeLocalToISO = (val) => {
    if (!val) return null;
    return new Date(val).toISOString();
  };

  const fetchPhaseAndCameraReady = async () => {
    // 1) Phase
    try {
      const ph = await conferenceApi.getConferencePhase(id);
      setPhase(ph);
      setDeadlineInput(toDatetimeLocal(ph?.camera_ready_deadline));
    } catch (e) {
      console.error("getConferencePhase error:", e);
    }

    // 2) Camera-ready list (from submission-service)
    try {
      setLoadingCameraReady(true);
      const list = await proceedingsApi.listCameraReady(id);
      setCameraReadyList(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("listCameraReady error:", e);
      setCameraReadyList([]);
    } finally {
      setLoadingCameraReady(false);
    }
  };

  const handleUpdate = async () => {
    try {
      await conferenceApi.updateConference(id, form);
      alert("Cập nhật hội nghị thành công");
      const res = await conferenceApi.getConferenceById(id);
      setConference(res);
    } catch (err) {
      console.error(err);
      alert("Cập nhật thất bại");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await conferenceApi.getConferenceById(id);
        setConference(res);

        setForm({
          name: res.name,
          description: res.description || "",
          start_date: res.start_date?.slice(0, 10) || "",
          start_time: res.start_date?.slice(11, 16) || "",
          end_date: res.end_date?.slice(0, 10) || "",
          end_time: res.end_date?.slice(11, 16) || "",
          logo: null,
        });
      } catch (e) {
        console.error(e);
      }

      try {
        const ts = await conferenceApi.getTracksByConference(id);
        setTracks(Array.isArray(ts) ? ts : []);
      } catch (e) {
        console.error(e);
        setTracks([]);
      }

      await fetchPhaseAndCameraReady();
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!conference) return <p className="p-8">Đang tải...</p>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{conference.name}</h2>

        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/chair/conferences/${id}/edit`)}
            className="px-4 py-2 border rounded-lg"
          >
            Chỉnh sửa
          </button>

          <button
            onClick={async () => {
              if (!window.confirm("Xóa hội nghị này?")) return;
              await conferenceApi.deleteConference(id);
              navigate("/chair/conferences");
            }}
            className="px-4 py-2 bg-red-500 text-white rounded-lg"
          >
            Xóa
          </button>
        </div>
      </div>

      {/* Logo (FIX đường dẫn) */}
      {conference.logo && (
        <img
          src={`${API_URL || ""}${conference.logo}`}
          alt="Conference logo"
          className="h-56 rounded-xl mb-6 object-cover"
        />
      )}

      <p className="text-slate-700 mb-8">{conference.description}</p>

      {/* Thời gian hội nghị */}
      <div className="mb-10 p-5 border rounded-xl bg-slate-50">
        <h3 className="font-bold mb-4 text-black">Thời gian hội nghị</h3>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div>
            <label className="text-sm font-medium text-black">Ngày bắt đầu</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-black bg-white
                         focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-black">Giờ bắt đầu</label>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-black bg-white
                         focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-black">Ngày kết thúc</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-black bg-white
                         focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-black">Giờ kết thúc</label>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-black bg-white
                         focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleUpdate}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Lưu thay đổi
          </button>
        </div>
      </div>

      {/* ===== Camera-ready & Proceedings (CHAIR) ===== */}
      <div className="mb-10 p-5 border rounded-xl bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-black">Camera-ready & Proceedings</h3>

          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              phase.camera_ready_open
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {phase.camera_ready_open ? "ĐANG MỞ" : "ĐANG ĐÓNG"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-black">
              Deadline camera-ready
            </label>
            <input
              type="datetime-local"
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-black bg-white
                         focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-slate-500 mt-1">
              Chair đặt deadline. Author chỉ nộp được khi camera-ready đang mở và còn hạn.
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={async () => {
                try {
                  await conferenceApi.openCameraReady(
                    id,
                    datetimeLocalToISO(deadlineInput)
                  );
                  alert("✅ Đã mở camera-ready");
                  fetchPhaseAndCameraReady();
                } catch (e) {
                  console.error(e);
                  alert("❌ Mở camera-ready thất bại");
                }
              }}
              className="px-4 py-2 rounded-lg bg-primary text-white font-bold"
            >
              Mở
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  await conferenceApi.closeCameraReady(id);
                  alert("✅ Đã đóng camera-ready");
                  fetchPhaseAndCameraReady();
                } catch (e) {
                  console.error(e);
                  alert("❌ Đóng camera-ready thất bại");
                }
              }}
              className="px-4 py-2 rounded-lg border font-bold text-slate-700 hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h4 className="font-bold text-black">Danh sách bài camera-ready</h4>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  // NOTE: nếu proceedingsApi.exportProceedings đã set responseType: 'blob'
                  // thì res chính là blob (axiosClient unwrap). Nếu chưa, giữ cách cũ.
                  const res = await proceedingsApi.exportProceedings(id, "csv");

                  // Hỗ trợ cả 2 trường hợp: res là Blob hoặc res.data là Blob
                  const blob =
                    res instanceof Blob
                      ? res
                      : res?.data instanceof Blob
                      ? res.data
                      : new Blob([res?.data ?? res], { type: "text/csv" });

                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `proceedings_conference_${id}.csv`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                } catch (e) {
                  console.error(e);
                  alert("❌ Export CSV thất bại (kiểm tra API submission-service)");
                }
              }}
              className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold"
            >
              Export CSV
            </button>

            <button
              type="button"
              onClick={() => fetchPhaseAndCameraReady()}
              className="px-3 py-2 rounded-lg border text-sm font-bold"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-3 border rounded-lg overflow-hidden">
          {loadingCameraReady ? (
            <p className="p-4 text-slate-500">Đang tải danh sách...</p>
          ) : cameraReadyList.length === 0 ? (
            <p className="p-4 text-slate-500 italic">
              Chưa có dữ liệu camera-ready (hoặc API submission-service chưa làm).
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left p-3">Paper</th>
                  <th className="text-left p-3">Trạng thái</th>
                  <th className="text-left p-3">Submitted</th>
                  <th className="text-left p-3">File</th>
                </tr>
              </thead>
              <tbody>
                {cameraReadyList.map((p) => {
                  const key = p?.paper_id || p?.id;
                  const fileUrl = normalizeFileUrl(
                    // ƯU TIÊN field đúng theo backend bạn flatten: camera_ready_file_url
                    p?.camera_ready_file_url ||
                      p?.camera_ready_file ||
                      p?.cameraReadyFileUrl ||
                      ""
                  );

                  return (
                    <tr key={key} className="border-t">
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">
                          {p.title || `Paper #${key}`}
                        </div>

                        {/* ✅ FIX: authors là array/object -> convert to string */}
                        <div className="text-xs text-slate-500">
                          {renderAuthors(p.authors)}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                          {p.status || "ACCEPTED"}
                        </span>
                      </td>

                      <td className="p-3 text-slate-700">
                        {p.camera_ready_submitted_at
                          ? new Date(p.camera_ready_submitted_at).toLocaleString()
                          : "Chưa nộp"}
                      </td>

                      <td className="p-3">
                        {fileUrl ? (
                          <a
                            className="text-blue-600 font-semibold"
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Xem file
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Tracks */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Danh sách Track</h3>
        <button
          onClick={() => navigate(`/chair/tracks/create?conferenceId=${conference.id}`)}
          className="bg-primary text-white px-4 py-2 rounded-lg"
        >
          + Thêm Track
        </button>
      </div>

      {tracks.length === 0 ? (
        <p className="italic text-slate-500">Chưa có track nào</p>
      ) : (
        <div className="space-y-3">
          {tracks.map((t) => (
            <div key={t.id} className="p-4 border rounded-lg flex justify-between">
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="text-sm text-slate-500">{t.description}</p>
              </div>

              <div className="flex items-center gap-3">
                {/* Edit */}
                <button
                  onClick={() => navigate(`/chair/tracks/${t.id}/edit`)}
                  title="Chỉnh sửa track"
                >
                  <span className="material-symbols-outlined text-blue-600">edit</span>
                </button>

                {/* Delete */}
                <button
                  onClick={async () => {
                    if (!window.confirm("Xóa track này?")) return;

                    try {
                      await trackApi.deleteTrack(t.id);
                      setTracks((prev) => prev.filter((x) => x.id !== t.id));
                    } catch (err) {
                      console.error(err);
                      alert("Xóa track thất bại");
                    }
                  }}
                  className="text-red-500"
                  title="Xóa track"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConferenceDetailPage;
