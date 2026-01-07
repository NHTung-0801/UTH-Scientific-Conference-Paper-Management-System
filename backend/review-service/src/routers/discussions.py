from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.deps import get_db
from src import crud, schemas

router = APIRouter(prefix="/discussions", tags=["Review Discussions"])

@router.post("/", response_model=schemas.DiscussionOut)
def create_discussion(data: schemas.DiscussionCreate, db: Session = Depends(get_db)):
    return crud.create_discussion(db, data)

@router.get("/paper/{paper_id}", response_model=list[schemas.DiscussionOut])
def list_discussions(paper_id: int, db: Session = Depends(get_db)):
    return crud.list_discussions(db, paper_id)
