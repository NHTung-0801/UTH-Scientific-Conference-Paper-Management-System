import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import reviewApi from "../../api/reviewApi";
import { useAuth } from "../../context/AuthContext";

const STATUS = {
  INVITED: "Invited",
  ACCEPTED: "Accepted",
  COMPLETED: "Completed",
  DECLINED: "Declined",
  COI: "COI",
};

const STATUS_LABEL = {
  [STATUS.INVITED]: "Mời mới",
  [STATUS.ACCEPTED]: "Đã nhận",
  [STATUS.COMPLETED]: "Đã nộp review",
  [STATUS.DECLINED]: "Từ chối",
  [STATUS.COI]: "COI",
};

const TABS = [
  { key: STATUS.INVITED, label: "Mời mới" },
  { key: STATUS.ACCEPTED, label: "Đã nhận" },
  { key: STATUS.COMPLETED, label: "Đã nộp review" },
  { key: STATUS.DECLINED, label: "Từ chối" },
  { key: STATUS.COI, label: "COI" },
];

function daysLeft(dueDate) {
  if (!dueDate) return null;
  const due = new Date(dueDate).getTime();
  if (!Number.isFinite(due)) return null;
  const now = Date.now();
  const diff = due - now;
  const d = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return Number.isFinite(d) ? d : null;
}

