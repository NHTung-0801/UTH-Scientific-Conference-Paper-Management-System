import logging
from datetime import datetime
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.config import settings
from src.conference.models import Conference
from src.conference.tracks.models import Track
from src.conference.reviewers.models import ConferenceReviewer, ReviewerMessage, ReviewerStatus
from src.conference.reviewers.schemas import (
    ReviewerActiveOut,
    ReviewerInviteRequest,
    ReviewerMessageCreate,
    ReviewerMessageOut,
    ReviewerResponseAction,
    ReviewerResponseOut,
    ReviewerStatusEnum,
    ReviewerUpdateRequest,
)
from src.database import get_db
from src.security.deps import get_current_payload, require_roles

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/conferences/{conference_id}/reviewers",
    tags=["Conference Reviewers"]
)

# ============================================================
# 1. GET ACTIVE REVIEWERS (Dùng cho review-service & phân công bài)
# ============================================================
@router.get(
    "/active",
    response_model=List[ReviewerActiveOut],
    summary="Lấy danh sách Reviewer đã chấp nhận tham gia hội nghị (ACCEPTED)",
)
def get_active_conference_reviewers(
    conference_id: int,
    track_id: Optional[int] = Query(None, description="Lọc theo phân ban"),
    db: Session = Depends(get_db),
):
    conf = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")

    query = db.query(ConferenceReviewer).filter(
        ConferenceReviewer.conference_id == conference_id,
        ConferenceReviewer.status == ReviewerStatus.ACCEPTED
    )
    if track_id is not None:
        query = query.filter(ConferenceReviewer.track_id == track_id)

    return query.all()


# ============================================================
# 2. GET ALL REVIEWERS IN CONFERENCE POOL (Cho Chair / Admin)
# ============================================================
@router.get(
    "/",
    response_model=List[ReviewerResponseOut],
    summary="Xem toàn bộ Ban Phản biện của hội nghị kèm trạng thái",
)
def list_conference_reviewers(
    conference_id: int,
    status_filter: Optional[ReviewerStatusEnum] = Query(None, alias="status", description="Lọc theo trạng thái"),
    track_id: Optional[int] = Query(None, description="Lọc theo phân ban"),
    db: Session = Depends(get_db),
    _payload: dict = Depends(require_roles("ADMIN", "CHAIR")),
):
    conf = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")

    query = db.query(ConferenceReviewer).filter(ConferenceReviewer.conference_id == conference_id)
    if status_filter:
        query = query.filter(ConferenceReviewer.status == status_filter.value)
    if track_id is not None:
        query = query.filter(ConferenceReviewer.track_id == track_id)

    return query.order_by(ConferenceReviewer.id.desc()).all()


# ============================================================
# 3. INVITE REVIEWER (Chair gửi lời mời chuyên gia)
# ============================================================
@router.post(
    "/invite",
    response_model=ReviewerResponseOut,
    status_code=status.HTTP_201_CREATED,
    summary="Mời chuyên gia tham gia Ban Phản biện của Hội nghị",
)
def invite_conference_reviewer(
    conference_id: int,
    body: ReviewerInviteRequest,
    db: Session = Depends(get_db),
    _payload: dict = Depends(require_roles("ADMIN", "CHAIR")),
):
    conf = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")

    if body.track_id:
        track = db.query(Track).filter(
            Track.id == body.track_id,
            Track.conference_id == conference_id
        ).first()
        if not track:
            raise HTTPException(status_code=404, detail="Track not found in this conference")

    target_email = body.reviewer_email.lower().strip()

    # Kiểm tra xem reviewer này đã từng được mời chưa
    existing = db.query(ConferenceReviewer).filter(
        ConferenceReviewer.conference_id == conference_id,
        ConferenceReviewer.reviewer_email == target_email
    ).first()

    if existing:
        if existing.status == ReviewerStatus.ACCEPTED:
            raise HTTPException(
                status_code=400,
                detail="Chuyên gia này đã là thành viên chính thức của Ban Phản biện."
            )
        if existing.status == ReviewerStatus.INVITED:
            raise HTTPException(
                status_code=400,
                detail="Lời mời đã được gửi trước đó và hiện đang chờ chuyên gia phản hồi."
            )
        # Nếu trước đó từng từ chối hoặc bị thu hồi quyền -> Mời lại
        existing.status = ReviewerStatus.INVITED
        existing.invited_at = datetime.utcnow()
        existing.responded_at = None
        existing.track_id = body.track_id or existing.track_id
        existing.max_papers = body.max_papers
        if body.reviewer_name:
            existing.reviewer_name = body.reviewer_name
        reviewer_record = existing
    else:
        # Tra cứu xem user đã có tài khoản trong hệ thống chưa
        user_id = None
        try:
            ident_url = settings.IDENTITY_SERVICE_URL.rstrip("/")
            resp = httpx.get(ident_url, timeout=3.0)
            if resp.status_code == 200:
                users = resp.json()
                if isinstance(users, list):
                    found = next((u for u in users if str(u.get("email") or "").lower() == target_email), None)
                    if found:
                        user_id = found.get("id")
        except Exception as e:
            logger.warning(f"Không thể tra cứu User ID từ Identity Service: {e}")

        reviewer_record = ConferenceReviewer(
            conference_id=conference_id,
            user_id=user_id,
            reviewer_email=target_email,
            reviewer_name=body.reviewer_name or "",
            track_id=body.track_id,
            status=ReviewerStatus.INVITED,
            max_papers=body.max_papers,
        )
        db.add(reviewer_record)

    # Gửi sự kiện mời sang Notification Service
    try:
        noti_url = settings.NOTIFICATION_SERVICE_URL.rstrip("/")
        base_noti = noti_url if not noti_url.endswith("/api/notifications") else noti_url.rsplit("/api/notifications", 1)[0]
        endpoint = f"{base_noti}/api/notifications/reviewer-invite"
        headers = {}
        if getattr(settings, "INTERNAL_KEY", None):
            headers["X-Internal-Key"] = settings.INTERNAL_KEY

        payload_noti = {
            "conference_id": conference_id,
            "reviewer_email": target_email,
            "reviewer_name": body.reviewer_name or "",
            "description": body.description or f"Kính mời tham gia Ban Phản biện cho hội nghị {conf.name}"
        }
        httpx.post(endpoint, json=payload_noti, headers=headers, timeout=5.0)
    except Exception as exc:
        logger.warning(f"Không thể dispatch lời mời sang Notification Service: {exc}")

    db.commit()
    db.refresh(reviewer_record)
    return reviewer_record


