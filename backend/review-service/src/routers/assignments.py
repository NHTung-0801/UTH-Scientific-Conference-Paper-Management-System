from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from src.deps import get_db
from src import crud, schemas

router = APIRouter(prefix="/assignments", tags=["Assignments"])

@router.post("/", response_model=schemas.AssignmentOut)
def create_assignment(data: schemas.AssignmentCreate, db: Session = Depends(get_db)):
    return crud.create_assignment(db, data)

@router.get("/", response_model=list[schemas.AssignmentOut])
def list_assignments(
    reviewer_id: int | None = Query(default=None),
    paper_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return crud.list_assignments(db, reviewer_id=reviewer_id, paper_id=paper_id)

@router.get("/{assignment_id}", response_model=schemas.AssignmentOut)
def get_assignment(assignment_id: int, db: Session = Depends(get_db)):
    obj = crud.get_assignment(db, assignment_id)
    if not obj:
        raise HTTPException(404, "Assignment not found")
    return obj

@router.patch("/{assignment_id}", response_model=schemas.AssignmentOut)
def update_assignment(assignment_id: int, data: schemas.AssignmentUpdate, db: Session = Depends(get_db)):
    obj = crud.update_assignment(db, assignment_id, data)
    if not obj:
        raise HTTPException(404, "Assignment not found")
    return obj
