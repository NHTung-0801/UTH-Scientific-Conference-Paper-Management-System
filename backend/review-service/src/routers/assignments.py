from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from src.deps import get_db
from src import crud, schemas
from src.security.deps import get_current_payload, require_roles

router = APIRouter(prefix="/assignments", tags=["Assignments"])

@router.post("/", response_model=schemas.AssignmentOut,
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))])
def create_assignment(data: schemas.AssignmentCreate, db: Session = Depends(get_db)):
    return crud.create_assignment(db, data)

@router.get("/", response_model=list[schemas.AssignmentOut])
def list_assignments(
    reviewer_id: int | None = Query(default=None),
    paper_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
):
    roles = set(payload.get("roles") or [])
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(401, "Token missing user_id")

    if "REVIEWER" in roles and "ADMIN" not in roles and "CHAIR" not in roles:
        reviewer_id = user_id

    return crud.list_assignments(db, reviewer_id=reviewer_id, paper_id=paper_id)

@router.get("/{assignment_id}", response_model=schemas.AssignmentOut)
def get_assignment(
    assignment_id: int, 
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
    ):
    obj = crud.get_assignment(db, assignment_id)
    if not obj:
        raise HTTPException(404, "Assignment not found")

    roles = set(payload.get("roles") or [])
    user_id = payload.get("user_id")

    if "REVIEWER" in roles and "ADMIN" not in roles and "CHAIR" not in roles:
        if obj.reviewer_id != user_id:
            raise HTTPException(403, "Not your assignment")

    return obj

@router.patch("/{assignment_id}", response_model=schemas.AssignmentOut)
def update_assignment(
    assignment_id: int,
    data: schemas.AssignmentUpdate,
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
):
    obj = crud.get_assignment(db, assignment_id)
    if not obj:
        raise HTTPException(404, "Assignment not found")

    roles = set(payload.get("roles") or [])
    user_id = payload.get("user_id")

    if "REVIEWER" in roles and "ADMIN" not in roles and "CHAIR" not in roles:
        if obj.reviewer_id != user_id:
            raise HTTPException(403, "Not your assignment")

    updated = crud.update_assignment(db, assignment_id, data)
    if not updated:
        raise HTTPException(404, "Assignment not found")
    return updated
