// src/pages/chair/ChairReviewDetailPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import chairReviewApi from "../../api/chairReviewApi";
import reviewerApi from "../../api/reviewerApi";
import conferenceApi from "../../api/conferenceApi"; // ✅ IMPORT

// ---------- helpers ----------
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

const safeStr = (v) => (v === null || v === undefined ? "" : String(v));

const isReviewSubmitted = (rv) => {
  const draft = rv?.is_draft;
  const submittedAt = rv?.submitted_at ?? rv?.submittedAt ?? null;
  return draft === false || !!submittedAt;
};

// ✅ Helpers Date (từ ConferenceDetailPage)
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

function Pill({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold ${className}`}>
      {children}
    </span>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="p-3 rounded-xl border border-slate-200 bg-white">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-black text-slate-900 mt-1 break-words">{safeStr(value) || "—"}</p>
    </div>
  );
}

export default function ChairReviewDetailPage() {
  const { paperId: paperIdParam } = useParams();
  const navigate = useNavigate();

  const paperId = useMemo(() => Number(paperIdParam), [paperIdParam]);

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const [paper, setPaper] = useState(null); // submission paper detail
  const [reviewerAccounts, setReviewerAccounts] = useState([]); // identity users
  const [assignments, setAssignments] = useState([]); // assignments for this paper
  const [reviewsByAssignment, setReviewsByAssignment] = useState({}); // { [assignmentId]: ReviewOut[] }
  const [openReviewPanel, setOpenReviewPanel] = useState(() => new Set()); // expanded assignmentIds

  // ✅ STATES & LOGIC CAMERA-READY (Copy từ ConferenceDetailPage)
  const [phase, setPhase] = useState({
    camera_ready_open: false,
    camera_ready_deadline: null,
  });
  const [deadlineInput, setDeadlineInput] = useState("");

  const fetchPhase = async (confId) => {
    try {
      const ph = await conferenceApi.getConferencePhase(confId);
      setPhase(ph);
      setDeadlineInput(toDatetimeLocal(ph?.camera_ready_deadline));
    } catch (e) {
      console.error("getConferencePhase error:", e);
    }
  };

  const handleOpenCameraReady = async () => {
    if (!paper?.conference_id) return;
    try {
      await conferenceApi.openCameraReady(
        paper.conference_id,
        datetimeLocalToISO(deadlineInput)
      );
      alert("✅ Đã mở camera-ready");
      fetchPhase(paper.conference_id);
    } catch (e) {
      console.error(e);
      alert("❌ Mở camera-ready thất bại");
    }
  };

  const handleCloseCameraReady = async () => {
    if (!paper?.conference_id) return;
    try {
      await conferenceApi.closeCameraReady(paper.conference_id);
      alert("✅ Đã đóng camera-ready");
      fetchPhase(paper.conference_id);
    } catch (e) {
      console.error(e);
      alert("❌ Đóng camera-ready thất bại");
    }
  };
  // ============================================

  // computed summary
  const summary = useMemo(() => {
    const assigned = (assignments || []).length;

    let submitted = 0;
    let latestMs = null;

    for (const a of assignments || []) {
      const aid = String(a.id);
      const list = reviewsByAssignment[aid] || [];

      const submittedReviews = list.filter(isReviewSubmitted);
      if (submittedReviews.length > 0) {
        submitted += 1;

        // latest submitted_at among submitted reviews
        for (const rv of submittedReviews) {
          const t = rv?.submitted_at ?? rv?.submittedAt ?? null;
          if (!t) continue;
          const ms = new Date(t).getTime();
          if (Number.isNaN(ms)) continue;
          if (latestMs == null || ms > latestMs) latestMs = ms;
        }
      }
    }

    return {
      assigned_count: assigned,
      submitted_count: submitted,
      all_submitted: assigned > 0 && submitted >= assigned,
      latest_submitted_at: latestMs ? new Date(latestMs).toISOString() : null,
    };
  }, [assignments, reviewsByAssignment]);

  const fetchAll = async () => {
    if (!paperId || Number.isNaN(paperId)) return;

    setLoading(true);
    try {
      // 1) paper detail (submission-service)
      let p = null;
      try {
        p = await chairReviewApi.getPaperDetail(paperId);
      } catch (e) {
        console.error("getPaperDetail failed", paperId, e);
      }
      setPaper(p);

      // ✅ Gọi fetchPhase nếu có conference_id
      if (p?.conference_id) {
        await fetchPhase(p.conference_id);
      }

      // 2) reviewer accounts (identity-service)
      let accs = [];
      try {
        accs = await reviewerApi.getReviewerAccounts();
      } catch (e) {
        console.error("getReviewerAccounts failed", e);
      }
      setReviewerAccounts(Array.isArray(accs) ? accs : []);

      // 3) assignments for this paper (review-service)
      const ass = await chairReviewApi.listAssignments({ paper_id: paperId });
      const assList = Array.isArray(ass) ? ass : [];
      setAssignments(assList);

      // 4) reviews for each assignment
      const map = {};
      await Promise.all(
        assList.map(async (a) => {
          const aid = a?.id;
          if (!aid) return;
          try {
            const list = await chairReviewApi.listReviewsByAssignment(aid);
            map[String(aid)] = Array.isArray(list) ? list : [];
          } catch (e) {
            console.error("listReviewsByAssignment failed", aid, e);
            map[String(aid)] = [];
          }
        })
      );
      setReviewsByAssignment(map);

      // auto-expand assignments that already have submitted reviews
      const nextOpen = new Set();
      assList.forEach((a) => {
        const aid = String(a.id);
        const list = map[aid] || [];
        if (list.some(isReviewSubmitted)) nextOpen.add(aid);
      });
      setOpenReviewPanel(nextOpen);
    } catch (e) {
      console.error(e);
      setPaper(null);
      setReviewerAccounts([]);
      setAssignments([]);
      setReviewsByAssignment({});
      setOpenReviewPanel(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperIdParam]);

  const reviewerById = useMemo(() => {
    const m = new Map();
    (reviewerAccounts || []).forEach((u) => {
      if (u?.id != null) m.set(String(u.id), u);
    });
    return m;
  }, [reviewerAccounts]);

  const paperStatus = useMemo(() => safeStr(paper?.status || "—"), [paper]);
  const statusMeta = useMemo(() => {
    return STATUS_META[paperStatus] || {
      label: paperStatus,
      cls: "bg-slate-50 text-slate-700 border-slate-200",
    };
  }, [paperStatus]);

  const progress = useMemo(() => {
    const assigned = Number(summary?.assigned_count || 0);
    const submitted = Number(summary?.submitted_count || 0);
    const allDone = !!summary?.all_submitted;
    return { assigned, submitted, allDone };
  }, [summary]);

  const togglePanel = (assignmentId) => {
    const key = String(assignmentId);
    setOpenReviewPanel((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const doDecision = async (nextStatus) => {
    if (!paperId || Number.isNaN(paperId)) return;

    if (!progress.allDone) {
      alert("Chỉ ra quyết định khi tất cả reviewer đã submit review.");
      return;
    }

    const note = window.prompt("Ghi chú (tuỳ chọn):", "");
    const ok = window.confirm(`Xác nhận chuyển Paper #${paperId} -> ${nextStatus}?`);
    if (!ok) return;

    setActing(true);
    try {
      await chairReviewApi.decidePaper(paperId, { status: nextStatus, note: note || null });
      await fetchAll();
      alert("✅ Cập nhật quyết định thành công!");
    } catch (e) {
      console.error(e);
      alert("❌ Cập nhật quyết định thất bại. Xem console log.");
    } finally {
      setActing(false);
    }
  };

  const canDecide = useMemo(() => {
    if (!progress.allDone) return false;
    if (!paper) return false;
    if (paperStatus === "ACCEPTED" || paperStatus === "REJECTED") return false;
    return ["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUIRED"].includes(paperStatus);
  }, [progress.allDone, paperStatus, paper]);

  const headerTitle = useMemo(() => {
    const title = safeStr(paper?.title || "");
    return title ? `#${paperId} — ${title}` : `Paper #${paperId}`;
  }, [paperId, paper]);

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Top bar */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <button className="hover:text-slate-900 font-bold" onClick={() => navigate(-1)} type="button">
                ← Quay lại
              </button>
              <span className="text-slate-300">/</span>
              <Link to="/chair/reviews" className="hover:text-slate-900 font-bold">
                Danh sách
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-600">Chi tiết</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900 mt-2 truncate">{headerTitle}</h2>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Pill className={statusMeta.cls}>{statusMeta.label}</Pill>

              <Pill
                className={
                  progress.allDone
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }
              >
                Tiến độ: {progress.submitted}/{progress.assigned} • {progress.allDone ? "Đã chấm xong" : "Đang chấm"}
              </Pill>

              <Pill className="bg-white text-slate-700 border-slate-200">
                Latest submit: {fmt(summary?.latest_submitted_at)}
              </Pill>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAll}
              className="px-4 h-11 rounded-xl border bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={loading}
            >
              Làm mới
            </button>

            <button
              onClick={() => doDecision("ACCEPTED")}
              className="px-4 h-11 rounded-xl bg-green-600 text-white font-bold disabled:opacity-50"
              disabled={!canDecide || acting}
              title={!progress.allDone ? "Chỉ ra quyết định khi đã chấm xong" : ""}
            >
              Accept
            </button>

            <button
              onClick={() => doDecision("REJECTED")}
              className="px-4 h-11 rounded-xl bg-rose-600 text-white font-bold disabled:opacity-50"
              disabled={!canDecide || acting}
              title={!progress.allDone ? "Chỉ ra quyết định khi đã chấm xong" : ""}
            >
              Reject
            </button>
          </div>
        </div>

        {/* Paper meta + Camera-ready Config */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. Paper Info */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b bg-slate-50">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông tin paper</p>
              </div>

              {loading ? (
                <div className="p-6 text-slate-500">Đang tải paper...</div>
              ) : !paper ? (
                <div className="p-6 text-slate-400">Không lấy được thông tin paper từ submission-service.</div>
              ) : (
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-sm font-bold text-slate-500">Abstract</p>
                    <p className="text-slate-800 mt-1 whitespace-pre-wrap">{paper.abstract || "—"}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <p className="text-sm font-bold text-slate-500 mr-2">Keywords:</p>
                    {(paper.keywords || []).length ? (
                      (paper.keywords || []).map((k, idx) => (
                        <span key={`kw-${idx}`} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-semibold rounded">
                          {k}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <InfoBox label="Conference ID" value={safeStr(paper.conference_id)} />
                    <InfoBox label="Track ID" value={safeStr(paper.track_id)} />
                    <InfoBox label="Submitted at" value={fmt(paper.submitted_at)} />
                  </div>

                  {paper.decision_note ? (
                    <div className="p-4 rounded-xl border bg-slate-50">
                      <p className="text-xs font-bold text-slate-500 uppercase">Decision note</p>
                      <p className="text-slate-800 mt-1 whitespace-pre-wrap">{paper.decision_note}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* 2. ✅ NEW: Cấu hình Camera-ready (Toàn hội nghị) - Chỉ hiện khi load được paper */}
            {paper && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b bg-white flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Camera-ready & Proceedings</h3>
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

                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-black">Deadline camera-ready</label>
                      <input
                        type="datetime-local"
                        value={deadlineInput}
                        onChange={(e) => setDeadlineInput(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary mt-1"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Chair đặt deadline. Author chỉ nộp được khi camera-ready đang mở và còn hạn.
                      </p>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={handleOpenCameraReady}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition"
                      >
                        Mở
                      </button>

                      <button
                        type="button"
                        onClick={handleCloseCameraReady}
                        className="px-4 py-2 rounded-lg border font-bold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b bg-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tác giả</p>
            </div>

            {loading ? (
              <div className="p-6 text-slate-500">Đang tải...</div>
            ) : !paper ? (
              <div className="p-6 text-slate-400">—</div>
            ) : (
              <div className="p-5 space-y-3">
                {(paper.authors || []).length ? (
                  (paper.authors || []).map((a, idx) => (
                    <div key={`au-${idx}`} className="p-3 rounded-xl border border-slate-200 bg-white flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 truncate">
                          {a.full_name}{" "}
                          {a.is_corresponding ? <span className="text-xs text-rose-600">• Corresponding</span> : null}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{a.email}</p>
                        <p className="text-xs text-slate-600 mt-1 truncate">{a.organization || "—"}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400">—</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Assignments + Reviews */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* ... (Phần Assignments giữ nguyên y hệt) ... */}
          <div className="p-5 border-b bg-white flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phân công & trạng thái chấm</p>
              <p className="text-slate-500 mt-1 text-sm">Mỗi assignment hiển thị reviewer, trạng thái assignment và review (draft/submitted).</p>
            </div>

            <div className="flex items-center gap-2">
              <Pill className="bg-white text-slate-700 border-slate-200">
                Assigned: <span className="ml-1 font-black text-slate-900">{progress.assigned}</span>
              </Pill>
              <Pill className="bg-white text-slate-700 border-slate-200">
                Submitted: <span className="ml-1 font-black text-slate-900">{progress.submitted}</span>
              </Pill>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-slate-500">Đang tải assignments...</div>
          ) : !(assignments || []).length ? (
            <div className="p-6 text-slate-400">Paper này chưa có assignment nào.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-50 border-b z-10">
                  <tr>
                    <Th>Reviewer</Th>
                    <Th>Assignment</Th>
                    <Th>Review</Th>
                    <Th>Due</Th>
                    <Th className="text-right">Chi tiết</Th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {(assignments || []).map((a) => {
                    const aid = String(a.id);
                    const rid = String(a.reviewer_id);

                    const acc = reviewerById.get(rid) || null;
                    const reviewerName = acc?.full_name || acc?.name || `Reviewer #${rid}`;
                    const reviewerEmail = acc?.email || "";

                    const list = reviewsByAssignment[aid] || [];
                    const submittedReviews = list.filter(isReviewSubmitted);
                    const draftReviews = list.filter((r) => r && !isReviewSubmitted(r));

                    const hasSubmitted = submittedReviews.length > 0;
                    const statusCls = hasSubmitted
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-amber-50 text-amber-700 border-amber-200";

                    const expanded = openReviewPanel.has(aid);

                    // latest submitted_at for this assignment
                    let latest = null;
                    for (const rv of submittedReviews) {
                      const t = rv?.submitted_at ?? rv?.submittedAt ?? null;
                      if (!t) continue;
                      const ms = new Date(t).getTime();
                      if (!Number.isNaN(ms)) latest = latest == null ? ms : Math.max(latest, ms);
                    }

                    return (
                      <React.Fragment key={`ass-${aid}`}>
                        <tr className="hover:bg-slate-50/60 transition">
                          <td className="px-5 py-4">
                            <div className="min-w-0">
                              <p className="font-black text-slate-900 truncate">{reviewerName}</p>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{reviewerEmail || "—"}</p>
                              <p className="text-xs text-slate-600 mt-1 truncate">
                                ID: <span className="font-bold">{rid}</span>
                              </p>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="space-y-2">
                              <Pill className="bg-white text-slate-700 border-slate-200">Assignment #{aid}</Pill>
                              <Pill className="bg-white text-slate-700 border-slate-200">
                                Status: <span className="ml-1 font-black">{safeStr(a.status)}</span>
                              </Pill>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-2">
                              <Pill className={statusCls}>{hasSubmitted ? "Đã submit" : "Chưa submit"}</Pill>

                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">
                                  Submitted: <span className="font-bold text-slate-700">{submittedReviews.length}</span>
                                </span>
                                <span className="text-xs text-slate-500">
                                  Draft: <span className="font-bold text-slate-700">{draftReviews.length}</span>
                                </span>
                              </div>

                              <p className="text-xs text-slate-500">
                                Latest: <span className="font-semibold text-slate-700">{latest ? fmt(new Date(latest).toISOString()) : "—"}</span>
                              </p>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-700">
                            <div className="space-y-1">
                              <div>
                                Due: <span className="font-semibold">{fmt(a.due_date)}</span>
                              </div>
                              <div>
                                Response: <span className="font-semibold">{fmt(a.response_date)}</span>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => togglePanel(aid)}
                              className="px-3 h-10 rounded-xl border bg-white font-bold text-slate-700 hover:bg-slate-50"
                            >
                              {expanded ? "Ẩn" : "Xem"}
                            </button>
                          </td>
                        </tr>

                        {expanded ? (
                          <tr>
                            <td colSpan={5} className="px-5 pb-5">
                              <div className="mt-3 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                                <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
                                  <p className="text-sm font-black text-slate-900">Reviews của Assignment #{aid}</p>
                                  <span className="text-xs text-slate-500">
                                    Tổng: <span className="font-bold text-slate-700">{list.length}</span>
                                  </span>
                                </div>

                                {!list.length ? (
                                  <div className="p-4 text-slate-400">Chưa có review nào.</div>
                                ) : (
                                  <div className="divide-y">
                                    {list.map((rv) => {
                                      const isSubmitted = isReviewSubmitted(rv);
                                      return (
                                        <div key={`rv-${rv.id}`} className="p-4">
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                              <Pill className="bg-white text-slate-700 border-slate-200">Review #{rv.id}</Pill>
                                              <Pill
                                                className={
                                                  isSubmitted
                                                    ? "bg-green-50 text-green-700 border-green-200"
                                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                                }
                                              >
                                                {isSubmitted ? "Submitted" : "Draft"}
                                              </Pill>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                              Submitted at:{" "}
                                              <span className="font-semibold text-slate-700">{fmt(rv.submitted_at)}</span>
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                                            <InfoBox label="Final score" value={rv.final_score ?? "—"} />
                                            <InfoBox label="Confidence" value={rv.confidence_score ?? "—"} />
                                            <InfoBox label="Anonymous" value={rv.is_anonymous ? "Yes" : "No"} />
                                          </div>

                                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                                            <div className="p-3 rounded-xl border bg-slate-50">
                                              <p className="text-xs font-bold text-slate-500 uppercase">Content (Author)</p>
                                              <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{rv.content_author || "—"}</p>
                                            </div>

                                            <div className="p-3 rounded-xl border bg-slate-50">
                                              <p className="text-xs font-bold text-slate-500 uppercase">Content (PC/Chair)</p>
                                              <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{rv.content_pc || "—"}</p>
                                            </div>
                                          </div>

                                          {Array.isArray(rv.criterias) && rv.criterias.length ? (
                                            <div className="mt-4">
                                              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Criterias</p>
                                              <div className="overflow-auto rounded-xl border">
                                                <table className="w-full text-left">
                                                  <thead className="bg-white border-b">
                                                    <tr>
                                                      <th className="px-3 py-2 text-xs font-bold text-slate-500 uppercase">Name</th>
                                                      <th className="px-3 py-2 text-xs font-bold text-slate-500 uppercase">Grade</th>
                                                      <th className="px-3 py-2 text-xs font-bold text-slate-500 uppercase">Weight</th>
                                                      <th className="px-3 py-2 text-xs font-bold text-slate-500 uppercase">Comment</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y">
                                                    {rv.criterias.map((c) => (
                                                      <tr key={`cr-${c.id}`} className="bg-white">
                                                        <td className="px-3 py-2 text-sm text-slate-800">{c.criteria_name}</td>
                                                        <td className="px-3 py-2 text-sm text-slate-700">{c.grade ?? "—"}</td>
                                                        <td className="px-3 py-2 text-sm text-slate-700">{c.weight ?? "—"}</td>
                                                        <td className="px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">{c.comment || "—"}</td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500">
          * “Đã submit” = review có <code>is_draft=false</code> hoặc <code>submitted_at</code> khác null.
          • Nút Accept/Reject chỉ bật khi tất cả assignments đã submit.
        </p>
      </div>
    </div>
  );
}