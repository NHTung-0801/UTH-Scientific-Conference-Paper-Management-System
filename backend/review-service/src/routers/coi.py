from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.deps import get_db
from src import crud, schemas
from src.security.deps import get_current_payload, require_roles

router = APIRouter(prefix="/coi", tags=["Conflicts of Interest"])


@router.post(
    "/",
    response_model=schemas.COIOut,
    dependencies=[Depends(require_roles(["REVIEWER", "ADMIN"]))],
)
def create_coi(
    data: schemas.COICreate,
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
):
    roles = set(payload.get("roles") or [])
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(401, "Token missing user_id")

    # Reviewer không được khai cho người khác
    if "ADMIN" not in roles:
        data.reviewer_id = user_id

    return crud.create_coi(db, data)


@router.get("/", response_model=list[schemas.COIOut])
def list_coi(
    paper_id: int | None = Query(default=None),
    reviewer_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
):
    roles = set(payload.get("roles") or [])
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(401, "Token missing user_id")

    if "REVIEWER" in roles and "ADMIN" not in roles and "CHAIR" not in roles:
        reviewer_id = user_id

    return crud.list_coi(db, paper_id=paper_id, reviewer_id=reviewer_id)


@router.patch(
    "/{coi_id}",
    response_model=schemas.COIOut,
    dependencies=[Depends(require_roles(["REVIEWER", "ADMIN"]))],
)
def update_coi(
    coi_id: int,
    data: schemas.COIUpdate,
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
):
    obj = crud.get_coi(db, coi_id) if hasattr(crud, "get_coi") else None
    if obj is None:
        # nếu crud chưa có get_coi thì crud.update_coi sẽ tự check
        pass
    else:
        roles = set(payload.get("roles") or [])
        user_id = payload.get("user_id")
        if "ADMIN" not in roles and obj.reviewer_id != user_id:
            raise HTTPException(403, "Not your COI")

    updated = crud.update_coi(db, coi_id, data)
    if not updated:
        raise HTTPException(404, "COI not found")
    return updated
