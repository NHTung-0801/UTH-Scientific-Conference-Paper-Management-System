import React, { useMemo, useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../utils/constants";
import axiosClient from "../../api/axiosClient"; 
import { toast } from "react-toastify"; 

export default function ProfilePage() {
  const { user: contextUser } = useAuth(); 
  
  // --- STATE DỮ LIỆU PROFILE (Lấy từ API) ---
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // --- STATE QUẢN LÝ MODAL & FORM ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form dữ liệu cho chỉnh sửa thông tin chung
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    organization: "",
    department: ""
  });

  const [newInterest, setNewInterest] = useState("");

  // --- 1. GỌI API LẤY DỮ LIỆU MỚI NHẤT KHI VÀO TRANG ---
  const fetchProfile = async () => {
    try {
      const res = await axiosClient.get("/identity/api/users/me");
      setProfileData(res); 
    } catch (error) {
      console.error("Lỗi lấy thông tin profile:", error);
      setProfileData(contextUser);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ưu tiên dùng dữ liệu từ API (profileData), nếu chưa có thì dùng contextUser
  const displayUser = profileData || contextUser;

  // Chuẩn hóa danh sách role
  const userRoles = useMemo(() => {
    if (!displayUser?.roles) return [];
    return displayUser.roles.map(r => (typeof r === 'string' ? r : r.role_name).toUpperCase());
  }, [displayUser]);

  // --- HÀM XỬ LÝ: MỞ MODAL EDIT ---
  const handleOpenEdit = () => {
    setFormData({
      full_name: displayUser?.full_name || "",
      email: displayUser?.email || "",
      phone: displayUser?.phone || "",
      organization: displayUser?.organization || "",
      department: displayUser?.department || ""
    });
    setShowEditModal(true);
  };

  // --- HÀM XỬ LÝ: LƯU THÔNG TIN HỒ SƠ ---
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axiosClient.put("/identity/api/users/me", formData);
      toast.success("✅ Cập nhật hồ sơ thành công!");
      setShowEditModal(false);
      await fetchProfile(); 
    } catch (error) {
      console.error(error);
      toast.error("❌ Có lỗi xảy ra khi cập nhật.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- HÀM XỬ LÝ: THÊM LĨNH VỰC NGHIÊN CỨU ---
  const handleAddInterest = async () => {
    if (!newInterest.trim()) return;
    setSubmitting(true);
    try {
      let currentInterests = displayUser?.research_interests;
      
      if (typeof currentInterests === 'string') {
          try {
             currentInterests = JSON.parse(currentInterests);
          } catch(e) {
             currentInterests = [];
          }
      }
      if (!Array.isArray(currentInterests)) currentInterests = [];

      const updatedInterests = [...currentInterests, newInterest.trim()];

      await axiosClient.put("/identity/api/users/me", {
        research_interests: updatedInterests
      });

      toast.success("✅ Đã thêm lĩnh vực nghiên cứu!");
      setNewInterest("");
      setShowInterestModal(false);
      await fetchProfile(); 
    } catch (error) {
      console.error(error);
      toast.error("❌ Lỗi khi thêm lĩnh vực.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- HÀM XỬ LÝ: XÓA LĨNH VỰC NGHIÊN CỨU ---
  const handleRemoveInterest = async (interestToRemove) => {
    if (!window.confirm(`Bạn muốn xóa "${interestToRemove}"?`)) return;
    try {
      let currentInterests = displayUser?.research_interests;
      if (!Array.isArray(currentInterests)) currentInterests = [];
      
      const updatedInterests = currentInterests.filter(i => i !== interestToRemove);

      await axiosClient.put("/identity/api/users/me", {
        research_interests: updatedInterests
      });
      toast.success("🗑️ Đã xóa.");
      await fetchProfile(); 
    } catch (error) {
      toast.error("Lỗi khi xóa.");
    }
  };

  if (loadingProfile) {
      return <div className="p-10 text-center">Đang tải thông tin...</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* 1. HEADER CARD */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div 
          className="h-32"
          style={{ background: "linear-gradient(to right, rgb(var(--primary-rgb) / 0.8), var(--primary))" }}
        ></div>
        
        <div className="px-8 pb-8 flex flex-col md:flex-row items-end gap-6 -mt-12">
          
          {/* --- AVATAR SECTION --- */}
          <div className="relative">
            <div className="w-32 h-32 rounded-2xl bg-white p-1 border border-slate-200 shadow-lg overflow-hidden">
              <div className="w-full h-full rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <span className="material-symbols-outlined text-[80px]">person</span>
              </div>
            </div>
          </div>

          <div className="flex-1 pb-2">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{displayUser?.full_name || "Chưa cập nhật tên"}</h1>
                <p className="text-slate-500 flex items-center gap-1 mt-1 text-sm">
                  <span className="material-symbols-outlined text-base">domain</span>
                  {displayUser?.department || "Phòng ban"} — {displayUser?.organization || "Tổ chức"}
                </p>
              </div>
              
              {/* 🔥 ĐỔI MÀU: Nút Edit Profile */}
              <button 
                onClick={handleOpenEdit}
                className="flex items-center gap-2 px-4 py-2 text-white text-sm font-bold rounded-lg shadow-md transition-all active:scale-95 hover:opacity-90"
                style={{ backgroundColor: "var(--primary)" }}
              >
                <span className="material-symbols-outlined text-base">edit</span>
                Chỉnh sửa hồ sơ
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CỘT TRÁI */}
        <div className="md:col-span-2 space-y-6">
          
          {/* 2. THÔNG TIN CHI TIẾT */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              {/* 🔥 ĐỔI MÀU: Icon */}
              <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>contact_page</span>
              Thông tin chi tiết
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InfoItem label="Họ và Tên" value={displayUser?.full_name} />
              <InfoItem label="Email" value={displayUser?.email} verified />
              <InfoItem label="Số điện thoại" value={displayUser?.phone || "Chưa cập nhật"} />
              <InfoItem label="Đơn vị công tác" value={displayUser?.organization} />
              <InfoItem label="Phòng ban / Khoa" value={displayUser?.department} />
            </div>
          </div>

          {/* 3. LĨNH VỰC NGHIÊN CỨU */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                {/* 🔥 ĐỔI MÀU: Icon */}
                <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>biotech</span>
                Lĩnh vực nghiên cứu
              </h3>
              
              {/* 🔥 ĐỔI MÀU: Nút Thêm mới */}
              <button 
                onClick={() => setShowInterestModal(true)}
                className="text-sm font-bold flex items-center gap-1 px-2 py-1 rounded transition-colors"
                style={{ color: "var(--primary)", backgroundColor: "rgb(var(--primary-rgb) / 0.05)" }}
              >
                <span className="material-symbols-outlined text-sm">add</span> Thêm mới
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {Array.isArray(displayUser?.research_interests) && displayUser.research_interests.length > 0 ? (
                displayUser.research_interests.map((tag, idx) => (
                  <span 
                    key={idx} 
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border"
                    // 🔥 ĐỔI MÀU: Tag interests
                    style={{
                      backgroundColor: "rgb(var(--primary-rgb) / 0.1)",
                      color: "var(--primary)",
                      borderColor: "rgb(var(--primary-rgb) / 0.2)"
                    }}
                  >
                    {tag}
                    <button 
                      onClick={() => handleRemoveInterest(tag)}
                      className="ml-2 text-slate-400 hover:text-red-500 transition-colors" 
                      title="Xóa"
                    >
                      <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                    </button>
                  </span>
                ))
              ) : (
                <p className="text-slate-400 text-sm italic">Chưa có thông tin lĩnh vực nghiên cứu.</p>
              )}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI */}
        <div className="space-y-6">
          {/* KHỐI VAI TRÒ HỆ THỐNG */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Vai trò hệ thống</h3>
            <div className="space-y-3">
              {userRoles.map(role => (
                <RoleBadge 
                  key={role}
                  icon={role === ROLES.ADMIN ? "admin_panel_settings" : role === ROLES.REVIEWER ? "verified_user" : "stars"} 
                  title={role} 
                  desc={getRoleDesc(role)} 
                  active 
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL 1: CHỈNH SỬA HỒ SƠ --- */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-lg">Chỉnh sửa hồ sơ</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-red-500">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Họ và tên</label>
                  <input 
                    type="text" required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    // 🔥 ĐỔI MÀU: Focus border
                    style={{ caretColor: "var(--primary)" }}
                    onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
                    onBlur={(e) => e.target.style.borderColor = "#cbd5e1"} // slate-300
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                  <input 
                    type="email" required disabled 
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-100 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:border-slate-600"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số điện thoại</label>
                  <input 
                    type="text"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
                    onBlur={(e) => e.target.style.borderColor = "#cbd5e1"}
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Đơn vị công tác</label>
                  <input 
                    type="text"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
                    onBlur={(e) => e.target.style.borderColor = "#cbd5e1"}
                    value={formData.organization}
                    onChange={(e) => setFormData({...formData, organization: e.target.value})}
                    placeholder="Ví dụ: Trường Đại học GTVT TP.HCM"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phòng ban / Khoa</label>
                  <input 
                    type="text"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
                    onBlur={(e) => e.target.style.borderColor = "#cbd5e1"}
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    placeholder="Ví dụ: Khoa CNTT"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-600 font-bold hover:bg-slate-50">Hủy</button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="flex-1 px-4 py-2 rounded-lg text-white font-bold hover:opacity-90 disabled:opacity-70"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  {submitting ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: THÊM LĨNH VỰC NGHIÊN CỨU --- */}
      {showInterestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm">
            <div className="p-5">
              <h3 className="font-bold text-lg mb-4">Thêm lĩnh vực nghiên cứu</h3>
              <input 
                type="text"
                autoFocus
                placeholder="Ví dụ: Machine Learning..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none mb-4 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
                onBlur={(e) => e.target.style.borderColor = "#cbd5e1"}
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowInterestModal(false)} className="px-3 py-1.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded">Hủy</button>
                <button 
                  onClick={handleAddInterest} 
                  disabled={submitting} 
                  className="px-3 py-1.5 text-sm font-bold text-white rounded hover:opacity-90"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  {submitting ? "..." : "Thêm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// --- HELPER COMPONENTS ---
function getRoleDesc(role) {
  switch(role) {
    case ROLES.ADMIN: return "Quản trị toàn bộ hệ thống";
    case ROLES.CHAIR: return "Quản lý bài nộp và phản biện";
    case ROLES.REVIEWER: return "Đánh giá các công trình khoa học";
    case ROLES.AUTHOR: return "Nộp và quản lý bài báo cá nhân";
    default: return "Thành viên hệ thống";
  }
}

function InfoItem({ label, value, verified }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <p className="text-slate-800 dark:text-slate-200 font-medium">{value || "Chưa cập nhật"}</p>
        {verified && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded uppercase">Verified</span>}
      </div>
    </div>
  );
}

function RoleBadge({ icon, title, desc, active }) {
  // 🔥 ĐỔI MÀU: Logic badge động theo var(--primary)
  const style = active ? {
    backgroundColor: "rgb(var(--primary-rgb) / 0.05)",
    borderColor: "rgb(var(--primary-rgb) / 0.2)"
  } : {
    backgroundColor: "var(--surface-2)", // fallback hoặc slate-50
    borderColor: "var(--border)"
  };

  const textStyle = active ? { color: "var(--primary)" } : { color: "#64748b" }; // slate-500

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={style}>
      <span className="material-symbols-outlined" style={textStyle}>
        {icon}
      </span>
      <div>
        <p className="text-sm font-bold" style={textStyle}>{title}</p>
        <p className="text-[10px] text-slate-500">{desc}</p>
      </div>
    </div>
  );
}