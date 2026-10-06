from pydantic import BaseModel, field_validator, model_validator
from datetime import datetime
from typing import Optional

class ConferenceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    logo: Optional[str] = None
    start_date: datetime
    end_date: datetime
    camera_ready_deadline: Optional[datetime] = None

    @field_validator("start_date")
    @classmethod
    def validate_start_date_not_past(cls, v: datetime) -> datetime:
        now = datetime.now(v.tzinfo) if v.tzinfo else datetime.now()
        if v < now:
            raise ValueError("Thời gian bắt đầu hội nghị không được ở trong quá khứ.")
        return v

    @model_validator(mode="after")
    def validate_dates_ordering(self) -> "ConferenceCreate":
        if self.end_date <= self.start_date:
            raise ValueError("Thời gian kết thúc phải diễn ra sau thời gian bắt đầu hội nghị.")
        if self.camera_ready_deadline:
            if self.camera_ready_deadline > self.start_date:
                raise ValueError("Hạn chót nộp Camera-Ready phải trước hoặc bằng thời gian bắt đầu hội nghị.")
        return self


class ConferenceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    camera_ready_deadline: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_update_dates(self) -> "ConferenceUpdate":
        if self.start_date and self.end_date:
            if self.end_date <= self.start_date:
                raise ValueError("Thời gian kết thúc phải diễn ra sau thời gian bắt đầu hội nghị.")
        if self.camera_ready_deadline and self.start_date:
            if self.camera_ready_deadline > self.start_date:
                raise ValueError("Hạn chót nộp Camera-Ready phải trước hoặc bằng thời gian bắt đầu hội nghị.")
        return self


class ConferenceResponse(BaseModel):
    id: int
    name: str
    logo: Optional[str] = None
    description: Optional[str] = None
    created_by: int
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    camera_ready_open: bool = False
    camera_ready_deadline: Optional[datetime] = None

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
    camera_ready_deadline: Optional[datetime] = None


class CameraReadyOpenIn(BaseModel):
    deadline: Optional[datetime] = None

    @field_validator("deadline")
    @classmethod
    def validate_deadline_not_past(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None:
            now = datetime.now(v.tzinfo) if v.tzinfo else datetime.now()
            if v < now:
                raise ValueError("Hạn chót Camera-Ready không được ở trong quá khứ.")
        return v
