import logging
import os
import shutil
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from src.config import settings
from src.conference.models import Conference
from src.conference.topics.models import Topic
from src.conference.topics.schemas import (
    TopicCreate,
    TopicResponse,
    TopicUpdate,
)
from src.conference.tracks.models import Track
from src.database import get_db
from src.security.deps import require_roles
from src.utils.file_handler import delete_image, save_image

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/topics", tags=["Topics"]
)

# ========================
# CREATE TOPIC
# ========================
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_topic(
    name: str = Form(...),
    description: str = Form(None),
    track_id: int = Form(...),
    picture: UploadFile = File(None),
    db: Session = Depends(get_db),
    _=Depends(require_roles("ADMIN", "CHAIR")),
):
    # ========================
    # CHECK TRACK TỒN TẠI
    # ========================
    track = db.query(Track).filter(
        Track.id == track_id
    ).first()

    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found"
        )

    # ========================
    # CHECK CONFERENCE TỒN TẠI
    # ========================
    conference = db.query(Conference).filter(
        Conference.id == track.conference_id
    ).first()

    if not conference:
        raise HTTPException(
            status_code=404,
            detail="Conference not found"
        )

    # ========================
    # CHECK THỜI GIAN HỘI NGHỊ (NV3)
    # ========================
    now = datetime.now()

    if conference.end_date and now > conference.end_date:
        raise HTTPException(
            status_code=400,
            detail="Hội nghị đã kết thúc. Không thể tạo chủ đề mới."
        )

    # Chuẩn hóa tên và kiểm tra trùng lặp trong phân ban
    clean_name = name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Tên chủ đề không được để trống.")

    existing = db.query(Topic).filter(
        Topic.track_id == track_id,
        func.lower(Topic.name) == clean_name.lower()
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Chủ đề với tên '{clean_name}' đã tồn tại trong phân ban này."
        )

    # ========================
    # HANDLE PICTURE
    # ========================
    picture_path = save_image(picture, "topic_pictures") if picture else None

    # ========================
    # CREATE TOPIC
    # ========================
    topic = Topic(
        name=clean_name,
        description=description.strip() if description else None,
        track_id=track_id,
        picture=picture_path
    )

    db.add(topic)
    db.commit()
    db.refresh(topic)

    return {
        "message": "Topic created successfully",
        "topic": {
            "id": topic.id,
            "name": topic.name,
            "description": topic.description,
            "track_id": topic.track_id,
            "conference_id": track.conference_id,
            "picture": topic.picture
        }
    }
# ========================
# ========================
# GET ALL TOPICS
# ========================
@router.get("/")
def get_topics(db: Session = Depends(get_db)):
    topics = db.query(Topic).options(joinedload(Topic.track)).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "picture": t.picture,
            "track_id": t.track_id,
            "conference_id": t.track.conference_id if t.track else None
        }
        for t in topics
    ]


# ========================
# GET TOPIC BY ID
# ========================
@router.get("/{topic_id}")
def get_topic(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(Topic).options(joinedload(Topic.track)).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    return {
        "id": topic.id,
        "name": topic.name,
        "description": topic.description,
        "picture": topic.picture,
        "track_id": topic.track_id,
        "conference_id": topic.track.conference_id if topic.track else None
    }


# ========================
# GET TOPICS BY TRACK
# ========================
@router.get("/track/{track_id}")
def get_topics_by_track(track_id: int, db: Session = Depends(get_db)):
    topics = db.query(Topic).options(joinedload(Topic.track)).filter(Topic.track_id == track_id).all()
    track = db.query(Track).filter(Track.id == track_id).first()

    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "picture": t.picture,
            "track_id": t.track_id,
            "conference_id": track.conference_id if track else None
        }
        for t in topics
    ]


