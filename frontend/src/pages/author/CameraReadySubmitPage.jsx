// src/pages/author/CameraReadySubmitPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import conferenceApi from "../../api/conferenceApi";
import {
  getSubmissionById,
  updatePaperDetails,
  uploadCameraReady,
  deleteSubmissionAuthor,
} from "../../api/submissionApi";

import axiosClient from "../../api/axiosClient";
import { useAuth } from "../../context/AuthContext";

const MAX_MB = 20;
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8080";

// ----------------------- Helpers -----------------------
function toDownloadUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  let p = String(raw).trim();
  if (!p.startsWith("/")) p = `/${p}`;

  if (p.startsWith("/papers/")) p = `/uploads${p}`;
  if (!p.startsWith("/submission/")) p = `/submission${p}`;

  return encodeURI(`${API_BASE}${p}`);
}

function fileOkPdf(file) {
  if (!file) return "Vui lòng chọn file.";
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Chỉ chấp nhận file PDF.";
  const mb = file.size / (1024 * 1024);
  if (mb > MAX_MB) return `File vượt quá ${MAX_MB}MB.`;
  return "";
}

function fmtBytes(bytes = 0) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

function fmtDateVN(d) {
  if (!d) return "--";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "--";
  return dt.toLocaleDateString("vi-VN");
}

function fmtDateTimeVN(d) {
  if (!d) return "--";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "--";
  return dt.toLocaleString("vi-VN");
}

