// src/pages/chair/CameraReadyListPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import conferenceApi from "../../api/conferenceApi";
import proceedingsApi from "../../api/proceedingsApi";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8080";
const ALL_CONFS = "__ALL_CONFS__";

// ----------------------- Helpers -----------------------
function toDownloadUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  let p = String(raw).trim();
  if (!p.startsWith("/")) p = `/${p}`;

  // Giống logic Author
  if (p.startsWith("/papers/")) p = `/uploads${p}`;
  if (!p.startsWith("/submission/")) p = `/submission${p}`;

  return encodeURI(`${API_BASE}${p}`);
}

function safeArr(x) {
  return Array.isArray(x) ? x : [];
}

// Map paper.id -> P01/P02...
function toPaperCode(id) {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return String(id ?? "--");
  return `P${String(n).padStart(2, "0")}`;
}

function pickLatestCameraReadyVersion(paper) {
  const versions = safeArr(
    paper?.versions ||
      paper?.paper_versions ||
      paper?.version_history ||
      paper?.paper_versions_history
  );

  const crList = versions.filter((v) => !!v?.is_camera_ready);
  if (!crList.length) return null;

  return crList.sort((a, b) => (b?.version_number ?? 0) - (a?.version_number ?? 0))[0];
}

// Track name
function getTrackName(p) {
  return (
    p?.track?.name ||
    p?.track_name ||
    p?.trackName ||
    p?.topic?.name ||
    p?.topic_name ||
    ""
  );
}

/**
 * ✅ Lấy "tác giả gốc" = submitter/owner
 * Ưu tiên:
 * 1) submitter_profile (backend trả từ identity)
 * 2) authors có user_id === submitter_id
 * 3) authors.is_corresponding
 * 4) authors[0]
 */
function pickOwnerAuthor(paper) {
  // 1) best: submitter_profile từ backend
  if (paper?.submitter_profile && typeof paper.submitter_profile === "object") {
    const u = paper.submitter_profile;
    return {
      full_name: u?.full_name || "--",
      email: u?.email || "--",
      organization: u?.organization,
      department: u?.department,
      phone: u?.phone,
      id: u?.id,
    };
  }

  // 2) fallback: match theo submitter_id với authors.user_id
  const submitterId = paper?.submitter_id ?? paper?.submitterId;
  const authors = safeArr(paper?.authors || paper?.paper_authors);

  if (submitterId != null) {
    const match = authors.find((a) => Number(a?.user_id) === Number(submitterId));
    if (match) return match;
  }

  // 3) fallback: corresponding
  const corresponding = authors.find((a) => a?.is_corresponding === true);
  if (corresponding) return corresponding;

  // 4) fallback: first author
  return authors[0] || null;
}

function normalizePaper(p, confMap) {
  const authors = safeArr(p?.authors || p?.paper_authors);
  const latestCR = pickLatestCameraReadyVersion(p);

  const hasCameraReady =
    p?.has_camera_ready === true || p?.hasCameraReady === true || !!latestCR;

  // backend status endpoint có camera_ready_file_url
  const fileUrlRaw =
    p?.camera_ready_file_url ||
    p?.cameraReadyFileUrl ||
    p?.pdf_url ||
    p?.pdfUrl ||
    latestCR?.file_url ||
    latestCR?.fileUrl ||
    "";

  const conferenceId = p?.conference_id ?? p?.conferenceId ?? p?.conference?.id ?? null;
  const conferenceName =
    p?.conference_name ||
    p?.conferenceName ||
    p?.conference?.name ||
    (conferenceId != null ? confMap?.get(Number(conferenceId)) || "" : "");

  const mainAuthor = pickOwnerAuthor({
    ...p,
    authors, // đảm bảo authors đúng
  });

  return {
    id: p?.id,
    code: toPaperCode(p?.id),
    title: p?.title || `Paper #${p?.id ?? "--"}`,
    trackName: getTrackName(p),
    conferenceId,
    conferenceName,
    mainAuthor,
    hasCameraReady,
    pdfUrl: hasCameraReady && fileUrlRaw ? toDownloadUrl(fileUrlRaw) : "",
  };
}