# ========================
# GET TOPICS BY CONFERENCE
# ========================
@router.get("/conference/{conference_id}")
def get_topics_by_conference(conference_id: int, db: Session = Depends(get_db)):
    """Lấy toàn bộ chủ đề thuộc hội nghị (gồm tất cả các phân ban)"""
    topics = (
        db.query(Topic)
        .join(Track, Topic.track_id == Track.id)
        .options(joinedload(Topic.track))
        .filter(Track.conference_id == conference_id)
        .all()
    )
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "picture": t.picture,
            "track_id": t.track_id,
            "track_name": t.track.name if t.track else None,
            "conference_id": conference_id
        }
        for t in topics
    ]


# ========================
# UPDATE TOPIC (TEXT + PICTURE)
# ========================
@router.put("/{topic_id}", status_code=200)
def update_topic(
    topic_id: int,
    name: str = Form(None),
    description: str = Form(None),
    picture: UploadFile = File(None),
    db: Session = Depends(get_db),
    _=Depends(require_roles("ADMIN", "CHAIR")),
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    track = db.query(Track).filter(Track.id == topic.track_id).first()
    

    # ===== BEFORE =====
    before = {
        "id": topic.id,
        "name": topic.name,
        "description": topic.description,
        "track_id": topic.track_id,
        "conference_id": track.conference_id if track else None,
        "picture": topic.picture
    }

    # update text
    if name is not None:
        clean_name = name.strip()
        if not clean_name:
            raise HTTPException(status_code=400, detail="Tên chủ đề không được để trống.")
        existing = db.query(Topic).filter(
            Topic.track_id == topic.track_id,
            Topic.id != topic_id,
            func.lower(Topic.name) == clean_name.lower()
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Chủ đề với tên '{clean_name}' đã tồn tại trong phân ban này."
            )
        topic.name = clean_name

    if description is not None:
        topic.description = description.strip() if description else None

    # update picture
    if picture:
        # Xóa ảnh cũ trước khi lưu ảnh mới
        delete_image(topic.picture)
        topic.picture = save_image(picture, "topic_pictures")

    db.commit()
    db.refresh(topic)

    # ===== AFTER =====
    after = {
        "id": topic.id,
        "name": topic.name,
        "description": topic.description,
        "track_id": topic.track_id,
        "conference_id": track.conference_id if track else None,
        "picture": topic.picture
    }

    return {
        "message": "Topic updated successfully",
        "before": before,
        "after": after
    }

# ========================
# DELETE TOPIC
# ========================
@router.delete("/{topic_id}", status_code=200)
def delete_topic(
    topic_id: int, 
    db: Session = Depends(get_db),
    _=Depends(require_roles("ADMIN", "CHAIR")),
):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Safe Delete: Kiểm tra xem có bài báo nào liên kết với chủ đề này chưa
    sub_service_url = settings.SUBMISSION_SERVICE_URL.rstrip("/")
    headers = {}
    if getattr(settings, "INTERNAL_KEY", None):
        headers["X-Internal-Key"] = settings.INTERNAL_KEY

    try:
        resp = httpx.get(
            f"{sub_service_url}/submissions/topic/{topic_id}/count",
            headers=headers,
            timeout=5.0
        )
        if resp.status_code == 200:
            paper_count = resp.json().get("count", 0)
            if paper_count > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Không thể xóa Chủ đề đã có bài báo liên kết (tồn tại {paper_count} bài báo liên kết)."
                )
    except httpx.RequestError as exc:
        logger.warning(f"Không thể kết nối Submission Service để kiểm tra chủ đề: {exc}")

    track = db.query(Track).filter(Track.id == topic.track_id).first()

    deleted_data = {
        "id": topic.id,
        "name": topic.name,
        "description": topic.description,
        "track_id": topic.track_id,
        "conference_id": track.conference_id if track else None,
        "picture": topic.picture
    }

    # Xóa file ảnh vật lý trên đĩa
    if topic.picture:
        delete_image(topic.picture)

    db.delete(topic)
    db.commit()

    return {
        "message": "Topic deleted successfully",
        "deleted_topic": deleted_data
    }