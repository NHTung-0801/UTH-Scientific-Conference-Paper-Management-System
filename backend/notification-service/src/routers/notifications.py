from fastapi import APIRouter, BackgroundTasks, Depends, status, HTTPException
from sqlalchemy.orm import Session
from .. import database, schemas, crud
from ..utils import email_utils 
from typing import List

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)

# Gửi tin nhắn hệ thống
@router.post("/send", status_code=status.HTTP_201_CREATED)
def send_notification(
    req: schemas.NotificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db)
):
   
    
    saved_msg = crud.create_notification_log(db=db, msg_data=req)
    
    html_body = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
        <h3 style="color: #2c3e50;">Xin chào {req.receiver_name},</h3>
        <p>Bạn có một thông báo mới từ hệ thống UTH Conference:</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; margin: 10px 0;">
            <strong>{req.subject}</strong><br>
            <p>{req.body}</p>
        </div>
        
        <p>Vui lòng truy cập hệ thống để xem chi tiết.</p>
        <hr>
        <p style="font-size: 12px; color: #777;">Thông báo tự động từ Notification Service.</p>
    </div>
    """

    background_tasks.add_task(
        email_utils.send_email_async,
        recipient_email=req.receiver_email,
        subject=req.subject,
        html_content=html_body
    )
    
    return {
        "status": "queued",
        "message_id": saved_msg.id,
        "detail": "Notification saved and email task started."
    }

# Xem hộp thư
@router.get("/{user_id}", response_model=List[schemas.MessageResponse])
def get_my_inbox(
    user_id: int,
    db: Session = Depends(database.get_db)
):
    return crud.get_user_messages(db=db, user_id=user_id)

# Đọc chi tiết (Đánh dấu đã xem)
@router.put("/{message_id}/read")
def mark_as_read(
    message_id: int,
    db: Session = Depends(database.get_db)
):
    msg = crud.mark_message_read(db=db, message_id=message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"status": "success", "is_read": True}