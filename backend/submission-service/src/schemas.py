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