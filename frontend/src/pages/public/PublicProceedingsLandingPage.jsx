// src/pages/public/PublicProceedingsLandingPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import proceedingsPublicApi from "../../api/proceedingsPublicApi";
import conferenceApi from "../../api/conferenceApi";
import { downloadBlob } from "../../utils/download";


const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8080";

function toPublicFileUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  let p = String(raw).trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (!p.startsWith("/uploads/")) p = `/uploads${p}`;
  return `${API_BASE}${encodeURI(p)}`;
}

function safeArr(x) {
  return Array.isArray(x) ? x : [];
}

function fmtDate(d) {
  if (!d) return "--";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "--";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function toneStyle(tone) {
  const map = {
    blue: "59 130 246",
    amber: "245 158 11",
    green: "34 197 94",
    rose: "244 63 94",
    violet: "139 92 246",
    slate: "100 116 139",
  };
  const rgb = map[tone] || map.slate;
  return {
    borderColor: `rgb(${rgb} / 0.25)`,
    backgroundColor: `rgb(${rgb} / 0.12)`,
    color: `rgb(${rgb} / 0.95)`,
  };
}

/** normalize meta để tránh thiếu dữ liệu do khác tên field */
function normalizeMeta(raw) {
  const m = raw || {};
  return {
    title: m.title || m.proceedings_title || m.proceedingsTitle || "Proceedings",
    published_date:
      m.published_date || m.publishedDate || m.published_at || m.publishedAt || null,
    cover_image_url: m.cover_image_url || m.coverImageUrl || m.cover || "",
    publisher: m.publisher || m.publishing_house || m.publishingHouse || "",
    isbn_issn: m.isbn_issn || m.isbnIssn || m.isbn || m.issn || "",
    preface: m.preface || m.foreword || m.description || "",
    copyright: m.copyright || "",
    proceedings_pdf_url:
      m.proceedings_pdf_url || m.proceedingsPdfUrl || m.pdf_url || m.pdfUrl || "",
  };
}

/** normalize paper để tự bắt các field pdf khác nhau */
function normalizePaper(raw) {
  const p = raw || {};
  return {
    paper_id: p.paper_id ?? p.id ?? p.submission_id ?? p.submissionId,
    title: p.title || p.paper_title || p.paperTitle || "--",
    track_id: p.track_id ?? p.trackId ?? p.track ?? null,
    authors: safeArr(p.authors || p.author_list || p.authorList || p.author_names || []),
    pdf_raw:
      p.camera_ready_file_url ||
      p.cameraReadyFileUrl ||
      p.camera_ready_pdf_url ||
      p.cameraReadyPdfUrl ||
      p.pdf_url ||
      p.pdfUrl ||
      p.file_url ||
      p.fileUrl ||
      "",
  };
}

async function extractBlobError(err) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    const text = await data.text();
    try {
      const json = JSON.parse(text);
      return json?.detail || json?.message || text;
    } catch {
      return text;
    }
  }
  return err?.response?.data?.detail || err?.message || "Tải PDF thất bại.";
}


function pickCorrespondingName(paperRow) {
  const authors = safeArr(paperRow?.authors);
  const cor = authors.find((a) => a?.is_corresponding || a?.isCorresponding);
  return (
    cor?.full_name ||
    cor?.fullName ||
    authors[0]?.full_name ||
    authors[0]?.fullName ||
    "--"
  );
}

function compactText(s, max = 220) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max).trim() + "…";
}

