from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime, date
from enum import Enum


class PaperStatus(str, Enum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    REVISION_REQUIRED = "REVISION_REQUIRED"
    WITHDRAWN = "WITHDRAWN"
    



class PaperAuthorCreate(BaseModel):
    full_name: str
    email: EmailStr
    organization: Optional[str] = None
    is_corresponding: bool = False
    user_id: Optional[int] = None


class PaperAuthorResponse(PaperAuthorCreate):
    id: int
    full_name: str
    email: EmailStr
    organization: Optional[str]
    is_corresponding: bool
    user_id: Optional[int]

    class Config:
        from_attributes = True


class PaperTopicCreate(BaseModel):
    topic_id: int


class PaperTopicResponse(PaperTopicCreate):
    id: int
    topic_id: int

    class Config:
        from_attributes = True


class PaperVersionResponse(BaseModel):
    id: int
    paper_id: int
    version_number: int
    file_url: str
    created_at: datetime

    is_camera_ready: Optional[bool] = False
    is_anonymous: Optional[bool] = True

    class Config:
        from_attributes = True


class PaperBase(BaseModel):
    title: str
    abstract: str
    keywords: List[str] = Field(default_factory=list)
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

    decision_note: Optional[str] = None

    submitted_at: Optional[datetime] = None
    created_at: datetime

    authors: List[PaperAuthorResponse]
    topics: List[PaperTopicResponse]
    versions: List[PaperVersionResponse]

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str

class AuthorAdd(BaseModel):
    full_name: str
    email: EmailStr
    organization: Optional[str] = None
    is_corresponding: bool = False
    user_id: Optional[int] = None


class AuthorResponse(AuthorAdd):
    id: int
    paper_id: int

    class Config:
        from_attributes = True

class AuthorUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    organization: Optional[str] = None
    is_corresponding: Optional[bool] = None

class PaperTopicInput(BaseModel):
    topic_id: int


class PaperUpdate(BaseModel):
    title: Optional[str] = None
    abstract: Optional[str] = None
    keywords: Optional[List[str]] = None

    topics: Optional[List[PaperTopicInput]] = None


class ConferenceExternalInfo(BaseModel):
    id: int
    name: str
    submission_deadline: Optional[datetime] = None

class ConferencePhase(BaseModel):
    conference_id: int
    camera_ready_open: bool
    camera_ready_deadline: Optional[datetime] = None



class PaperDecision(BaseModel):
    status: PaperStatus
    note: Optional[str] = None


class ProceedingsAuthorOut(BaseModel):
    full_name: str
    email: EmailStr
    organization: Optional[str] = None
    is_corresponding: bool = False


class ProceedingsPaperOut(BaseModel):
    paper_id: int
    conference_id: int
    track_id: int
    title: str
    abstract: str
    keywords: List[str] = Field(default_factory=list)

    camera_ready_file_url: str
    camera_ready_version: int

    authors: List[ProceedingsAuthorOut] = Field(default_factory=list)

class SubmitterProfileOut(BaseModel):
    id: int
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    organization: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None

class CameraReadyStatusOut(PaperResponse):
    has_camera_ready: bool
    camera_ready_file_url: Optional[str] = None
    camera_ready_submitted_at: Optional[datetime] = None
    camera_ready_version: Optional[int] = None

    submitter_profile: Optional[SubmitterProfileOut] = None

class ProceedingsMetaIn(BaseModel):
    title: str
    isbn_issn: Optional[str] = None
    volume: Optional[str] = None
    publisher: Optional[str] = None
    published_date: Optional[date] = None
    cover_image_url: Optional[str] = None
    preface: Optional[str] = None
    copyright: Optional[str] = None

class ProceedingsItemOut(BaseModel):
    paper_id: int
    sort_order: int = 0

class ProceedingsOut(BaseModel):
    conference_id: int
    title: str
    isbn_issn: Optional[str] = None
    volume: Optional[str] = None
    publisher: Optional[str] = None
    published_date: Optional[date] = None
    cover_image_url: Optional[str] = None
    preface: Optional[str] = None
    copyright: Optional[str] = None
    is_published: bool
    paper_ids: List[int] = []
    updated_at: Optional[datetime] = None

class ProceedingsPublishIn(BaseModel):
    paper_ids: List[int]

class CameraReadyConferenceOut(BaseModel):
    conference_id: int
    conference_name: Optional[str] = None
    camera_ready_papers: int = 0
