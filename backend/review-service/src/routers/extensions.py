from __future__ import annotations

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from src.deps import get_db
from src.security.deps import get_current_payload, require_roles
from src import models, schemas
from src.utils.notification_client import send_notification

router = APIRouter(prefix="/extensions", tags=["Extensions"])


# --- API cho Reviewer: Gửi yêu cầu xin gia hạn ---
@router.post(
    "/",
    response_model=schemas.ExtensionOut,
    dependencies=[Depends(require_roles(["REVIEWER"]))],
)
def request_extension(
    data: schemas.ExtensionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
):
    user_id = payload.get("user_id")

    # 1. Kiểm tra quyền sở hữu Assignment
    ass = db.query(models.Assignment).filter(models.Assignment.id == data.assignment_id).first()
    if not ass or ass.reviewer_id != user_id:
        raise HTTPException(403, "Not your assignment")

    # 2. Kiểm tra trạng thái Assignment hợp lệ
    ass_status = getattr(ass.status, "value", str(ass.status))
    if ass_status in ["Declined", "Completed"]:
        raise HTTPException(400, f"Cannot request extension for assignment with status '{ass_status}'")

    # 3. Kiểm tra ngày xin gia hạn phải ở tương lai
    if data.requested_date <= datetime.utcnow():
        raise HTTPException(400, "Requested date must be in the future")

    # 4. Chặn gửi nhiều đơn xin gia hạn trùng lặp khi đang PENDING
    existing_pending = db.query(models.ExtensionRequest).filter(
        models.ExtensionRequest.assignment_id == data.assignment_id,
        models.ExtensionRequest.status == "PENDING",
    ).first()
    if existing_pending:
        raise HTTPException(400, "You already have a pending extension request for this assignment")

    # 5. Tạo yêu cầu gia hạn mới
    new_req = models.ExtensionRequest(
        assignment_id=data.assignment_id,
        reviewer_id=user_id,
        requested_date=data.requested_date,
        reason=data.reason,
        status="PENDING",
    )
    db.add(new_req)
    db.commit()
    db.refresh(new_req)
    return new_req


# --- API cho Reviewer: Xem danh sách yêu cầu gia hạn của chính mình ---
@router.get(
    "/my-requests",
    response_model=list[schemas.ExtensionOut],
    dependencies=[Depends(require_roles(["REVIEWER"]))],
)
def list_my_extensions(
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
):
    user_id = payload.get("user_id")
    return (
        db.query(models.ExtensionRequest)
        .filter(models.ExtensionRequest.reviewer_id == user_id)
        .order_by(models.ExtensionRequest.created_at.desc())
        .all()
    )


# --- API cho Chair: Xem danh sách yêu cầu đang chờ duyệt ---
@router.get(
    "/pending",
    response_model=list[schemas.ExtensionOut],
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def list_pending_extensions(db: Session = Depends(get_db)):
    return (
        db.query(models.ExtensionRequest)
        .filter(models.ExtensionRequest.status == "PENDING")
        .order_by(models.ExtensionRequest.created_at.asc())
        .all()
    )


# --- API cho Chair: Duyệt / Từ chối yêu cầu gia hạn ---
@router.patch(
    "/{request_id}/resolve",
    response_model=schemas.ExtensionOut,
    dependencies=[Depends(require_roles(["CHAIR", "ADMIN"]))],
)
def resolve_extension(
    request_id: int,
    action: schemas.ExtensionAction,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    req = db.query(models.ExtensionRequest).filter(models.ExtensionRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Request not found")

    if req.status != "PENDING":
        raise HTTPException(400, "Request already resolved")

    status_upper = action.status.strip().upper()
    if status_upper not in ["APPROVED", "REJECTED"]:
        raise HTTPException(400, "Invalid status. Must be 'APPROVED' or 'REJECTED'")

    req.status = status_upper
    req.updated_at = datetime.utcnow()

    ass = db.query(models.Assignment).filter(models.Assignment.id == req.assignment_id).first()

    # LOGIC TỰ ĐỘNG TĂNG DEADLINE KHI APPROVED
    if status_upper == "APPROVED" and ass:
        ass.due_date = req.requested_date
        db.add(ass)

    db.commit()
    db.refresh(req)

    # Gửi thông báo ngầm cho Reviewer
    if ass:
        action_text = "đã được phê duyệt" if status_upper == "APPROVED" else "đã bị từ chối"
        background_tasks.add_task(
            send_notification,
            user_id=req.reviewer_id,
            subject=f"Đơn xin gia hạn chấm bài #{ass.paper_id} {action_text}",
            body=f"Chủ tọa hội nghị đã giải quyết đơn xin gia hạn phản biện: {action_text}. Hạn mới: {ass.due_date}.",
            paper_id=ass.paper_id,
        )

    return req