import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import proceedingsPublishApi from "../../api/proceedingsPublishApi";

function safeArr(x) {
  return Array.isArray(x) ? x : [];
}

function pickCorrespondingName(p) {
  const authors = safeArr(p?.authors);
  const cor = authors.find((a) => a?.is_corresponding);
  return cor?.full_name || authors[0]?.full_name || "--";
}

/** helper: tailwind cannot compute rgb() well, so do inline style */
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

export default function ProceedingsIndexPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // search expand (giống MySubmissions)
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await proceedingsPublishApi.listCameraReadyStatusAll();
        setRows(res || []);
      } catch (e) {
        setErr(e?.response?.data?.detail || e?.message || "Không tải được danh sách kỷ yếu.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return rows;

    return safeArr(rows).filter((p) => {
      const t = String(p?.title || "").toLowerCase();
      const a = String(pickCorrespondingName(p) || "").toLowerCase();
      const conf = String(p?.conference_name || "").toLowerCase();
      return t.includes(keyword) || a.includes(keyword) || conf.includes(keyword);
    });
  }, [rows, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = useMemo(() => {
    const safePage = Math.min(page, pageCount);
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageCount]);

  useEffect(() => setPage(1), [q]);

  const visiblePages = useMemo(() => {
    const maxBtns = 5;
    const safePage = Math.min(page, pageCount);
    let start = Math.max(1, safePage - Math.floor(maxBtns / 2));
    let end = Math.min(pageCount, start + maxBtns - 1);
    start = Math.max(1, end - maxBtns + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, pageCount]);

  const onOpenPublish = (paper) => {
    const confId = paper?.conference_id;
    const paperId = paper?.id;
    if (!confId) return;
    navigate(`/chair/proceedings/${confId}?select=${paperId}`);
  };

  const primaryBtnStyle = {
    background: "var(--primary)",
    color: "#fff",
    boxShadow: "0 10px 25px rgb(var(--primary-rgb) / 0.20)",
  };

  return (
    <div
      className="min-h-[calc(100vh-64px)] overflow-x-hidden"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* Header bar */}
      <div
        className="h-16 flex items-center justify-between px-6 border-b"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-black" style={{ color: "var(--text)" }}>
            Kỷ yếu
          </h2>
        </div>

        <button
          onClick={() => navigate("/chair")}
          className="h-10 px-4 rounded-lg font-black transition active:scale-[0.98]"
          style={primaryBtnStyle}
          title="Về trang chủ Chair"
        >
          Về trang chủ
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-12 space-y-5">
        {/* Title */}
        <div>
          <h1 className="text-2xl md:text-3xl font-black" style={{ color: "var(--text)" }}>
            Danh sách bài Camera-ready
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Nhấn “Công bố” để vào trang cấu hình và công bố kỷ yếu theo hội nghị.
          </p>
        </div>

        {/* Box */}
        <div
          className="rounded-2xl border shadow-sm overflow-hidden"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {/* Toolbar */}
          <div
            className="flex flex-col lg:flex-row lg:items-center justify-between border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="px-6 py-4 flex items-center gap-3">
              <span
                className="inline-flex items-center px-3 py-1 rounded-full border text-xs font-black"
                style={toneStyle("green")}
              >
                <span className="size-1.5 rounded-full mr-1.5" style={{ backgroundColor: "currentColor", opacity: 0.6 }} />
                Camera-ready
              </span>

              <span className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
                Tổng: <b style={{ color: "var(--text)" }}>{filtered.length}</b> bài
              </span>
            </div>

            <div className="p-3 flex items-center gap-3">
              {!searchOpen ? (
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="h-10 w-10 rounded-lg border flex items-center justify-center transition"
                  style={{
                    background: "var(--surface-2)",
                    borderColor: "var(--border)",
                    color: "var(--muted)",
                  }}
                  title="Tìm kiếm"
                >
                  <span className="material-symbols-outlined">search</span>
                </button>
              ) : (
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
                    placeholder="Tìm theo tiêu đề / tác giả / hội nghị..."
                    autoFocus
                    onBlur={() => {
                      if (!q.trim()) setSearchOpen(false);
                    }}
                    className="h-10 rounded-lg border pl-10 pr-3 text-sm outline-none"
                    style={{
                      width: 380,
                      background: "var(--surface-2)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto w-full">
            <table className="min-w-full w-full text-left border-collapse">
              <thead
                className="text-xs font-black uppercase"
                style={{ background: "var(--surface-2)", color: "var(--muted)" }}
              >
                <tr>
                  <th className="px-6 py-4">Paper ID</th>
                  <th className="px-6 py-4">Tiêu đề</th>
                  <th className="px-6 py-4">Tác giả chính</th>
                  <th className="px-6 py-4">Conference</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>

              <tbody style={{ borderTop: `1px solid var(--border)` }}>
                {loading ? (
                  <tr>
                    <td className="px-6 py-10 font-semibold" style={{ color: "var(--muted)" }} colSpan={5}>
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : err ? (
                  <tr>
                    <td className="px-6 py-10 font-semibold" style={{ color: "rgb(244 63 94 / 0.95)" }} colSpan={5}>
                      {err}
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td className="px-6 py-12" style={{ color: "var(--muted)" }} colSpan={5}>
                      Không có dữ liệu phù hợp.
                    </td>
                  </tr>
                ) : (
                  paged.map((p) => (
                    <tr
                      key={p?.id}
                      className="transition"
                      style={{ borderTop: `1px solid var(--border)` }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgb(var(--primary-rgb) / 0.04)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <td className="px-6 py-4 text-sm font-semibold" style={{ color: "var(--muted)" }}>
                        #{String(p?.id ?? "").padStart(4, "0")}
                      </td>

                      <td className="px-6 py-4 max-w-xl">
                        <p className="text-sm font-black line-clamp-2" style={{ color: "var(--text)" }}>
                          {p?.title || "--"}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm" style={{ color: "var(--muted)" }}>
                        {pickCorrespondingName(p)}
                      </td>

                      <td className="px-6 py-4 text-sm" style={{ color: "var(--muted)" }}>
                        {p?.conference_name || `Conference #${p?.conference_id || "--"}`}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenPublish(p)}
                          className="h-10 px-4 rounded-lg font-black transition active:scale-[0.98] inline-flex items-center gap-2"
                          style={primaryBtnStyle}
                        >
                          <span className="material-symbols-outlined text-lg">publish</span>
                          Công bố
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            className="px-6 py-4 border-t flex items-center justify-between"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
          >
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Đang hiển thị {paged.length ? (page - 1) * pageSize + 1 : 0}-
              {Math.min(page * pageSize, filtered.length)} trên tổng số {filtered.length} bài
            </p>

            <div className="flex items-center gap-2">
              <button
                className="p-1.5 rounded border transition disabled:opacity-40"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                  color: "var(--muted)",
                }}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>

              {visiblePages.map((n) => {
                const active = n === page;
                return (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className="w-8 h-8 flex items-center justify-center rounded text-sm font-black border transition"
                    style={
                      active
                        ? {
                            background: "var(--primary)",
                            color: "#fff",
                            borderColor: "var(--primary)",
                          }
                        : {
                            background: "var(--surface)",
                            color: "var(--text)",
                            borderColor: "var(--border)",
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = "rgb(var(--primary-rgb) / 0.08)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = "var(--surface)";
                    }}
                  >
                    {n}
                  </button>
                );
              })}

              <button
                className="p-1.5 rounded border transition disabled:opacity-40"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                  color: "var(--muted)",
                }}
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Small stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Tổng camera-ready" value={filtered.length} icon="menu_book" tone="green" />
          <StatCard title="Hội nghị (ước tính)" value={new Set(filtered.map((x) => x?.conference_id)).size} icon="event" tone="primary" />
          <StatCard title="Đang hiển thị" value={paged.length} icon="visibility" tone="amber" />
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

  const toneStyle = (t) => {
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
      : toneStyle(tone);

  return (
    <div
      className="p-6 rounded-2xl border shadow-sm flex items-center gap-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
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
