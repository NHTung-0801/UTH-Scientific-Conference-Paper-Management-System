from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.deps import get_db
from src import crud, schemas
from src.security.deps import get_current_payload, require_roles

router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.post(
    "/",
    response_model=schemas.ReviewOut,
    dependencies=[Depends(require_roles(["REVIEWER", "ADMIN"]))],
)
def create_review(
    data: schemas.ReviewCreate,
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
):
    reviewer_id = payload.get("user_id")
    roles = set(payload.get("roles") or [])

    ass = crud.get_assignment(db, data.assignment_id)
    if not ass:
        raise HTTPException(400, "assignment_id not found")

    if "ADMIN" not in roles and ass.reviewer_id != reviewer_id:
        raise HTTPException(403, "Not your assignment")

    return crud.create_review(db, data)


@router.get(
    "/",
    response_model=list[schemas.ReviewOut],
    dependencies=[Depends(require_roles(["REVIEWER", "CHAIR", "ADMIN"]))],
)
def list_reviews(
    assignment_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
):
    roles = set(payload.get("roles") or [])
    user_id = payload.get("user_id")

    # reviewer bắt buộc phải lọc theo assignment của mình
    if "REVIEWER" in roles and "ADMIN" not in roles and "CHAIR" not in roles:
        if assignment_id is None:
            raise HTTPException(400, "assignment_id is required for reviewer")
        ass = crud.get_assignment(db, assignment_id)
        if not ass or ass.reviewer_id != user_id:
            raise HTTPException(403, "Not your assignment")

    return crud.list_reviews(db, assignment_id=assignment_id)


@router.get(
    "/{review_id}",
    response_model=schemas.ReviewOut,
    dependencies=[Depends(require_roles(["REVIEWER", "CHAIR", "ADMIN"]))],
)
def get_review(
    review_id: int,
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
):
    obj = crud.get_review(db, review_id)
    if not obj:
        raise HTTPException(404, "Review not found")

    roles = set(payload.get("roles") or [])
    user_id = payload.get("user_id")

    # reviewer chỉ xem review thuộc assignment mình
    if "REVIEWER" in roles and "ADMIN" not in roles and "CHAIR" not in roles:
        ass = crud.get_assignment(db, obj.assignment_id)
        if not ass or ass.reviewer_id != user_id:
            raise HTTPException(403, "Not your review")

    return obj


@router.patch(
    "/{review_id}",
    response_model=schemas.ReviewOut,
    dependencies=[Depends(require_roles(["REVIEWER", "ADMIN"]))],
)
def update_review(
    review_id: int,
    data: schemas.ReviewUpdate,
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
):
    obj = crud.get_review(db, review_id)
    if not obj:
        raise HTTPException(404, "Review not found")

    roles = set(payload.get("roles") or [])
    user_id = payload.get("user_id")

    if "ADMIN" not in roles:
        ass = crud.get_assignment(db, obj.assignment_id)
        if not ass or ass.reviewer_id != user_id:
            raise HTTPException(403, "Not your review")

    updated = crud.update_review(db, review_id, data)
    if not updated:
        raise HTTPException(404, "Review not found")
    return updated


@router.post(
    "/{review_id}/criterias",
    response_model=schemas.ReviewCriteriaOut,
    dependencies=[Depends(require_roles(["REVIEWER", "ADMIN"]))],
)
def add_criteria(
    review_id: int,
    data: schemas.ReviewCriteriaCreate,
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
):
    rev = crud.get_review(db, review_id)
    if not rev:
        raise HTTPException(404, "Review not found")

    roles = set(payload.get("roles") or [])
    user_id = payload.get("user_id")

    if "ADMIN" not in roles:
        ass = crud.get_assignment(db, rev.assignment_id)
        if not ass or ass.reviewer_id != user_id:
            raise HTTPException(403, "Not your review")

    return crud.add_review_criteria(db, review_id, data)