function formatDateVN(dueDate) {
  if (!dueDate) return "";
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function clampText(v, fallback = "") {
  const s = (v ?? "").toString().trim();
  return s.length ? s : fallback;
}

/**
 * Normalize status from backend (case-insensitive)
 * plus fallback logic if backend returns custom strings.
 */
function normalizeStatus(raw) {
  const s = (raw ?? "").toString().trim();
  if (!s) return STATUS.INVITED;

  const u = s.toLowerCase();
  if (u === "invited") return STATUS.INVITED;
  if (u === "accepted") return STATUS.ACCEPTED;
  if (u === "completed") return STATUS.COMPLETED;
  if (u === "declined") return STATUS.DECLINED;

  // If backend already supports COI:
  if (u === "coi" || u === "conflict" || u === "conflict_of_interest")
    return STATUS.COI;

  // Unknown -> keep but fallback to invited
  return STATUS.INVITED;
}

function chipClassByStatus(status) {
  switch (status) {
    case STATUS.INVITED:
      return "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:ring-blue-700/40";
    case STATUS.ACCEPTED:
      return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-700/40";
    case STATUS.COMPLETED:
      return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/40";
    case STATUS.DECLINED:
      return "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-zinc-800 dark:text-slate-200 dark:ring-zinc-700/60";
    case STATUS.COI:
      return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:ring-rose-700/40";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-zinc-800 dark:text-slate-200 dark:ring-zinc-700/60";
  }
}

function dueBadge(dLeft) {
  if (dLeft === null) return null;
  // SLA display
  if (dLeft < 0) {
    return {
      icon: "warning",
      text: "Quá hạn",
      cls: "text-rose-600 dark:text-rose-300 font-bold",
    };
  }
  if (dLeft <= 3) {
    return {
      icon: "timer",
      text: `Còn ${dLeft} ngày`,
      cls: "text-primary font-bold",
    };
  }
  return {
    icon: "schedule",
    text: `Còn ${dLeft} ngày`,
    cls: "text-slate-500 dark:text-slate-400 font-medium",
  };
}

export default function ReviewerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [active, setActive] = useState(STATUS.INVITED);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  // Optional UI states
  const [q, setQ] = useState("");

  // Your context says you might test by admin; reviewerId should be from logged-in user.
  const reviewerId = user?.id;

  const load = async () => {
    if (!reviewerId) return;
    setLoading(true);
    setErr("");
    try {
      const res = await reviewApi.listAssignments({ reviewerId });
      const raw = res?.data ?? [];

      // Normalize + enrich fields for UI
      const normalized = raw.map((x) => {
        const st = normalizeStatus(x.status);
        const dLeft = daysLeft(x.due_date);
        const isOverdue = dLeft !== null && dLeft < 0 && st !== STATUS.COMPLETED;
        return {
          ...x,
          status: st,
          __daysLeft: dLeft,
          __isOverdue: isOverdue,
          // Derived: show SLA line clearly
          __slaText:
            dLeft === null
              ? "SLA: Chưa có hạn chót"
              : dLeft < 0
              ? `SLA: Quá hạn ${Math.abs(dLeft)} ngày`
              : `SLA: Còn ${dLeft} ngày`,
        };
      });

      setItems(normalized);
    } catch (e) {
      setErr(
        e?.response?.data?.detail || e?.message || "Không tải được danh sách"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewerId]);

  const counts = useMemo(() => {
    const c = {
      [STATUS.INVITED]: 0,
      [STATUS.ACCEPTED]: 0,
      [STATUS.COMPLETED]: 0,
      [STATUS.DECLINED]: 0,
      [STATUS.COI]: 0,
    };
    for (const x of items) c[x.status] = (c[x.status] || 0) + 1;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const list = items.filter((x) => x.status === active);

    const keyword = q.trim().toLowerCase();
    if (!keyword) return list;

    return list.filter((x) => {
      const title = (x.paper_title ?? x.title ?? "").toString().toLowerCase();
      const track = (x.track_name ?? x.track ?? "").toString().toLowerCase();
      const pid = (x.paper_id ?? "").toString().toLowerCase();
      const aid = (x.id ?? "").toString().toLowerCase();
      return (
        title.includes(keyword) ||
        track.includes(keyword) ||
        pid.includes(keyword) ||
        aid.includes(keyword)
      );
    });
  }, [items, active, q]);

  // Actions
  const onAccept = async (assignmentId) => {
    await reviewApi.updateAssignment(assignmentId, { status: STATUS.ACCEPTED });
    await load();
  };

  const onDecline = async (assignmentId) => {
    await reviewApi.updateAssignment(assignmentId, { status: STATUS.DECLINED });
    await load();
  };

  // COI declaration
  const onDeclareCOI = async (a) => {
    await reviewApi.declareCOI({
      paper_id: a.paper_id,
      reviewer_id: reviewerId,
      type: "Manual_Declared",
      description: "Reviewer declared COI",
    });
    await load();
  };


  // Rebuttal/Discussion navigation (optional in your routes: /reviewer/discussion/:paperId exists)
  const openDiscussion = (paperId) => navigate(`/reviewer/discussion/${paperId}`);

  // Review workspace (exists in routes: /reviewer/review/:assignmentId)
  const openWorkspace = (assignmentId) =>
    navigate(`/reviewer/review/${assignmentId}`);

  // NOTE: Double-blind rule: DO NOT show author info. We intentionally do not render author fields.

  const stats = useMemo(() => {
    const total = items.length;
    const completed = counts[STATUS.COMPLETED] ?? 0;
    const accepted = counts[STATUS.ACCEPTED] ?? 0;
    const invited = counts[STATUS.INVITED] ?? 0;
    const declined = counts[STATUS.DECLINED] ?? 0;
    const coi = counts[STATUS.COI] ?? 0;

    const inProgress = accepted; // accepted ≈ in progress (until completed)
    const pendingInvites = invited;

    // Overdue derived:
    const overdue = items.filter((x) => x.__isOverdue).length;

    return { total, completed, inProgress, pendingInvites, declined, coi, overdue };
  }, [items, counts]);

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display transition-colors duration-200">
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-16 py-8">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          {/* Heading */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Reviewer Dashboard
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-base">
                Quản lý lời mời, trạng thái assignment, SLA review và thảo luận/rebuttal (nếu có).
              </p>
            </div>

            {/* Search */}
            <div className="w-full md:w-[360px]">
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  style={{ fontSize: 20 }}
                >
                  search
                </span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-3 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  placeholder="Tìm paper / track / ID..."
                  type="text"
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">
                  Tổng assignment
                </p>
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {stats.total}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Mời mới: <span className="font-bold">{stats.pendingInvites}</span> • Đã nhận:{" "}
                  <span className="font-bold">{stats.inProgress}</span>
                </p>
              </div>
              <div className="size-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
                  assignment
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">
                  Đã nộp review
                </p>
                <p className="text-3xl font-extrabold text-primary">{stats.completed}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Từ chối: <span className="font-bold">{stats.declined}</span> • COI:{" "}
                  <span className="font-bold">{stats.coi}</span>
                </p>
              </div>
              <div className="size-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
                  check_circle
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">
                  SLA / Quá hạn
                </p>
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {stats.overdue}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Quá hạn được tính khi due_date &lt; hôm nay và chưa “Đã nộp review”.
                </p>
              </div>
              <div className="size-12 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-600">
                <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
                  warning
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-200 dark:border-slate-700 mt-2">
            <nav aria-label="Tabs" className="-mb-px flex space-x-6 overflow-x-auto">
              {TABS.map((t) => {
                const isActive = active === t.key;
                const n = counts[t.key] ?? 0;

                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActive(t.key)}
                    className={
                      isActive
                        ? "border-primary text-primary whitespace-nowrap border-b-[3px] py-4 px-1 text-sm font-black flex items-center gap-2"
                        : "border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-300 whitespace-nowrap border-b-[3px] py-4 px-1 text-sm font-bold flex items-center gap-2"
                    }
                  >
                    {t.label}
                    <span
                      className={
                        isActive
                          ? "bg-primary/10 text-primary py-0.5 px-2.5 rounded-full text-xs font-bold"
                          : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 py-0.5 px-2.5 rounded-full text-xs font-bold"
                      }
                    >
                      {n}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex flex-col gap-4 mt-2">
            {loading ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                <p className="text-sm text-slate-500 dark:text-slate-400">Đang tải...</p>
              </div>
            ) : err ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-rose-200/70 dark:border-rose-900/40 p-6">
                <p className="text-sm font-bold text-rose-600 dark:text-rose-300">{err}</p>
                <button
                  onClick={load}
                  className="mt-4 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-black shadow-sm hover:bg-rose-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark"
                >
                  Thử lại
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-10 text-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  Không có assignment nào trong tab này.
                </p>
              </div>
            ) : (
              <>
                {filtered.map((a) => {
                  const dLeft = a.__daysLeft ?? daysLeft(a.due_date);
                  const dueVN = formatDateVN(a.due_date);
                  const sla = a.__slaText ?? "";

                  const badge = dueBadge(dLeft);

                  const paperId = a.paper_id;
                  const assignmentId = a.id;

                  const title = clampText(
                    a.paper_title ?? a.title,
                    `Bài nộp #${paperId}`
                  );

                  const track = clampText(a.track_name ?? a.track, "Chưa phân loại");
                  const statusLabel = STATUS_LABEL[a.status] ?? a.status;

                  const canAcceptDecline = a.status === STATUS.INVITED;
                  const canStartReview = a.status === STATUS.ACCEPTED;
                  const canViewReview = a.status === STATUS.COMPLETED;

                  // Discussion/Rebuttal route exists in your AppRoutes: /reviewer/discussion/:paperId
                  // If your backend returns flags like a.discussion_open or a.rebuttal_open, you can gate it.
                  const showDiscussion =
                    a.status === STATUS.ACCEPTED || a.status === STATUS.COMPLETED;

                  return (
                    <div
                      key={assignmentId}
                      className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 md:p-6 hover:shadow-md transition-shadow duration-200"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                        {/* Left */}
                        <div className="flex flex-col gap-3 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-500/10">
                              Paper #{paperId}
                            </span>

                            <span
                              className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-black ring-1 ring-inset ${chipClassByStatus(
                                a.status
                              )}`}
                              title="Trạng thái assignment"
                            >
                              {statusLabel}
                            </span>

                            {badge ? (
                              <span
                                className={`inline-flex items-center gap-1 text-xs ${badge.cls}`}
                                title="SLA"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 16 }}
                                >
                                  {badge.icon}
                                </span>
                                {badge.text}
                              </span>
                            ) : null}
                          </div>

                          <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white leading-snug">
                            {title}
                          </h3>

                          {/* Double-blind: intentionally do NOT show authors */}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-600 dark:text-slate-300">
                            <div className="flex items-center gap-2">
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: 18 }}
                              >
                                category
                              </span>
                              <span className="font-semibold">{track}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: 18 }}
                              >
                                calendar_today
                              </span>
                              <span>
                                Review deadline:{" "}
                                <span className="font-bold">
                                  {dueVN || "Chưa có"}
                                </span>
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: 18 }}
                              >
                                analytics
                              </span>
                              <span className="font-semibold">{sla}</span>
                            </div>
                          </div>

                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Assignment ID: <span className="font-bold">#{assignmentId}</span>
                          </div>
                        </div>

                        {/* Right Actions */}
                        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:min-w-[260px] items-stretch">
                          {canAcceptDecline ? (
                            <>
                              <button
                                onClick={() => onAccept(assignmentId)}
                                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-black shadow-sm hover:bg-rose-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 18 }}
                                >
                                  check
                                </span>
                                Chấp nhận
                              </button>

                              <button
                                onClick={() => onDecline(assignmentId)}
                                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent text-slate-700 dark:text-slate-200 text-sm font-black hover:bg-slate-50 dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 18 }}
                                >
                                  close
                                </span>
                                Từ chối
                              </button>

                              <button
                                onClick={() => onDeclareCOI(a)}
                                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-700/50 bg-rose-50/60 dark:bg-rose-900/10 text-rose-700 dark:text-rose-200 text-sm font-black hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-300"
                                title="Khai báo xung đột lợi ích (COI)"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 18 }}
                                >
                                  report
                                </span>
                                Declare COI
                              </button>
                            </>
                          ) : null}

                          {canStartReview ? (
                            <button
                              onClick={() => openWorkspace(assignmentId)}
                              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-black shadow-sm hover:bg-rose-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark"
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: 18 }}
                              >
                                edit
                              </span>
                              Bắt đầu đánh giá
                            </button>
                          ) : null}

                          {canViewReview ? (
                            <button
                              onClick={() => openWorkspace(assignmentId)}
                              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-black shadow-sm hover:bg-rose-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark"
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: 18 }}
                              >
                                visibility
                              </span>
                              Xem đánh giá
                            </button>
                          ) : null}

                          {/* Discussion / Rebuttal entry (optional) */}
                          {showDiscussion ? (
                            <button
                              onClick={() => openDiscussion(paperId)}
                              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent text-slate-700 dark:text-slate-200 text-sm font-black hover:bg-slate-50 dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
                              title="Thảo luận / rebuttal (nếu hội nghị bật)"
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: 18 }}
                              >
                                forum
                              </span>
                              Discussion / Rebuttal
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {/* Helper note about double-blind */}
                      <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 18 }}
                        >
                          visibility_off
                        </span>
                        <div>
                          <div className="font-bold text-slate-600 dark:text-slate-300">
                            Double-blind
                          </div>
                          <div>
                            Không hiển thị danh tính tác giả trong giai đoạn phản biện (theo
                            chính sách hội nghị).
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="mt-4 flex justify-between items-center pb-10 text-sm text-slate-500 dark:text-slate-400">
                  <p>
                    Hiển thị <span className="font-bold">{filtered.length}</span> mục trong tab{" "}
                    <span className="font-bold">{STATUS_LABEL[active] || active}</span>
                  </p>
                  <button
                    onClick={load}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-white/5 font-bold"
                    title="Reload"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      refresh
                    </span>
                    Tải lại
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
