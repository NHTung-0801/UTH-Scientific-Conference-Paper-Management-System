// src/pages/chair/ReviewerAssignmentPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import reviewerApi from "../../api/reviewerApi";

// ---- helpers: interests có thể array / JSON string / "a,b,c"
const normalizeInterests = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean).map(String);

  if (typeof val === "string") {
    const s = val.trim();
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch (_) {}
    return s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
};

const pickAffiliation = (acc) => {
  if (!acc) return "—";
  const org = String(acc.organization || acc.org || acc.affiliation || acc.company || "").trim();
  const dept = String(acc.department || acc.dept || acc.faculty || "").trim();
  if (dept && org) return `${dept} — ${org}`;
  return org || dept || "—";
};

const pickInterests = (acc) => {
  if (!acc) return [];
  const raw = acc.research_interests ?? acc.researchInterests ?? acc.interests ?? acc.tags ?? [];
  return normalizeInterests(raw);
};

// ---- dedupe accepted reviewers by email (fallback by name)
const makeReviewerKey = (inv, acc) => {
  const email = (acc?.email || inv?.reviewer_email || "").toLowerCase().trim();
  if (email) return `email:${email}`;
  const name = (acc?.full_name || acc?.name || inv?.reviewer_name || "").toLowerCase().trim();
  return name ? `name:${name}` : `unknown:${String(acc?.id || inv?.id || Math.random())}`;
};

// ---- safe string
const asStr = (v) => (v === null || v === undefined ? "" : String(v));
const normId = (v) => asStr(v).trim();

// ---- paper helpers
const pickPaperId = (p) => p?.id ?? p?.paper_id ?? p?.paperId ?? null;
const pickPaperTitle = (p) => String(p?.title ?? p?.paper_title ?? p?.paperTitle ?? "—");
const pickPaperConf = (p) =>
  p?.conference_id ?? p?.conferenceId ?? p?.conference?.id ?? p?.conference?.conference_id ?? null;
const pickPaperTrack = (p) => p?.track_id ?? p?.trackId ?? p?.track?.id ?? null;

const fmtDateTime = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN");
};

