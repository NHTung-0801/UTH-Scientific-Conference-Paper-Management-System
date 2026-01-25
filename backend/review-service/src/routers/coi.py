# src/routers/coi.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime

from src.deps import get_db
from src import crud, schemas
from src.models import AssignmentStatus

router = APIRouter(prefix="/coi", tags=["COI"])

@router.get("/", response_model=list[schemas.COIOut])
def list_coi(
    paper_id: int | None = Query(default=None),
    reviewer_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return crud.list_coi(db, paper_id=paper_id, reviewer_id=reviewer_id)

@router.post("/", response_model=schemas.COIOut)
def create_coi(data: schemas.COICreate, db: Session = Depends(get_db)):
    # 1) prevent duplicates OPEN
    existing = crud.list_coi(db, paper_id=data.paper_id, reviewer_id=data.reviewer_id)
    for x in existing:
        status_val = getattr(x.status, "value", str(x.status))
        if status_val == "Open":
            raise HTTPException(400, "COI already declared (OPEN)")

    # 2) do NOT allow declare COI after review submitted
    assignments = crud.list_assignments(db, reviewer_id=data.reviewer_id, paper_id=data.paper_id)
    for a in assignments:
        st = getattr(a.status, "value", str(a.status))
        if st == "Completed":
            raise HTTPException(400, "Cannot declare COI after review submitted")

    # 3) create COI
    coi = crud.create_coi(db, data)

    # 4) enforce: auto-decline any existing assignments (Invited/Accepted)
    for a in assignments:
        st = getattr(a.status, "value", str(a.status))
        if st in ("Invited", "Accepted"):
            a.status = AssignmentStatus.DECLINED
            a.response_date = datetime.utcnow()

    db.commit()
    return coi
