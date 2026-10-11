from pydantic import BaseModel, field_validator, model_validator
from datetime import datetime
from typing import Optional

class ConferenceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    logo: Optional[str] = None
    start_date: datetime
    end_date: datetime

    # Important Dates (Mốc thời gian vòng đời)
    submission_deadline: Optional[datetime] = None
    review_deadline: Optional[datetime] = None
    notification_date: Optional[datetime] = None
    rebuttal_deadline: Optional[datetime] = None
    camera_ready_deadline: Optional[datetime] = None
    is_submission_open: bool = True

    # Review Policies & Guidelines
    blind_mode: str = "DOUBLE_BLIND"
    min_reviews_per_paper: int = 2
    max_paper_pages: int = 8
    guidelines: Optional[str] = None

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

        # Logic: Hạn nộp bài phải trước ngày khai mạc
        if self.submission_deadline and self.submission_deadline > self.start_date:
            raise ValueError("Hạn nộp bài (submission_deadline) phải trước hoặc bằng ngày bắt đầu hội nghị.")

        # Logic: Hạn phản biện phải sau hạn nộp bài
        if self.submission_deadline and self.review_deadline:
            if self.review_deadline < self.submission_deadline:
                raise ValueError("Hạn phản biện (review_deadline) phải sau hạn nộp bài (submission_deadline).")

        # Logic: Ngày thông báo kết quả phải sau hạn phản biện
        if self.review_deadline and self.notification_date:
            if self.notification_date < self.review_deadline:
                raise ValueError("Ngày công bố kết quả (notification_date) phải sau hạn phản biện (review_deadline).")

        # Logic: Hạn camera-ready phải trước hoặc bằng ngày bắt đầu hội nghị
        if self.camera_ready_deadline:
            if self.camera_ready_deadline > self.start_date:
                raise ValueError("Hạn chót nộp Camera-Ready phải trước hoặc bằng thời gian bắt đầu hội nghị.")
            if self.notification_date and self.camera_ready_deadline < self.notification_date:
                raise ValueError("Hạn nộp Camera-Ready phải sau ngày công bố kết quả (notification_date).")

        return self


class ConferenceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    submission_deadline: Optional[datetime] = None
    review_deadline: Optional[datetime] = None
    notification_date: Optional[datetime] = None
    rebuttal_deadline: Optional[datetime] = None
    camera_ready_deadline: Optional[datetime] = None
    is_submission_open: Optional[bool] = None

    # Review Policies
    blind_mode: Optional[str] = None
    min_reviews_per_paper: Optional[int] = None
    max_paper_pages: Optional[int] = None
    guidelines: Optional[str] = None

    @model_validator(mode="after")
    def validate_update_dates(self) -> "ConferenceUpdate":
        if self.start_date and self.end_date:
            if self.end_date <= self.start_date:
                raise ValueError("Thời gian kết thúc phải diễn ra sau thời gian bắt đầu hội nghị.")
        if self.camera_ready_deadline and self.start_date:
            if self.camera_ready_deadline > self.start_date:
                raise ValueError("Hạn chót nộp Camera-Ready phải trước hoặc bằng thời gian bắt đầu hội nghị.")
        if self.submission_deadline and self.start_date:
            if self.submission_deadline > self.start_date:
                raise ValueError("Hạn nộp bài phải trước hoặc bằng thời gian bắt đầu hội nghị.")
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

    # Important Dates
    submission_deadline: Optional[datetime] = None
    review_deadline: Optional[datetime] = None
    notification_date: Optional[datetime] = None
    rebuttal_deadline: Optional[datetime] = None
    is_submission_open: bool = True

    # Policies & Guidelines
    blind_mode: str = "DOUBLE_BLIND"
    min_reviews_per_paper: int = 2
    max_paper_pages: int = 8
    guidelines: Optional[str] = None

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
    submission_deadline: Optional[datetime] = None
    is_submission_open: bool = True


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


class SubmissionWindowToggle(BaseModel):
    is_open: bool


class ConferencePolicyUpdate(BaseModel):
    blind_mode: Optional[str] = None
    min_reviews_per_paper: Optional[int] = None
    max_paper_pages: Optional[int] = None
    guidelines: Optional[str] = None