# ============================================================
# 4. RESPOND TO INVITATION (Reviewer hoặc Webhook phản hồi)
# ============================================================
@router.post(
    "/respond",
    response_model=ReviewerResponseOut,
    summary="Ghi nhận phản hồi Chấp nhận / Từ chối lời mời phản biện",
)
def respond_reviewer_invitation(
    conference_id: int,
    body: ReviewerResponseAction,
    db: Session = Depends(get_db),
):
    target_email = body.reviewer_email.lower().strip()
    reviewer = db.query(ConferenceReviewer).filter(
        ConferenceReviewer.conference_id == conference_id,
        ConferenceReviewer.reviewer_email == target_email
    ).first()

    if not reviewer:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy thông tin lời mời cho email này tại hội nghị."
        )

    if body.action == "accept":
        reviewer.status = ReviewerStatus.ACCEPTED
    else:
        reviewer.status = ReviewerStatus.DECLINED

    reviewer.responded_at = datetime.utcnow()
    if body.user_id:
        reviewer.user_id = body.user_id

    db.commit()
    db.refresh(reviewer)
    return reviewer


# ============================================================
# 5. UPDATE REVIEWER IN POOL (Chair điều chỉnh track, quota, status)
# ============================================================
@router.patch(
    "/{reviewer_id}",
    response_model=ReviewerResponseOut,
    summary="Cập nhật phân ban phụ trách, hạn mức bài hoặc trạng thái của Reviewer",
)
def update_conference_reviewer(
    conference_id: int,
    reviewer_id: int,
    body: ReviewerUpdateRequest,
    db: Session = Depends(get_db),
    _payload: dict = Depends(require_roles("ADMIN", "CHAIR")),
):
    reviewer = db.query(ConferenceReviewer).filter(
        ConferenceReviewer.id == reviewer_id,
        ConferenceReviewer.conference_id == conference_id
    ).first()

    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found in this conference")

    if body.track_id is not None:
        if body.track_id != 0:
            track = db.query(Track).filter(
                Track.id == body.track_id,
                Track.conference_id == conference_id
            ).first()
            if not track:
                raise HTTPException(status_code=404, detail="Track not found in this conference")
            reviewer.track_id = body.track_id
        else:
            reviewer.track_id = None

    if body.max_papers is not None:
        reviewer.max_papers = body.max_papers

    if body.status is not None:
        reviewer.status = ReviewerStatus(body.status.value)

    db.commit()
    db.refresh(reviewer)
    return reviewer


# ============================================================
# 6. DELETE REVIEWER FROM POOL (Chair xóa reviewer khỏi hội nghị)
# ============================================================
@router.delete(
    "/{reviewer_id}",
    summary="Xóa phản biện viên khỏi danh sách của hội nghị",
)
def delete_conference_reviewer(
    conference_id: int,
    reviewer_id: int,
    db: Session = Depends(get_db),
    _payload: dict = Depends(require_roles("ADMIN", "CHAIR")),
):
    reviewer = db.query(ConferenceReviewer).filter(
        ConferenceReviewer.id == reviewer_id,
        ConferenceReviewer.conference_id == conference_id
    ).first()

    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found in this conference")

    db.delete(reviewer)
    db.commit()
    return {"message": "Reviewer removed from conference pool successfully", "id": reviewer_id}


