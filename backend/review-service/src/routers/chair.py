from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src import database, crud, models, schemas
from src.security.deps import get_current_payload, require_roles

router = APIRouter(prefix="/chair", tags=["Chair Review Management"])


@router.get(
    "/papers/review-summary",
    response_model=List[schemas.ChairPaperReviewSummary],
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def chair_papers_review_summary(
    paper_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
):
    """
    Xem tổng quan tiến độ phản biện của các bài báo trong hội nghị.
    """
    return crud.chair_list_papers_review_summary(db, paper_id=paper_id)


@router.post(
    "/reviews/{review_id}/evaluations",
    response_model=schemas.EvaluationOut,
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def evaluate_review(
    review_id: int,
    data: schemas.EvaluationCreate,
    db: Session = Depends(database.get_db),
    payload=Depends(get_current_payload),
):
    """
    Chair đánh giá chất lượng phiếu phản biện của Reviewer (Rating từ 1-5 sao và lời nhận xét).
    """
    chair_id = payload.get("user_id")
    if not chair_id:
        raise HTTPException(401, "Missing user_id in token")

    # Kiểm tra review có tồn tại không
    rev = crud.get_review(db, review_id)
    if not rev:
        raise HTTPException(404, "Review not found")

    return crud.create_review_evaluation(db, review_id, data, chair_id=chair_id)


@router.get(
    "/reviews/{review_id}/evaluations",
    response_model=List[schemas.EvaluationOut],
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN", "REVIEWER"]))],
)
def list_review_evaluations(
    review_id: int,
    db: Session = Depends(database.get_db),
):
    """
    Xem danh sách đánh giá của Chair cho một phiếu chấm phản biện.
    """
    rev = crud.get_review(db, review_id)
    if not rev:
        raise HTTPException(404, "Review not found")

    return crud.list_review_evaluations(db, review_id)
