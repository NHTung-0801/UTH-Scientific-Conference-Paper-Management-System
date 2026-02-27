import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import conferenceApi from "../../api/conferenceApi";
import proceedingsApi from "../../api/proceedingsApi";
import { downloadBlob } from "../../utils/download";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8080";

function safeArr(x) {
  return Array.isArray(x) ? x : [];
}

function toDownloadUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  let p = String(raw).trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.startsWith("/papers/")) p = `/uploads${p}`;
  if (!p.startsWith("/submission/")) p = `/submission${p}`;

  return encodeURI(`${API_BASE}${p}`);
}

function fmtDateTime(x) {
  if (!x) return "--";
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return String(x);
  return d.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ✅ chủ bài = submitter_profile -> fallback authors.user_id == submitter_id -> is_corresponding -> first
function pickOwnerAuthor(paper) {
  if (paper?.submitter_profile) {
    return {
      full_name: paper.submitter_profile?.full_name || "--",
      email: paper.submitter_profile?.email || "--",
      organization: paper.submitter_profile?.organization || "",
    };
  }

  const authors = safeArr(paper?.authors);
  const sid = paper?.submitter_id;

  if (sid != null) {
    const match = authors.find((a) => Number(a?.user_id) === Number(sid));
    if (match) return match;
  }

  const cor = authors.find((a) => a?.is_corresponding === true);
  if (cor) return cor;

  return authors[0] || null;
}

function roleLabel(a, submitterId) {
  if (a?.is_corresponding) return { text: "Liên hệ chính", cls: "text-primary font-bold" };
  if (submitterId != null && Number(a?.user_id) === Number(submitterId))
    return { text: "Chủ bài", cls: "text-primary font-bold" };
  return { text: "Đồng tác giả", cls: "text-zinc-500 dark:text-zinc-400" };
}

export default function CameraReadyDetailPage() {
  const { paperId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState("");

  const [paper, setPaper] = useState(null);
  const [confName, setConfName] = useState("");
  const [trackName, setTrackName] = useState("");

  const owner = useMemo(() => pickOwnerAuthor(paper), [paper]);

  const latestCR = useMemo(() => {
    const versions = safeArr(paper?.versions);
    const cr = versions.filter((v) => v?.is_camera_ready);
    if (!cr.length) return null;
    return cr.sort((a, b) => (b?.version_number ?? 0) - (a?.version_number ?? 0))[0];
  }, [paper]);

  const pdfUrl = useMemo(() => {
    const raw = paper?.camera_ready_file_url || latestCR?.file_url || "";
    return raw ? toDownloadUrl(raw) : "";
  }, [paper, latestCR]);

  const statusBadge = useMemo(() => {
    const s = String(paper?.status || "").toUpperCase();
    if (s === "ACCEPTED")
      return { text: "Đã chấp nhận", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
    if (s === "UNDER_REVIEW")
      return { text: "Đang phản biện", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
    if (s === "SUBMITTED")
      return { text: "Đã nộp", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
    return { text: s || "—", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" };
  }, [paper]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setErr("");

        const p = await proceedingsApi.getPaperPublicDetailForChair(Number(paperId));
        setPaper(p);

        // best-effort load names
        try {
          const conf = await conferenceApi.getConferenceById?.(Number(p?.conference_id));
          if (conf?.name) setConfName(conf.name);
        } catch {}

        try {
          const tr = await conferenceApi.getTrackById?.(Number(p?.track_id));
          if (tr?.name) setTrackName(tr.name);
        } catch {}
      } catch (e) {
        setErr(e?.response?.data?.detail || e?.message || "Không tải được chi tiết Camera-ready.");
        setPaper(null);
      } finally {
        setLoading(false);
      }
    };

    if (paperId) run();
  }, [paperId]);

  // ✅ Export proceedings theo conference_id
  const onExportProceedings = async (format = "csv") => {
    const confId = paper?.conference_id;
    if (!confId) {
      setErr("Không xác định được conference_id để xuất kỷ yếu.");
      return;
    }

    try {
      setExporting(true);
      setErr("");

      const blob = await proceedingsApi.exportProceedings(confId, format); // blob trực tiếp
      const ext = String(format).toLowerCase();
      downloadBlob(blob, `proceedings_conference_${confId}.${ext}`);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Không xuất được kỷ yếu.");
    } finally {
      setExporting(false);
    }
  };

  if (loading && !paper) {
    return <div className="p-8 text-zinc-500 font-semibold">Đang tải...</div>;
  }

  return (
    <div className="px-8 py-6 max-w-[1200px] mx-auto w-full">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm mb-6">
        <button onClick={() => navigate("/chair")} className="text-zinc-500 hover:text-primary transition-colors">
          Trang chủ
        </button>
        <span className="text-zinc-400 material-symbols-outlined text-xs">chevron_right</span>
        <button onClick={() => navigate("/chair/camera-ready")} className="text-zinc-500 hover:text-primary transition-colors">
          Danh sách Camera-ready
        </button>
        <span className="text-zinc-400 material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-zinc-900 dark:text-white font-semibold">Bài báo #{paperId}</span>
      </div>

      {/* Error */}
      {err && (
        <div className="mb-6 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-semibold">
          {err}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight">Bài báo ID: #{paperId}</h1>
            <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase ${statusBadge.cls}`}>{statusBadge.text}</span>
          </div>

          <p className="text-zinc-500 dark:text-zinc-400">
            Ngày nộp bản cuối: {fmtDateTime(paper?.camera_ready_submitted_at || latestCR?.created_at || paper?.submitted_at)}
          </p>

          {(confName || trackName) && (
            <p className="text-xs text-zinc-500">
              {confName ? `Hội nghị: ${confName}` : ""}
              {confName && trackName ? " • " : ""}
              {trackName ? `Track: ${trackName}` : ""}
            </p>
          )}
        </div>

        {/* Export buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={exporting || loading}
            onClick={() => onExportProceedings("csv")}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-sm hover:bg-primary/90 transition-all disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Xuất kỷ yếu (CSV)
          </button>

          <button
            type="button"
            disabled={exporting || loading}
            onClick={() => onExportProceedings("xlsx")}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-bold shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-sm">table_view</span>
            Xuất kỷ yếu (XLSX)
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Info */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">info</span>
              <h3 className="font-bold text-lg">Thông tin bài báo</h3>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Tiêu đề (Title)</label>
                <h2 className="text-xl font-bold leading-relaxed">{paper?.title || "--"}</h2>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Tóm tắt (Abstract)</label>
                <p className="text-zinc-800 dark:text-zinc-300 leading-relaxed text-sm">{paper?.abstract || "--"}</p>
              </div>

              {owner && (
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 p-4">
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Chủ bài (Submitter)</div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white">{owner?.full_name || "--"}</div>
                  <div className="text-xs text-zinc-500">{owner?.email || "--"}</div>
                </div>
              )}
            </div>
          </div>

          {/* Authors */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">groups</span>
                <h3 className="font-bold text-lg">Danh sách tác giả</h3>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-bold">
                {safeArr(paper?.authors).length} Tác giả
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-xs uppercase font-bold">
                    <th className="px-6 py-3">Họ và tên</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Đơn vị công tác</th>
                    <th className="px-6 py-3 text-right">Vai trò</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {safeArr(paper?.authors).map((a) => {
                    const role = roleLabel(a, paper?.submitter_id);
                    return (
                      <tr key={a?.id || `${a?.email}-${a?.full_name}`}>
                        <td className="px-6 py-4 text-sm font-semibold">{a?.full_name || "--"}</td>
                        <td className="px-6 py-4 text-sm">{a?.email || "--"}</td>
                        <td className="px-6 py-4 text-sm text-zinc-500">{a?.organization || "--"}</td>
                        <td className={`px-6 py-4 text-right text-xs ${role.cls}`}>{role.text}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-col gap-6">
          {/* Files */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">download_for_offline</span>
              <h3 className="font-bold text-lg">Tệp tin đính kèm</h3>
            </div>

            <div className="p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/20 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
                    <span className="material-symbols-outlined">picture_as_pdf</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{pdfUrl ? `CameraReady_ID${paperId}.pdf` : "Chưa có PDF"}</p>
                    <p className="text-[10px] text-zinc-500">{pdfUrl ? "PDF" : "--"}</p>
                  </div>
                </div>

                <a
                  href={pdfUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className={[
                    "p-2 rounded-full transition-colors",
                    pdfUrl ? "text-primary hover:bg-primary/10" : "text-zinc-300 pointer-events-none",
                  ].join(" ")}
                  title={pdfUrl ? "Tải PDF" : "Chưa có PDF"}
                >
                  <span className="material-symbols-outlined">download</span>
                </a>
              </div>
            </div>
          </div>

          {/* Back */}
          <button
            type="button"
            onClick={() => navigate("/chair/camera-ready")}
            className="w-full py-3 rounded-lg font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    </div>
  );
}
