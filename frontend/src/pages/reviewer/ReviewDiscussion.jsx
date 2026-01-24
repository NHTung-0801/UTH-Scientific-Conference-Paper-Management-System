import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import reviewApi from "../../api/reviewApi";
import { useAuth } from "../../context/AuthContext";

export default function ReviewDiscussion() {
  const { paperId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [content, setContent] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await reviewApi.listDiscussionsByPaper(Number(paperId));
      setItems(res?.data ?? []);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Không tải được thảo luận");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId]);

  const send = async () => {
    if (!content.trim()) return;
    setErr("");
    try {
      await reviewApi.createDiscussion({
        paper_id: Number(paperId),
        sender_id: user?.id,
        content: content.trim(),
        parent_id: null,
      });
      setContent("");
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Gửi thất bại");
    }
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark px-4 md:px-8 py-8">
      <div className="max-w-[900px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#171113] dark:text-white">
              Thảo luận phản biện • Paper #{paperId}
            </h1>
            <p className="text-sm text-[#87646b] dark:text-gray-400">
              Trao đổi giữa các reviewer / chair (nếu có).
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-[#e5dcde] dark:border-[#444] bg-white dark:bg-transparent px-4 py-2 text-sm font-bold text-[#171113] dark:text-white hover:bg-gray-50 dark:hover:bg-[#333]"
          >
            Quay lại
          </button>
        </div>

        {err ? (
          <div className="mb-4 bg-white dark:bg-[#1e1e1e] border border-red-200 dark:border-red-900/40 rounded-xl p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
          </div>
        ) : null}

        <div className="bg-white dark:bg-[#1e1e1e] border border-[#e5dcde] dark:border-[#333] rounded-xl overflow-hidden">
          <div className="border-b border-[#e5dcde] dark:border-[#333] px-5 py-4">
            <p className="text-sm font-bold text-[#171113] dark:text-white">Luồng thảo luận</p>
          </div>

          <div className="p-5 space-y-3 max-h-[55vh] overflow-y-auto">
            {loading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có tin nhắn.</p>
            ) : (
              items.map((m) => (
                <div
                  key={m.id}
                  className="border border-[#e5dcde] dark:border-[#333] rounded-lg p-4 bg-gray-50/50 dark:bg-[#222]"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#171113] dark:text-white">
                      Reviewer #{m.sender_id}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(m.sent_at).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-200 mt-2 whitespace-pre-wrap">
                    {m.content}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-[#e5dcde] dark:border-[#333] p-4 flex gap-3">
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 rounded-lg border border-[#e5dcde] dark:border-[#444] bg-white dark:bg-[#211115] px-3 py-2 text-sm text-[#171113] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Nhập nội dung..."
            />
            <button
              onClick={send}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white hover:bg-red-600"
            >
              Gửi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
