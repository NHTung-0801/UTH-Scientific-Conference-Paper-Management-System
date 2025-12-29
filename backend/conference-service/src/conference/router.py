from fastapi import APIRouter, Depends, HTTPException
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

router = APIRouter(prefix="/conferences", tags=["Conferences"])

# ========================
# CREATE
# ========================
@router.post("/", response_model=ConferenceResponse)
def create_conference(
    data: ConferenceCreate,
    db: Session = Depends(get_db),
):
    # 🔹 LẤY ID NHỎ NHẤT CHƯA DÙNG
    result = db.execute(text("""
        SELECT MIN(t1.id + 1) AS next_id
        FROM conferences t1
        LEFT JOIN conferences t2 ON t1.id + 1 = t2.id
        WHERE t2.id IS NULL
    """)).fetchone()

    next_id = result[0] if result and result[0] else 1

    conf = Conference(
        id=next_id,          # 👈 CHỖ DUY NHẤT THAY ĐỔI
        name=data.name,
        logo=data.logo,
        description=data.description,
        created_by=1         # demo cứng user_id
    )

    db.add(conf)
    db.commit()
    db.refresh(conf)
    return conf

# ========================
# GET BY ID (PHỤC VỤ PUT)
# ========================
@router.get("/{conference_id}", response_model=ConferenceResponse)
def get_conference(conference_id: int, db: Session = Depends(get_db)):
    conf = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")
    return conf


# ========================
# UPDATE (PUT)
# ========================
@router.put("/{conference_id}", response_model=ConferenceUpdateResult)
def update_conference(
    conference_id: int,
    data: ConferenceUpdate,
    db: Session = Depends(get_db),
):
    conf = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")

    # Lưu dữ liệu trước khi update
    before_update = ConferenceResponse.from_orm(conf)

    # Update từng field nếu có
    if data.name is not None:
        conf.name = data.name
    if data.logo is not None:
        conf.logo = data.logo
    if data.description is not None:
        conf.description = data.description

    db.commit()
    db.refresh(conf)

    after_update = ConferenceResponse.from_orm(conf)

    return {
        "before_update": before_update,
        "after_update": after_update
    }


# ========================
# DELETE
# ========================
@router.delete("/{conference_id}", response_model=ConferenceDeleteResult)
def delete_conference(conference_id: int, db: Session = Depends(get_db)):
    conf = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")

    deleted_data = ConferenceResponse.from_orm(conf)

    db.delete(conf)
    db.commit()

    return {
        "message": "Conference deleted successfully",
        "deleted_conference": deleted_data
    }

