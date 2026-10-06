import logging
import os
import shutil
from datetime import date, datetime, time, timedelta
from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.config import settings
from src.conference.models import Conference
from src.conference.schemas import (
    CameraReadyOpenIn,
    ConferenceCreate,
    ConferenceDeleteResult,
    ConferencePhaseOut,
    ConferencePolicyUpdate,
    ConferenceResponse,
    ConferenceUpdate,
    ConferenceUpdateResult,
    SubmissionWindowToggle,
)
from src.database import get_db
from src.security.deps import require_roles
from src.utils.file_handler import delete_image, save_image

logger = logging.getLogger(__name__)

# =========================
# CONFIG
# =========================
router = APIRouter(prefix="/api/conferences", tags=["Conferences"])

# =========================
# HELPER FUNCTIONS
# =========================



def get_conference_status(conference: Conference) -> str:
    now = datetime.now()
    start = conference.start_date
    end = conference.end_date

    if not start or not end:
        return "unknown"

    if not isinstance(start, datetime):
        start = datetime.combine(start, time.min)
    if not isinstance(end, datetime):
        end = datetime.combine(end, time.max)

    if now < start:
        return "upcoming"
    elif now > end:
        return "ended"
    return "ongoing"

# =========================
# [NEW] API ĐẾM SỐ LƯỢNG (Cho Service Khác Gọi)
# =========================
@router.get("/count-total")
def count_conferences(db: Session = Depends(get_db)):
    """API trả về tổng số lượng hội nghị (Dùng cho Dashboard Admin)"""
    count = db.query(Conference).count()
    return {"total": count}

# =========================
# GET ALL CONFERENCES
# =========================
@router.get("/")
def get_conferences(db: Session = Depends(get_db)):
    conferences = db.query(Conference).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "logo": c.logo,
            "start_date": c.start_date,
            "end_date": c.end_date,
            "status": get_conference_status(c),
            "camera_ready_open": c.camera_ready_open,
            "camera_ready_deadline": c.camera_ready_deadline,
            "submission_deadline": c.submission_deadline,
            "review_deadline": c.review_deadline,
            "notification_date": c.notification_date,
            "rebuttal_deadline": c.rebuttal_deadline,
            "is_submission_open": c.is_submission_open,
            "blind_mode": c.blind_mode,
            "min_reviews_per_paper": c.min_reviews_per_paper,
            "max_paper_pages": c.max_paper_pages,
            "guidelines": c.guidelines,
        }
        for c in conferences
    ]

# =========================
# CREATE CONFERENCE
# =========================
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_conference(
    name: str = Form(...),
    description: str | None = Form(None),
    start_date: date = Form(...),
    start_time: time = Form(...),
    end_date: date = Form(...),
    end_time: time = Form(...),
    submission_deadline: datetime | None = Form(None),
    review_deadline: datetime | None = Form(None),
    notification_date: datetime | None = Form(None),
    rebuttal_deadline: datetime | None = Form(None),
    blind_mode: str = Form("DOUBLE_BLIND"),
    min_reviews_per_paper: int = Form(2),
    max_paper_pages: int = Form(8),
    guidelines: str | None = Form(None),
    logo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("ADMIN", "CHAIR")),
):
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    start_dt = datetime.combine(start_date, start_time).replace(microsecond=0)
    end_dt = datetime.combine(end_date, end_time).replace(microsecond=0)

    # Validate thời gian hội nghị
    now = datetime.now()
    if start_dt < now - timedelta(minutes=5):
        raise HTTPException(
            status_code=400,
            detail="Thời gian bắt đầu hội nghị không được ở trong quá khứ."
        )

    if start_dt >= end_dt:
        raise HTTPException(
            status_code=400,
            detail="Thời gian bắt đầu phải trước thời gian kết thúc hội nghị."
        )

    if submission_deadline and submission_deadline > start_dt:
        raise HTTPException(
            status_code=400,
            detail="Hạn nộp bài phải trước hoặc bằng ngày bắt đầu hội nghị."
        )

    logo_path = save_image(logo, "conference_logos") if logo else None

    new_conference = Conference(
        name=name,
        description=description,
        logo=logo_path,
        start_date=start_dt,
        end_date=end_dt,
        submission_deadline=submission_deadline,
        review_deadline=review_deadline,
        notification_date=notification_date,
        rebuttal_deadline=rebuttal_deadline,
        is_submission_open=True,
        blind_mode=blind_mode,
        min_reviews_per_paper=min_reviews_per_paper,
        max_paper_pages=max_paper_pages,
        guidelines=guidelines,
        created_by=user_id,
    )

    db.add(new_conference)
    db.commit()
    db.refresh(new_conference)

    return {
        "message": "Conference created successfully",
        "conference": {
            "id": new_conference.id,
            "name": new_conference.name,
            "status": get_conference_status(new_conference)
        },
    }

