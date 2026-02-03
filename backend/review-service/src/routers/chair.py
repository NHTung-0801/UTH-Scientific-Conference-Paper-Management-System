from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from src import database, crud
from src.schemas import ChairPaperReviewSummary  # hoặc nơi bạn để schema

router = APIRouter(prefix="/chair", tags=["Chair"])

@router.get("/papers/review-summary", response_model=List[ChairPaperReviewSummary])
def chair_papers_review_summary(
    paper_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
):
    return crud.chair_list_papers_review_summary(db, paper_id=paper_id)
