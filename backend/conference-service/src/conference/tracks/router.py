from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.database import get_db
from src.conference.tracks.models import Track
from src.conference.tracks.schemas import (
    TrackCreate,
    TrackUpdate,
    TrackResponse
)
from src.conference.models import Conference
from fastapi import UploadFile, File, Form
import os
import shutil

router = APIRouter(
    prefix="/tracks",
    tags=["Tracks"]
)

# ========================
# CREATE TRACK
# ========================
@router.post("/")
def create_track(
    name: str = Form(...),
    description: str = Form(None),
    conference_id: int = Form(...),
    logo: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    # ✅ CHECK CONFERENCE TỒN TẠI TRƯỚC
    conference = db.query(Conference).filter(
        Conference.id == conference_id
    ).first()

    if not conference:
        raise HTTPException(
            status_code=404,
            detail="Conference not found"
        )

    logo_path = None
    if logo:
        os.makedirs("src/static/track_logos", exist_ok=True)
        file_path = f"src/static/track_logos/{logo.filename}"

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(logo.file, buffer)

        logo_path = f"track_logos/{logo.filename}"

    track = Track(
        name=name,
        description=description,
        conference_id=conference_id,
        logo=logo_path
    )

    try:
        db.add(track)
        db.commit()
        db.refresh(track)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid conference_id"
        )

    return {
        "message": "Track created successfully",
        "track": {
            "id": track.id,
            "name": track.name,
            "description": track.description,
            "logo": track.logo,
            "conference_id": track.conference_id
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
        raise HTTPException(
            status_code=404,
            detail="Track not found"
        )
    return track


# ========================
# GET TRACKS BY CONFERENCE
# ========================
@router.get("/conference/{conference_id}", response_model=list[TrackResponse])
def get_tracks_by_conference(
    conference_id: int,
    db: Session = Depends(get_db)
):
    return db.query(Track).filter(
        Track.conference_id == conference_id
    ).all()


# ========================
# UPDATE TRACK
# ========================
@router.put("/{track_id}")
def update_track(
    track_id: int,
    name: str = Form(None),
    description: str = Form(None),
    logo: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found"
        )

    # ===== BEFORE UPDATE =====
    before_update = {
        "id": track.id,
        "name": track.name,
        "description": track.description,
        "conference_id": track.conference_id,
        "logo": track.logo
    }

    # ===== UPDATE TEXT =====
    if name is not None:
        track.name = name

    if description is not None:
        track.description = description

    # ===== UPDATE LOGO =====
    if logo:
        os.makedirs("src/static/track_logos", exist_ok=True)
        file_path = f"src/static/track_logos/{logo.filename}"

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(logo.file, buffer)

        track.logo = f"track_logos/{logo.filename}"

    db.commit()
    db.refresh(track)

    # ===== AFTER UPDATE =====
    after_update = {
        "id": track.id,
        "name": track.name,
        "description": track.description,
        "conference_id": track.conference_id,
        "logo": track.logo
    }

    return {
        "message": "Track updated successfully",
        "before": before_update,
        "after": after_update
    }

# ========================
# DELETE TRACK
# ========================
@router.delete("/{track_id}")
def delete_track(track_id: int, db: Session = Depends(get_db)):
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(
            status_code=404,
            detail="Track not found"
        )

    # ===== DATA BEFORE DELETE =====
    deleted_track = {
        "id": track.id,
        "name": track.name,
        "description": track.description,
        "conference_id": track.conference_id,
        "logo": track.logo
    }

    db.delete(track)
    db.commit()

    return {
        "message": "Track deleted successfully",
        "deleted": deleted_track
    }

