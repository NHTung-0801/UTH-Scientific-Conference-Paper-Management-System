import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import conferenceApi from "../../api/conferenceApi";
import proceedingsPublishApi from "../../api/proceedingsPublishApi";
import { downloadBlob } from "../../utils/download";

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

export default function ProceedingsPublishSuccessPage() {
  const navigate = useNavigate();
  const { conferenceId } = useParams();
  const location = useLocation();

  const [confName, setConfName] = useState(location.state?.confName || "");
  const [title, setTitle] = useState(location.state?.title || "");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const publicUrl = useMemo(() => {
    return `${window.location.origin}/proceedings/${conferenceId}`;
  }, [conferenceId]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // best effort load conf name
        if (!confName) {
          try {
            const conf = await conferenceApi.getConferenceById?.(Number(conferenceId));
            if (conf?.name) setConfName(conf.name);
          } catch {}
        }

        // best effort load meta title (đề phòng user refresh trang success)
        if (!title) {
          try {
            const meta = await proceedingsPublishApi.getMeta(Number(conferenceId));
            if (meta?.title) setTitle(meta.title);
          } catch {}
        }
      } catch (e) {
        setErr(e?.response?.data?.detail || e?.message || "Không tải được dữ liệu sau khi công bố.");
      } finally {
        setLoading(false);
      }
    })();
  }, [conferenceId]); // eslint-disable-line

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      alert("Đã copy link công khai!");
    } catch {
      alert("Không copy được. Bạn hãy copy thủ công: " + publicUrl);
    }
  };

  const exportFile = async (format) => {
    try {
      setSaving(true);
      setErr("");
      const blob = await proceedingsPublishApi.exportFile(Number(conferenceId), format, "published");
      const realBlob = blob instanceof Blob ? blob : blob?.data instanceof Blob ? blob.data : null;
      if (!realBlob) throw new Error("Invalid blob response");
      downloadBlob(realBlob, `proceedings_conference_${conferenceId}.${format}`);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Xuất kỷ yếu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 font-semibold" style={{ color: "var(--muted)" }}>
        Đang tải...
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)]" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* top bar */}
      <div
        className="h-16 flex items-center justify-between px-6 border-b"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <span className="size-10 rounded-xl border flex items-center justify-center" style={toneStyle("green")}>
            <span className="material-symbols-outlined">check_circle</span>
          </span>
          <div>
            <h2 className="text-lg font-black">Công bố thành công</h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {confName ? `Hội nghị: ${confName}` : `Conference #${conferenceId}`}
            </p>
          </div>
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
          ← Về danh sách
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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

        {/* Hero card */}
        <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-black" style={{ color: "var(--text)" }}>
                  🎉 Kỷ yếu đã được công bố
                </h1>
                <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                  {title ? `Tên kỷ yếu: ${title}` : "Bạn có thể mở link public để kiểm tra ngay."}
                </p>
              </div>

              <span
                className="inline-flex items-center px-3 py-1 rounded-full border text-xs font-black"
                style={toneStyle("green")}
              >
                <span className="size-1.5 rounded-full mr-1.5" style={{ backgroundColor: "currentColor", opacity: 0.6 }} />
                Published
              </span>
            </div>

            {/* public link */}
            <div
              className="mt-5 p-4 rounded-2xl border flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              <div className="min-w-0">
                <p className="text-xs font-black uppercase" style={{ color: "var(--muted)" }}>
                  Link công khai
                </p>
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                  {publicUrl}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={copyLink}
                  className="h-10 px-4 rounded-lg font-black border transition"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgb(var(--primary-rgb) / 0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
                >
                  Copy link
                </button>

                {/* ✅ SỬA: về Home và nhảy đúng tab/section Kỷ yếu */}
                <button
                  onClick={() => navigate("/#proceedings")}
                  className="h-10 px-4 rounded-lg font-black transition active:scale-[0.98]"
                  style={primaryBtnStyle}
                >
                  Về Trang chủ (Kỷ yếu)
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                className="h-11 rounded-lg font-black border transition"
                style={toneStyle("violet")}
                onClick={() => navigate(`/chair/proceedings/${conferenceId}`)}
              >
                Quay lại trang quản trị
              </button>

              <button
                className="h-11 rounded-lg font-black border transition disabled:opacity-60"
                style={toneStyle("blue")}
                disabled={saving}
                onClick={() => exportFile("csv")}
              >
                Xuất CSV
              </button>

              <button
                className="h-11 rounded-lg font-black border transition disabled:opacity-60"
                style={toneStyle("amber")}
                disabled={saving}
                onClick={() => exportFile("xlsx")}
              >
                Xuất XLSX
              </button>
            </div>

            <p className="text-xs mt-4" style={{ color: "var(--muted)" }}>
              Tip: Nếu bạn chỉnh sửa kỷ yếu (meta / papers) sau này, hãy lưu nháp và công bố lại để cập nhật trang public.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
