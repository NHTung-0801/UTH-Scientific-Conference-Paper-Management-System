
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class AuthorDTO(BaseModel):
    full_name: str
    organization: str
    email: str # Có thể ẩn email nếu cần bảo mật cao hơn

class PaperVersionDTO(BaseModel):
    version_number: int
    created_at: datetime
    # Không trả về file_path thực tế cho client vì lý do bảo mật

class PaperDetailResponse(BaseModel):
    id: int
    title: str
    abstract: str
    status: str
    conference_id: int
    # Logic Double-blind: authors có thể là None
    authors: Optional[List[AuthorDTO]] = None 
    versions: List[PaperVersionDTO]

    class Config:
        from_attributes = True
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
from enum import Enum


class PaperStatus(str, Enum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"

# Tác giả của bài báo
class PaperAuthorCreate(BaseModel):
    full_name: str
    email: EmailStr
    organization: Optional[str] = None
    is_corresponding: bool = False
    user_id: Optional[int] = None


class PaperAuthorResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    organization: Optional[str]
    is_corresponding: bool
    user_id: Optional[int]

    class Config:
        from_attributes = True


# Chủ đề của bài báo
class PaperTopicCreate(BaseModel):
    topic_id: int


class PaperTopicResponse(BaseModel):
    id: int
    topic_id: int

    class Config:
        from_attributes = True


# Phiên bản của bài báo
class PaperVersionResponse(BaseModel):
    id: int
    version_number: int
    file_url: str
    created_at: datetime
    is_camera_ready: bool
    is_anonymous: bool

    class Config:
        from_attributes = True

# Bài báo
class PaperBase(BaseModel):
    title: str
    abstract: str
    keywords: Optional[str] = None
    conference_id: int
    track_id: int
    is_blind_mode: bool = True

class PaperCreate(PaperBase):
    authors: List[PaperAuthorCreate]
    topics: List[PaperTopicCreate]

class PaperResponse(PaperBase):
    id: int
    submitter_id: int
    status: PaperStatus
    
    submitted_at: datetime
    created_at: datetime

    authors: List[PaperAuthorResponse]
    topics: List[PaperTopicResponse]
    versions: List[PaperVersionResponse]

    class Config:
        from_attributes = True

# Thông điệp phản hồi chung
class MessageResponse(BaseModel):
    message: str
