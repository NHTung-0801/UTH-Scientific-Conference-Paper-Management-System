from __future__ import annotations

import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.deps import get_db
from src import crud, schemas
from src.security.deps import get_current_payload, require_roles

router = APIRouter(prefix="/discussions", tags=["Review Discussions"])

SUBMISSION_SERVICE_URL = os.getenv("SUBMISSION_SERVICE_URL", "http://submission-service:8000").rstrip("/")
INTERNAL_KEY = os.getenv("INTERNAL_KEY", "")

async def _get_paper_author_id(paper_id: int) -> int:
    """
    Hàm này KHÔNG ảnh hưởng logic cũ.
    Chỉ dùng để xác định ai là Author của bài báo.
    """
    if not SUBMISSION_SERVICE_URL:
        return -1

    url = f"{SUBMISSION_SERVICE_URL}/api/submissions/{paper_id}"
    headers = {}
    if INTERNAL_KEY:
        headers["X-Internal-Key"] = INTERNAL_KEY

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(url, headers=headers)
            if r.status_code == 200:
                data = r.json()
                return int(data.get("created_by") or data.get("user_id") or data.get("author_id") or -1)
    except Exception:
        pass
    
    return -1


@router.post(
    "/",
    response_model=schemas.DiscussionViewOut,
    dependencies=[Depends(require_roles(["AUTHOR", "REVIEWER", "CHAIR", "ADMIN"]))],
)
async def create_discussion(
    data: schemas.DiscussionCreate,
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
):
    roles = set(payload.get("roles") or [])
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(401, "Token missing user_id")

    is_reviewer_assigned = False
    if "REVIEWER" in roles and "ADMIN" not in roles and "CHAIR" not in roles:
        ass = crud.list_assignments(db, reviewer_id=user_id, paper_id=data.paper_id)
        if ass:
            is_reviewer_assigned = True

    is_author_owner = False
    paper_author_id = await _get_paper_author_id(data.paper_id)
    
    if "AUTHOR" in roles:
        if user_id == paper_author_id:
            is_author_owner = True

    if not is_reviewer_assigned and not is_author_owner and "ADMIN" not in roles and "CHAIR" not in roles:
        raise HTTPException(403, "Permission denied: Not assigned reviewer or paper author")

    new_msg = crud.create_discussion(db, data, sender_id=user_id)

    sender_role = "UNKNOWN"
    if is_author_owner:
        sender_role = "AUTHOR"
    elif is_reviewer_assigned:
        sender_role = "REVIEWER"
    elif "CHAIR" in roles or "ADMIN" in roles:
        sender_role = "CHAIR"

    return {
        **new_msg.__dict__,
        "sender_role": sender_role,
        "sender_name": "Me",
        "is_me": True
    }


@router.get(
    "/paper/{paper_id}",
    response_model=list[schemas.DiscussionViewOut],
    dependencies=[Depends(require_roles(["AUTHOR", "REVIEWER", "CHAIR", "ADMIN"]))],
)

async def list_discussions(
    paper_id: int,
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
):
    roles = set(payload.get("roles") or [])
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(401, "Token missing user_id")

    paper_author_id = await _get_paper_author_id(paper_id)

    is_viewer_reviewer = False
    is_viewer_author = False

    if "REVIEWER" in roles:
        if crud.list_assignments(db, reviewer_id=user_id, paper_id=paper_id):
            is_viewer_reviewer = True

    if "AUTHOR" in roles:
        if user_id == paper_author_id:
            is_viewer_author = True

    is_admin_chair = "ADMIN" in roles or "CHAIR" in roles
    if not is_viewer_reviewer and not is_viewer_author and not is_admin_chair:
        raise HTTPException(403, "Not assigned to this paper")

    # --- LẤY DỮ LIỆU ---
    raw_msgs = crud.list_discussions(db, paper_id)
    reviewer_ids = sorted({
        m.sender_id for m in raw_msgs
        if m.sender_id is not None and m.sender_id != paper_author_id
    })
    reviewer_alias_map = {rid: f"R{idx+1}" for idx, rid in enumerate(reviewer_ids)}

    results = []
    for m in raw_msgs:
        is_me = (m.sender_id == user_id)
        is_author_msg = (m.sender_id == paper_author_id)
        if is_author_msg:
            sender_role = "AUTHOR"
        else:
            sender_role = "REVIEWER"

        sender_id_out = None
        sender_name = "Ẩn danh"

        if is_admin_chair:
            sender_id_out = m.sender_id
            if sender_role == "AUTHOR":
                sender_name = "Tác giả"
            else:
                alias = reviewer_alias_map.get(m.sender_id, "R?")
                sender_name = f"Reviewer ({alias})"
        else:
            if sender_role == "AUTHOR":
                sender_name = "Tác giả"
            else:
                alias = reviewer_alias_map.get(m.sender_id, "R?")
                sender_name = f"Reviewer Ẩn danh ({alias})"

        if is_me:
            sender_name = "Tôi"

        results.append({
            "id": m.id,
            "paper_id": m.paper_id,
            "sender_id": sender_id_out,    
            "content": m.content,
            "sent_at": m.sent_at,
            "parent_id": m.parent_id,

            "sender_role": sender_role,
            "sender_name": sender_name,
            "is_me": is_me,
        })

    return results