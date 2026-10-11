from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from .database import get_db
from . import schemas, ai_engine, models
from .services.ai_reviewer import ai_service  # <--- Import Service mới
import time
from typing import List
import json

router = APIRouter()

# Hàm log chạy ngầm (Background Task)
def log_to_db(db: Session, user_id: int, role: str, feature: str, prompt: str, output: dict, duration: float):
    try:
        # Chuyển output object thành dict nếu cần
        if hasattr(output, "model_dump"):
            output_data = output.model_dump()
        else:
            output_data = output

        log = models.AILog(
            user_id=user_id,
            user_role=role,
            feature_type=feature,
            model_name="gemini-1.5-flash",
            input_prompt=prompt[:1000], 
            output_response=output_data,
            processing_time=duration
        )
        db.add(log)
        db.commit()
    except Exception as e:
        print(f"Error logging AI usage: {e}")

# API 1: Author Refine (Giữ nguyên dùng logic cũ ai_engine)
@router.post("/author/refine", response_model=schemas.RefineResponse)
async def refine_text(req: schemas.RefineRequest, bg_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    start = time.time()
    try:
        result = await ai_engine.AIEngine.refine_text(req.text, req.type)
        duration = time.time() - start
        
        bg_tasks.add_task(log_to_db, db, 1, "AUTHOR", "REFINE", req.text, result, duration)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# API 2: Reviewer Analyze (UPDATED - Dùng ai_service mới)
@router.post("/reviewer/analyze", response_model=schemas.AnalyzeResponse)
async def analyze_paper(req: schemas.AnalyzeRequest, bg_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    start = time.time()
    try:
        # Logic mới: Ưu tiên PDF, nếu không có thì dùng Abstract
        if req.pdf_url and req.pdf_url.strip():
            print(f"🚀 Analyzing PDF via URL: {req.pdf_url}")
            result = await ai_service.analyze_pdf_url(req.pdf_url)
            log_input = f"PDF: {req.pdf_url}"
        else:
            print("ℹ️ Analyzing Abstract Text")
            # Fallback về text abstract
            result = ai_service.analyze_paper_abstract("Paper Title", req.abstract_text or "")
            log_input = req.abstract_text[:100] if req.abstract_text else "Empty content"

        duration = time.time() - start
        
        bg_tasks.add_task(log_to_db, db, 2, "REVIEWER", "ANALYZE", log_input, result, duration)
        
        return result
    except Exception as e:
        print(f"Error in analyze_paper: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API 3: Chair Match (Giữ nguyên)
@router.post("/chair/match", response_model=List[schemas.MatchResult])
async def match_reviewers(req: schemas.MatchRequest, bg_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    start = time.time()
    try:
        result_json = await ai_engine.AIEngine.match_reviewers(req.paper_abstract, req.candidates)
        duration = time.time() - start
        
        bg_tasks.add_task(log_to_db, db, 3, "CHAIR", "MATCHING", req.paper_abstract, result_json, duration)
        
        return result_json["matches"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# API 4: Chair Email Draft (Giữ nguyên)
@router.post("/chair/email-draft", response_model=schemas.EmailDraftResponse)
async def draft_email(req: schemas.EmailDraftRequest, bg_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    start = time.time()
    try:
        result = await ai_engine.AIEngine.draft_email(req.decision, req.author_name, req.paper_title, req.comments)
        duration = time.time() - start
        
        bg_tasks.add_task(log_to_db, db, 3, "CHAIR", "EMAIL_DRAFT", str(req.model_dump()), result, duration)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))