import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from src.database import get_db
from src.models import Paper, PaperVersion
from src.schemas import PaperDetailResponse

# --- IMPORT MỚI TỪ UTILS ---
# Dùng hàm get_current_user từ file security.py đã tách ra
from src.utils.security import get_current_user 

router = APIRouter(prefix="/submissions", tags=["Submissions"])

# --- HELPER: MOCK LOGIC CẤU HÌNH HỘI NGHỊ ---
def is_conference_double_blind(conference_id: int) -> bool:
    """
    Kiểm tra xem hội nghị có phải là Double-blind (Ẩn danh đôi) không.
    Thực tế: Cần gọi API sang Conference Service hoặc query database config.
    """
    # Tạm thời hard-code: Hội nghị ID = 1 là Double-blind
    if conference_id == 1:
        return True
    return False

# --- API: XEM CHI TIẾT BÀI BÁO ---
@router.get("/{paper_id}", response_model=PaperDetailResponse)
def get_submission_detail(
    paper_id: int, 
    db: Session = Depends(get_db),
    user = Depends(get_current_user) # Sử dụng hàm auth từ src.utils.security
):
    # 1. Tìm bài báo trong DB
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # 2. Validate dữ liệu sang Pydantic model
    response_data = PaperDetailResponse.model_validate(paper)
    
    # 3. LOGIC DOUBLE-BLIND (Ẩn danh đôi)
    is_blind = is_conference_double_blind(paper.conference_id)
    user_role = user.get('role') 
    user_id = user.get('id')

    # Nếu là Reviewer VÀ Hội nghị là Double-blind -> Ẩn danh sách tác giả
    if user_role == "REVIEWER" and is_blind:
        # Trừ trường hợp Reviewer chính là tác giả bài này
        if paper.submitter_id != user_id:
            response_data.authors = None 
    
    # Nếu là Chair hoặc Author -> Giữ nguyên hiển thị
    return response_data

# --- API: TẢI FILE PDF ---
@router.get("/{paper_id}/download/{version}")
def download_submission_file(
    paper_id: int,
    version: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    # 1. Tìm thông tin phiên bản file trong DB
    paper_ver = db.query(PaperVersion).filter(
        PaperVersion.paper_id == paper_id,
        PaperVersion.version_number == version
    ).first()
    
    if not paper_ver:
        raise HTTPException(status_code=404, detail="Version not found")

    # 2. Kiểm tra file có tồn tại trên ổ cứng không
    # Lưu ý: paper_ver.file_path lấy từ DB (VD: "uploads/paper_1_v1.pdf")
    file_path = paper_ver.file_path
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    # 3. Trả về file cho trình duyệt tải xuống
    return FileResponse(
        path=file_path, 
        filename=f"Paper_{paper_id}_v{version}.pdf",
        media_type="application/pdf"
    )