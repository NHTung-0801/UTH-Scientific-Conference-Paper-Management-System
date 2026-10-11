from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from src import database, crud, models, schemas
from src.security.deps import get_current_payload, require_roles
from src.utils.notification_client import send_notification

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
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db),
    payload=Depends(get_current_payload),
):
    """
    Chair đánh giá chất lượng phiếu phản biện của Reviewer (Rating từ 1-5 sao và lời nhận xét).
    Đồng thời gửi thông báo bất đồng bộ qua Notification Service cho Reviewer.
    """
    chair_id = payload.get("user_id")
    if not chair_id:
        raise HTTPException(401, "Missing user_id in token")

    # 1. Kiểm tra review có tồn tại không
    rev = crud.get_review(db, review_id)
    if not rev:
        raise HTTPException(404, "Review not found")

    # 2. Tạo evaluation
    evaluation = crud.create_review_evaluation(db, review_id, data, chair_id=chair_id)

    # 3. Tra cứu assignment để lấy reviewer_id và paper_id gửi thông báo
    ass = crud.get_assignment(db, rev.assignment_id)
    if ass:
        star_str = f" ⭐ {data.rating}/5 sao" if data.rating else ""
        background_tasks.add_task(
            send_notification,
            user_id=ass.reviewer_id,
            subject=f"Chủ tọa đã đánh giá chất lượng phản biện của bạn cho bài #{ass.paper_id}",
            body=f"Phiếu phản biện của bạn đã được Chair đánh giá{star_str}. Nhận xét: \"{data.comment[:60]}...\"",
            paper_id=ass.paper_id,
        )

    return evaluation


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


@router.get(
    "/reviewers/{reviewer_id}/performance",
    response_model=schemas.ReviewerPerformanceOut,
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def get_reviewer_performance(
    reviewer_id: int,
    db: Session = Depends(database.get_db),
):
    """
    Chair xem hồ sơ đánh giá chất lượng (Performance) của một phản biện viên qua tất cả các bài đã chấm:
    - Tổng số bài được phân công
    - Tổng số bài đã nộp phản biện
    - Điểm đánh giá trung bình từ Chair (1-5 sao)
    - Chi tiết các đánh giá và nhận xét
    """
    # Lấy các assignments của reviewer
    assignments = db.query(models.Assignment).filter(models.Assignment.reviewer_id == reviewer_id).all()
    total_assignments = len(assignments)

    if total_assignments == 0:
        return schemas.ReviewerPerformanceOut(
            reviewer_id=reviewer_id,
            total_assignments=0,
            completed_reviews=0,
            evaluated_reviews=0,
            average_rating=None,
            evaluations=[],
        )

    assignment_map = {a.id: a.paper_id for a in assignments}
    assignment_ids = list(assignment_map.keys())

    # Lấy các reviews
    reviews = db.query(models.Review).filter(models.Review.assignment_id.in_(assignment_ids)).all()
    completed_reviews = [r for r in reviews if not getattr(r, "is_draft", True)]
    completed_count = len(completed_reviews)

    review_ids = [r.id for r in reviews]
    review_paper_map = {r.id: assignment_map.get(r.assignment_id) for r in reviews}

    # Lấy tất cả evaluations
    evaluations_raw = (
        db.query(models.ReviewEvaluation)
        .filter(models.ReviewEvaluation.review_id.in_(review_ids))
        .order_by(models.ReviewEvaluation.created_at.desc())
        .all()
    )

    eval_items: List[schemas.ReviewerEvaluationItem] = []
    ratings: List[int] = []

    for ev in evaluations_raw:
        if ev.rating is not None:
            ratings.append(ev.rating)
        eval_items.append(
            schemas.ReviewerEvaluationItem(
                review_id=ev.review_id,
                paper_id=review_paper_map.get(ev.review_id),
                rating=ev.rating,
                comment=ev.comment,
                created_at=ev.created_at,
            )
        )

    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else None

    return schemas.ReviewerPerformanceOut(
        reviewer_id=reviewer_id,
        total_assignments=total_assignments,
        completed_reviews=completed_count,
        evaluated_reviews=len(eval_items),
        average_rating=avg_rating,
        evaluations=eval_items,
    )


@router.get(
    "/my-evaluations",
    response_model=List[schemas.ReviewerEvaluationItem],
    dependencies=[Depends(require_roles(["REVIEWER"]))],
)
def list_my_evaluations(
    db: Session = Depends(database.get_db),
    payload=Depends(get_current_payload),
):
    """
    Reviewer tự xem các đánh giá chất lượng mà Chair đã chấm cho mình.
    """
    user_id = payload.get("user_id")
    assignments = db.query(models.Assignment).filter(models.Assignment.reviewer_id == user_id).all()
    if not assignments:
        return []

    assignment_map = {a.id: a.paper_id for a in assignments}
    reviews = db.query(models.Review).filter(models.Review.assignment_id.in_(list(assignment_map.keys()))).all()
    if not reviews:
        return []

    review_ids = [r.id for r in reviews]
    review_paper_map = {r.id: assignment_map.get(r.assignment_id) for r in reviews}

    evaluations = (
        db.query(models.ReviewEvaluation)
        .filter(models.ReviewEvaluation.review_id.in_(review_ids))
        .order_by(models.ReviewEvaluation.created_at.desc())
        .all()
    )

    return [
        schemas.ReviewerEvaluationItem(
            review_id=ev.review_id,
            paper_id=review_paper_map.get(ev.review_id),
            rating=ev.rating,
            comment=ev.comment,
            created_at=ev.created_at,
        )
        for ev in evaluations
    ]
