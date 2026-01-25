from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.deps import get_db
from src import crud, schemas
from src.models import AssignmentStatus

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


def _enum_value(x):
    return getattr(x, "value", str(x))


@router.patch("/{assignment_id}", response_model=schemas.AssignmentOut)
def update_assignment(
    assignment_id: int, data: schemas.AssignmentUpdate, db: Session = Depends(get_db)
):
    ass = crud.get_assignment(db, assignment_id)
    if not ass:
        raise HTTPException(404, "Assignment not found")

    payload = data.model_dump(exclude_unset=True)

    incoming_status = payload.get("status")
    if incoming_status is not None:
        incoming_status = str(incoming_status).strip()

    current_status = _enum_value(ass.status)

    allowed = {s.value for s in AssignmentStatus}

    if incoming_status is not None and incoming_status not in allowed:
        raise HTTPException(
            400,
            f"Invalid status '{incoming_status}'. Allowed: {sorted(list(allowed))}",
        )

    if incoming_status == AssignmentStatus.ACCEPTED.value:
        coi_list = crud.list_coi(db, paper_id=ass.paper_id, reviewer_id=ass.reviewer_id)
        for c in coi_list:
            if _enum_value(c.status) == "Open":
                raise HTTPException(400, "COI declared: cannot accept this assignment")

    if incoming_status == AssignmentStatus.COMPLETED.value:
        if current_status != AssignmentStatus.ACCEPTED.value:
            raise HTTPException(400, "Only ACCEPTED assignments can be completed")

    if incoming_status in (AssignmentStatus.ACCEPTED.value, AssignmentStatus.DECLINED.value):
        if payload.get("response_date") is None:
            payload["response_date"] = datetime.utcnow()

    # Update
    enforced = schemas.AssignmentUpdate(**payload)
    obj = crud.update_assignment(db, assignment_id, enforced)
    if not obj:
        raise HTTPException(404, "Assignment not found")
    return obj