function StatCard({ icon, label, value }) {
  return (
    <div
      className="rounded-2xl border p-4 flex items-start gap-3"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div
        className="size-10 rounded-xl border flex items-center justify-center"
        style={{ background: "rgb(var(--primary-rgb) / 0.10)", borderColor: "rgb(var(--primary-rgb) / 0.18)" }}
      >
        <span className="material-symbols-outlined" style={{ color: "var(--text)" }}>
          {icon}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase" style={{ color: "var(--muted)" }}>
          {label}
        </p>
        <p className="text-lg font-black leading-tight" style={{ color: "var(--text)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default function PublicProceedingsLandingPage() {
  const { conferenceId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [confName, setConfName] = useState("");
  const [meta, setMeta] = useState(null);
  const [papers, setPapers] = useState([]);

  const [q, setQ] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [imgOk, setImgOk] = useState(true);

  const coverUrl = useMemo(() => toPublicFileUrl(meta?.cover_image_url), [meta?.cover_image_url]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");

        try {
          const conf = await conferenceApi.getConferenceById?.(Number(conferenceId));
          if (conf?.name) setConfName(conf.name);
        } catch {}

        const metaRes = await proceedingsPublicApi.getMeta(Number(conferenceId));
        setMeta(normalizeMeta(metaRes));

        const paperRes = await proceedingsPublicApi.getPapers(Number(conferenceId));
        const arr = Array.isArray(paperRes?.items)
          ? paperRes.items
          : Array.isArray(paperRes)
          ? paperRes
          : [];
        setPapers(arr.map(normalizePaper));
      } catch (e) {
        const detail = e?.response?.data?.detail || e?.message;
        setErr(detail || "Kỷ yếu chưa được công bố hoặc không tồn tại.");
      } finally {
        setLoading(false);
      }
    })();
  }, [conferenceId]);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return papers;
    return papers.filter((p) => {
      const t = String(p?.title || "").toLowerCase();
      const a = String(pickCorrespondingName(p) || "").toLowerCase();
      const id = String(p?.paper_id ?? "").toLowerCase();
      const track = String(p?.track_id ?? "").toLowerCase();
      return t.includes(keyword) || a.includes(keyword) || id.includes(keyword) || track.includes(keyword);
    });
  }, [papers, q]);

  const stats = useMemo(() => {
    const total = papers.length;
    const pdfCount = papers.reduce((acc, p) => acc + (String(p?.pdf_raw || "").trim() ? 1 : 0), 0);
    const trackSet = new Set(papers.map((p) => p?.track_id).filter((x) => x !== null && x !== undefined));
    return {
      total,
      pdfCount,
      trackCount: trackSet.size,
    };
  }, [papers]);

  const exportPdf = async () => {
    try {
      setDownloading(true);
      const blob = await proceedingsPublicApi.exportPdf(Number(conferenceId));
      const realBlob = blob instanceof Blob ? blob : blob?.data instanceof Blob ? blob.data : null;
      if (!realBlob) throw new Error("Invalid blob response");
      downloadBlob(realBlob, `proceedings_conference_${conferenceId}.pdf`);
    } catch (e) {
      const msg = await extractBlobError(e);
      alert(msg);
      console.error("Export PDF error:", e);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] p-8" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
            Đang tải kỷ yếu...
          </div>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-3xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="h-6 w-56 rounded-lg" style={{ background: "rgb(var(--primary-rgb) / 0.12)" }} />
              <div className="mt-4 h-10 w-4/5 rounded-xl" style={{ background: "rgb(var(--primary-rgb) / 0.10)" }} />
              <div className="mt-3 h-4 w-2/3 rounded-lg" style={{ background: "rgb(var(--primary-rgb) / 0.08)" }} />
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[1, 2, 3].map((k) => (
                  <div key={k} className="h-20 rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
                ))}
              </div>
            </div>
            <div className="lg:col-span-5 rounded-3xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="aspect-[16/11]" style={{ background: "rgb(var(--primary-rgb) / 0.08)" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-[calc(100vh-64px)] p-6" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <div
          className="max-w-3xl mx-auto p-6 rounded-3xl border"
          style={{
            borderColor: "rgb(244 63 94 / 0.25)",
            background: "rgb(244 63 94 / 0.08)",
            color: "rgb(244 63 94 / 0.95)",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined">error</span>
            <p className="font-black">Không thể hiển thị kỷ yếu</p>
          </div>
          <p className="mt-2 font-semibold">{err}</p>
          <p className="mt-2 text-sm" style={{ color: "rgb(244 63 94 / 0.9)" }}>
            Nếu bạn là Chair: hãy kiểm tra đã “Công bố” kỷ yếu cho hội nghị này chưa.
          </p>
        </div>
      </div>
    );
  }

  const title = meta?.title || "Proceedings";
  const confLabel = confName ? confName : `Conference #${conferenceId}`;
  const published = meta?.published_date ? fmtDate(meta.published_date) : "—";
  const isbn = (meta?.isbn_issn || "").trim();
  const publisher = (meta?.publisher || "").trim();
  const preface = (meta?.preface || "").trim();

  return (
    <div className="min-h-[calc(100vh-64px)]" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* HERO */}
      <div
        className="border-b"
        style={{
          background:
            "radial-gradient(1200px 500px at 20% 0%, rgb(var(--primary-rgb) / 0.18), transparent 60%), radial-gradient(900px 400px at 85% 10%, rgb(139 92 246 / 0.14), transparent 55%)",
          borderColor: "var(--border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* LEFT */}
            <div className="lg:col-span-7">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="inline-flex items-center px-3 py-1 rounded-full border text-xs font-black"
                  style={toneStyle("green")}
                >
                  <span className="size-1.5 rounded-full mr-1.5" style={{ backgroundColor: "currentColor", opacity: 0.6 }} />
                  Proceedings Published
                </span>

                <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                  {confLabel}
                </span>
              </div>

              <h1 className="mt-3 text-3xl md:text-5xl font-black leading-[1.05] tracking-tight">
                {title}
              </h1>

              <div className="mt-4 flex items-center gap-3 flex-wrap text-sm" style={{ color: "var(--muted)" }}>
                <span className="inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">event</span>
                  {published}
                </span>

                {isbn && (
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">barcode</span>
                    {isbn}
                  </span>
                )}

                {publisher && (
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">apartment</span>
                    {publisher}
                  </span>
                )}
              </div>

              {/* ACTIONS */}
              <div className="mt-6 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => navigate("/")}
                  className="h-11 px-5 rounded-2xl font-black border transition active:scale-[0.99]"
                  style={toneStyle("slate")}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="material-symbols-outlined">arrow_back</span>
                    Quay lại trang chủ
                  </span>
                </button>
                <button
                  onClick={exportPdf}
                  disabled={downloading}
                  className="h-11 px-5 rounded-2xl font-black transition disabled:opacity-60 active:scale-[0.99]"
                  style={{
                    background: "var(--primary)",
                    color: "#fff",
                    boxShadow: "0 14px 30px rgb(var(--primary-rgb) / 0.22)",
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="material-symbols-outlined">download</span>
                    {downloading ? "Đang tải PDF..." : "Tải PDF kỷ yếu"}
                  </span>
                </button>

                {(meta?.proceedings_pdf_url || "").trim() && (
                  <a
                    href={toPublicFileUrl(meta.proceedings_pdf_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="h-11 px-5 rounded-2xl font-black border inline-flex items-center gap-2 transition"
                    style={toneStyle("violet")}
                  >
                    <span className="material-symbols-outlined">open_in_new</span>
                    Mở PDF
                  </a>
                )}
              </div>

              {/* STATS */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard icon="description" label="Tổng bài" value={stats.total} />
                <StatCard icon="category" label="Số track" value={stats.trackCount} />
                <StatCard icon="picture_as_pdf" label="Bài có PDF" value={stats.pdfCount} />
              </div>

              {/* PREFACE PREVIEW (để đỡ trống) */}
              {preface && (
                <div
                  className="mt-6 rounded-3xl border p-5"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase" style={{ color: "var(--muted)" }}>
                      Preface
                    </p>
                    <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                      {preface.length} ký tự
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                    {compactText(preface, 380)}
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT (Cover + mini info) */}
            <div className="lg:col-span-5">
              <div
                className="rounded-3xl border overflow-hidden shadow-sm h-full"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="relative aspect-[16/11]">
                  {coverUrl && imgOk ? (
                    <img
                      src={coverUrl}
                      alt="cover"
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={() => setImgOk(false)}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                      <div
                        className="size-14 rounded-2xl border flex items-center justify-center"
                        style={{
                          borderColor: "rgb(var(--primary-rgb) / 0.18)",
                          background: "rgb(var(--primary-rgb) / 0.10)",
                          color: "var(--text)",
                        }}
                      >
                        <span className="material-symbols-outlined text-2xl">menu_book</span>
                      </div>
                      <p className="mt-3 font-black">Không có ảnh bìa</p>
                      <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                        Chair có thể cập nhật ảnh bìa trong phần Publish.
                      </p>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-transparent" />

                  <div className="absolute left-4 bottom-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 text-[#181111] text-xs font-black">
                    <span className="material-symbols-outlined text-sm text-primary">verified</span>
                    Published
                  </div>
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className="rounded-2xl border p-4"
                      style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                    >
                      <p className="text-xs font-black uppercase" style={{ color: "var(--muted)" }}>
                        Conference
                      </p>
                      <p className="mt-1 text-sm font-black line-clamp-2">{confLabel}</p>
                    </div>

                    <div
                      className="rounded-2xl border p-4"
                      style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                    >
                      <p className="text-xs font-black uppercase" style={{ color: "var(--muted)" }}>
                        Published
                      </p>
                      <p className="mt-1 text-sm font-black">{published}</p>
                    </div>
                  </div>

                  {/* Hint nhỏ */}
                  <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                    Tip: Bạn có thể tìm nhanh theo <b>mã bài</b>, <b>track</b>, <b>tác giả</b> ở ô tìm kiếm phía dưới.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        {/* Header + Search */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">Danh sách bài trong kỷ yếu</h2>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              Tổng: {papers.length} bài • Hiển thị: {filtered.length} bài
            </p>
          </div>

          <div className="w-full md:w-[420px]">
            <div className="relative">
              <span
                className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg"
                style={{ color: "var(--muted)" }}
              >
                search
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm theo tiêu đề / tác giả / mã bài / track..."
                className="h-11 w-full rounded-2xl border pl-10 pr-3 text-sm outline-none"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              />
            </div>
          </div>
        </div>

        {/* MOBILE CARDS */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {filtered.map((p, idx) => {
            const pdfUrl = toPublicFileUrl(p?.pdf_raw);
            return (
              <div
                key={String(p?.paper_id ?? idx)}
                className="rounded-3xl border p-4"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black line-clamp-2">{p?.title || "--"}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                      #{String(idx + 1).padStart(2, "0")} • Paper #{p?.paper_id ?? "--"}
                      {p?.track_id != null ? ` • Track ${p.track_id}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-xs font-black px-2.5 py-1 rounded-full border" style={toneStyle("slate")}>
                    {pdfUrl ? "PDF" : "—"}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-sm" style={{ color: "var(--muted)" }}>
                    <span className="material-symbols-outlined align-middle text-base mr-1">person</span>
                    {pickCorrespondingName(p)}
                  </div>

                  {pdfUrl ? (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border font-black text-sm"
                      style={toneStyle("violet")}
                    >
                      <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                      Mở PDF
                    </a>
                  ) : (
                    <span className="text-sm" style={{ color: "var(--muted)" }}>
                      Không có file
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="rounded-3xl border p-6 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }}>
              Không có bài phù hợp.
            </div>
          )}
        </div>

        {/* DESKTOP TABLE */}
        <div
          className="hidden md:block rounded-3xl border shadow-sm overflow-hidden"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="overflow-x-auto w-full">
            <table className="min-w-full w-full text-left border-collapse">
              <thead className="text-xs font-black uppercase" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
                <tr>
                  <th className="px-6 py-4 w-[72px]">#</th>
                  <th className="px-6 py-4">Tiêu đề</th>
                  <th className="px-6 py-4 w-[240px]">Tác giả chính</th>
                  <th className="px-6 py-4 w-[160px]">PDF</th>
                </tr>
              </thead>

              <tbody style={{ borderTop: `1px solid var(--border)` }}>
                {filtered.map((p, idx) => {
                  const pdfUrl = toPublicFileUrl(p?.pdf_raw);
                  return (
                    <tr
                      key={String(p?.paper_id ?? idx)}
                      style={{ borderTop: `1px solid var(--border)` }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgb(var(--primary-rgb) / 0.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td className="px-6 py-4 text-sm font-semibold" style={{ color: "var(--muted)" }}>
                        {String(idx + 1).padStart(2, "0")}
                      </td>

                      <td className="px-6 py-4">
                        <p className="text-sm font-black line-clamp-2">{p?.title || "--"}</p>
                        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                          Paper #{p?.paper_id ?? "--"}
                          {p?.track_id != null ? ` • Track ${p.track_id}` : ""}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm" style={{ color: "var(--muted)" }}>
                        {pickCorrespondingName(p)}
                      </td>

                      <td className="px-6 py-4">
                        {pdfUrl ? (
                          <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border font-black text-sm transition"
                            style={toneStyle("violet")}
                          >
                            <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                            Mở PDF
                          </a>
                        ) : (
                          <span className="text-sm" style={{ color: "var(--muted)" }}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-sm" style={{ color: "var(--muted)" }}>
                      Không có bài phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {(meta?.copyright || "").trim() && (
            <div className="px-6 py-4 border-t" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {meta.copyright}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
