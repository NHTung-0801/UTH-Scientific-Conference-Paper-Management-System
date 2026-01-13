from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import json
import httpx
import os
import shutil

from .. import database, crud, schemas, exceptions
from ..config import settings
from ..utils.file_handler import save_paper_file, delete_paper_version_file

router = APIRouter(
    prefix="/submissions",
    tags=["Submissions"]
)


# --- HÀM GỌI API ---
def call_notification_service_task(payload: dict):

    notification_url = settings.NOTIFICATION_SERVICE_URL 
    
    try:
        with httpx.Client() as client:
            response = client.post(notification_url, json=payload)
            
            if response.status_code == 201:
                print(f" [Submission Service] Notification sent for Paper #{payload['paper_id']}")
            else:
                print(f" [Submission Service] Failed to send notification: {response.text}")
                
    except Exception as e:
        print(f" [Submission Service] Connection Error: {str(e)}")


# API nộp bài
@router.post("/", response_model=schemas.PaperResponse, status_code=status.HTTP_201_CREATED)

def submit_paper(
    background_tasks: BackgroundTasks,
    metadata: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    submitter_id: int = 42
    # current_user: models.User = Depends(deps.get_current_user)
):
    created_paper_id = None
    created_version_number = None
    
    try:

        # real_submitter_id = current_user.id

        # paper_data = schemas.PaperCreate.model_validate_json(metadata)

        try:
            data_dict = json.loads(metadata)
            paper_data = schemas.PaperCreate(**data_dict)
        except Exception as json_error:
            raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(json_error)}")

        paper = crud.create_paper(
            db=db,
            paper_data=paper_data,
            submitter_id=submitter_id
            # submitter_id=real_submitter_id
        )
        created_paper_id = paper.id

        version = crud.create_new_paper_version(
            db=db,
            paper_id=paper.id,
            file_url="TEMP_URL_HOLDER",
            is_blind_mode=paper.is_blind_mode
        )
        created_version_number = version.version_number
        

        file_url = save_paper_file(
            paper_id=paper.id,
            version_number=version.version_number,
            upload_file=file
        )
        version.file_url = file_url
        
        db.commit() 
        db.refresh(paper)


        # Tìm email người nhận
        recipient_email = None
        recipient_name = "Author"

        if paper_data.authors:
            recipient_email = paper_data.authors[0].email
            recipient_name = paper_data.authors[0].full_name
            
            for author in paper_data.authors:
                if author.is_corresponding:
                    recipient_email = author.email
                    recipient_name = author.full_name
                    break

        notification_payload = {
            "receiver_id": submitter_id,        
            "receiver_email": recipient_email,  
            "receiver_name": recipient_name,    
            "paper_id": paper.id,
            "paper_title": paper.title,
            "subject": f"Xác nhận nộp bài: {paper.title}",
            "body": f"Bài báo #{paper.id} đã được nộp thành công vào hệ thống. Vui lòng chờ phản hồi."
        }

        background_tasks.add_task(call_notification_service_task, notification_payload)
        
        return paper

    except Exception as e:
        db.rollback()
        print(f" Error submitting paper: {str(e)}")
        
        if created_paper_id is not None and created_version_number is not None:
            try:
                delete_paper_version_file(
                    paper_id=created_paper_id,
                    version_number=created_version_number
                )
            except Exception as cleanup_error:
                print(f" Failed to clean up file: {cleanup_error}")

        raise HTTPException(
            status_code=400,
            detail=f"Submission failed: {str(e)}"
        )
    

# Danh sách bài đã nộp
@router.get(
    "",
    response_model=List[schemas.PaperResponse]
)
def get_my_submissions(
    db: Session = Depends(database.get_db),
    submitter_id: int = 42
    # current_user: models.User = Depends(deps.get_current_user)
):
    papers = crud.get_papers_by_author(db, submitter_id)
    # papers = crud.get_papers_by_author(db, current_user.id)
    return papers


# Xem chi tiết bài báo
@router.get(
    "/{paper_id}", 
    response_model=schemas.PaperResponse
)
def get_submission_detail(
    paper_id: int,
    db: Session = Depends(database.get_db),
    submitter_id: int = 42
    # current_user: models.User = Depends(deps.get_current_user)
):

    try:
        paper = crud.get_author_paper_detail(
            db=db,
            paper_id=paper_id,
            submitter_id=submitter_id
            # submitter_id=current_user.id
        )
        return paper
        
    except exceptions.PaperNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
        
    except exceptions.NotAuthorizedError as e:
        raise HTTPException(status_code=403, detail=str(e))


# --- API THÊM TÁC GIẢ ---
@router.post("/{paper_id}/authors", response_model=schemas.AuthorResponse)
def add_co_author(
    paper_id: int,
    author_data: schemas.AuthorAdd,
    db: Session = Depends(database.get_db),
    # current_user = Depends(get_current_user)
):
    # Mock user ID để test (Sau này thay bằng current_user.id)
    submitter_id = 1
    
    try:
        new_author = crud.add_author(db, paper_id, submitter_id, author_data)
        return new_author
        
    except exceptions.PaperNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except exceptions.NotAuthorizedError as e:
        raise HTTPException(status_code=403, detail=e.message)
    except exceptions.BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{paper_id}/authors/{author_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_co_author(
    paper_id: int,
    author_id: int,
    db: Session = Depends(database.get_db),
):
    submitter_id = 1
    
    try:
        crud.remove_author(db, paper_id, author_id, submitter_id)
        return
        
    except exceptions.AuthorNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except exceptions.NotAuthorizedError as e:
        raise HTTPException(status_code=403, detail=e.message)
    except exceptions.BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=e.message)
    

@router.post("/{paper_id}/withdraw", response_model=schemas.PaperResponse)
def withdraw_submission(
    paper_id: int,
    db: Session = Depends(database.get_db)
):

    submitter_id = 1  
    
    try:
        paper = crud.withdraw_paper(db, paper_id, submitter_id)
        return paper

    except exceptions.PaperNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except exceptions.NotAuthorizedError as e:
        raise HTTPException(status_code=403, detail=e.message)
    except exceptions.BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=e.message)
    


@router.put("/{paper_id}", response_model=schemas.PaperResponse)
def update_paper_details(
    paper_id: int,
    update_data: schemas.PaperUpdate,
    db: Session = Depends(database.get_db)
):
    submitter_id = 1 
    
    try:
        updated_paper = crud.update_paper_metadata(db, paper_id, submitter_id, update_data)
        return updated_paper

    except exceptions.PaperNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except exceptions.NotAuthorizedError as e:
        raise HTTPException(status_code=403, detail=e.message)
    except exceptions.BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=e.message)
    

@router.post("/{paper_id}/file", response_model=schemas.PaperVersionResponse)
def update_paper_file(
    paper_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db)
):
    submitter_id = 1 
    
    try:
        next_ver = crud.get_next_version_number(db, paper_id)

        base_dir = f"uploads/papers/{paper_id}/v{next_ver}"
        os.makedirs(base_dir, exist_ok=True)

        file_path = f"{base_dir}/{file.filename}"
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        new_version = crud.upload_new_version(
            db=db, 
            paper_id=paper_id, 
            submitter_id=submitter_id, 
            file_path=file_path, 
            version_number=next_ver,
            is_blind_mode=True 
        )
        return new_version

    except exceptions.PaperNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except exceptions.NotAuthorizedError as e:
        raise HTTPException(status_code=403, detail=e.message)
    except exceptions.BusinessRuleError as e:
        raise HTTPException(status_code=400, detail=e.message)