from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from src.deps import get_db
from src import crud, schemas

router = APIRouter(prefix="/coi", tags=["Conflicts of Interest"])

@router.post("/", response_model=schemas.COIOut)
def create_coi(data: schemas.COICreate, db: Session = Depends(get_db)):
    return crud.create_coi(db, data)

@router.get("/", response_model=list[schemas.COIOut])
def list_coi(paper_id: int | None = Query(default=None), reviewer_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    return crud.list_coi(db, paper_id=paper_id, reviewer_id=reviewer_id)

@router.patch("/{coi_id}", response_model=schemas.COIOut)
def update_coi(coi_id: int, data: schemas.COIUpdate, db: Session = Depends(get_db)):
    obj = crud.update_coi(db, coi_id, data)
    if not obj:
        raise HTTPException(404, "COI not found")
    return obj
