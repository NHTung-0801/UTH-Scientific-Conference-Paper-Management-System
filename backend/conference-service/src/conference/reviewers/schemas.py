from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class ReviewerStatusEnum(str, Enum):
    INVITED = "INVITED"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    REVOKED = "REVOKED"

class ReviewerInviteRequest(BaseModel):
    reviewer_email: EmailStr
    reviewer_name: Optional[str] = None
    track_id: Optional[int] = None
    max_papers: int = Field(default=3, ge=1, le=20, description="Hạn mức số bài báo tối đa nhận phản biện")
    description: Optional[str] = None

class ReviewerUpdateRequest(BaseModel):
    track_id: Optional[int] = None
    max_papers: Optional[int] = Field(default=None, ge=1, le=20)
    status: Optional[ReviewerStatusEnum] = None

class ReviewerResponseOut(BaseModel):
    id: int
    conference_id: int
    user_id: Optional[int] = None
    reviewer_email: str
    reviewer_name: Optional[str] = None
    track_id: Optional[int] = None
    status: ReviewerStatusEnum
    max_papers: int
    invited_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ReviewerActiveOut(BaseModel):
    id: int
    conference_id: int
    user_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    reviewer_email: str
    track_id: Optional[int] = None
    max_papers: int

    class Config:
        from_attributes = True

class ReviewerResponseAction(BaseModel):
    reviewer_email: EmailStr
    action: str = Field(..., pattern="^(accept|decline)$")
    user_id: Optional[int] = None

class ReviewerMessageCreate(BaseModel):
    subject: str = Field(..., min_length=1, max_length=255, description="Tiêu đề trao đổi")
    content: str = Field(..., min_length=1, description="Nội dung tin nhắn")

class ReviewerMessageOut(BaseModel):
    id: int
    conference_id: int
    reviewer_pool_id: int
    sender_id: int
    sender_role: str
    sender_name: Optional[str] = None
    subject: str
    content: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
