<<<<<<< HEAD
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
=======
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
import json

from .. import database, crud, schemas, exceptions
from ..utils.file_handler import save_paper_file, delete_paper_version_file

router = APIRouter(
    prefix="/submissions",
    tags=["Submissions"]
)

# API nộp bài
@router.post("/", response_model=schemas.PaperResponse, status_code=status.HTTP_201_CREATED)

def submit_paper(
    metadata: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    submitter_id: int = 42
    # current_user: models.User = Depends(deps.get_current_user)
):
    created_paper_id = None
    created_version_number = None
    
    try:

        # real_submitter_id = current_user.id

        # paper_data = schemas.PaperCreate.model_validate_json(metadata)

        try:
            # Chuyển chuỗi JSON thành Dictionary
            data_dict = json.loads(metadata)
            # Validate dữ liệu bằng Pydantic
            paper_data = schemas.PaperCreate(**data_dict)
        except Exception as json_error:
            raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(json_error)}")

        paper = crud.create_paper(
            db=db,
            paper_data=paper_data,
            submitter_id=submitter_id
            # submitter_id=real_submitter_id
        )
        created_paper_id = paper.id

        version = crud.create_new_paper_version(
            db=db,
            paper_id=paper.id,
            file_url="TEMP_URL_HOLDER",
            is_blind_mode=paper.is_blind_mode
        )
        created_version_number = version.version_number
        

        file_url = save_paper_file(
            paper_id=paper.id,
            version_number=version.version_number,
            upload_file=file
        )
        version.file_url = file_url
        
        db.commit() 
        db.refresh(paper)
        
        return paper

    except Exception as e:
        db.rollback()
        print(f" Error submitting paper: {str(e)}")
        
        if created_paper_id is not None and created_version_number is not None:
            try:
                delete_paper_version_file(
                    paper_id=created_paper_id,
                    version_number=created_version_number
                )
            except Exception as cleanup_error:
                print(f" Failed to clean up file: {cleanup_error}")

        raise HTTPException(
            status_code=400,
            detail=f"Submission failed: {str(e)}"
        )
    

# Danh sách bài đã nộp
@router.get(
    "",
    response_model=List[schemas.PaperResponse]
)
def get_my_submissions(
    db: Session = Depends(database.get_db),
    submitter_id: int = 42
    # current_user: models.User = Depends(deps.get_current_user)
):
    papers = crud.get_papers_by_author(db, submitter_id)
    # papers = crud.get_papers_by_author(db, current_user.id)
    return papers


# Xem chi tiết bài báo
@router.get(
    "/{paper_id}", 
    response_model=schemas.PaperResponse
)
def get_submission_detail(
    paper_id: int,
    db: Session = Depends(database.get_db),
    submitter_id: int = 42
    # current_user: models.User = Depends(deps.get_current_user)
):

    try:
        paper = crud.get_author_paper_detail(
            db=db,
            paper_id=paper_id,
            submitter_id=submitter_id
            # submitter_id=current_user.id
        )
        return paper
        
    except exceptions.PaperNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
        
    except exceptions.NotAuthorizedError as e:
        raise HTTPException(status_code=403, detail=str(e))
>>>>>>> a4399b3c71fb9a397bf2621bf4d07e74019f8161
