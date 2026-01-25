# src/routers/reviews.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.deps import get_db
from src import crud, schemas

router = APIRouter(prefix="/reviews", tags=["Reviews"])

@router.post("/", response_model=schemas.ReviewOut)
def create_review(data: schemas.ReviewCreate, db: Session = Depends(get_db)):
    ass = crud.get_assignment(db, data.assignment_id)
    if not ass:
        raise HTTPException(400, "assignment_id not found")

    ass_status = ass.status.value if hasattr(ass.status, "value") else str(ass.status)

    # ✅ only Accepted can create review
    if ass_status != "Accepted":
        raise HTTPException(400, "Assignment must be Accepted before creating a review")

    # ✅ COI block
    if crud.has_open_coi(db, reviewer_id=ass.reviewer_id, paper_id=ass.paper_id):
        raise HTTPException(400, "COI detected: cannot create review for this paper")

    return crud.create_review(db, data)

@router.get("/", response_model=list[schemas.ReviewOut])
def list_reviews(assignment_id: int | None = None, db: Session = Depends(get_db)):
    return crud.list_reviews(db, assignment_id=assignment_id)

@router.get("/{review_id}", response_model=schemas.ReviewOut)
def get_review(review_id: int, db: Session = Depends(get_db)):
    obj = crud.get_review(db, review_id)
    if not obj:
        raise HTTPException(404, "Review not found")
    return obj

@router.patch("/{review_id}", response_model=schemas.ReviewOut)
def update_review(review_id: int, data: schemas.ReviewUpdate, db: Session = Depends(get_db)):
    obj = crud.update_review(db, review_id, data)
    if not obj:
        raise HTTPException(404, "Review not found")
    return obj

@router.post("/{review_id}/criterias", response_model=schemas.ReviewCriteriaOut)
def add_criteria(review_id: int, data: schemas.ReviewCriteriaCreate, db: Session = Depends(get_db)):
    rev = crud.get_review(db, review_id)
    if not rev:
        raise HTTPException(404, "Review not found")
    return crud.add_review_criteria(db, review_id, data)
