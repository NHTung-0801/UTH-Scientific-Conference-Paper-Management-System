import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.deps import get_db
from src import crud
from src.config import SUBMISSION_SERVICE_URL

router = APIRouter(prefix="/papers", tags=["Papers (helper)"])

@router.get("/{assignment_id}/pdf-url")
async def get_pdf_url(assignment_id: int, db: Session = Depends(get_db)):
    ass = crud.get_assignment(db, assignment_id)
    if not ass:
        raise HTTPException(404, "Assignment not found")

    # fetch paper detail from submission-service
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{SUBMISSION_SERVICE_URL}/submissions/{ass.paper_id}")
    if r.status_code != 200:
        raise HTTPException(502, "Cannot fetch paper from submission-service")

    data = r.json()
    versions = data.get("versions") or []
    if not versions:
        raise HTTPException(404, "No versions found for this paper")

    latest = max(versions, key=lambda v: v.get("version_number", 0))
    file_url = latest.get("file_url")
    if not file_url:
        raise HTTPException(404, "file_url missing")

    return {"paper_id": ass.paper_id, "version_number": latest.get("version_number"), "pdf_url": f"{SUBMISSION_SERVICE_URL}/static{file_url}"}
