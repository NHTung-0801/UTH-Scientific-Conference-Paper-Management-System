from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TrackBase(BaseModel):
    name: str
    description: Optional[str] = None
    chair_id: Optional[int] = None

class TrackCreate(TrackBase):
    conference_id: int

class TrackUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    chair_id: Optional[int] = None

class TrackAssignChairRequest(BaseModel):
    chair_id: int

class TrackResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    conference_id: int
    chair_id: Optional[int] = None
    logo: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
