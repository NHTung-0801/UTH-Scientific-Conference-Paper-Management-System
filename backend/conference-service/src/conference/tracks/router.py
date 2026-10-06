import logging
import os
import shutil
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.config import settings
from src.conference.models import Conference
from src.conference.tracks.models import Track
from src.conference.tracks.schemas import TrackAssignChairRequest, TrackResponse
from src.database import get_db
from src.security.deps import require_roles
from src.utils.file_handler import delete_image, save_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tracks", tags=["Tracks"])


# ========================
# GET TRACKS BY CONFERENCE  ✅ đặt lên trước /{track_id}
# ========================
@router.get("/conference/{conference_id}", response_model=list[TrackResponse])
def get_tracks_by_conference(conference_id: int, db: Session = Depends(get_db)):
    return db.query(Track).filter(Track.conference_id == conference_id).all()


# ========================
# CREATE TRACK
# ========================
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_track(
    name: str = Form(...),
    description: str | None = Form(None),
    conference_id: int = Form(...),
    chair_id: int | None = Form(None),
    logo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    _=Depends(require_roles("ADMIN", "CHAIR")),
):
    conference = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conference:
        raise HTTPException(status_code=404, detail="Conference not found")

    logo_path = save_image(logo, "track_logos") if logo else None

    track = Track(
        name=name,
        description=description,
        conference_id=conference_id,
        chair_id=chair_id,
        logo=logo_path
    )

    try:
        db.add(track)
        db.commit()
        db.refresh(track)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid conference_id")

    return {
        "message": "Track created successfully",
        "track": {
            "id": track.id,
            "name": track.name,
            "description": track.description,
            "logo": track.logo,
            "conference_id": track.conference_id,
            "chair_id": track.chair_id,
        }
    }


# ========================
# GET ALL TRACKS
# ========================
@router.get("/", response_model=list[TrackResponse])
def get_tracks(db: Session = Depends(get_db)):
    return db.query(Track).all()


# ========================
# GET TRACK BY ID
# ========================
@router.get("/{track_id}", response_model=TrackResponse)
def get_track(track_id: int, db: Session = Depends(get_db)):
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return track


# ========================
# UPDATE TRACK
# ========================
@router.put("/{track_id}")
def update_track(
    track_id: int,
    name: str | None = Form(None),
    description: str | None = Form(None),
    chair_id: int | None = Form(None),
    logo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    _=Depends(require_roles("ADMIN", "CHAIR")),
):
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    before_update = {
        "id": track.id,
        "name": track.name,
        "description": track.description,
        "conference_id": track.conference_id,
        "chair_id": track.chair_id,
        "logo": track.logo
    }

    if name is not None:
        track.name = name
    if description is not None:
        track.description = description
    if chair_id is not None:
        track.chair_id = chair_id if chair_id != 0 else None
    if logo:
        # Xóa logo cũ trên đĩa trước khi lưu logo mới
        delete_image(track.logo)
        track.logo = save_image(logo, "track_logos")

    db.commit()
    db.refresh(track)

    after_update = {
        "id": track.id,
        "name": track.name,
        "description": track.description,
        "conference_id": track.conference_id,
        "chair_id": track.chair_id,
        "logo": track.logo
    }

    return {"message": "Track updated successfully", "before": before_update, "after": after_update}


# ========================
# ASSIGN TRACK CHAIR
# ========================
@router.post(
    "/{track_id}/assign-chair",
    response_model=TrackResponse,
    summary="Chỉ định Trưởng phân ban (Track Chair) quản lý phân ban",
)
def assign_track_chair(
    track_id: int,
    body: TrackAssignChairRequest,
    db: Session = Depends(get_db),
    _=Depends(require_roles("ADMIN", "CHAIR")),
):
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    track.chair_id = body.chair_id
    db.commit()
    db.refresh(track)
    return track


# ========================
# REMOVE TRACK CHAIR
# ========================
@router.delete(
    "/{track_id}/remove-chair",
    response_model=TrackResponse,
    summary="Gỡ bỏ Trưởng phân ban (Track Chair) khỏi phân ban",
)
def remove_track_chair(
    track_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("ADMIN", "CHAIR")),
):
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    track.chair_id = None
    db.commit()
    db.refresh(track)
    return track


# ========================
# DELETE TRACK
# ========================
@router.delete("/{track_id}")
def delete_track(
    track_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("ADMIN", "CHAIR"))
):
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # Safe Delete: Kiểm tra xem đã có bài báo nào nộp vào phân ban này chưa
    sub_service_url = settings.SUBMISSION_SERVICE_URL.rstrip("/")
    headers = {}
    if getattr(settings, "INTERNAL_KEY", None):
        headers["X-Internal-Key"] = settings.INTERNAL_KEY

    try:
        resp = httpx.get(
            f"{sub_service_url}/submissions/track/{track_id}/count",
            headers=headers,
            timeout=5.0
        )
        if resp.status_code == 200:
            paper_count = resp.json().get("count", 0)
            if paper_count > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Không thể xóa Phân ban đã có bài báo nộp (tồn tại {paper_count} bài nộp)."
                )
    except httpx.RequestError as exc:
        logger.warning(f"Không thể kết nối Submission Service để kiểm tra bài báo: {exc}")

    deleted_track = {
        "id": track.id,
        "name": track.name,
        "description": track.description,
        "conference_id": track.conference_id,
        "logo": track.logo
    }

    # Xóa file logo vật lý trên đĩa
    if track.logo:
        delete_image(track.logo)

    db.delete(track)
    db.commit()
    return {"message": "Track deleted successfully", "deleted": deleted_track}
