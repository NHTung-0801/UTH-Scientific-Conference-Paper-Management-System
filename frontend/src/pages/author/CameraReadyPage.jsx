// src/pages/author/CameraReadyPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listMySubmissions } from "../../api/submissionApi";
import conferenceApi from "../../api/conferenceApi";

const STATUS_META = {
  SUBMITTED: { label: "Submitted", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  UNDER_REVIEW: { label: "Under review", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  ACCEPTED: { label: "Accepted", cls: "bg-green-50 text-green-700 border-green-200" },
  REJECTED: { label: "Rejected", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  WITHDRAWN: { label: "Withdrawn", cls: "bg-slate-50 text-slate-600 border-slate-200" },
  REVISION_REQUIRED: { label: "Revision required", cls: "bg-purple-50 text-purple-700 border-purple-200" },
};

function fmtDateVN(d) {
  if (!d) return "--";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "--";
  return dt.toLocaleDateString("vi-VN");
}

function daysLeft(deadline) {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days;
}

function isDeadlinePassed(deadline) {
  if (!deadline) return false;
  const t = new Date(deadline).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

export default function CameraReadyPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState([]);

  // conferenceId -> { camera_ready_open, camera_ready_deadline }
  const [phaseMap, setPhaseMap] = useState({});
  const [confNameMap, setConfNameMap] = useState({});

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // =============================
  // ✅ CHỌN CHẾ ĐỘ LỌC Ở ĐÂY
  // Mode A: chỉ ACCEPTED
  // Mode B: ACCEPTED + open + chưa quá hạn (chỉ bài nộp được)
  // =============================
  const SHOW_ONLY_SUBMITTABLE = false; // <-- đổi true nếu muốn Mode B

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const data = await listMySubmissions();
        if (!alive) return;

        const list = Array.isArray(data) ? data : [];
        setPapers(list);

        // fetch phase + conf name theo conference_id
        const confIds = [...new Set(list.map((p) => p.conference_id).filter(Boolean))];

        const phasePairs = await Promise.all(
          confIds.map(async (cid) => {
            try {
              const phase = await conferenceApi.getConferencePhase(cid);
              return [cid, phase];
            } catch {
              return [cid, { conference_id: cid, camera_ready_open: false, camera_ready_deadline: null }];
            }
          })
        );

        const namePairs = await Promise.all(
          confIds.map(async (cid) => {
            try {
              const conf = await conferenceApi.getConferenceById(cid);
              return [cid, conf?.name || `Conference #${cid}`];
            } catch {
              return [cid, `Conference #${cid}`];
            }
          })
        );

        if (!alive) return;

        setPhaseMap(Object.fromEntries(phasePairs));
        setConfNameMap(Object.fromEntries(namePairs));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // ✅ LỌC ACCEPTED (và optionally lọc được nộp)
  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();

    // 1) lọc status ACCEPTED trước
    let base = papers.filter((p) => String(p.status || "").toUpperCase() === "ACCEPTED");

    // 2) nếu chỉ muốn hiện bài NỘP ĐƯỢC (open + chưa quá hạn)
    if (SHOW_ONLY_SUBMITTABLE) {
      base = base.filter((p) => {
        const phase = phaseMap[p.conference_id] || {};
        const open = !!phase.camera_ready_open;
        const deadline = phase.camera_ready_deadline;
        const passed = isDeadlinePassed(deadline);
        return open && !passed;
      });
    }

    // 3) search trên tập đã lọc
    if (!keyword) return base;

    return base.filter((p) => {
      const title = (p.title || "").toLowerCase();
      const pid = String(p.id || "").toLowerCase();
      const confName = (confNameMap[p.conference_id] || "").toLowerCase();
      return title.includes(keyword) || pid.includes(keyword) || confName.includes(keyword);
    });
  }, [papers, q, confNameMap, phaseMap, SHOW_ONLY_SUBMITTABLE]);

  // ✅ sort để accepted mới nhất lên trước (optional nhưng hợp lý)
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ta = new Date(a.submitted_at || a.created_at || 0).getTime();
      const tb = new Date(b.submitted_at || b.created_at || 0).getTime();
      return tb - ta;
    });
  }, [filtered]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageItems = useMemo(() => {
    const p = Math.min(Math.max(1, page), totalPages);
    const start = (p - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, totalPages]);

  // ✅ reset page khi search HOẶC khi dataset thay đổi
  useEffect(() => {
    setPage(1);
  }, [q, total]);

  if (loading) return <p className="p-8">Đang tải...</p>;

  return (
    <div className="p-6 md:p-8 lg:p-10">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-6">
        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Danh sách nộp Camera-ready
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Quản lý và nộp bản thảo hoàn thiện cho các bài báo đã được chấp nhận.
          </p>

          {/* (optional) Hint filter mode */}
          {/* <p className="text-xs text-slate-400">
            Đang hiển thị: {SHOW_ONLY_SUBMITTABLE ? "Bài có thể nộp Camera-ready" : "Tất cả bài ACCEPTED"}
          </p> */}
        </div>

        {/* Banner */}
        <div className="border rounded-xl p-4 md:p-5 flex gap-4 items-start bg-primary/5 border-primary/20 shadow-sm">
          <div className="bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm text-primary shrink-0">
            <span className="material-symbols-outlined text-[24px]">celebration</span>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-slate-900 dark:text-white font-bold">Hệ thống thông báo</p>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              Nếu bài của bạn đã được chấp nhận và Camera-ready đang mở, bạn có thể chỉnh sửa thông tin và tải lên bản hoàn thiện trước hạn chót.
            </p>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 items-end sm:items-center pt-2">
          <div className="relative w-full sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-slate-400 text-[20px]">search</span>
            </div>
            <input
              className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg
                         bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400
                         focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm"
              placeholder="Tìm kiếm bài báo..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-28">
                    Mã bài
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[280px]">
                    Tiêu đề bài báo
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[180px]">
                    Hội nghị
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-40">
                    Trạng thái
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-36">
                    Hạn chót
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                    Hành động
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pageItems.length === 0 ? (
                  <tr>
                    <td className="px-6 py-6 text-sm text-slate-500" colSpan={6}>
                      Không có bài ACCEPTED phù hợp.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((p) => {
                    const phase = phaseMap[p.conference_id] || {};
                    const open = !!phase.camera_ready_open;
                    const deadline = phase.camera_ready_deadline;

                    const left = daysLeft(deadline);
                    const deadlinePassed = isDeadlinePassed(deadline);

                    const versions = p.versions || p.paper_versions || [];
                    const isSubmitted = versions.some((v) => v.is_camera_ready);

                    const canSubmit = open && !deadlinePassed;

                    const meta =
                      STATUS_META[p.status] || {
                        label: String(p.status || "UNKNOWN"),
                        cls: "bg-slate-50 text-slate-600 border-slate-200",
                      };

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                          #{String(p.id).padStart(4, "0")}
                        </td>

                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{p.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Track #{p.track_id}</p>
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {confNameMap[p.conference_id] || `Conference #${p.conference_id}`}
                          {!open && (
                            <span className="ml-2 inline-flex text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              Đóng
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.cls}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70" />
                            {meta.label}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-sm font-medium">
                          {deadline ? (
                            <div className={deadlinePassed ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-200"}>
                              {fmtDateVN(deadline)}
                              {typeof left === "number" && !deadlinePassed && (
                                <span className="block text-[10px] font-normal text-slate-500">Còn {left} ngày</span>
                              )}
                              {deadlinePassed && <span className="block text-[10px] font-normal text-slate-500">Đã quá hạn</span>}
                            </div>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          {/* 2. LOGIC HIỂN THỊ NÚT BẤM */}
                          {isSubmitted ? (
                            // TRƯỜNG HỢP 1: ĐÃ NỘP -> HIỆN NÚT XEM CHI TIẾT (Màu xanh lá hoặc xám)
                            <button
                              onClick={() => navigate(`/author/camera-ready/${p.id}`)}
                              className="inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-green-700 bg-green-50 
                                        border border-green-200 rounded-lg hover:bg-green-100 transition shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[18px] mr-2">visibility</span>
                              Xem bản đã nộp
                            </button>
                          ) : canSubmit ? (
                            // TRƯỜNG HỢP 2: CHƯA NỘP & CÒN HẠN -> HIỆN NÚT CHUẨN BỊ (Màu chính)
                            <button
                              onClick={() => navigate(`/author/camera-ready/${p.id}`)}
                              className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white
                                        bg-primary rounded-lg shadow-sm hover:opacity-95 focus:outline-none focus:ring-2
                                        focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                            >
                              <span className="material-symbols-outlined text-[18px] mr-2">upload_file</span>
                              Chuẩn bị bản cuối
                            </button>
                          ) : (
                            // TRƯỜNG HỢP 3: KHÔNG THỂ NỘP (Đóng hoặc quá hạn)
                            <button
                              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium
                                        text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-not-allowed
                                        border border-slate-200 dark:border-slate-700"
                              disabled
                              title={!open ? "Camera-ready chưa mở" : deadlinePassed ? "Đã quá deadline" : "Không thể nộp"}
                            >
                              <span className="material-symbols-outlined text-[18px] mr-2">
                                {!open ? "lock" : deadlinePassed ? "event_busy" : "lock"}
                              </span>
                              {!open ? "Đã đóng" : deadlinePassed ? "Quá hạn" : "Đang chờ"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
                Hiển thị{" "}
                <span className="font-medium">{total === 0 ? 0 : (page - 1) * pageSize + 1}</span>{" "}
                đến{" "}
                <span className="font-medium">{Math.min(page * pageSize, total)}</span>{" "}
                của <span className="font-medium">{total}</span> kết quả
              </div>

              <div className="flex items-center gap-1 mx-auto sm:mx-0">
                <button
                  className="flex size-9 items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>

                {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                  const n = idx + 1;
                  const active = n === page;
                  return (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={
                        active
                          ? "text-sm font-bold flex size-9 items-center justify-center text-primary bg-primary/10 rounded-md"
                          : "text-sm font-normal flex size-9 items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
                      }
                    >
                      {n}
                    </button>
                  );
                })}

                <button
                  className="flex size-9 items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pb-6 text-center sm:text-left">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            © 2024 UTH-ConfMS. Hệ thống quản lý hội nghị khoa học.
          </p>
        </div>
      </div>
    </div>
  );
}