export default function ReviewerAssignmentPage() {
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  // papers
  const [papers, setPapers] = useState([]);
  const [searchPaper, setSearchPaper] = useState("");
  const [selectedPaperIds, setSelectedPaperIds] = useState(() => new Set());

  // reviewer accepted
  const [items, setItems] = useState([]); // invitations
  const [reviewerAccounts, setReviewerAccounts] = useState([]); // identity users
  const [selectedReviewerIds, setSelectedReviewerIds] = useState(() => new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ps, inv, accounts] = await Promise.all([
        reviewerApi.getOpenPapersForBidding(),
        reviewerApi.getInvitations(),
        reviewerApi.getReviewerAccounts(),
      ]);

      setPapers(Array.isArray(ps) ? ps : []);
      setItems(Array.isArray(inv) ? inv : []);
      setReviewerAccounts(Array.isArray(accounts) ? accounts : []);
    } catch (e) {
      console.error(e);
      setPapers([]);
      setItems([]);
      setReviewerAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // map email -> account
  const accountByEmail = useMemo(() => {
    const m = new Map();
    (reviewerAccounts || []).forEach((u) => {
      const email = (u.email || "").toLowerCase().trim();
      if (email) m.set(email, u);
    });
    return m;
  }, [reviewerAccounts]);

  // accepted reviewers (dedupe)
  const acceptedReviewers = useMemo(() => {
    const list = (items || []).filter((i) => String(i.status).toUpperCase() === "ACCEPTED");

    const withAcc = list
      .map((inv) => {
        const acc = accountByEmail.get((inv.reviewer_email || "").toLowerCase().trim()) || null;
        return { ...inv, account: acc };
      })
      .filter((x) => !!x.account);

    const dedupMap = new Map();
    for (const row of withAcc) {
      const key = makeReviewerKey(row, row.account);
      if (!dedupMap.has(key)) dedupMap.set(key, row);
    }
    return Array.from(dedupMap.values());
  }, [items, accountByEmail]);

  // papers filter
  const filteredPapers = useMemo(() => {
    const q = searchPaper.trim().toLowerCase();
    const arr = Array.isArray(papers) ? papers : [];
    if (!q) return arr;

    return arr.filter((p) => {
      const id = pickPaperId(p);
      const title = pickPaperTitle(p).toLowerCase();
      const conf = asStr(pickPaperConf(p)).toLowerCase();
      const track = asStr(pickPaperTrack(p)).toLowerCase();
      return (
        title.includes(q) ||
        asStr(id).toLowerCase().includes(q) ||
        conf.includes(q) ||
        track.includes(q)
      );
    });
  }, [papers, searchPaper]);

  // paper select
  const allPapersChecked = useMemo(() => {
    if (!filteredPapers.length) return false;
    return filteredPapers.every((p) => selectedPaperIds.has(String(pickPaperId(p))));
  }, [filteredPapers, selectedPaperIds]);

  const selectedPaperCount = useMemo(() => selectedPaperIds.size, [selectedPaperIds]);

  const togglePaper = (id) => {
    const key = String(id);
    setSelectedPaperIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllPapers = () => {
    setSelectedPaperIds((prev) => {
      const next = new Set(prev);
      if (allPapersChecked) {
        filteredPapers.forEach((p) => next.delete(String(pickPaperId(p))));
      } else {
        filteredPapers.forEach((p) => next.add(String(pickPaperId(p))));
      }
      return next;
    });
  };

  // reviewer select
  const allReviewersChecked = useMemo(() => {
    if (!acceptedReviewers.length) return false;
    return acceptedReviewers.every((r) => selectedReviewerIds.has(String(r.account.id)));
  }, [acceptedReviewers, selectedReviewerIds]);

  const selectedReviewerCount = useMemo(() => selectedReviewerIds.size, [selectedReviewerIds]);

  const toggleReviewer = (id) => {
    const key = String(id);
    setSelectedReviewerIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllReviewers = () => {
    setSelectedReviewerIds((prev) => {
      const next = new Set(prev);
      if (allReviewersChecked) {
        acceptedReviewers.forEach((r) => next.delete(String(r.account.id)));
      } else {
        acceptedReviewers.forEach((r) => next.add(String(r.account.id)));
      }
      return next;
    });
  };

  const handleAssign = async () => {
    if (selectedPaperIds.size === 0) {
      alert("Vui lòng chọn ít nhất 1 bài báo.");
      return;
    }
    if (selectedReviewerIds.size === 0) {
      alert("Vui lòng chọn ít nhất 1 reviewer.");
      return;
    }

    const paperIds = Array.from(selectedPaperIds)
      .map((x) => Number(x))
      .filter((x) => !Number.isNaN(x));

    const reviewerIds = Array.from(selectedReviewerIds)
      .map((x) => Number(x))
      .filter((x) => !Number.isNaN(x));

    const ok = window.confirm(
      `Xác nhận phân công?\n` +
        `Reviewer đã chọn: ${reviewerIds.length}\n` +
        `Bài báo đã chọn: ${paperIds.length}\n\n` +
        `Lưu ý: hệ thống sẽ bỏ qua các bài đã phân công trùng.`
    );
    if (!ok) return;

    setAssigning(true);
    try {
      let created = 0;
      let skipped = 0;

      // chống trùng theo reviewer (nhanh và đúng với logic hiện tại của bạn)
      for (const rid of reviewerIds) {
        let existing = [];
        try {
          existing = await reviewerApi.listAssignmentsByReviewer(rid);
        } catch (e) {
          console.error("listAssignmentsByReviewer failed", rid, e);
          existing = [];
        }

        const existingPaperIds = new Set(
          (existing || [])
            .map((a) => a?.paper_id ?? a?.paperId)
            .filter(Boolean)
            .map(String)
        );

        for (const pid of paperIds) {
          const pidStr = String(pid);
          if (existingPaperIds.has(pidStr)) {
            skipped += 1;
            continue;
          }

          try {
            await reviewerApi.createAssignment({
              reviewer_id: rid,
              paper_id: Number(pid),
              is_manual: true,
              due_date: null,
            });
            created += 1;
          } catch (e) {
            console.error("createAssignment failed", { rid, pid }, e);
            skipped += 1;
          }
        }
      }

      alert(`✅ Phân công xong!\nTạo mới: ${created}\nBỏ qua/Trùng/Lỗi: ${skipped}`);
      // optional: reload assignments list? (ở đây chỉ reload data tổng)
      // fetchData();
    } catch (e) {
      console.error(e);
      alert("❌ Phân công thất bại. Xem console log để biết chi tiết.");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-slate-900">Phân công Reviewer</h2>
            <p className="text-slate-500 mt-1">
              Chọn bài báo (trái) → chọn reviewer đã chấp nhận (phải) → bấm phân công
            </p>
          </div>

          <button
            onClick={fetchData}
            className="px-4 h-11 rounded-xl border bg-white font-bold text-slate-700 hover:bg-slate-50"
          >
            Làm mới
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: papers */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                    search
                  </span>
                  <input
                    className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                    placeholder="Tìm bài báo theo tiêu đề / id / conference_id / track_id..."
                    value={searchPaper}
                    onChange={(e) => setSearchPaper(e.target.value)}
                  />
                </div>

                <div className="px-3 h-10 rounded-xl border border-slate-200 bg-white flex items-center text-sm">
                  <span className="text-slate-600 font-bold">
                    Đã chọn: <span className="text-slate-900 font-black">{selectedPaperCount}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-auto">
              {loading ? (
                <div className="p-6 text-slate-500">Đang tải bài báo...</div>
              ) : filteredPapers.length === 0 ? (
                <div className="p-6 text-slate-400">Không có bài báo nào để phân công.</div>
              ) : (
                <div>
                  <div className="sticky top-0 z-10 bg-white border-b px-5 py-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-slate-300"
                      checked={allPapersChecked}
                      onChange={toggleAllPapers}
                    />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Chọn tất cả (theo danh sách đang lọc)
                    </span>
                  </div>

                  <ul className="divide-y">
                    {filteredPapers.map((p) => {
                      const id = String(pickPaperId(p));
                      const checked = selectedPaperIds.has(id);
                      const title = pickPaperTitle(p);
                      const confId = pickPaperConf(p);
                      const trackId = pickPaperTrack(p);
                      const submittedAt = p?.submitted_at ?? p?.submittedAt ?? p?.created_at ?? p?.createdAt ?? null;

                      return (
                        <li key={`paper-${id}`}>
                          <button
                            type="button"
                            onClick={() => togglePaper(id)}
                            className={`w-full text-left px-5 py-4 hover:bg-slate-50 transition ${
                              checked ? "bg-slate-50" : ""
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                className="mt-1 size-4 rounded border-slate-300"
                                checked={checked}
                                onChange={() => togglePaper(id)}
                                onClick={(e) => e.stopPropagation()}
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="font-black text-slate-900 truncate">{title}</p>
                                  {checked ? (
                                    <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-green-100 text-green-700">
                                      Đã chọn
                                    </span>
                                  ) : null}
                                </div>

                                <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                                  <span>
                                    <b>ID:</b> {id}
                                  </span>
                                  {confId != null ? (
                                    <span>
                                      <b>Conference:</b> {String(confId)}
                                    </span>
                                  ) : null}
                                  {trackId != null ? (
                                    <span>
                                      <b>Track:</b> {String(trackId)}
                                    </span>
                                  ) : null}
                                  <span>
                                    <b>Submitted:</b> {fmtDateTime(submittedAt)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Right: reviewers */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b bg-white">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reviewer đã chấp nhận</p>
                  <p className="text-lg font-black text-slate-900 mt-1">
                    {acceptedReviewers.length ? `${acceptedReviewers.length} reviewer` : "Chưa có reviewer"}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-3 h-11 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">groups</span>
                    <span className="text-sm text-slate-600 font-bold">
                      Đã chọn: <span className="text-slate-900 font-black">{selectedReviewerCount}</span>
                    </span>
                  </div>

                  <button
                    onClick={handleAssign}
                    className="px-5 h-11 bg-rose-600 text-white rounded-xl font-bold shadow hover:opacity-95 disabled:opacity-60"
                    disabled={assigning || selectedReviewerCount === 0 || selectedPaperCount === 0}
                  >
                    {assigning ? "Đang phân công..." : "Phân công"}
                  </button>
                </div>
              </div>
            </div>

            {/* reviewers table */}
            <div className="overflow-auto max-h-[62vh]">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-50 border-b z-10">
                  <tr>
                    <th className="px-5 py-3 w-12">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-slate-300"
                        checked={allReviewersChecked}
                        onChange={toggleAllReviewers}
                        disabled={acceptedReviewers.length === 0}
                      />
                    </th>
                    <Th>Reviewer</Th>
                    <Th>Đơn vị công tác</Th>
                    <Th>Lĩnh vực</Th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-slate-500">
                        Đang tải reviewer...
                      </td>
                    </tr>
                  ) : acceptedReviewers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                        Chưa có reviewer nào đã chấp nhận (và có tài khoản).
                      </td>
                    </tr>
                  ) : (
                    acceptedReviewers.map((r) => {
                      const acc = r.account;
                      const id = String(acc.id);
                      const name = acc.full_name || acc.name || r.reviewer_name || "—";
                      const email = acc.email || r.reviewer_email || "—";
                      const affiliation = pickAffiliation(acc);
                      const interests = pickInterests(acc);

                      return (
                        <tr key={`acc-${id}`} className="hover:bg-slate-50 transition">
                          <td className="px-5 py-4">
                            <input
                              type="checkbox"
                              className="size-4 rounded border-slate-300"
                              checked={selectedReviewerIds.has(id)}
                              onChange={() => toggleReviewer(id)}
                            />
                          </td>

                          <td className="px-5 py-4">
                            <div>
                              <p className="font-bold text-slate-900">{name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{email}</p>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-700">{affiliation}</td>

                          <td className="px-5 py-4">
                            {interests.length ? (
                              <div className="flex flex-wrap gap-1">
                                {interests.slice(0, 6).map((tag, idx) => (
                                  <span
                                    key={`${id}-tag-${idx}`}
                                    className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t bg-white flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Đã chọn{" "}
                <span className="font-black text-slate-900">{String(selectedReviewerCount).padStart(2, "0")}</span>{" "}
                reviewer
              </p>
              <button
                className="px-4 h-10 rounded-xl border font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => setSelectedReviewerIds(new Set())}
                disabled={!selectedReviewerCount || assigning}
              >
                Bỏ chọn reviewer
              </button>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          * Nguồn bài báo: <code className="mx-1">GET /submission/submissions/open-for-bidding</code> (submission-service)
          <br />
          * Nguồn reviewer: invitations <code className="mx-1">ACCEPTED</code> + accounts từ identity-service
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
}
