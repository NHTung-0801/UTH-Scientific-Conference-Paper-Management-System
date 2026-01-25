import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import reviewApi from "../../api/reviewApi";
import { useAuth } from "../../context/AuthContext";

const CRITERIAS = [
  { key: "Originality", label: "Tính độc đáo", left: "Ít đổi mới", right: "Đột phá", weight: 1 },
  { key: "TechnicalQuality", label: "Chất lượng kỹ thuật", left: "Có lỗi", right: "Chặt chẽ", weight: 1 },
  { key: "Relevance", label: "Mức độ phù hợp", left: "Ngoài phạm vi", right: "Rất phù hợp", weight: 1 },
];

export default function ReviewWorkspace() {
  const { assignmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [assignment, setAssignment] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");

  const [review, setReview] = useState(null);

  // form state
  const [scores, setScores] = useState({
    Originality: 3,
    TechnicalQuality: 4,
    Relevance: 5,
  });
  const [recommendation, setRecommendation] = useState("Accept"); // UI only
  const [confidence, setConfidence] = useState(4); // 1..5
  const [contentAuthor, setContentAuthor] = useState("");
  const [contentPc, setContentPc] = useState("");

  const existingCriteriaNames = useMemo(() => {
    const arr = review?.criterias ?? [];
    return new Set(arr.map((c) => c.criteria_name));
  }, [review]);

  const calcFinalScore = useMemo(() => {
    const vals = Object.values(scores);
    const sum = vals.reduce((a, b) => a + b, 0);
    return Math.round((sum / vals.length) * 10) / 10; // 1 decimal
  }, [scores]);

  const loadAll = async () => {
    setLoading(true);
    setErr("");
    try {
      const [assRes, pdfRes, listRevRes] = await Promise.all([
        reviewApi.getAssignment(Number(assignmentId)),
        reviewApi.getPaperPdfUrlByAssignment(Number(assignmentId)),
        reviewApi.listReviews({ assignmentId: Number(assignmentId) }),
      ]);

      setAssignment(assRes.data);
      setPdfUrl(pdfRes.data?.pdf_url || "");

      const reviews = listRevRes.data ?? [];
      let current = reviews[0];

      if (!current) {
        const created = await reviewApi.createReview({
          assignment_id: Number(assignmentId),
          is_anonymous: true,
          is_draft: true,
        });
        current = created.data;
      }

      setReview(current);

      // hydrate
      if (current?.confidence_score) setConfidence(current.confidence_score);
      if (current?.content_author) setContentAuthor(current.content_author);
      if (current?.content_pc) setContentPc(current.content_pc);

      const byName = new Map((current?.criterias ?? []).map((c) => [c.criteria_name, c.grade]));
      setScores((prev) => ({
        ...prev,
        Originality: byName.get("Originality") ?? prev.Originality,
        TechnicalQuality: byName.get("TechnicalQuality") ?? prev.TechnicalQuality,
        Relevance: byName.get("Relevance") ?? prev.Relevance,
      }));
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Không tải được workspace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  const saveDraft = async () => {
    if (!review?.id) return;

    setSaving(true);
    setErr("");

    try {
      // 1) Update review core fields
      await reviewApi.updateReview(review.id, {
        final_score: calcFinalScore,
        confidence_score: confidence,
        content_author: contentAuthor,
        content_pc: contentPc,
        is_draft: true,
        // recommendation: recommendation, // (nếu backend có field này thì bật lên)
      });

      // 2) Map criterias hiện có theo name để biết cái nào update, cái nào create
      const existingMap = new Map(
        (review?.criterias ?? []).map((c) => [c.criteria_name, c])
      );

      // 3) Upsert criterias
      for (const c of CRITERIAS) {
        const existed = existingMap.get(c.key);
        const payload = {
          criteria_name: c.key,
          grade: scores[c.key],
          weight: c.weight,
          comment: null,
        };

        if (existed?.id) {
          // ✅ UPDATE
          await reviewApi.updateCriteria(review.id, existed.id, payload);
        } else {
          // ✅ CREATE
          await reviewApi.addCriteria(review.id, payload);
        }
      }

      // 4) Reload review để UI nhận criterias mới nhất (id, grade)
      const fresh = await reviewApi.getReview(review.id);
      setReview(fresh.data);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Lưu nháp thất bại");
    } finally {
      setSaving(false);
    }
  };


  const submit = async () => {
    if (!review?.id) return;
    setSaving(true);
    setErr("");
    try {
      // ensure draft saved
      await saveDraft();

      // mark as submitted + update assignment completed
      await reviewApi.updateReview(review.id, {
        is_draft: false,
        submitted_at: new Date().toISOString(),
      });

      await reviewApi.updateAssignment(Number(assignmentId), { status: "Completed" });

      navigate("/reviewer");
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Nộp đánh giá thất bại");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-0px)] flex items-center justify-center bg-background-light dark:bg-background-dark">
        <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main font-display h-screen flex flex-col overflow-hidden">
      {/* header giống thiết kế */}
      <header className="flex-none flex items-center justify-between whitespace-nowrap border-b border-solid border-[#e5dcdc] dark:border-[#4a3b3b] bg-white dark:bg-[#2a1d1d] px-6 py-3 z-20 shadow-sm">
        <div className="flex items-center gap-4 text-text-main dark:text-white">
          <div className="size-8 flex items-center justify-center bg-primary/10 rounded-lg text-primary">
            <span className="material-symbols-outlined">rate_review</span>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-[-0.015em]">UTH-ConfMS</h1>
            <p className="text-xs text-gray-500 dark:text-gray-300 font-medium">
              Không gian đánh giá • Assignment #{assignment?.id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:block text-sm font-medium text-text-main dark:text-white">
            {user?.name || `Reviewer #${user?.id ?? ""}`}
          </span>
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-[#e5dcdc] dark:border-[#4a3b3b] px-3 py-2 text-sm font-bold bg-white dark:bg-transparent text-text-main dark:text-white hover:bg-gray-50 dark:hover:bg-[#3a2a2a]"
          >
            Quay lại
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* LEFT: PDF */}
        <section className="flex-none w-[60%] flex flex-col border-r border-[#e5dcdc] dark:border-[#4a3b3b] bg-[#525659] relative">
          <div className="h-12 bg-[#323639] flex items-center justify-between px-4 shadow-md z-10 text-gray-200">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium truncate max-w-[420px]">
                Paper #{assignment?.paper_id} • PDF
              </span>
            </div>
            <div className="flex items-center gap-2">
              {pdfUrl ? (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 hover:bg-white/10 rounded transition-colors text-gray-300"
                  title="Mở PDF"
                >
                  <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                </a>
              ) : null}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 flex justify-center">
            <div className="w-full h-full max-w-[900px] bg-white shadow-2xl rounded overflow-hidden">
              {pdfUrl ? (
                <iframe title="paper-pdf" src={pdfUrl} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-sm text-gray-500">Không có PDF url</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT: FORM */}
        <section className="flex-none w-[40%] flex flex-col bg-white dark:bg-[#2a1d1d] border-l border-[#e5dcdc] dark:border-[#4a3b3b] relative">
          <div className="px-8 py-5 border-b border-[#e5dcdc] dark:border-[#4a3b3b] flex-none bg-white dark:bg-[#2a1d1d] z-10">
            <div className="flex justify-between items-start mb-1">
              <h2 className="text-xl font-bold text-text-main dark:text-white">Biểu mẫu đánh giá</h2>
              <span className="text-xs font-semibold px-2 py-1 bg-yellow-100 text-yellow-800 rounded border border-yellow-200">
                {review?.is_draft ? "Đã lưu nháp" : "Đã nộp"}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-300">
              Vui lòng đánh giá bài báo dựa trên các tiêu chí bên dưới.
            </p>
            {err ? <p className="mt-3 text-sm text-red-600">{err}</p> : null}
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 pb-32">
            {/* Quantitative */}
            <div className="space-y-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-300 border-b border-[#e5dcdc] dark:border-[#4a3b3b] pb-2">
                Đánh giá định lượng
              </h3>

              {CRITERIAS.map((c) => {
                const value = scores[c.key];
                const pct = ((value - 1) / 4) * 100;
                return (
                  <div key={c.key} className="group">
                    <div className="flex justify-between mb-3">
                      <label className="text-sm font-semibold text-text-main dark:text-white">
                        {c.label}
                      </label>
                      <span className="text-sm font-bold text-primary">{value}/5</span>
                    </div>

                    <div className="relative h-2 bg-[#e5dcdc] dark:bg-[#4a3b3b] rounded-full">
                      <div
                        className="absolute top-0 left-0 h-full bg-primary rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                      <input
                        className="absolute top-[-6px] left-0 w-full h-5 opacity-0 cursor-pointer z-10"
                        type="range"
                        min="1"
                        max="5"
                        value={value}
                        onChange={(e) =>
                          setScores((prev) => ({ ...prev, [c.key]: Number(e.target.value) }))
                        }
                      />
                      <div
                        className="absolute top-[-4px] bg-white border-2 border-primary rounded-full shadow"
                        style={{ left: `${pct}%`, width: 16, height: 16, transform: "translateX(-50%)" }}
                      />
                    </div>

                    <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-300">
                      <span>{c.left}</span>
                      <span>{c.right}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recommendation */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-300 border-b border-[#e5dcdc] dark:border-[#4a3b3b] pb-2">
                Khuyến nghị
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-main dark:text-white mb-2">
                    Quyết định gợi ý
                  </label>
                  <select
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    className="w-full rounded-lg border border-[#e5dcdc] dark:border-[#4a3b3b] bg-white dark:bg-[#211111] px-3 py-2 text-sm text-text-main dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Accept">Chấp nhận</option>
                    <option value="WeakAccept">Hơi nghiêng chấp nhận</option>
                    <option value="Borderline">Cân nhắc</option>
                    <option value="WeakReject">Hơi nghiêng từ chối</option>
                    <option value="Reject">Từ chối</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-main dark:text-white mb-2">
                    Độ tự tin (1-5)
                  </label>
                  <select
                    value={confidence}
                    onChange={(e) => setConfidence(Number(e.target.value))}
                    className="w-full rounded-lg border border-[#e5dcdc] dark:border-[#4a3b3b] bg-white dark:bg-[#211111] px-3 py-2 text-sm text-text-main dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-xs text-primary font-bold">
                  Điểm tổng kết (auto): {calcFinalScore}/5
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                  (Là trung bình 3 tiêu chí. Bạn có thể đổi logic nếu muốn.)
                </p>
              </div>
            </div>

            {/* Text feedback */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-300 border-b border-[#e5dcdc] dark:border-[#4a3b3b] pb-2">
                Nhận xét định tính
              </h3>

              <div>
                <label className="block text-sm font-semibold text-text-main dark:text-white mb-2">
                  Nhận xét cho tác giả
                </label>
                <textarea
                  value={contentAuthor}
                  onChange={(e) => setContentAuthor(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-[#e5dcdc] dark:border-[#4a3b3b] bg-white dark:bg-[#211111] px-3 py-2 text-sm text-text-main dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Góp ý rõ ràng, xây dựng..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-main dark:text-white mb-2">
                  Ghi chú cho PC/Chair (ẩn với tác giả)
                </label>
                <textarea
                  value={contentPc}
                  onChange={(e) => setContentPc(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-[#e5dcdc] dark:border-[#4a3b3b] bg-white dark:bg-[#211111] px-3 py-2 text-sm text-text-main dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Các điểm cần lưu ý nội bộ..."
                />
              </div>

              <button
                type="button"
                onClick={() => navigate(`/reviewer/discussion/${assignment?.paper_id}`)}
                className="w-full rounded-lg border border-[#e5dcdc] dark:border-[#4a3b3b] bg-white dark:bg-transparent px-4 py-2 text-sm font-bold text-text-main dark:text-white hover:bg-gray-50 dark:hover:bg-[#3a2a2a]"
              >
                Mở thảo luận phản biện
              </button>
            </div>
          </div>

          {/* sticky actions */}
          <div className="absolute bottom-0 left-0 right-0 px-8 py-4 bg-white/95 dark:bg-[#2a1d1d]/95 backdrop-blur border-t border-[#e5dcdc] dark:border-[#4a3b3b] flex gap-3">
            <button
              onClick={saveDraft}
              disabled={saving || review?.is_draft === false}
              className="flex-1 rounded-lg border border-[#e5dcdc] dark:border-[#4a3b3b] bg-white dark:bg-transparent px-4 py-3 text-sm font-bold text-text-main dark:text-white hover:bg-gray-50 dark:hover:bg-[#3a2a2a] disabled:opacity-60"
            >
              Lưu nháp
            </button>
            <button
              onClick={submit}
              disabled={saving || review?.is_draft === false}
              className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60"
            >
              Nộp đánh giá
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
