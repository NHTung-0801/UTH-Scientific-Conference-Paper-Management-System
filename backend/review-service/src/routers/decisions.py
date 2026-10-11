from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.deps import get_db
from src.security.deps import require_roles
from src import models, schemas

router = APIRouter(prefix="/decisions", tags=["Review Decisions & Metrics"])


def _calculate_metrics_for_paper(db: Session, paper_id: int) -> schemas.PaperReviewMetrics:
    # 1. Lấy tất cả phân công của bài báo
    assignments = db.query(models.Assignment).filter(models.Assignment.paper_id == paper_id).all()
    total_assignments = len(assignments)

    if total_assignments == 0:
        return schemas.PaperReviewMetrics(
            paper_id=paper_id,
            total_assignments=0,
            total_reviews=0,
            completed_reviews=0,
            recommendation="PENDING",
            reviews=[],
        )

    assignment_ids = [a.id for a in assignments]

    # 2. Lấy tất cả các bài review gắn với assignment
    reviews = db.query(models.Review).filter(models.Review.assignment_id.in_(assignment_ids)).all()
    total_reviews = len(reviews)

    # 3. Lọc các bài review đã nộp chính thức (không còn là bản nháp)
    completed_reviews_list = [
        r for r in reviews
        if not getattr(r, "is_draft", True) and getattr(r, "final_score", None) is not None
    ]
    completed_count = len(completed_reviews_list)

    # 4. Chuẩn bị danh sách tóm tắt từng phiếu chấm (đánh số ẩn danh Reviewer #1, #2...)
    review_items: List[schemas.ReviewScoreItem] = []
    for idx, r in enumerate(reviews):
        review_items.append(
            schemas.ReviewScoreItem(
                review_id=r.id,
                reviewer_label=f"Reviewer #{idx + 1}",
                final_score=r.final_score,
                confidence_score=r.confidence_score,
                is_draft=getattr(r, "is_draft", True),
                submitted_at=getattr(r, "submitted_at", None),
            )
        )

    # Nếu chưa có bài review nào hoàn tất nộp điểm
    if completed_count == 0:
        return schemas.PaperReviewMetrics(
            paper_id=paper_id,
            total_assignments=total_assignments,
            total_reviews=total_reviews,
            completed_reviews=0,
            recommendation="PENDING",
            reviews=review_items,
        )

    # 5. Tính toán các chỉ số điểm số
    scores = [float(r.final_score) for r in completed_reviews_list if r.final_score is not None]
    confidences = [int(r.confidence_score) if r.confidence_score else 3 for r in completed_reviews_list]

    avg_score = round(sum(scores) / len(scores), 2)
    min_score = round(min(scores), 2)
    max_score = round(max(scores), 2)
    score_spread = round(max_score - min_score, 2)

    # Tính điểm trung bình có trọng số theo độ tự tin: sum(score * conf) / sum(conf)
    total_conf = sum(confidences)
    if total_conf > 0:
        weighted_score = round(sum(s * c for s, c in zip(scores, confidences)) / total_conf, 2)
    else:
        weighted_score = avg_score

    # 6. Kiểm tra cảnh báo lệch điểm (Score Discrepancy)
    # Gắn cờ khi có ít nhất 2 bài chấm hoàn tất và độ chênh lệch điểm >= 3.0 (trên thang 10)
    has_discrepancy = len(scores) >= 2 and score_spread >= 3.0
    discrepancy_reason = None
    if has_discrepancy:
        discrepancy_reason = (
            f"Phát hiện chênh lệch điểm số lớn ({score_spread} điểm, Max: {max_score}, Min: {min_score}). "
            "Chair nên chủ trì thảo luận ẩn danh hoặc mời thêm phản biện viên thứ ba trước khi ra quyết định."
        )

    # 7. Đề xuất quyết định sơ bộ
    if weighted_score >= 7.0:
        recommendation = "ACCEPT"
    elif weighted_score >= 5.0:
        recommendation = "REVISION"
    else:
        recommendation = "REJECT"

    return schemas.PaperReviewMetrics(
        paper_id=paper_id,
        total_assignments=total_assignments,
        total_reviews=total_reviews,
        completed_reviews=completed_count,
        average_score=avg_score,
        weighted_score=weighted_score,
        min_score=min_score,
        max_score=max_score,
        score_spread=score_spread,
        has_discrepancy=has_discrepancy,
        discrepancy_reason=discrepancy_reason,
        recommendation=recommendation,
        reviews=review_items,
    )


@router.get(
    "/papers/{paper_id}/metrics",
    response_model=schemas.PaperReviewMetrics,
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def get_paper_review_metrics(
    paper_id: int,
    db: Session = Depends(get_db),
):
    """
    Trả về toàn bộ chỉ số thống kê phản biện cho bài báo:
    - Điểm trung bình thường và điểm trung bình có trọng số theo độ tự tin.
    - Cảnh báo lệch điểm (Score Discrepancy) nếu hiệu số max - min >= 3.0.
    - Đề xuất tự động (ACCEPT / REVISION / REJECT / PENDING).
    """
    return _calculate_metrics_for_paper(db, paper_id)


@router.get(
    "/discrepancies",
    response_model=List[schemas.PaperReviewMetrics],
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def list_paper_discrepancies(
    db: Session = Depends(get_db),
):
    """
    Lấy danh sách các bài báo đang có sự bất đồng/phân cực điểm số (score_spread >= 3.0)
    để Chair ưu tiên can thiệp xử lý.
    """
    # Lấy các paper_id riêng biệt có bài chấm
    distinct_papers = db.query(models.Assignment.paper_id).distinct().all()
    discrepancy_list: List[schemas.PaperReviewMetrics] = []

    for (p_id,) in distinct_papers:
        metrics = _calculate_metrics_for_paper(db, p_id)
        if metrics.has_discrepancy:
            discrepancy_list.append(metrics)

    return discrepancy_list
