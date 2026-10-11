from sqlalchemy.orm import Session
from datetime import datetime
from sqlalchemy import or_
from src import models, schemas
from sqlalchemy import func, case
from datetime import datetime

# -------- Assignments --------
def create_assignment(db: Session, data: schemas.AssignmentCreate) -> models.Assignment:
    obj = models.Assignment(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def list_assignments(db: Session, reviewer_id: int | None = None, paper_id: int | None = None):
    q = db.query(models.Assignment)
    if reviewer_id is not None:
        q = q.filter(models.Assignment.reviewer_id == reviewer_id)
    if paper_id is not None:
        q = q.filter(models.Assignment.paper_id == paper_id)
    return q.order_by(models.Assignment.id.desc()).all()

def get_assignment(db: Session, assignment_id: int):
    return db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()

def update_assignment(db: Session, assignment_id: int, data: schemas.AssignmentUpdate):
    obj = get_assignment(db, assignment_id)
    if not obj:
        return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj

# -------- Reviews --------
def create_review(db: Session, data: schemas.ReviewCreate) -> models.Review:
    obj = models.Review(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def get_review(db: Session, review_id: int):
    return db.query(models.Review).filter(models.Review.id == review_id).first()

def list_reviews(db: Session, assignment_id: int | None = None):
    q = db.query(models.Review)
    if assignment_id is not None:
        q = q.filter(models.Review.assignment_id == assignment_id)
    return q.order_by(models.Review.id.desc()).all()

def update_review(db: Session, review_id: int, data: schemas.ReviewUpdate):
    obj = get_review(db, review_id)
    if not obj:
        return None
    payload = data.model_dump(exclude_unset=True)

    # if user marks as submitted, set submitted_at if missing
    if payload.get("is_draft") is False and payload.get("submitted_at") is None:
        payload["submitted_at"] = datetime.utcnow()

    for k, v in payload.items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj

def add_review_criteria(db: Session, review_id: int, data: schemas.ReviewCriteriaCreate) -> models.ReviewCriteria:
    obj = models.ReviewCriteria(review_id=review_id, **data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

# ✅ NEW: criteria helpers for PATCH
def get_review_criteria(db: Session, criteria_id: int):
    return (
        db.query(models.ReviewCriteria)
        .filter(models.ReviewCriteria.id == criteria_id)
        .first()
    )

def update_review_criteria(db: Session, criteria_id: int, data: schemas.ReviewCriteriaUpdate):
    obj = get_review_criteria(db, criteria_id)
    if not obj:
        return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj

# ========= HELPERS (SLA / COI enforcement) =========
def has_open_coi(db: Session, reviewer_id: int, paper_id: int) -> bool:
    q = (
        db.query(models.ConflictOfInterest)
        .filter(
            models.ConflictOfInterest.reviewer_id == reviewer_id,
            models.ConflictOfInterest.paper_id == paper_id,
            models.ConflictOfInterest.status == models.ConflictStatus.OPEN,
        )
    )
    return db.query(q.exists()).scalar()

def has_submitted_review(db: Session, assignment_id: int) -> bool:
    q = (
        db.query(models.Review)
        .filter(models.Review.assignment_id == assignment_id)
        .filter(or_(models.Review.is_draft == False, models.Review.submitted_at.isnot(None)))
    )
    return db.query(q.exists()).scalar()

# -------- COI --------
def create_coi(db: Session, data: schemas.COICreate) -> models.ConflictOfInterest:
    obj = models.ConflictOfInterest(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)

    # ✅ AUTO-ENFORCE: nếu đã có assignment thì auto chuyển Declined
    ass = (
        db.query(models.Assignment)
        .filter(
            models.Assignment.paper_id == data.paper_id,
            models.Assignment.reviewer_id == data.reviewer_id,
        )
        .first()
    )
    if ass and ass.status in [models.AssignmentStatus.INVITED, models.AssignmentStatus.ACCEPTED]:
        ass.status = models.AssignmentStatus.DECLINED
        ass.response_date = datetime.utcnow()
        db.commit()
        db.refresh(ass)

    return obj

def list_coi(db: Session, paper_id: int | None = None, reviewer_id: int | None = None):
    q = db.query(models.ConflictOfInterest)
    if paper_id is not None:
        q = q.filter(models.ConflictOfInterest.paper_id == paper_id)
    if reviewer_id is not None:
        q = q.filter(models.ConflictOfInterest.reviewer_id == reviewer_id)
    return q.order_by(models.ConflictOfInterest.id.desc()).all()

def update_coi(db: Session, coi_id: int, data: schemas.COIUpdate):
    obj = db.query(models.ConflictOfInterest).filter(models.ConflictOfInterest.id == coi_id).first()
    if not obj:
        return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit(); db.refresh(obj)
    return obj

def get_coi(db: Session, coi_id: int):
    return (
        db.query(models.ConflictOfInterest)
        .filter(models.ConflictOfInterest.id == coi_id)
        .first()
    )

# -------- Discussions --------
def create_discussion(db: Session, data: schemas.DiscussionCreate, sender_id: int) -> models.ReviewDiscussion:
    obj = models.ReviewDiscussion(
        paper_id=data.paper_id,
        sender_id=sender_id,
        content=data.content,
        parent_id=data.parent_id,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def list_discussions(db: Session, paper_id: int):
    return (
        db.query(models.ReviewDiscussion)
        .filter(models.ReviewDiscussion.paper_id == paper_id)
        .order_by(models.ReviewDiscussion.sent_at.asc())
        .all()
    )

# =========================================================
# ✅ NEW: REBUTTALS & EVALUATIONS CRUD
# =========================================================

# -------- Rebuttals --------
def create_rebuttal(db: Session, data: schemas.RebuttalCreate, author_id: int) -> models.Rebuttal:
    # Kiểm tra xem đã có rebuttal chưa (mỗi bài 1 cái)
    existing = db.query(models.Rebuttal).filter(models.Rebuttal.paper_id == data.paper_id).first()
    if existing:
        raise ValueError("Rebuttal already exists for this paper")
        
    obj = models.Rebuttal(
        paper_id=data.paper_id,
        author_id=author_id,
        content=data.content
    )
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def get_rebuttal_by_paper(db: Session, paper_id: int):
    return db.query(models.Rebuttal).filter(models.Rebuttal.paper_id == paper_id).first()

# -------- Review Evaluations --------
def create_review_evaluation(db: Session, review_id: int, data: schemas.EvaluationCreate, chair_id: int):
    obj = models.ReviewEvaluation(
        review_id=review_id,
        chair_id=chair_id,
        rating=data.rating,
        comment=data.comment
    )
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def list_review_evaluations(db: Session, review_id: int):
    return db.query(models.ReviewEvaluation).filter(models.ReviewEvaluation.review_id == review_id).all()

def chair_list_papers_review_summary(db: Session, paper_id: int | None = None):
    """
    Trả về list paper summary (paper_id, assigned_count, submitted_count, all_submitted,...)
    Không gọi service ngoài.
    """

    # Subquery: với mỗi assignment -> có submitted review chưa + latest submitted_at
    # submitted nếu exists review where is_draft=false OR submitted_at not null
    submitted_case = case(
        (
            (models.Review.is_draft == False) | (models.Review.submitted_at.isnot(None)),
            1,
        ),
        else_=0,
    )

    q = (
        db.query(
            models.Assignment.paper_id.label("paper_id"),
            models.Assignment.id.label("assignment_id"),
            models.Assignment.reviewer_id.label("reviewer_id"),
            models.Assignment.status.label("assignment_status"),
            models.Assignment.due_date.label("due_date"),
            models.Assignment.response_date.label("response_date"),
            func.max(submitted_case).label("has_submitted_review_int"),
            func.max(models.Review.submitted_at).label("latest_submitted_at"),
        )
        .outerjoin(models.Review, models.Review.assignment_id == models.Assignment.id)
        .group_by(
            models.Assignment.paper_id,
            models.Assignment.id,
            models.Assignment.reviewer_id,
            models.Assignment.status,
            models.Assignment.due_date,
            models.Assignment.response_date,
        )
        .order_by(models.Assignment.paper_id.desc(), models.Assignment.id.desc())
    )

    if paper_id is not None:
        q = q.filter(models.Assignment.paper_id == paper_id)

    rows = q.all()

    # group by paper_id in python
    by_paper = {}
    for r in rows:
        pid = int(r.paper_id)
        if pid not in by_paper:
            by_paper[pid] = {
                "paper_id": pid,
                "assignments": [],
                "assigned_count": 0,
                "submitted_count": 0,
                "latest_submitted_at": None,
            }

        has_submitted = bool(r.has_submitted_review_int == 1)
        item = {
            "assignment_id": int(r.assignment_id),
            "reviewer_id": int(r.reviewer_id),
            "assignment_status": str(r.assignment_status),
            "due_date": r.due_date,
            "response_date": r.response_date,
            "has_submitted_review": has_submitted,
            "submitted_at": r.latest_submitted_at,
        }

        by_paper[pid]["assignments"].append(item)
        by_paper[pid]["assigned_count"] += 1
        if has_submitted:
            by_paper[pid]["submitted_count"] += 1

        # latest submitted time of paper
        if r.latest_submitted_at:
            cur = by_paper[pid]["latest_submitted_at"]
            if (cur is None) or (r.latest_submitted_at > cur):
                by_paper[pid]["latest_submitted_at"] = r.latest_submitted_at

    # finalize all_submitted
    out = []
    for pid, obj in by_paper.items():
        obj["all_submitted"] = (obj["assigned_count"] > 0 and obj["submitted_count"] == obj["assigned_count"])
        out.append(obj)

    # sort paper_id desc
    out.sort(key=lambda x: x["paper_id"], reverse=True)
    return out