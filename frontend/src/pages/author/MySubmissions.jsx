  import { useEffect, useMemo, useState } from "react";
  import { useNavigate } from "react-router-dom";
  import { listMySubmissions } from "../../api/submissionApi";
  import conferenceApi from "../../api/conferenceApi";



  // Map status -> label + style (bạn chỉnh lại theo enum backend)
  const STATUS_META = {
    SUBMITTED: { label: "Submitted", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    UNDER_REVIEW: { label: "Under review", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    ACCEPTED: { label: "Accepted", cls: "bg-green-50 text-green-700 border-green-200" },
    REJECTED: { label: "Rejected", cls: "bg-rose-50 text-rose-700 border-rose-200" },
    WITHDRAWN: { label: "Withdrawn", cls: "bg-slate-50 text-slate-600 border-slate-200" },
    REVISION_REQUIRED: { label: "Revision required", cls: "bg-purple-50 text-purple-700 border-purple-200" },
  };

  const TABS = [
    { key: "ALL", label: "Tất cả" },
    { key: "UNDER_REVIEW", label: "Đang đợi duyệt" },
    { key: "ACCEPTED", label: "Đã chấp nhận" },
    { key: "REJECTED_WITHDRAWN", label: "Từ chối/Rút bài" },
  ];

  function normalizeList(data) {
    // backend có thể trả array hoặc {items: []}
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }

  function formatDate(iso) {
    if (!iso) return "--";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "--";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  export default function MySubmissions() {
    const navigate = useNavigate();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [confMap, setConfMap] = useState({});

    const [tab, setTab] = useState("ALL");
    const [q, setQ] = useState("");

    // pagination (client-side)
    const [page, setPage] = useState(1);
    const pageSize = 8;

    useEffect(() => {
      (async () => {
        try {
          setLoading(true);
          setErr("");

          const data = await listMySubmissions();
          const list = normalizeList(data);
          setItems(list);

          // lấy danh sách conference_id duy nhất
          const ids = [...new Set(list.map(x => x.conference_id).filter(Boolean))];

          // gọi lấy conference detail để lấy name
          const results = await Promise.allSettled(
            ids.map(id => conferenceApi.getConferenceById(id))
          );

          const nextMap = {};
          results.forEach((r, idx) => {
            const id = ids[idx];
            if (r.status === "fulfilled" && r.value?.name) {
              nextMap[id] = r.value.name;
            }
          });

          setConfMap(nextMap);

        } catch (e) {
          setErr(e?.response?.data?.detail || "Không tải được danh sách bài nộp.");
        } finally {
          setLoading(false);
        }
      })();
    }, []);



    const counts = useMemo(() => {
      const c = {
        ALL: items.length,
        UNDER_REVIEW: 0,
        ACCEPTED: 0,
        REJECTED_WITHDRAWN: 0,
      };
      for (const it of items) {
        if (it.status === "UNDER_REVIEW" || it.status === "SUBMITTED") c.UNDER_REVIEW += 1;
        if (it.status === "ACCEPTED") c.ACCEPTED += 1;
        if (it.status === "REJECTED" || it.status === "WITHDRAWN") c.REJECTED_WITHDRAWN += 1;
      }
      return c;
    }, [items]);

    const filtered = useMemo(() => {
      const qq = q.trim().toLowerCase();

      let arr = items;

      if (tab === "UNDER_REVIEW") {
        arr = arr.filter((x) => x.status === "UNDER_REVIEW" || x.status === "SUBMITTED");
      } else if (tab === "ACCEPTED") {
        arr = arr.filter((x) => x.status === "ACCEPTED");
      } else if (tab === "REJECTED_WITHDRAWN") {
        arr = arr.filter((x) => x.status === "REJECTED" || x.status === "WITHDRAWN");
      }

      if (qq) {
        arr = arr.filter((x) => {
          const title = (x.title || "").toLowerCase();
          const conf = String(x.conference_id ?? "").toLowerCase();
          const track = String(x.track_id ?? "").toLowerCase();
          return title.includes(qq) || conf.includes(qq) || track.includes(qq);
        });
      }

      return arr;
    }, [items, tab, q]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paged = useMemo(() => {
      const p = Math.min(page, pageCount);
      const start = (p - 1) * pageSize;
      return filtered.slice(start, start + pageSize);
    }, [filtered, page, pageCount]);

    useEffect(() => {
      // đổi tab/search thì reset trang
      setPage(1);
    }, [tab, q]);

    return (
      <div className="bg-slate-50/50 min-h-[calc(100vh-64px)] overflow-x-hidden">
        {/* Header bar (giống style hiện tại) */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="text-slate-800 font-black">Bài nộp của tôi</div>
          </div>

          <button
            onClick={() => navigate("/author/submissions/new")}
            className="h-10 px-4 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-sm"
          >
            + Nộp bài mới
          </button>
        </div>

        <div className="max-w-5xl mx-auto p-6 md:p-8 pb-12 space-y-5">
          {/* Title + subtitle */}
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">Bài nộp của tôi</h1>
            <p className="text-sm text-slate-500 mt-1">Quản lý và theo dõi tiến độ các bài báo nghiên cứu của bạn.</p>
          </div>

          {/* Tabs + Search */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <div className="flex items-center gap-2 overflow-x-auto">
              {TABS.map((t) => {
                const active = tab === t.key;
                const count =
                  t.key === "ALL" ? counts.ALL :
                  t.key === "UNDER_REVIEW" ? counts.UNDER_REVIEW :
                  t.key === "ACCEPTED" ? counts.ACCEPTED :
                  counts.REJECTED_WITHDRAWN;

                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={[
                      "px-4 h-10 rounded-full border text-sm font-bold whitespace-nowrap transition",
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {t.label} <span className={active ? "text-white/90" : "text-slate-400"}>({count})</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full lg:w-[360px]">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Tìm kiếm theo tiêu đề..."
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
              </div>

              <button
                type="button"
                className="h-10 w-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                title="Bộ lọc"
                onClick={() => {}}
              >
                ⏷
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="min-w-full w-full table-fixed text-left">
                <thead className="bg-slate-50 text-xs font-black text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-3 w-[100px]">ID</th>
                    <th className="px-3 py-3">Tiêu đề bài báo</th>
                    <th className="px-3 py-3 w-[240px]">Hội nghị</th>
                    <th className="px-3 py-3 w-[140px]">Ngày nộp</th>
                    <th className="px-3 py-3 w-[160px]">Trạng thái</th>
                    <th className="px-3 py-3 w-[140px] text-right">Hành động</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td className="px-5 py-6 text-slate-500 font-semibold" colSpan={6}>
                        Đang tải dữ liệu...
                      </td>
                    </tr>
                  ) : err ? (
                    <tr>
                      <td className="px-5 py-6 text-rose-600 font-semibold" colSpan={6}>
                        {err}
                      </td>
                    </tr>
                  ) : paged.length === 0 ? (
                    <tr>
                      <td className="px-5 py-10 text-slate-500" colSpan={6}>
                        Không có bài nộp phù hợp.
                      </td>
                    </tr>
                  ) : (
                    paged.map((it) => {
                      const meta = STATUS_META[it.status] || { label: it.status, cls: "bg-slate-50 text-slate-600 border-slate-200" };
                      return (
                        <tr key={it.id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-4 text-slate-500 font-bold">#{String(it.id).padStart(4, "0")}</td>

                          <td className="px-5 py-4">
                            <div className="font-black text-slate-900 line-clamp-2 max-w-[420px]">
                              {it.title || "(Chưa có tiêu đề)"}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            <div className="font-semibold">
                              {confMap[it.conference_id] || `Conference #${it.conference_id}`}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600 font-semibold">
                            {formatDate(it.submitted_at || it.created_at)}
                          </td>

                          <td className="px-5 py-4">
                            <span className={["inline-flex items-center px-3 py-1 rounded-full border text-xs font-black", meta.cls].join(" ")}>
                              {meta.label}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2 whitespace-nowrap">
                              <button
                                onClick={() => navigate(`/author/submissions/${it.id}`)}
                                className="h-9 w-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                                title="Xem"
                              >
                                👁️
                              </button>

                              <button
                                onClick={() => navigate(`/author/submissions/${it.id}`)}
                                className="h-9 w-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                                title="Chi tiết"
                              >
                                ↗️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
              <div className="text-sm text-slate-500">
                Đang hiển thị {paged.length ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, filtered.length)} trên tổng số {filtered.length} bài nộp
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="h-9 w-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>

                {Array.from({ length: Math.min(pageCount, 5) }).map((_, i) => {
                  const n = i + 1;
                  const active = n === page;
                  return (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={[
                        "h-9 w-9 rounded-lg border font-black",
                        active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {n}
                    </button>
                  );
                })}

                <button
                  className="h-9 w-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          {/* Stats cards (giống ảnh) */}
          <div className="grid md:grid-cols-3 gap-4">
            <StatCard title="Tổng số bài nộp" value={counts.ALL} icon="📄" />
            <StatCard title="Được chấp nhận" value={counts.ACCEPTED} icon="✅" />
            <StatCard title="Đang chờ xử lý" value={counts.UNDER_REVIEW} icon="🕒" />
          </div>
        </div>
      </div>
    );
  }

  function StatCard({ title, value, icon }) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
        <div className="h-11 w-11 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-lg">
          {icon}
        </div>
        <div>
          <div className="text-xs font-black text-slate-500 uppercase">{title}</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{value}</div>
        </div>
      </div>
    );
  }
