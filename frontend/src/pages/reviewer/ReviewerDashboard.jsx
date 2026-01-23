import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import reviewApi from "../../api/reviewApi";
import { useAuth } from "../../context/AuthContext";

const STATUS = {
  INVITED: "Invited",
  ACCEPTED: "Accepted",
  COMPLETED: "Completed",
  DECLINED: "Declined",
};

const TABS = [
  { key: STATUS.INVITED, label: "Lời mời đang chờ" },
  { key: STATUS.ACCEPTED, label: "Đang tiến hành" },
  { key: STATUS.COMPLETED, label: "Đã hoàn thành" },
  // Thiết kế gốc chỉ có 3 tab; nếu bạn muốn thêm “Đã từ chối” thì bật lại:
  // { key: STATUS.DECLINED, label: "Đã từ chối" },
];

function daysLeft(dueDate) {
  if (!dueDate) return null;
  const due = new Date(dueDate).getTime();
  const now = Date.now();
  const diff = due - now;
  const d = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return Number.isFinite(d) ? d : null;
}

function formatDateVN(dueDate) {
  if (!dueDate) return "";
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return "";
  // dd/mm/yyyy
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function ReviewerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [active, setActive] = useState(STATUS.INVITED);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  // ✅ bạn đang test bằng admin -> fallback reviewerId=1
  const reviewerId = user?.id;

  const counts = useMemo(() => {
    const c = {
      [STATUS.INVITED]: 0,
      [STATUS.ACCEPTED]: 0,
      [STATUS.COMPLETED]: 0,
      [STATUS.DECLINED]: 0,
    };
    for (const x of items) c[x.status] = (c[x.status] || 0) + 1;
    return c;
  }, [items]);

  const filtered = useMemo(
    () => items.filter((x) => x.status === active),
    [items, active]
  );

  const load = async () => {
    if (!reviewerId) return;
    setLoading(true);
    setErr("");
    try {
      const res = await reviewApi.listAssignments({ reviewerId });
      setItems(res?.data ?? []);
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

  const onAccept = async (assignmentId) => {
    await reviewApi.updateAssignment(assignmentId, { status: STATUS.ACCEPTED });
    await load();
  };

  const onDecline = async (assignmentId) => {
    await reviewApi.updateAssignment(assignmentId, { status: STATUS.DECLINED });
    await load();
  };

  const openWorkspace = (assignmentId) => navigate(`/reviewer/review/${assignmentId}`);

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display transition-colors duration-200">
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-40 py-8">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
              <li className="inline-flex items-center">
                <span className="inline-flex items-center text-sm font-medium text-slate-500 dark:text-slate-400">
                  Bảng điều khiển
                </span>
              </li>
              <li>
                <div className="flex items-center">
                  <span
                    className="material-symbols-outlined text-slate-400 mx-1"
                    style={{ fontSize: 16 }}
                  >
                    chevron_right
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    Bài tập của tôi
                  </span>
                </div>
              </li>
            </ol>
          </nav>

          {/* Page Heading */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Bài tập của tôi
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-base">
                Quản lý các lời mời đánh giá và bài báo đang được phân công cho bạn.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-200 dark:border-slate-700 mt-4">
            <nav aria-label="Tabs" className="-mb-px flex space-x-8 overflow-x-auto">
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
                        ? "border-primary text-primary whitespace-nowrap border-b-[3px] py-4 px-1 text-sm font-bold flex items-center gap-2"
                        : "border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-300 whitespace-nowrap border-b-[3px] py-4 px-1 text-sm font-bold flex items-center gap-2"
                    }
                  >
                    {t.label}
                    <span
                      className={
                        isActive
                          ? "bg-primary/10 text-primary py-0.5 px-2.5 rounded-full text-xs"
                          : "bg-slate-100 dark:bg-surface-dark text-slate-600 dark:text-slate-300 py-0.5 px-2.5 rounded-full text-xs"
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
              <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 p-5 md:p-6">
                <p className="text-sm text-slate-500 dark:text-slate-400">Đang tải...</p>
              </div>
            ) : err ? (
              <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-rose-200/70 dark:border-rose-900/40 p-5 md:p-6">
                <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{err}</p>
                <button
                  onClick={load}
                  className="mt-4 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-bold shadow-sm hover:bg-rose-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark"
                >
                  Thử lại
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 p-8 text-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  Không có mục nào trong tab này.
                </p>
              </div>
            ) : (
              <>
                {filtered.map((a) => {
                  const dLeft = daysLeft(a.due_date);
                  const dueVN = formatDateVN(a.due_date);

                  const isInvited = a.status === STATUS.INVITED;
                  const isCompleted = a.status === STATUS.COMPLETED;

                  return (
                    <div
                      key={a.id}
                      className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 p-5 md:p-6 hover:shadow-md transition-shadow duration-200"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        {/* Left */}
                        <div className="flex flex-col gap-3 flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-700/50 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-500/10">
                              Paper #{a.paper_id}
                            </span>

                            {dLeft !== null ? (
                              <span
                                className={
                                  dLeft <= 3
                                    ? "inline-flex items-center gap-1 text-xs font-bold text-primary"
                                    : "inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400"
                                }
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 14 }}
                                >
                                  {dLeft <= 3 ? "timer" : "schedule"}
                                </span>
                                {dLeft >= 0 ? `Còn ${dLeft} ngày` : "Quá hạn"}
                              </span>
                            ) : null}
                          </div>

                          <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white leading-snug">
                            Bài nộp #{a.paper_id}
                          </h3>

                          <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400 mt-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: 18 }}
                              >
                                calendar_today
                              </span>
                              <span>
                                Hạn chót: {dueVN || "(chưa có)"}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 hidden sm:flex">
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: 18 }}
                              >
                                description
                              </span>
                              <span>Assignment ID: #{a.id}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right Actions */}
                        <div className="flex flex-row md:flex-col lg:flex-row gap-3 md:min-w-[280px] lg:min-w-fit items-center md:items-stretch lg:items-center justify-start md:justify-center">
                          {isInvited ? (
                            <>
                              <button
                                onClick={() => onDecline(a.id)}
                                className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-transparent text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
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
                                onClick={() => onAccept(a.id)}
                                className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-bold shadow-sm hover:bg-rose-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: 18 }}
                                >
                                  check
                                </span>
                                Chấp nhận đánh giá
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => openWorkspace(a.id)}
                              className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-bold shadow-sm hover:bg-rose-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark"
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: 18 }}
                              >
                                {isCompleted ? "visibility" : "edit"}
                              </span>
                              {isCompleted ? "Xem đánh giá" : "Bắt đầu đánh giá"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="mt-4 flex justify-center pb-8">
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Hiển thị {filtered.length} trong số {filtered.length} mục
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
