from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.deps import get_db
from src import crud, schemas
from src.security.deps import get_current_payload, require_roles

router = APIRouter(prefix="/discussions", tags=["Review Discussions"])


@router.post(
    "/",
    response_model=schemas.DiscussionOut,
    dependencies=[Depends(require_roles(["REVIEWER", "CHAIR", "ADMIN"]))],
)
def create_discussion(
    data: schemas.DiscussionCreate,
    db: Session = Depends(get_db),
    payload=Depends(get_current_payload),
):
    sender_id = payload.get("user_id")
    return crud.create_discussion(db, data, sender_id=sender_id)


@router.get(
    "/paper/{paper_id}",
    response_model=list[schemas.DiscussionOut],
    dependencies=[Depends(require_roles(["REVIEWER", "CHAIR", "ADMIN"]))],
)
def list_discussions(
    paper_id: int,
    db: Session = Depends(get_db),
):
    return crud.list_discussions(db, paper_id)
