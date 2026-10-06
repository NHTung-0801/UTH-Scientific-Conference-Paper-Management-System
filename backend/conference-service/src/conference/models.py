from sqlalchemy import Column, Integer, String, Text, Boolean
from src.database import Base
from sqlalchemy.orm import relationship
from sqlalchemy import DateTime
class Conference(Base):
    __tablename__ = "conferences"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    logo = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    created_by = Column(Integer, nullable=False)  # user_id từ identity-service
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)

    camera_ready_open = Column(Boolean, default=False, nullable=False)
    camera_ready_deadline = Column(DateTime, nullable=True)

    # Important Dates (Mốc thời gian vòng đời hội nghị)
    submission_deadline = Column(DateTime, nullable=True)     # Hạn nộp bài
    review_deadline = Column(DateTime, nullable=True)         # Hạn phản biện
    notification_date = Column(DateTime, nullable=True)       # Ngày công bố kết quả
    rebuttal_deadline = Column(DateTime, nullable=True)       # Hạn phản hồi giải trình
    is_submission_open = Column(Boolean, default=True, nullable=False) # Trạng thái cổng nộp bài

    # Quy chế & Thể lệ phản biện (Review Policies & Guidelines)
    blind_mode = Column(String(50), default="DOUBLE_BLIND", nullable=False) # DOUBLE_BLIND, SINGLE_BLIND, OPEN
    min_reviews_per_paper = Column(Integer, default=2, nullable=False)      # Số lượng phản biện tối thiểu/bài
    max_paper_pages = Column(Integer, default=8, nullable=False)            # Giới hạn số trang tối đa
    guidelines = Column(Text, nullable=True)                               # Thể lệ chi tiết hội nghị

    tracks = relationship(
        "Track",
        back_populates="conference",
        cascade="all, delete"
    )

    reviewers = relationship(
        "ConferenceReviewer",
        back_populates="conference",
        cascade="all, delete-orphan"
    )