# =========================
# GET BY ID
# =========================
@router.get("/{conference_id}")
def get_conference_by_id(conference_id: int, db: Session = Depends(get_db)):
    conference = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conference:
        raise HTTPException(status_code=404, detail="Conference not found")

    return {
        "id": conference.id,
        "name": conference.name,
        "description": conference.description,
        "logo": conference.logo,
        "start_date": conference.start_date,
        "end_date": conference.end_date,
        "status": get_conference_status(conference),
        "created_by": conference.created_by,
        "camera_ready_open": conference.camera_ready_open,
        "camera_ready_deadline": conference.camera_ready_deadline,
        "submission_deadline": conference.submission_deadline,
        "review_deadline": conference.review_deadline,
        "notification_date": conference.notification_date,
        "rebuttal_deadline": conference.rebuttal_deadline,
        "is_submission_open": conference.is_submission_open,
        "blind_mode": conference.blind_mode,
        "min_reviews_per_paper": conference.min_reviews_per_paper,
        "max_paper_pages": conference.max_paper_pages,
        "guidelines": conference.guidelines,
    }

# =========================
# UPDATE
# =========================
@router.put("/{conference_id}")
def update_conference(
    conference_id: int,
    name: str | None = Form(None),
    description: str | None = Form(None),
    start_date: date | None = Form(None),
    start_time: time | None = Form(None),
    end_date: date | None = Form(None),
    end_time: time | None = Form(None),
    submission_deadline: datetime | None = Form(None),
    review_deadline: datetime | None = Form(None),
    notification_date: datetime | None = Form(None),
    rebuttal_deadline: datetime | None = Form(None),
    is_submission_open: bool | None = Form(None),
    blind_mode: str | None = Form(None),
    min_reviews_per_paper: int | None = Form(None),
    max_paper_pages: int | None = Form(None),
    guidelines: str | None = Form(None),
    logo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("ADMIN", "CHAIR")),
):
    conference = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conference:
        raise HTTPException(status_code=404, detail="Conference not found")

    if name: conference.name = name
    if description is not None: conference.description = description
    if submission_deadline is not None: conference.submission_deadline = submission_deadline
    if review_deadline is not None: conference.review_deadline = review_deadline
    if notification_date is not None: conference.notification_date = notification_date
    if rebuttal_deadline is not None: conference.rebuttal_deadline = rebuttal_deadline
    if is_submission_open is not None: conference.is_submission_open = is_submission_open
    if blind_mode is not None: conference.blind_mode = blind_mode
    if min_reviews_per_paper is not None: conference.min_reviews_per_paper = min_reviews_per_paper
    if max_paper_pages is not None: conference.max_paper_pages = max_paper_pages
    if guidelines is not None: conference.guidelines = guidelines

    # Cập nhật thời gian
    current_start = conference.start_date
    current_end = conference.end_date

    # Nếu truyền date/time mới thì ghép lại, nếu không thì dùng cái cũ
    new_start_dt = datetime.combine(
        start_date if start_date else current_start.date(),
        start_time if start_time else current_start.time()
    )
    
    new_end_dt = datetime.combine(
        end_date if end_date else current_end.date(),
        end_time if end_time else current_end.time()
    )

    if new_start_dt >= new_end_dt:
        raise HTTPException(
            status_code=400,
            detail="Thời gian bắt đầu phải trước thời gian kết thúc hội nghị."
        )

    conference.start_date = new_start_dt
    conference.end_date = new_end_dt

    if logo:
        # Xóa logo cũ trên đĩa trước khi lưu logo mới
        delete_image(conference.logo)
        conference.logo = save_image(logo, "conference_logos")

    db.commit()
    db.refresh(conference)

    return {"message": "Conference updated successfully", "id": conference.id}

# =========================
# DELETE
# =========================
@router.delete("/{conference_id}")
def delete_conference(
    conference_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("ADMIN", "CHAIR")),
):
    conference = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conference:
        raise HTTPException(status_code=404, detail="Conference not found")

    # Safe Delete: Kiểm tra xem đã có bài báo nào nộp vào hội nghị này chưa
    sub_service_url = settings.SUBMISSION_SERVICE_URL.rstrip("/")
    headers = {}
    if getattr(settings, "INTERNAL_KEY", None):
        headers["X-Internal-Key"] = settings.INTERNAL_KEY

    try:
        resp = httpx.get(
            f"{sub_service_url}/submissions/conference/{conference_id}/count",
            headers=headers,
            timeout=5.0
        )
        if resp.status_code == 200:
            paper_count = resp.json().get("count", 0)
            if paper_count > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Không thể xóa Hội nghị đã có bài báo nộp (tồn tại {paper_count} bài nộp)."
                )
    except httpx.RequestError as exc:
        logger.warning(f"Không thể kết nối Submission Service để kiểm tra bài báo: {exc}")

    # Xóa file logo vật lý trên đĩa
    if conference.logo:
        delete_image(conference.logo)

    db.delete(conference)
    db.commit()

    return {
        "message": "Conference deleted successfully",
        "id": conference_id,
    }



