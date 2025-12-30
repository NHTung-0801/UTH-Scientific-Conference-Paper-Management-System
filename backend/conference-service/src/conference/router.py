from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from src.database import get_db
from src.conference.models import Conference
from src.conference.schemas import ConferenceDeleteResult
from sqlalchemy import text

from src.conference.schemas import (
    ConferenceCreate,
    ConferenceUpdate,
    ConferenceResponse,
    ConferenceUpdateResult
)
from fastapi import UploadFile, File, Form
import os, shutil

router = APIRouter(prefix="/conferences", tags=["Conferences"])

# =========================
# CONFIG UPLOAD
# =========================
UPLOAD_DIR = "static/conference_logos"
os.makedirs(UPLOAD_DIR, exist_ok=True)


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
            "logo": c.logo
        }
        for c in conferences
    ]


# =========================
# CREATE CONFERENCE
# =========================
@router.post("/")
def create_conference(
    name: str = Form(...),
    description: str | None = Form(None),
    logo: UploadFile | None = File(None),
    db: Session = Depends(get_db)
):
    logo_path = None

    if logo:
        filename = f"{name}_{logo.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(logo.file, buffer)

        logo_path = file_path

    new_conference = Conference(
        name=name,
        description=description,
        logo=logo_path,
        created_by=1  # tạm thời hardcode NV2
    )

    db.add(new_conference)
    db.commit()
    db.refresh(new_conference)

    return {
        "message": "Conference created successfully",
        "conference": {
            "id": new_conference.id,
            "name": new_conference.name,
            "description": new_conference.description,
            "logo": new_conference.logo
        }
    }


# =========================
# UPDATE CONFERENCE
# =========================
@router.put("/{conference_id}")
def update_conference(
    conference_id: int,
    name: str | None = Form(None),
    description: str | None = Form(None),
    logo: UploadFile | None = File(None),
    db: Session = Depends(get_db)
):
    conference = db.query(Conference).filter(
        Conference.id == conference_id
    ).first()

    if not conference:
        raise HTTPException(status_code=404, detail="Conference not found")

    old_data = {
        "id": conference.id,
        "name": conference.name,
        "description": conference.description,
        "logo": conference.logo
    }

    if name is not None:
        conference.name = name

    if description is not None:
        conference.description = description

    if logo:
        filename = f"{conference.id}_{logo.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(logo.file, buffer)

        conference.logo = file_path

    db.commit()
    db.refresh(conference)

    return {
        "message": "Conference updated successfully",
        "before_update": old_data,
        "after_update": {
            "id": conference.id,
            "name": conference.name,
            "description": conference.description,
            "logo": conference.logo
        }
    }


# =========================
# DELETE CONFERENCE
# =========================
@router.delete("/{conference_id}")
def delete_conference(
    conference_id: int,
    db: Session = Depends(get_db)
):
    conference = db.query(Conference).filter(
        Conference.id == conference_id
    ).first()

    if not conference:
        raise HTTPException(status_code=404, detail="Conference not found")

    deleted_data = {
        "id": conference.id,
        "name": conference.name,
        "description": conference.description,
        "logo": conference.logo
    }

    db.delete(conference)
    db.commit()

    return {
        "message": "Conference deleted successfully",
        "deleted_conference": deleted_data
    }