function isDeadlinePassed(deadline) {
  if (!deadline) return false;
  const t = new Date(deadline).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

function parseInterests(text) {
  const arr = String(text || "")
    .split(/[,;\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);

  return Array.from(new Set(arr));
}

function PrimaryButton({ disabled, onClick, children, className = "" }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={[
        "h-12 px-6 rounded-lg font-black text-sm flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
      style={{
        background: "var(--primary)",
        color: "#fff",
        boxShadow: "0 10px 25px rgb(var(--primary-rgb) / 0.20)",
      }}
      type="button"
    >
      {children}
    </button>
  );
}

// ----------------------- Component -----------------------
export default function CameraReadySubmitPage() {
  const { paperId } = useParams();
  const id = Number(paperId);
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const { user, updateUser, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [paper, setPaper] = useState(null);
  const [confName, setConfName] = useState("");
  const [phase, setPhase] = useState(null);
  const [phaseErr, setPhaseErr] = useState("");

  // paper form
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [commit, setCommit] = useState(false);

  // file
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // ✅ Profile (6 fields)
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileErr, setProfileErr] = useState("");
  const [profileOk, setProfileOk] = useState("");

  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
    organization: "",
    department: "",
    research_interests: [],
  });

  // ✅ Khi vào trang, kéo profile mới nhất từ backend
  useEffect(() => {
    if (refreshUser) refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ snapshot để không bị warning exhaustive-deps + đảm bảo data normalize
  const userSnapshot = useMemo(
    () => ({
      id: user?.id ?? null,
      full_name: user?.full_name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      organization: user?.organization ?? "",
      department: user?.department ?? "",
      research_interests: Array.isArray(user?.research_interests) ? user.research_interests : [],
    }),
    [
      user?.id,
      user?.full_name,
      user?.email,
      user?.phone,
      user?.organization,
      user?.department,
      user?.research_interests,
    ]
  );

  // ✅ Prefill: chỉ fill các field còn trống (không ghi đè dữ liệu user đang gõ)
  useEffect(() => {
    setProfile((prev) => ({
      full_name: prev.full_name || userSnapshot.full_name,
      email: prev.email || userSnapshot.email,
      phone: prev.phone || userSnapshot.phone,
      organization: prev.organization || userSnapshot.organization,
      department: prev.department || userSnapshot.department,
      research_interests:
        Array.isArray(prev.research_interests) && prev.research_interests.length > 0
          ? prev.research_interests
          : userSnapshot.research_interests,
    }));
  }, [userSnapshot]);

  const interestsText = useMemo(
    () => (profile.research_interests || []).join(", "),
    [profile.research_interests]
  );

  const isProfileComplete = useMemo(() => {
    return !!(
      profile.full_name?.trim() &&
      profile.email?.trim() &&
      profile.phone?.trim() &&
      profile.organization?.trim() &&
      profile.department?.trim() &&
      Array.isArray(profile.research_interests) &&
      profile.research_interests.length > 0
    );
  }, [profile]);

  // ✅ Update profile API
  const updateMe = async (payload) => {
    // Nếu backend khác route, sửa ở đây
    return axiosClient.put("/identity/api/users/me", payload);
  };

  const onSaveProfile = async () => {
    setProfileErr("");
    setProfileOk("");

    const payload = {
      full_name: profile.full_name?.trim() || "",
      email: profile.email?.trim() || "",
      organization: profile.organization?.trim() || "",
      department: profile.department?.trim() || "",
      phone: profile.phone?.trim() || "",
      research_interests: Array.isArray(profile.research_interests) ? profile.research_interests : [],
    };

    if (!payload.full_name || !payload.email) {
      setProfileErr("Vui lòng nhập tối thiểu Họ và tên + Email.");
      return false;
    }

    try {
      setProfileBusy(true);
      await updateMe(payload);

      // ✅ refresh profile từ backend để chắc chắn UI đúng dữ liệu DB
      if (refreshUser) await refreshUser();
      else if (updateUser) updateUser(payload);

      setProfileOk("Đã cập nhật thông tin chi tiết tác giả.");
      return true;
    } catch (e) {
      setProfileErr(e?.response?.data?.detail || "Cập nhật thông tin tác giả thất bại.");
      return false;
    } finally {
      setProfileBusy(false);
    }
  };

  // Versions & finalized
  const versions = useMemo(() => {
    const v =
      paper?.versions ||
      paper?.paper_versions ||
      paper?.version_history ||
      paper?.paper_versions_history ||
      [];
    return Array.isArray(v) ? v : [];
  }, [paper]);

  const latestCameraReady = useMemo(() => {
    const crList = versions.filter((v) => !!v?.is_camera_ready);
    if (crList.length === 0) return null;
    return crList.sort((a, b) => (b.version_number || 0) - (a.version_number || 0))[0];
  }, [versions]);

  const isFinalized = !!latestCameraReady;

  const authors = useMemo(() => {
    const a = paper?.authors || paper?.paper_authors || [];
    return Array.isArray(a) ? a : [];
  }, [paper]);

  const canSubmit = useMemo(() => {
    if (!paper) return false;

    const status = String(paper.status || "").toUpperCase();
    if (status !== "ACCEPTED") return false;

    const open = !!phase?.camera_ready_open;
    const passed = isDeadlinePassed(phase?.camera_ready_deadline);
    if (!open || passed) return false;

    if (isFinalized) return false;

    if (!isProfileComplete) return false;
    if (!commit) return false;
    if (!file) return false;

    return true;
  }, [paper, phase, commit, file, isFinalized, isProfileComplete]);

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      setPhaseErr("");

      const p = await getSubmissionById(id);
      setPaper(p);

      setTitle(p?.title || "");
      setAbstract(p?.abstract || "");

      if (p?.conference_id) {
        try {
          const [conf, ph] = await Promise.all([
            conferenceApi.getConferenceById(p.conference_id),
            conferenceApi.getConferencePhase(p.conference_id),
          ]);
          setConfName(conf?.name || `Conference #${p.conference_id}`);
          setPhase(ph || null);
        } catch (e) {
          setConfName(`Conference #${p?.conference_id ?? "--"}`);
          setPhase(null);
          setPhaseErr("Không lấy được trạng thái Camera-ready của hội nghị.");
        }
      }
    } catch (e) {
      setErr(e?.response?.data?.detail || "Không tải được dữ liệu bài báo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) {
      setErr("paperId không hợp lệ.");
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onPickFile = (f) => {
    setErr("");
    const msg = fileOkPdf(f);
    if (msg) {
      setFile(null);
      return setErr(msg);
    }
    setFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onPickFile(f);
  };

  const onSaveAndSubmit = async () => {
    if (!paper) return;
    setErr("");

    const status = String(paper.status || "").toUpperCase();
    if (status !== "ACCEPTED") return setErr("Chỉ bài ACCEPTED mới được nộp Camera-ready.");

    const open = !!phase?.camera_ready_open;
    const passed = isDeadlinePassed(phase?.camera_ready_deadline);
    if (!open) return setErr("Camera-ready chưa mở cho hội nghị này.");
    if (passed) return setErr("Đã quá hạn nộp Camera-ready.");

    if (isFinalized) return setErr("Bạn đã nộp Camera-ready rồi.");

    if (!isProfileComplete)
      return setErr("Vui lòng cập nhật đầy đủ Thông tin chi tiết tác giả (6 trường) trước khi nộp Camera-ready.");

    if (!commit) return setErr("Vui lòng tick cam kết trước khi gửi.");
    if (!file) return setErr("Vui lòng chọn file PDF Camera-ready.");

    const msg = fileOkPdf(file);
    if (msg) return setErr(msg);

    try {
      setBusy(true);

      await updatePaperDetails(id, {
        title: title?.trim(),
        abstract: abstract?.trim(),
      });

      await uploadCameraReady({ paperId: id, file });

      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Gửi Camera-ready thất bại.");
    } finally {
      setBusy(false);
      setCommit(false);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDeleteAuthor = async (authorId) => {
    if (!window.confirm("Xóa tác giả này?")) return;
    try {
      setBusy(true);
      setErr("");
      await deleteSubmissionAuthor(id, authorId);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Xóa tác giả thất bại.");
    } finally {
      setBusy(false);
    }
  };

  // ----------------------- Render -----------------------
  if (loading) {
    return (
      <div className="p-8 font-semibold" style={{ color: "var(--muted)" }}>
        Đang tải...
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="p-8">
        <div
          className="p-4 rounded-2xl font-semibold border"
          style={{
            background: "rgb(244 63 94 / 0.12)",
            borderColor: "rgb(244 63 94 / 0.25)",
            color: "rgb(244 63 94 / 0.95)",
          }}
        >
          {err || "Không tìm thấy bài báo."}
        </div>

        <button
          onClick={() => navigate("/author/camera-ready")}
          className="mt-4 px-4 h-10 rounded-lg border font-black transition"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          Quay lại
        </button>
      </div>
    );
  }

  const open = !!phase?.camera_ready_open;
  const deadline = phase?.camera_ready_deadline;
  const passed = isDeadlinePassed(deadline);

  const returnTo = encodeURIComponent(`/author/camera-ready/${id}`);

  return (
    <div style={{ background: "var(--bg)", minHeight: "calc(100vh - 64px)", color: "var(--text)" }}>
      <div className="max-w-[960px] mx-auto px-4 md:px-10 py-10">
        {/* Heading */}
        <div className="flex flex-col gap-2 mb-8">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: "var(--text)" }}>
            {isFinalized ? "Chi tiết Camera-ready" : "Nộp bản thảo Camera-ready"}
          </h1>
          <p style={{ color: "var(--muted)" }}>
            {isFinalized
              ? "Dưới đây là thông tin và tệp tin bạn đã nộp."
              : "Vui lòng chỉnh sửa thông tin lần cuối và tải lên bản thảo hoàn thiện trước khi in ấn."}
          </p>

          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            <span className="font-bold" style={{ color: "var(--text)" }}>
              {confName}
            </span>
            {deadline && (
              <span>
                {" "}
                • Hạn chót:{" "}
                <span className={passed ? "text-rose-600 dark:text-rose-400" : ""}>{fmtDateVN(deadline)}</span>
              </span>
            )}
            {!open && (
              <span className="ml-2 inline-flex text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                Camera-ready đóng
              </span>
            )}
            {passed && (
              <span className="ml-2 inline-flex text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                Quá hạn
              </span>
            )}
          </div>
        </div>

        {/* Banner finalized */}
        {isFinalized && latestCameraReady && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-start md:items-center gap-4 shadow-sm">
            <div className="bg-emerald-100 text-emerald-600 p-3 rounded-full shrink-0">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-emerald-900">Đã hoàn tất!</h2>
              <p className="text-emerald-700 mt-1 text-sm">
                Bạn đã nộp thành công phiên bản Camera-ready (v{latestCameraReady.version_number || "--"}).
              </p>
              <p className="text-xs text-emerald-600 mt-1 opacity-80">
                Nộp lúc: {latestCameraReady.created_at ? fmtDateTimeVN(latestCameraReady.created_at) : "--"}
              </p>
            </div>

            <a
              href={toDownloadUrl(latestCameraReady.file_url)}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 bg-white border border-emerald-300 text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 transition flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined">download</span>
              Tải file đã nộp
            </a>
          </div>
        )}

        {/* errors */}
        {err && (
          <div
            className="mb-6 p-4 rounded-2xl font-semibold border"
            style={{
              background: "rgb(244 63 94 / 0.12)",
              borderColor: "rgb(244 63 94 / 0.25)",
              color: "rgb(244 63 94 / 0.95)",
            }}
          >
            {err}
          </div>
        )}

        {phaseErr && (
          <div
            className="mb-6 p-4 rounded-2xl text-sm font-semibold border"
            style={{
              background: "rgb(245 158 11 / 0.12)",
              borderColor: "rgb(245 158 11 / 0.25)",
              color: "rgb(245 158 11 / 0.95)",
            }}
          >
            {phaseErr}
          </div>
        )}

        {/* Form container */}
        <div
          className="rounded-2xl border shadow-sm p-6 md:p-8 flex flex-col gap-8"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {/* Section: Paper info */}
          <section className="flex flex-col gap-6">
            <div className="pb-2 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
              <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                edit_document
              </span>
              <h3 className="text-lg font-black" style={{ color: "var(--text)" }}>
                Thông tin bài báo
              </h3>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-black" style={{ color: "var(--text)" }}>
                Tiêu đề bài báo (Title) <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isFinalized}
                className={[
                  "w-full min-h-[84px] rounded-xl border px-4 py-3 outline-none focus:ring-2",
                  isFinalized ? "bg-gray-100 text-gray-500 cursor-not-allowed opacity-70" : "",
                ].join(" ")}
                style={
                  !isFinalized
                    ? { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }
                    : {}
                }
                placeholder="Nhập tiêu đề chính thức của bài báo..."
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-black" style={{ color: "var(--text)" }}>
                Tóm tắt (Abstract) <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                disabled={isFinalized}
                className={[
                  "w-full min-h-[160px] rounded-xl border px-4 py-3 outline-none focus:ring-2",
                  isFinalized ? "bg-gray-100 text-gray-500 cursor-not-allowed opacity-70" : "",
                ].join(" ")}
                style={
                  !isFinalized
                    ? { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }
                    : {}
                }
                placeholder="Nhập tóm tắt nội dung bài báo..."
              />
            </div>

            {/* Authors */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-black" style={{ color: "var(--text)" }}>
                  Danh sách tác giả
                </label>

                {!isFinalized && (
                  <button
                    type="button"
                    className="text-sm font-black flex items-center gap-1 hover:underline"
                    style={{ color: "var(--primary)" }}
                    onClick={() => navigate(`/author/submissions/${id}/authors/new?returnTo=${returnTo}`)}
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Thêm tác giả
                  </button>
                )}
              </div>

              <div
                className="p-4 rounded-xl border flex flex-col gap-2"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
              >
                {authors.length === 0 ? (
                  <div className="text-sm" style={{ color: "var(--muted)" }}>
                    Chưa có tác giả.
                  </div>
                ) : (
                  authors.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-xl border flex items-center gap-3 bg-white"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <span className="material-symbols-outlined" style={{ color: "var(--muted)" }}>
                        drag_indicator
                      </span>

                      <div className="flex-1">
                        <p className="text-sm font-black" style={{ color: "var(--text)" }}>
                          {a.full_name}
                        </p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          {a.organization || a.email || "--"}
                        </p>
                      </div>

                      {!isFinalized && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="p-2 rounded-lg transition"
                            title="Chỉnh sửa"
                            style={{ color: "rgb(245 158 11 / 0.95)" }}
                            onClick={() =>
                              navigate(`/author/submissions/${id}/authors/${a.id}/edit?returnTo=${returnTo}`)
                            }
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>

                          <button
                            type="button"
                            className="p-2 rounded-lg transition"
                            title="Xóa"
                            style={{ color: "rgb(244 63 94 / 0.95)" }}
                            onClick={() => onDeleteAuthor(a.id)}
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* ✅ Section: Author profile (6 fields) */}
          <section className="flex flex-col gap-6">
            <div className="pb-2 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
              <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                id_card
              </span>
              <h3 className="text-lg font-black" style={{ color: "var(--text)" }}>
                Thông tin chi tiết tác giả
              </h3>
            </div>

            {(profileErr || profileOk) && (
              <div
                className="p-4 rounded-2xl font-semibold border"
                style={{
                  background: profileErr ? "rgb(244 63 94 / 0.12)" : "rgb(34 197 94 / 0.12)",
                  borderColor: profileErr ? "rgb(244 63 94 / 0.25)" : "rgb(34 197 94 / 0.25)",
                  color: profileErr ? "rgb(244 63 94 / 0.95)" : "rgb(34 197 94 / 0.95)",
                }}
              >
                {profileErr || profileOk}
              </div>
            )}

            {!isProfileComplete && (
              <div
                className="p-4 rounded-2xl text-sm font-semibold border"
                style={{
                  background: "rgb(245 158 11 / 0.12)",
                  borderColor: "rgb(245 158 11 / 0.25)",
                  color: "rgb(245 158 11 / 0.95)",
                }}
              >
                Bạn cần cập nhật đủ 6 trường: Họ tên, Email, SĐT, Đơn vị, Phòng ban/Khoa, Lĩnh vực nghiên cứu trước khi
                nộp Camera-ready.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-black mb-2" style={{ color: "var(--text)" }}>
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <input
                  value={profile.full_name}
                  onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                  className="w-full h-11 rounded-lg px-4 text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                  placeholder="Nguyễn Văn A"
                  disabled={isFinalized}
                />
              </div>

              <div>
                <label className="block text-sm font-black mb-2" style={{ color: "var(--text)" }}>
                  Email <span className="text-rose-500">*</span>
                </label>
                <input
                  value={profile.email}
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                  className="w-full h-11 rounded-lg px-4 text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                  placeholder="vi-du@uth.edu.vn"
                  disabled={isFinalized}
                />
              </div>

              <div>
                <label className="block text-sm font-black mb-2" style={{ color: "var(--text)" }}>
                  Số điện thoại <span className="text-rose-500">*</span>
                </label>
                <input
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full h-11 rounded-lg px-4 text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                  placeholder="09xxxxxxxx"
                  disabled={isFinalized}
                />
              </div>

              <div>
                <label className="block text-sm font-black mb-2" style={{ color: "var(--text)" }}>
                  Đơn vị công tác <span className="text-rose-500">*</span>
                </label>
                <input
                  value={profile.organization}
                  onChange={(e) => setProfile((p) => ({ ...p, organization: e.target.value }))}
                  className="w-full h-11 rounded-lg px-4 text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                  placeholder="Trường Đại học..."
                  disabled={isFinalized}
                />
              </div>

              <div>
                <label className="block text-sm font-black mb-2" style={{ color: "var(--text)" }}>
                  Phòng ban / Khoa <span className="text-rose-500">*</span>
                </label>
                <input
                  value={profile.department}
                  onChange={(e) => setProfile((p) => ({ ...p, department: e.target.value }))}
                  className="w-full h-11 rounded-lg px-4 text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                  placeholder="Khoa CNTT / Phòng..."
                  disabled={isFinalized}
                />
              </div>

              <div>
                <label className="block text-sm font-black mb-2" style={{ color: "var(--text)" }}>
                  Lĩnh vực nghiên cứu <span className="text-rose-500">*</span>
                </label>
                <input
                  value={interestsText}
                  onChange={(e) => setProfile((p) => ({ ...p, research_interests: parseInterests(e.target.value) }))}
                  className="w-full h-11 rounded-lg px-4 text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                  placeholder="VD: AI, NLP, Computer Vision"
                  disabled={isFinalized}
                />
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                  Nhập nhiều lĩnh vực, ngăn cách bằng dấu phẩy hoặc xuống dòng.
                </p>
              </div>
            </div>

            {/* ✅ Ẩn nút lưu khi đã finalize */}
            {!isFinalized && (
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={profileBusy}
                  onClick={onSaveProfile}
                  className="px-6 h-11 rounded-lg font-black transition active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                  style={{
                    background: "var(--primary)",
                    color: "#fff",
                    boxShadow: "0 10px 25px rgb(var(--primary-rgb) / 0.20)",
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Lưu thông tin tác giả
                </button>
              </div>
            )}
          </section>

          {/* Upload + Submit (only if not finalized) */}
          {!isFinalized && (
            <>
              {/* Section: upload */}
              <section className="flex flex-col gap-6">
                <div className="pb-2 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
                  <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                    upload_file
                  </span>
                  <h3 className="text-lg font-black" style={{ color: "var(--text)" }}>
                    Tệp tin hoàn thiện
                  </h3>
                </div>

                <div className="flex flex-col gap-4">
                  <div
                    className="relative w-full min-h-[180px] border-2 border-dashed rounded-2xl cursor-pointer transition flex items-center justify-center"
                    style={{
                      borderColor: dragOver ? "rgb(var(--primary-rgb) / 0.65)" : "var(--border)",
                      background: dragOver ? "rgb(var(--primary-rgb) / 0.08)" : "var(--surface-2)",
                    }}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                  >
                    <div className="flex flex-col items-center text-center gap-2 px-6">
                      <div
                        className="size-12 rounded-full flex items-center justify-center"
                        style={{ background: "rgb(var(--primary-rgb) / 0.12)", color: "var(--primary)" }}
                      >
                        <span className="material-symbols-outlined text-3xl">cloud_upload</span>
                      </div>

                      <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                        Nhấn để tải lên hoặc kéo thả tệp vào đây
                      </p>

                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        PDF (Backend giới hạn 15 trang; size client max {MAX_MB}MB)
                      </p>
                    </div>

                    <input
                      ref={fileRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => onPickFile(e.target.files?.[0])}
                    />
                  </div>

                  {file && (
                    <div
                      className="p-4 rounded-xl border flex items-center justify-between"
                      style={{
                        background: "rgb(var(--primary-rgb) / 0.06)",
                        borderColor: "rgb(var(--primary-rgb) / 0.20)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                          description
                        </span>
                        <div className="flex flex-col">
                          <span className="text-sm font-black" style={{ color: "var(--text)" }}>
                            {file.name}
                          </span>
                          <span className="text-xs" style={{ color: "var(--muted)" }}>
                            {fmtBytes(file.size)}
                          </span>
                        </div>
                      </div>

                      <span className="material-symbols-outlined" style={{ color: "rgb(34 197 94 / 0.95)" }}>
                        check_circle
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* Section: commit + submit */}
              <section className="flex flex-col gap-6 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <label className="flex items-start gap-3 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commit}
                    onChange={(e) => setCommit(e.target.checked)}
                    className="mt-1 size-5"
                    style={{ accentColor: "var(--primary)" }}
                  />
                  <span className="text-sm" style={{ color: "var(--text)" }}>
                    Tôi đã kiểm tra kỹ thông tin và cam kết đây là bản thảo cuối cùng để in ấn kỷ yếu. Tôi chịu trách
                    nhiệm về nội dung và định dạng của bài báo.
                  </span>
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <PrimaryButton disabled={busy || !canSubmit} onClick={onSaveAndSubmit} className="w-full sm:flex-1">
                    <span className="material-symbols-outlined">save</span>
                    Lưu &amp; Gửi bản cuối
                  </PrimaryButton>

                  <button
                    className="w-full sm:w-auto px-6 h-12 rounded-lg border font-black transition"
                    style={{
                      background: "transparent",
                      borderColor: "var(--border)",
                      color: "var(--muted)",
                    }}
                    onClick={() => navigate("/author/camera-ready")}
                    disabled={busy}
                    type="button"
                  >
                    Hủy bỏ
                  </button>
                </div>

                {/* Warnings */}
                {String(paper.status || "").toUpperCase() !== "ACCEPTED" && (
                  <div
                    className="p-4 rounded-2xl text-sm font-semibold border"
                    style={{
                      background: "rgb(245 158 11 / 0.12)",
                      borderColor: "rgb(245 158 11 / 0.25)",
                      color: "rgb(245 158 11 / 0.95)",
                    }}
                  >
                    Bài chưa ACCEPTED nên không thể nộp Camera-ready.
                  </div>
                )}

                {!open && (
                  <div
                    className="p-4 rounded-2xl text-sm font-semibold border"
                    style={{
                      background: "rgb(245 158 11 / 0.12)",
                      borderColor: "rgb(245 158 11 / 0.25)",
                      color: "rgb(245 158 11 / 0.95)",
                    }}
                  >
                    Camera-ready đang đóng cho hội nghị này.
                  </div>
                )}

                {passed && (
                  <div
                    className="p-4 rounded-2xl text-sm font-semibold border"
                    style={{
                      background: "rgb(244 63 94 / 0.12)",
                      borderColor: "rgb(244 63 94 / 0.25)",
                      color: "rgb(244 63 94 / 0.95)",
                    }}
                  >
                    Đã quá hạn nộp Camera-ready.
                  </div>
                )}

                {!isProfileComplete && (
                  <div
                    className="p-4 rounded-2xl text-sm font-semibold border"
                    style={{
                      background: "rgb(245 158 11 / 0.12)",
                      borderColor: "rgb(245 158 11 / 0.25)",
                      color: "rgb(245 158 11 / 0.95)",
                    }}
                  >
                    Chưa đủ thông tin chi tiết tác giả (6 trường) nên chưa thể nộp Camera-ready.
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="py-8 flex justify-center">
          <button
            onClick={() => navigate("/author/camera-ready")}
            className="h-12 px-8 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
                       bg-rose-50 text-rose-700 border border-rose-200 
                       hover:bg-rose-100 hover:border-rose-300 hover:shadow-md active:scale-[0.98]"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Quay lại danh sách
          </button>
        </div>
      </div>
    </div>
  );
}