function makeTrackLabel(t) {
  return t || "";
}

// ----------------------- UI bits -----------------------
function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex h-10 items-center justify-center rounded-lg px-4 text-sm transition-all border",
        active
          ? "bg-primary/10 text-primary border-transparent font-bold"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent hover:text-primary font-semibold",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function StatusBadge({ submitted }) {
  return submitted ? (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      <span className="size-1.5 rounded-full bg-emerald-500 mr-2" />
      Đã nộp
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      <span className="size-1.5 rounded-full bg-zinc-400 mr-2" />
      Chưa nộp
    </span>
  );
}

function IconLink({ href, title, colorClass, icon, disabled }) {
  if (!href || disabled) {
    return (
      <span className="text-zinc-300 dark:text-zinc-700" title={title}>
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </span>
    );
  }

  return (
    <a
      className={[colorClass, "transition-transform hover:scale-110"].join(" ")}
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
    >
      <span className="material-symbols-outlined text-2xl">{icon}</span>
    </a>
  );
}

// ----------------------- Page -----------------------
export default function CameraReadyListPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [confs, setConfs] = useState([]);
  const [conferenceId, setConferenceId] = useState(ALL_CONFS);

  const [rows, setRows] = useState([]); // raw papers from API
  const [q, setQ] = useState("");

  const [trackFilter, setTrackFilter] = useState("ALL");

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  // Load conferences (để map conferenceName khi ALL)
  useEffect(() => {
    const loadConferences = async () => {
      try {
        const list = await conferenceApi.getAllConferences();
        const arr = Array.isArray(list) ? list : list?.items ?? list?.results ?? [];
        setConfs(arr);
      } catch {
        setConfs([]);
      }
    };
    loadConferences();
  }, []);

  const confMap = useMemo(() => {
    const m = new Map();
    confs.forEach((c) => {
      if (c?.id != null) m.set(Number(c.id), c?.name || "");
    });
    return m;
  }, [confs]);

  const isAllConfs = conferenceId === ALL_CONFS;

  const confSelected = useMemo(() => {
    if (isAllConfs) return null;
    const id = Number(conferenceId);
    return confs.find((c) => Number(c?.id) === id) || null;
  }, [confs, conferenceId, isAllConfs]);

  // ✅ Load data: 1 conf hoặc ALL confs
  const loadData = useCallback(
    async (confId) => {
      try {
        setLoading(true);
        setErr("");

        // ===== ALL CONFS =====
        if (confId === ALL_CONFS) {
          // Ưu tiên endpoint ALL (mới) -> không loop
          if (typeof proceedingsApi.listCameraReadyStatusAll === "function") {
            const list = await proceedingsApi.listCameraReadyStatusAll();
            const arr = Array.isArray(list) ? list : list?.items ?? list?.results ?? [];
            setRows(arr);
            setPage(1);
            return;
          }

          // Fallback (nếu bạn chưa thêm api ALL): loop confs
          const useStatus = typeof proceedingsApi.listCameraReadyStatus === "function";

          const tasks = confs.map(async (c) => {
            try {
              let list = null;

              if (useStatus) {
                list = await proceedingsApi.listCameraReadyStatus(Number(c.id));
              } else {
                list = await proceedingsApi.listCameraReady(Number(c.id));
                list = safeArr(list).map((p) => ({ ...p, has_camera_ready: true }));
              }

              const arr = Array.isArray(list) ? list : list?.items ?? list?.results ?? [];
              return arr.map((p) => ({
                ...p,
                conference_id: p?.conference_id ?? c.id,
                conference_name: p?.conference_name ?? c.name,
              }));
            } catch {
              return [];
            }
          });

          const results = await Promise.all(tasks);
          setRows(results.flat());
          setPage(1);
          return;
        }

        // ===== SINGLE CONF =====
        if (!confId) {
          setRows([]);
          setPage(1);
          return;
        }

        let list = null;

        if (typeof proceedingsApi.listCameraReadyStatus === "function") {
          try {
            list = await proceedingsApi.listCameraReadyStatus(Number(confId));
          } catch {
            list = null;
          }
        }

        if (!list) {
          list = await proceedingsApi.listCameraReady(Number(confId));
          list = safeArr(list).map((p) => ({ ...p, has_camera_ready: true }));
        }

        const arr = Array.isArray(list) ? list : list?.items ?? list?.results ?? [];
        setRows(arr);
        setPage(1);
      } catch (e) {
        setErr(e?.response?.data?.detail || "Không tải được danh sách Camera-ready.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [confs]
  );

  useEffect(() => {
    loadData(conferenceId);
  }, [conferenceId, loadData]);

  const normalized = useMemo(() => rows.map((r) => normalizePaper(r, confMap)), [rows, confMap]);

  const trackOptions = useMemo(() => {
    const tracks = normalized.map((p) => p.trackName).filter(Boolean);
    const unique = Array.from(new Set(tracks));
    return ["ALL", ...unique];
  }, [normalized]);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();

    return normalized.filter((p) => {
      if (trackFilter !== "ALL" && p.trackName !== trackFilter) return false;
      if (!keyword) return true;

      const authorName = p.mainAuthor?.full_name || p.mainAuthor?.fullName || p.mainAuthor?.name || "";
      const authorEmail = p.mainAuthor?.email || "";
      const confName = p.conferenceName || "";

      const hay = `${p.code} ${p.id} ${p.title} ${p.trackName} ${authorName} ${authorEmail} ${confName}`.toLowerCase();
      return hay.includes(keyword);
    });
  }, [normalized, q, trackFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const paged = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const rangeText = useMemo(() => {
    if (total === 0) return "Hiển thị 0 - 0 trong tổng số 0 bài báo";
    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);
    return `Hiển thị ${start} - ${end} trong tổng số ${total} bài báo`;
  }, [total, currentPage]);

  const onReset = () => {
    setQ("");
    setTrackFilter("ALL");
    setPage(1);
    setConferenceId(ALL_CONFS);
  };

  const breadcrumbLeft = isAllConfs ? "Tất cả hội nghị" : (confSelected?.name || "Hội nghị");

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-zinc-500 text-sm mb-1">
        <span>{breadcrumbLeft}</span>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-zinc-800 dark:text-zinc-300 font-medium">Camera-ready</span>
      </div>

      {/* Heading */}
      <div className="mb-8">
        <h2 className="text-[#171113] dark:text-white text-4xl font-extrabold tracking-tight">
          Quản lý Camera-ready
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-lg mt-2">
          Theo dõi và kiểm tra các bài báo nộp bản hoàn thiện cho kỷ yếu hội nghị.
        </p>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: track chips */}
          <div className="flex gap-3 flex-wrap items-center">
            <button
              type="button"
              className="flex h-10 items-center justify-center gap-x-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 pl-4 pr-3 text-zinc-800 dark:text-white border border-transparent hover:border-zinc-300 transition-all"
              onClick={() => setTrackFilter("ALL")}
              title="Tất cả chuyên đề"
            >
              <span className="text-sm font-bold">Tất cả chuyên đề</span>
              <span className="material-symbols-outlined text-lg">expand_more</span>
            </button>

            {trackOptions
              .filter((t) => t !== "ALL")
              .slice(0, 3)
              .map((t) => (
                <Chip key={t} active={trackFilter === t} onClick={() => setTrackFilter(t)}>
                  {makeTrackLabel(t)}
                </Chip>
              ))}
          </div>

          {/* Right: search */}
          <div className="flex-1 max-w-md">
            <label className="relative block">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="material-symbols-outlined text-zinc-400">search</span>
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full h-11 bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg pl-11 pr-4 text-sm text-[#171113] dark:text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="Tìm theo ID, Tiêu đề hoặc Tác giả..."
                type="text"
              />
            </label>
          </div>
        </div>

        {/* Conference selector + actions */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="min-w-[260px]">
            <select
              value={conferenceId}
              onChange={(e) => setConferenceId(e.target.value)}
              className="w-full h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-semibold text-zinc-800 dark:text-white border border-transparent focus:ring-2 focus:ring-primary/40"
            >
              <option value={ALL_CONFS}>Tất cả hội nghị</option>
              {confs.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name || `Conference #${c.id}`}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onReset}
            className="h-10 px-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={() => loadData(conferenceId)}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
          >
            Làm mới
          </button>

          <button
            type="button"
            onClick={() => navigate("/chair")}
            className="h-10 px-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-sm font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Về trang Chair
          </button>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div className="mb-6 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-semibold">
          {err}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-zinc-500 font-semibold">Đang tải...</div>
        ) : total === 0 ? (
          <div className="p-10 text-center text-zinc-500">Chưa có dữ liệu (hoặc không khớp bộ lọc).</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-32 text-center">
                      ID bài báo
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Tiêu đề bài báo
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Tác giả liên hệ
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-40">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-44 text-center">
                      Tệp tin
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-48 text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {paged.map((p) => {
                    // ✅ luôn là submitter_profile (nếu có), fallback logic chuẩn
                    const authorName =
                      p.mainAuthor?.full_name || p.mainAuthor?.fullName || p.mainAuthor?.name || "--";
                    const authorEmail = p.mainAuthor?.email || "--";

                    return (
                      <tr
                        key={`${p.conferenceId || "c"}-${p.id}`}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                      >
                        {/* ID */}
                        <td className="px-6 py-5 text-sm font-bold text-zinc-900 dark:text-white text-center">
                          {p.code}
                        </td>

                        {/* Title + Conf/Track */}
                        <td className="px-6 py-5">
                          <div className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
                            {p.title}
                          </div>

                          {isAllConfs && (
                            <div className="text-xs text-zinc-500">
                              Hội nghị: {p.conferenceName || "--"}
                            </div>
                          )}

                          <div className="text-xs text-zinc-500">
                            Track: {p.trackName ? p.trackName : "--"}
                          </div>
                        </td>

                        {/* Main author */}
                        <td className="px-6 py-5">
                          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            {authorName}
                          </div>
                          <div className="text-xs text-zinc-500">{authorEmail}</div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-5">
                          <StatusBadge submitted={p.hasCameraReady} />
                        </td>

                        {/* Files */}
                        <td className="px-6 py-5">
                          {p.hasCameraReady ? (
                            <div className="flex items-center justify-center gap-4">
                              <IconLink
                                href={p.pdfUrl}
                                title="Tải PDF"
                                colorClass="text-primary hover:text-primary/80"
                                icon="picture_as_pdf"
                              />
                            </div>
                          ) : (
                            <div className="text-center text-zinc-300 dark:text-zinc-700">-</div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-5 text-right">
                          {p.hasCameraReady ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/chair/camera-ready/${p.id}`)}
                              className="bg-primary text-white text-xs font-bold py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                            >
                              Kiểm tra chi tiết
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-bold py-2 px-4 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                              onClick={() => alert("Chưa có API nhắc nhở nộp.")}
                            >
                              Nhắc nhở nộp
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{rangeText}</p>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="p-1.5 rounded bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-zinc-400 disabled:opacity-50"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p0) => Math.max(1, p0 - 1))}
                >
                  <span className="material-symbols-outlined text-lg leading-none">chevron_left</span>
                </button>

                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => i + 1).map((pnum) => (
                  <button
                    key={pnum}
                    type="button"
                    onClick={() => setPage(pnum)}
                    className={[
                      "size-8 rounded text-xs font-bold transition-colors",
                      pnum === currentPage
                        ? "bg-primary text-white"
                        : "bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:border-primary",
                    ].join(" ")}
                  >
                    {pnum}
                  </button>
                ))}

                <button
                  type="button"
                  className="p-1.5 rounded bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:border-primary transition-colors disabled:opacity-50"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p0) => Math.min(totalPages, p0 + 1))}
                >
                  <span className="material-symbols-outlined text-lg leading-none">chevron_right</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
