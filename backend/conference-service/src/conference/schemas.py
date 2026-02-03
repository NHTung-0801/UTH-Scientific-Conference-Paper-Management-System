from pydantic import BaseModel
from datetime import datetime

class ConferenceCreate(BaseModel):
    name: str
    logo: str | None = None
    description: str | None = None


class ConferenceUpdate(BaseModel):
    name: str | None = None
    logo: str | None = None
    description: str | None = None


class ConferenceResponse(BaseModel):
    id: int
    name: str
    logo: str | None
    description: str | None
    created_by: int

    camera_ready_open: bool = False
    camera_ready_deadline: datetime | None = None

    class Config:
        from_attributes = True


class ConferenceUpdateResult(BaseModel):
    before_update: ConferenceResponse
    after_update: ConferenceResponse

class ConferenceDeleteResult(BaseModel):
    message: str
    deleted_conference: ConferenceResponse


class ConferencePhaseOut(BaseModel):
    conference_id: int
    camera_ready_open: bool
    camera_ready_deadline: datetime | None = None

class CameraReadyOpenIn(BaseModel):
    deadline: datetime | None = None
