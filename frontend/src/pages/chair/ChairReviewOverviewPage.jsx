// src/pages/chair/ChairReviewOverviewPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import chairReviewApi from "../../api/chairReviewApi";

const STATUS_META = {
  SUBMITTED: { label: "Submitted", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  UNDER_REVIEW: { label: "Under review", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  ACCEPTED: { label: "Accepted", cls: "bg-green-50 text-green-700 border-green-200" },
  REJECTED: { label: "Rejected", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  REVISION_REQUIRED: { label: "Revision required", cls: "bg-purple-50 text-purple-700 border-purple-200" },
  WITHDRAWN: { label: "Withdrawn", cls: "bg-slate-50 text-slate-600 border-slate-200" },
};

const fmt = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
};

// review được tính là "đã submit" nếu is_draft=false hoặc submitted_at có giá trị
const isReviewSubmitted = (rv) => {
  const draft = rv?.is_draft;
  const submittedAt = rv?.submitted_at ?? rv?.submittedAt ?? null;
  return draft === false || !!submittedAt;
};

export default function ChairReviewOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]); // merged rows: computed summary + paper detail

  const fetchAll = async () => {
    setLoading(true);
    try {
      // 1) lấy tất cả assignments
      const assignments = await chairReviewApi.listAssignments();

      // group theo paper_id
      const byPaper = new Map();
      for (const a of assignments || []) {
        const pid = a?.paper_id ?? a?.paperId;
        if (pid == null) continue;
        const key = String(pid);
        if (!byPaper.has(key)) byPaper.set(key, []);
        byPaper.get(key).push(a);
      }

      const paperIds = Array.from(byPaper.keys());

      // 2) fetch reviews cho từng assignment để tính submitted_count & latest_submitted_at
      // NOTE: N+1 calls, nhưng chạy được ngay. Sau này tối ưu bằng backend summary endpoint.
      const paperSummaries = await Promise.all(
        paperIds.map(async (pidStr) => {
          const list = byPaper.get(pidStr) || [];
          const assigned_count = list.length;

          let submitted_count = 0;
          let latest_submitted_at = null;

          // fetch reviews của từng assignment
          const reviewFlags = await Promise.all(
            list.map(async (ass) => {
              try {
                const reviews = await chairReviewApi.listReviewsByAssignment(ass.id);
                const submittedReviews = (reviews || []).filter(isReviewSubmitted);

                if (submittedReviews.length > 0) {
                  // assignment này coi như đã chấm (ít nhất 1 review submit)
                  // tìm latest submitted_at của assignment
                  let latest = null;
                  for (const rv of submittedReviews) {
                    const t = rv?.submitted_at ?? rv?.submittedAt ?? null;
                    if (!t) continue;
                    const ms = new Date(t).getTime();
                    if (!Number.isNaN(ms)) {
                      if (latest == null || ms > latest) latest = ms;
                    }
                  }

                  if (latest != null) {
                    if (latest_submitted_at == null || latest > latest_submitted_at) {
                      latest_submitted_at = latest;
                    }
                  }
                  return true;
                }
                return false;
              } catch (e) {
                console.error("listReviewsByAssignment failed:", ass?.id, e);
                return false;
              }
            })
          );

          submitted_count = reviewFlags.filter(Boolean).length;

          return {
            paper_id: Number(pidStr),
            assigned_count,
            submitted_count,
            all_submitted: assigned_count > 0 && submitted_count >= assigned_count,
            latest_submitted_at: latest_submitted_at ? new Date(latest_submitted_at).toISOString() : null,
          };
        })
      );

      // 3) lấy paper detail từ submission-service (parallel)
      const details = await Promise.all(
        paperIds.map(async (pidStr) => {
          const pid = Number(pidStr);
          try {
            const p = await chairReviewApi.getPaperDetail(pid);
            return { paper_id: pid, paper: p };
          } catch (e) {
            console.error("getPaperDetail failed", pid, e);
            return { paper_id: pid, paper: null };
          }
        })
      );

      const paperMap = new Map(details.map((x) => [String(x.paper_id), x.paper]));

      // 4) merge
      const merged = (paperSummaries || []).map((s) => ({
        ...s,
        paper: paperMap.get(String(s.paper_id)) || null,
      }));

      // sort: paper mới / hoặc theo latest submitted
      merged.sort((a, b) => {
        const aT = a.latest_submitted_at ? new Date(a.latest_submitted_at).getTime() : 0;
        const bT = b.latest_submitted_at ? new Date(b.latest_submitted_at).getTime() : 0;
        if (bT !== aT) return bT - aT;
        return (b.paper_id || 0) - (a.paper_id || 0);
      });

      setRows(merged);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows || [];
    return (rows || []).filter((r) => {
      const p = r.paper || {};
      const title = String(p.title || "").toLowerCase();
      const pid = String(r.paper_id || "");
      return title.includes(kw) || pid.includes(kw);
    });
  }, [rows, q]);

  const doDecision = async (paperId, status) => {
    if (!paperId) return;
    const note = window.prompt("Ghi chú (tuỳ chọn):", "");
    const ok = window.confirm(`Xác nhận chuyển Paper #${paperId} -> ${status}?`);
    if (!ok) return;

    setActing(true);
    try {
      await chairReviewApi.decidePaper(paperId, { status, note: note || null });
      await fetchAll();
      alert("✅ Cập nhật quyết định thành công!");
    } catch (e) {
      console.error(e);
      alert("❌ Cập nhật quyết định thất bại. Xem console log.");
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-black text-slate-900">Chair • Phân công & Trạng thái chấm</h2>
            <p className="text-slate-500 mt-1">Xem danh sách paper đã được phân công, tiến độ review và ra quyết định.</p>
          </div>

          <button
            onClick={fetchAll}
            className="px-4 h-11 rounded-xl border bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            disabled={loading}
          >
            Làm mới
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <div className="relative max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                search
              </span>
              <input
                className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                placeholder="Tìm theo Paper ID hoặc Title..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-slate-500">Đang tải dữ liệu...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-slate-400">Chưa có paper nào được phân công.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white border-b z-10">
                  <tr>
                    <Th>Paper</Th>
                    <Th>Trạng thái Paper</Th>
                    <Th>Tiến độ chấm</Th>
                    <Th>Lần chấm gần nhất</Th>
                    <Th className="text-right">Hành động</Th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {filtered.map((r) => {
                    const p = r.paper || {};
                    const paperId = r.paper_id;
                    const title = p.title || "(Không lấy được title)";
                    const st = String(p.status || "—");
                    const meta = STATUS_META[st] || { label: st, cls: "bg-slate-50 text-slate-700 border-slate-200" };

                    const assigned = Number(r.assigned_count || 0);
                    const submitted = Number(r.submitted_count || 0);
                    const allDone = !!r.all_submitted;

                    return (
                      <tr key={`paper-${paperId}`} className="hover:bg-slate-50/60 transition">
                        <td className="px-5 py-4">
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 truncate">
                              #{paperId} — {title}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Assigned reviewers: <span className="font-bold text-slate-700">{assigned}</span>
                            </p>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold ${meta.cls}`}>
                            {meta.label}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-black border ${
                                allDone ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {submitted}/{assigned}
                            </span>
                            <span className="text-xs text-slate-500">{allDone ? "Đã chấm xong" : "Đang chấm"}</span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">{fmt(r.latest_submitted_at)}</td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={`/chair/reviews/paper/${paperId}`}
                              className="px-3 h-10 inline-flex items-center rounded-xl border bg-white font-bold text-slate-700 hover:bg-slate-50"
                            >
                              Chi tiết
                            </Link>

                            <button
                              className="px-3 h-10 rounded-xl bg-green-600 text-white font-bold disabled:opacity-50"
                              disabled={!allDone || acting || st === "ACCEPTED" || st === "REJECTED"}
                              onClick={() => doDecision(paperId, "ACCEPTED")}
                              title={!allDone ? "Chỉ ra quyết định khi đã chấm xong" : ""}
                            >
                              Accept
                            </button>

                            <button
                              className="px-3 h-10 rounded-xl bg-rose-600 text-white font-bold disabled:opacity-50"
                              disabled={!allDone || acting || st === "ACCEPTED" || st === "REJECTED"}
                              onClick={() => doDecision(paperId, "REJECTED")}
                              title={!allDone ? "Chỉ ra quyết định khi đã chấm xong" : ""}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500">
          * “Đã chấm xong” = tất cả assignment của paper có ít nhất 1 review đã submit (is_draft=false hoặc submitted_at có giá trị).
        </p>
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider ${className}`}>{children}</th>;
}