# =========================
# GET CONFERENCE PHASE (CAMERA-READY)
# =========================
@router.get("/{conference_id}/phase")
def get_conference_phase(conference_id: int, db: Session = Depends(get_db)):
    conf = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")

    return {
        "conference_id": conf.id,
        "camera_ready_open": getattr(conf, "camera_ready_open", False),
        "camera_ready_deadline": getattr(conf, "camera_ready_deadline", None),
        "submission_deadline": getattr(conf, "submission_deadline", None),
        "is_submission_open": getattr(conf, "is_submission_open", True),
    }


# =========================
# TOGGLE SUBMISSION WINDOW (CHAIR/ADMIN)
# =========================
@router.put("/{conference_id}/submission-window")
def toggle_submission_window(
    conference_id: int,
    body: SubmissionWindowToggle,
    db: Session = Depends(get_db),
    _payload: dict = Depends(require_roles("ADMIN", "CHAIR")),
):
    conf = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")

    conf.is_submission_open = body.is_open
    db.commit()
    db.refresh(conf)

    return {
        "conference_id": conf.id,
        "is_submission_open": conf.is_submission_open,
        "submission_deadline": conf.submission_deadline,
    }


# =========================
# OPEN CAMERA-READY (CHAIR/ADMIN)
# =========================
@router.put("/{conference_id}/camera-ready/open")
def open_camera_ready(
    conference_id: int,
    body: CameraReadyOpenIn,
    db: Session = Depends(get_db),
    _payload: dict = Depends(require_roles("ADMIN", "CHAIR")),
):
    conf = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")

    if body.deadline:
        now = datetime.now(body.deadline.tzinfo) if body.deadline.tzinfo else datetime.now()
        if body.deadline < now:
            raise HTTPException(
                status_code=400,
                detail="Hạn chót Camera-Ready không được ở trong quá khứ."
            )
        if conf.start_date and body.deadline > conf.start_date:
            raise HTTPException(
                status_code=400,
                detail="Hạn chót Camera-Ready phải trước hoặc bằng ngày bắt đầu hội nghị."
            )

    conf.camera_ready_open = True
    conf.camera_ready_deadline = body.deadline
    db.commit()
    db.refresh(conf)

    return {
        "conference_id": conf.id,
        "camera_ready_open": conf.camera_ready_open,
        "camera_ready_deadline": conf.camera_ready_deadline,
    }


# =========================
# CLOSE CAMERA-READY (CHAIR/ADMIN)
# =========================
@router.put("/{conference_id}/camera-ready/close")
def close_camera_ready(
    conference_id: int,
    db: Session = Depends(get_db),
    _payload: dict = Depends(require_roles("ADMIN", "CHAIR")),
):
    conf = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")

    conf.camera_ready_open = False
    db.commit()
    db.refresh(conf)

    return {
        "conference_id": conf.id,
        "camera_ready_open": conf.camera_ready_open,
        "camera_ready_deadline": conf.camera_ready_deadline,
    }


# =========================
# GET GUIDELINES & POLICY (PUBLIC)
# =========================
@router.get("/{conference_id}/guidelines")
def get_conference_guidelines(conference_id: int, db: Session = Depends(get_db)):
    """API công khai cho Tác giả và Reviewer xem quy định nộp bài & phản biện"""
    conf = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")

    return {
        "conference_id": conf.id,
        "conference_name": conf.name,
        "blind_mode": conf.blind_mode,
        "min_reviews_per_paper": conf.min_reviews_per_paper,
        "max_paper_pages": conf.max_paper_pages,
        "guidelines": conf.guidelines,
        "submission_deadline": conf.submission_deadline,
        "review_deadline": conf.review_deadline,
        "notification_date": conf.notification_date,
        "camera_ready_deadline": conf.camera_ready_deadline,
        "is_submission_open": conf.is_submission_open,
    }


# =========================
# UPDATE POLICY & GUIDELINES (CHAIR/ADMIN)
# =========================
@router.put("/{conference_id}/policy")
def update_conference_policy(
    conference_id: int,
    body: ConferencePolicyUpdate,
    db: Session = Depends(get_db),
    _payload: dict = Depends(require_roles("ADMIN", "CHAIR")),
):
    """API cho Chair cập nhật chính sách phản biện và hướng dẫn nộp bài"""
    conf = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")

    if body.blind_mode is not None:
        conf.blind_mode = body.blind_mode
    if body.min_reviews_per_paper is not None:
        if body.min_reviews_per_paper < 1:
            raise HTTPException(status_code=400, detail="Số phản biện tối thiểu mỗi bài phải >= 1")
        conf.min_reviews_per_paper = body.min_reviews_per_paper
    if body.max_paper_pages is not None:
        if body.max_paper_pages < 1:
            raise HTTPException(status_code=400, detail="Số trang tối đa của bài viết phải >= 1")
        conf.max_paper_pages = body.max_paper_pages
    if body.guidelines is not None:
        conf.guidelines = body.guidelines

    db.commit()
    db.refresh(conf)

    return {
        "conference_id": conf.id,
        "blind_mode": conf.blind_mode,
        "min_reviews_per_paper": conf.min_reviews_per_paper,
        "max_paper_pages": conf.max_paper_pages,
        "guidelines": conf.guidelines,
    }


