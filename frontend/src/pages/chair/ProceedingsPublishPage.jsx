import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import proceedingsPublishApi from "../../api/proceedingsPublishApi";
import conferenceApi from "../../api/conferenceApi";
import { downloadBlob } from "../../utils/download";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8080";

function safeArr(x) {
  return Array.isArray(x) ? x : [];
}

function toPublicFileUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  let p = String(raw).trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (!p.startsWith("/uploads/")) p = `/uploads${p}`;
  return `${API_BASE}${encodeURI(p)}`;
}

function pickCorrespondingName(paper) {
  const authors = safeArr(paper?.authors);
  const cor = authors.find((a) => a?.is_corresponding);
  return cor?.full_name || authors[0]?.full_name || "--";
}

/** Inline tone badge style (same idea as MySubmissions) */
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

const primaryBtnStyle = {
  background: "var(--primary)",
  color: "#fff",
  boxShadow: "0 10px 25px rgb(var(--primary-rgb) / 0.20)",
};

export default function ProceedingsPublishPage() {
  const navigate = useNavigate();
  const { conferenceId } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [confName, setConfName] = useState("");

  // published flag (lock UI)
  const [isPublished, setIsPublished] = useState(false);

  const [meta, setMeta] = useState({
    title: "",
    isbn_issn: "",
    volume: "",
    publisher: "",
    published_date: "",
    cover_image_url: "",
    preface: "",
    copyright: "",
  });

  const [papers, setPapers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const selectedCount = selected.size;

  const coverPreviewUrl = useMemo(
    () => (meta.cover_image_url ? toPublicFileUrl(meta.cover_image_url) : ""),
    [meta.cover_image_url]
  );

  // progress of selection
  const progress = useMemo(() => {
    if (!papers.length) return 0;
    return Math.round((selectedCount / papers.length) * 100);
  }, [papers.length, selectedCount]);

  const readonly = isPublished || saving;

  // -----------------------------
  // Data loading
  // -----------------------------
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setErr("");

        // 1) load conference name (best effort)
        try {
          const conf = await conferenceApi.getConferenceById?.(Number(conferenceId));
          if (conf?.name) setConfName(conf.name);
        } catch {}

        // 2) load meta
        const metaRes = await proceedingsPublishApi.getMeta(Number(conferenceId));

        setIsPublished(!!metaRes?.is_published);

        setMeta({
          title: metaRes?.title || "",
          isbn_issn: metaRes?.isbn_issn || "",
          volume: metaRes?.volume || "",
          publisher: metaRes?.publisher || "",
          published_date: metaRes?.published_date || "",
          cover_image_url: metaRes?.cover_image_url || "",
          preface: metaRes?.preface || "",
          copyright: metaRes?.copyright || "",
        });

        // 3) load papers camera-ready
        const list = await proceedingsPublishApi.listCameraReadyStatus(Number(conferenceId));
        setPapers(list || []);

        // 4) selected from server
        const initial = new Set((metaRes?.paper_ids || []).map((x) => Number(x)));
        setSelected(initial);
      } catch (e) {
        setErr(e?.response?.data?.detail || e?.message || "Không tải được dữ liệu kỷ yếu.");
      } finally {
        setLoading(false);
      }
    };

    if (conferenceId) run();
  }, [conferenceId]);

  // -----------------------------
  // Selection helpers
  // -----------------------------
  const toggleAll = (checked) => {
    if (readonly) return;
    if (!checked) {
      setSelected(new Set());
      return;
    }
    const all = new Set(papers.map((p) => Number(p.id)));
    setSelected(all);
  };

  const toggleOne = (paperId) => {
    if (readonly) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const id = Number(paperId);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // -----------------------------
  // Actions
  // -----------------------------
  const onPickCover = async (file) => {
    if (!file || readonly) return;
    try {
      setSaving(true);
      setErr("");
      const res = await proceedingsPublishApi.uploadCover(Number(conferenceId), file);
      setMeta((m) => ({ ...m, cover_image_url: res?.cover_image_url || "" }));
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Upload ảnh bìa thất bại.");
    } finally {
      setSaving(false);
    }
  };

  // Save meta + selected papers (used before publish)
  const saveBeforePublish = async () => {
    if (!meta.title?.trim()) throw new Error("Tên kỷ yếu là bắt buộc.");

    await proceedingsPublishApi.saveMeta(Number(conferenceId), {
      title: meta.title,
      isbn_issn: meta.isbn_issn || null,
      volume: meta.volume || null,
      publisher: meta.publisher || null,
      published_date: meta.published_date || null,
      cover_image_url: meta.cover_image_url || null,
      preface: meta.preface || null,
      copyright: meta.copyright || null,
    });

    await proceedingsPublishApi.setPapers(Number(conferenceId), Array.from(selected));
  };

  const publish = async () => {
    try {
      if (isPublished) return;

      setSaving(true);
      setErr("");

      await saveBeforePublish();
      await proceedingsPublishApi.publish(Number(conferenceId));

      // lock UI immediately
      setIsPublished(true);

      // go success page
      navigate(`/chair/proceedings/${conferenceId}/success`, {
        state: { confName, title: meta.title },
      });
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Công bố thất bại.");
    } finally {
      setSaving(false);
    }
  };

  // ✅ Export ONLY 1 PDF proceedings
  const exportProceedingsPdf = async () => {
    try {
      setSaving(true);
      setErr("");

      // Bạn cần backend hỗ trợ format pdf ở exportFile
      const blob = await proceedingsPublishApi.exportFile(Number(conferenceId), "pdf", "published");
      const realBlob = blob instanceof Blob ? blob : blob?.data instanceof Blob ? blob.data : null;
      if (!realBlob) throw new Error("Invalid blob response");

      downloadBlob(realBlob, `proceedings_conference_${conferenceId}.pdf`);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Xuất PDF kỷ yếu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------
  // Render states
  // -----------------------------
  if (loading) {
    return (
      <div className="p-8 font-semibold" style={{ color: "var(--muted)" }}>
        Đang tải...
      </div>
    );
  }

  return (
    <div
      className="min-h-[calc(100vh-64px)] overflow-x-hidden"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* Header bar (NO publish button here) */}
      <div
        className="h-16 flex items-center justify-between px-6 border-b"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="size-10 rounded-xl border flex items-center justify-center"
            style={{
              background: "rgb(var(--primary-rgb) / 0.10)",
              borderColor: "rgb(var(--primary-rgb) / 0.25)",
              color: "var(--primary)",
            }}
          >
            <span className="material-symbols-outlined">menu_book</span>
          </span>

          <div>
            <h2 className="text-lg font-black">Công bố Kỷ yếu</h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {confName ? `Hội nghị: ${confName}` : `Conference #${conferenceId}`}
            </p>
          </div>

          <span
            className="ml-3 inline-flex items-center px-3 py-1 rounded-full border text-xs font-black"
            style={isPublished ? toneStyle("green") : toneStyle("amber")}
            title={isPublished ? "Kỷ yếu đã công bố" : "Chưa công bố"}
          >
            <span
              className="size-1.5 rounded-full mr-1.5"
              style={{ backgroundColor: "currentColor", opacity: 0.6 }}
            />
            {isPublished ? "Đã kỷ yếu" : "Chưa công bố"}
          </span>
        </div>

        <button
          onClick={() => navigate("/chair/proceedings")}
          className="h-10 px-4 rounded-lg font-black border transition"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgb(var(--primary-rgb) / 0.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
        >
          ← Danh sách kỷ yếu
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-12 space-y-5">
        {/* Error */}
        {err && (
          <div
            className="p-4 rounded-2xl border font-semibold"
            style={{
              borderColor: "rgb(244 63 94 / 0.25)",
              background: "rgb(244 63 94 / 0.08)",
              color: "rgb(244 63 94 / 0.95)",
            }}
          >
            {err}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Đã chọn" value={`${selectedCount}/${papers.length}`} icon="done_all" tone="green" />
          <StatCard title="Tiến độ chọn" value={`${progress}%`} icon="monitoring" tone="amber" />
          <StatCard title="Trạng thái" value={isPublished ? "Đã kỷ yếu" : saving ? "Đang xử lý..." : "Sẵn sàng"} icon="bolt" tone="primary" />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section 1: meta */}
            <div
              className="rounded-2xl border shadow-sm overflow-hidden"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div
                className="px-6 py-5 border-b flex items-center justify-between"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <h3 className="text-lg font-black">Phần 1: Thông tin kỷ yếu</h3>
                  <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
                    Điền metadata, ảnh bìa, lời nói đầu và bản quyền.
                  </p>
                </div>

                <span className="inline-flex items-center px-3 py-1 rounded-full border text-xs font-black" style={toneStyle("violet")}>
                  <span className="size-1.5 rounded-full mr-1.5" style={{ backgroundColor: "currentColor", opacity: 0.6 }} />
                  Meta
                </span>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-sm font-black" style={{ color: "var(--text)" }}>
                    Tên kỷ yếu <span style={{ color: "var(--primary)" }}>*</span>
                  </span>
                  <input
                    disabled={readonly}
                    className="h-11 px-4 rounded-lg border text-sm outline-none disabled:opacity-70"
                    style={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                    placeholder="Nhập tên chính thức của kỷ yếu"
                    value={meta.title}
                    onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-black">Mã số ISBN/ISSN</span>
                  <input
                    disabled={readonly}
                    className="h-11 px-4 rounded-lg border text-sm outline-none disabled:opacity-70"
                    style={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                    placeholder="Ví dụ: 978-3-16-148410-0"
                    value={meta.isbn_issn}
                    onChange={(e) => setMeta((m) => ({ ...m, isbn_issn: e.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-black">Tên viết tắt / Volume</span>
                  <input
                    disabled={readonly}
                    className="h-11 px-4 rounded-lg border text-sm outline-none disabled:opacity-70"
                    style={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                    placeholder="Ví dụ: VTS 2026 / Vol.1"
                    value={meta.volume}
                    onChange={(e) => setMeta((m) => ({ ...m, volume: e.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-black">Nhà xuất bản</span>
                  <input
                    disabled={readonly}
                    className="h-11 px-4 rounded-lg border text-sm outline-none disabled:opacity-70"
                    style={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                    placeholder="Tên đơn vị xuất bản"
                    value={meta.publisher}
                    onChange={(e) => setMeta((m) => ({ ...m, publisher: e.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-black">Ngày xuất bản</span>
                  <input
                    disabled={readonly}
                    type="date"
                    className="h-11 px-4 rounded-lg border text-sm outline-none disabled:opacity-70"
                    style={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                    value={meta.published_date || ""}
                    onChange={(e) => setMeta((m) => ({ ...m, published_date: e.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-sm font-black">Lời nói đầu (Preface)</span>
                  <textarea
                    disabled={readonly}
                    rows={5}
                    className="px-4 py-3 rounded-lg border text-sm outline-none disabled:opacity-70"
                    style={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                    placeholder="Nhập lời nói đầu..."
                    value={meta.preface}
                    onChange={(e) => setMeta((m) => ({ ...m, preface: e.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-sm font-black">Thông tin bản quyền</span>
                  <textarea
                    disabled={readonly}
                    rows={4}
                    className="px-4 py-3 rounded-lg border text-sm outline-none disabled:opacity-70"
                    style={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                    placeholder="Ví dụ: © 2026 UTH. All rights reserved..."
                    value={meta.copyright}
                    onChange={(e) => setMeta((m) => ({ ...m, copyright: e.target.value }))}
                  />
                </label>
              </div>
            </div>

            {/* Section 2: papers */}
            <div
              className="rounded-2xl border shadow-sm overflow-hidden"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div
                className="px-6 py-5 border-b flex items-center justify-between"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <h3 className="text-lg font-black">Phần 2: Chọn bài Camera-ready</h3>
                  <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
                    Tick các bài sẽ đưa vào kỷ yếu.
                  </p>
                </div>

                <span className="inline-flex items-center px-3 py-1 rounded-full border text-xs font-black" style={toneStyle("green")}>
                  <span className="size-1.5 rounded-full mr-1.5" style={{ backgroundColor: "currentColor", opacity: 0.6 }} />
                  Đã chọn: {selectedCount}/{papers.length}
                </span>
              </div>

              <div className="overflow-x-auto w-full">
                <table className="min-w-full w-full text-left border-collapse">
                  <thead className="text-xs font-black uppercase" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
                    <tr>
                      <th className="px-6 py-4 w-12">
                        <input
                          type="checkbox"
                          disabled={readonly}
                          checked={papers.length > 0 && selectedCount === papers.length}
                          onChange={(e) => toggleAll(e.target.checked)}
                        />
                      </th>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Tiêu đề bài báo</th>
                      <th className="px-6 py-4">Tác giả chính</th>
                      <th className="px-6 py-4">Trạng thái</th>
                    </tr>
                  </thead>

                  <tbody style={{ borderTop: `1px solid var(--border)` }}>
                    {papers.map((p) => {
                      const id = Number(p.id);
                      const checked = selected.has(id);

                      return (
                        <tr
                          key={id}
                          className="transition"
                          style={{ borderTop: `1px solid var(--border)` }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgb(var(--primary-rgb) / 0.04)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              disabled={readonly}
                              checked={checked}
                              onChange={() => toggleOne(id)}
                            />
                          </td>

                          <td className="px-6 py-4 text-sm font-semibold" style={{ color: "var(--muted)" }}>
                            #{String(id).padStart(4, "0")}
                          </td>

                          <td className="px-6 py-4 max-w-xl">
                            <p className="text-sm font-black line-clamp-2" style={{ color: "var(--text)" }}>
                              {p.title || "--"}
                            </p>
                          </td>

                          <td className="px-6 py-4 text-sm" style={{ color: "var(--muted)" }}>
                            {pickCorrespondingName(p)}
                          </td>

                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-black" style={toneStyle("green")}>
                              <span className="size-1.5 rounded-full mr-1.5" style={{ backgroundColor: "currentColor", opacity: 0.6 }} />
                              Camera-ready
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {papers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-sm" style={{ color: "var(--muted)" }}>
                          Chưa có bài camera-ready.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {isPublished && (
                <div
                  className="px-6 py-4 border-t text-sm font-semibold"
                  style={{
                    borderColor: "var(--border)",
                    background: "rgb(34 197 94 / 0.06)",
                    color: "rgb(34 197 94 / 0.95)",
                  }}
                >
                  ✅ Kỷ yếu đã công bố. Dữ liệu đã được khóa để đảm bảo tính toàn vẹn.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-1 space-y-6">
            {/* Cover */}
            <div
              className="rounded-2xl border shadow-sm overflow-hidden"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="px-6 py-5 border-b" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-lg font-black">Ảnh bìa</h3>
                <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
                  Upload PNG/JPG/WebP (khuyến nghị 1200×1600).
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div
                  className="rounded-2xl border overflow-hidden aspect-[3/4]"
                  style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                >
                  {coverPreviewUrl ? (
                    <img src={coverPreviewUrl} alt="cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm" style={{ color: "var(--muted)" }}>
                      Chưa có ảnh bìa
                    </div>
                  )}
                </div>

                <input
                  disabled={readonly}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => onPickCover(e.target.files?.[0])}
                />

                {readonly && (
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {isPublished ? "Ảnh bìa đã khóa sau khi công bố." : "Đang xử lý..."}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div
              className="rounded-2xl border shadow-sm overflow-hidden"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="px-6 py-5 border-b" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-lg font-black">Hành động</h3>

                {!isPublished ? (
                  <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
                    Kiểm tra dữ liệu rồi nhấn “Xác nhận & Công bố”. Sau khi công bố, hệ thống sẽ khóa chỉnh sửa.
                  </p>
                ) : (
                  <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
                    Kỷ yếu đã công bố. Bạn có thể tải PDF kỷ yếu hoặc mở trang Public.
                  </p>
                )}
              </div>

              <div className="p-6 space-y-3">
                {!isPublished ? (
                  <button
                    onClick={publish}
                    disabled={saving}
                    className="w-full h-11 rounded-lg font-black transition disabled:opacity-60 active:scale-[0.98]"
                    style={primaryBtnStyle}
                    title="Xác nhận & Công bố"
                  >
                    {saving ? "Đang xử lý..." : "Xác nhận & Công bố"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => navigate(`/proceedings/${conferenceId}`)}
                      className="w-full h-11 rounded-lg font-black transition active:scale-[0.98]"
                      style={primaryBtnStyle}
                    >
                      Mở trang Public
                    </button>

                    <button
                      onClick={exportProceedingsPdf}
                      disabled={saving}
                      className="w-full h-11 rounded-lg font-black border transition disabled:opacity-60"
                      style={toneStyle("blue")}
                      title="Tải 1 file PDF kỷ yếu"
                    >
                      {saving ? "Đang tải..." : "Tải PDF kỷ yếu"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Progress */}
            <div className="rounded-2xl border shadow-sm p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-black">Mức độ chọn paper</p>
                <p className="text-sm font-black" style={{ color: "var(--primary)" }}>
                  {progress}%
                </p>
              </div>

              <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "rgb(var(--primary-rgb) / 0.12)" }}>
                <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "var(--primary)" }} />
              </div>

              <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
                Đã chọn: {selectedCount} / {papers.length} bài.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, tone = "primary" }) {
  const map = {
    blue: "59 130 246",
    amber: "245 158 11",
    green: "34 197 94",
    rose: "244 63 94",
    violet: "139 92 246",
    slate: "100 116 139",
  };

  const toneStyleLocal = (t) => {
    const rgb = map[t] || map.slate;
    return {
      borderColor: `rgb(${rgb} / 0.25)`,
      backgroundColor: `rgb(${rgb} / 0.12)`,
      color: `rgb(${rgb} / 0.95)`,
    };
  };

  const style =
    tone === "primary"
      ? {
          backgroundColor: "rgb(var(--primary-rgb) / 0.12)",
          borderColor: "rgb(var(--primary-rgb) / 0.25)",
          color: "var(--primary)",
        }
      : toneStyleLocal(tone);

  return (
    <div className="p-6 rounded-2xl border shadow-sm flex items-center gap-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="size-12 rounded-xl border flex items-center justify-center" style={style}>
        <span className="material-symbols-outlined text-3xl">{icon}</span>
      </div>

      <div>
        <p className="text-xs uppercase font-black tracking-tight" style={{ color: "var(--muted)" }}>
          {title}
        </p>
        <p className="text-2xl font-black" style={{ color: "var(--text)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}