# ============================================================
# 7. GET ALL CONFERENCE REVIEWER MESSAGES (Cho Chair xem tổng thể)
# ============================================================
@router.get(
    "/messages",
    response_model=List[ReviewerMessageOut],
    summary="Xem tất cả tin nhắn trao đổi từ Ban Phản biện trong hội nghị (Chair)",
)
def list_conference_reviewer_messages(
    conference_id: int,
    db: Session = Depends(get_db),
    _payload: dict = Depends(require_roles("ADMIN", "CHAIR")),
):
    conf = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")

    messages = db.query(ReviewerMessage).filter(
        ReviewerMessage.conference_id == conference_id
    ).order_by(ReviewerMessage.created_at.desc()).all()

    return messages


# ============================================================
# 8. GET THREAD MESSAGES (Xem luồng tin nhắn giữa Chair và 1 Reviewer)
# ============================================================
@router.get(
    "/{reviewer_id}/messages",
    response_model=List[ReviewerMessageOut],
    summary="Xem luồng tin nhắn trao đổi giữa Chair và một Reviewer",
)
def get_thread_messages(
    conference_id: int,
    reviewer_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("ADMIN", "CHAIR", "REVIEWER")),
):
    reviewer = db.query(ConferenceReviewer).filter(
        ConferenceReviewer.id == reviewer_id,
        ConferenceReviewer.conference_id == conference_id
    ).first()
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found in this conference")

    roles = {str(r).upper() for r in (payload.get("roles") or [])}
    user_id = payload.get("user_id")

    if "ADMIN" not in roles and "CHAIR" not in roles:
        if reviewer.user_id and reviewer.user_id != user_id:
            raise HTTPException(status_code=403, detail="Không có quyền xem tin nhắn của Reviewer khác")

    messages = db.query(ReviewerMessage).filter(
        ReviewerMessage.conference_id == conference_id,
        ReviewerMessage.reviewer_pool_id == reviewer_id
    ).order_by(ReviewerMessage.created_at.asc()).all()

    return messages


# ============================================================
# 9. SEND MESSAGE IN THREAD (Gửi tin nhắn trao đổi)
# ============================================================
@router.post(
    "/{reviewer_id}/messages",
    response_model=ReviewerMessageOut,
    status_code=status.HTTP_201_CREATED,
    summary="Gửi tin nhắn trao đổi giữa Chair và Reviewer",
)
def send_thread_message(
    conference_id: int,
    reviewer_id: int,
    body: ReviewerMessageCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles("ADMIN", "CHAIR", "REVIEWER")),
):
    conf = db.query(Conference).filter(Conference.id == conference_id).first()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")

    reviewer = db.query(ConferenceReviewer).filter(
        ConferenceReviewer.id == reviewer_id,
        ConferenceReviewer.conference_id == conference_id
    ).first()
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found in this conference")

    roles = {str(r).upper() for r in (payload.get("roles") or [])}
    user_id = payload.get("user_id") or 0

    is_chair = "ADMIN" in roles or "CHAIR" in roles
    if not is_chair:
        if reviewer.user_id and reviewer.user_id != user_id:
            raise HTTPException(status_code=403, detail="Không có quyền gửi tin nhắn thay cho Reviewer khác")
        sender_role = "REVIEWER"
        sender_name = reviewer.reviewer_name or "Reviewer"
        receiver_id = conf.created_by
        receiver_email = None
    else:
        sender_role = "CHAIR"
        sender_name = "Chủ tọa (Chair)"
        receiver_id = reviewer.user_id or 0
        receiver_email = reviewer.reviewer_email

    msg = ReviewerMessage(
        conference_id=conference_id,
        reviewer_pool_id=reviewer_id,
        sender_id=user_id,
        sender_role=sender_role,
        sender_name=sender_name,
        subject=body.subject,
        content=body.content,
        is_read=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Gửi thông báo chuông sang Notification Service
    try:
        noti_url = settings.NOTIFICATION_SERVICE_URL.rstrip("/")
        base_noti = noti_url if not noti_url.endswith("/api/notifications") else noti_url.rsplit("/api/notifications", 1)[0]
        endpoint = f"{base_noti}/api/notifications"
        headers = {}
        if getattr(settings, "INTERNAL_KEY", None):
            headers["X-Internal-Key"] = settings.INTERNAL_KEY

        noti_payload = {
            "receiver_id": receiver_id,
            "receiver_email": receiver_email,
            "subject": f"[{conf.name}] {body.subject}",
            "body": f"Tin nhắn mới từ {sender_name}: {body.content[:100]}...",
            "type": "MESSAGE"
        }
        httpx.post(endpoint, json=noti_payload, headers=headers, timeout=5.0)
    except Exception as exc:
        logger.warning(f"Không thể dispatch thông báo tin nhắn sang Notification Service: {exc}")

    return msg


# ============================================================
# 10. MARK MESSAGE AS READ (Đánh dấu đã đọc)
# ============================================================
@router.patch(
    "/messages/{message_id}/read",
    response_model=ReviewerMessageOut,
    summary="Đánh dấu tin nhắn đã đọc",
)
def mark_message_as_read(
    conference_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    _payload: dict = Depends(require_roles("ADMIN", "CHAIR", "REVIEWER")),
):
    msg = db.query(ReviewerMessage).filter(
        ReviewerMessage.id == message_id,
        ReviewerMessage.conference_id == conference_id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    msg.is_read = True
    db.commit()
    db.refresh(msg)
    return msg
