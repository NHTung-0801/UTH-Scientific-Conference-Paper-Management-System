import enum
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from src.database import Base

class ReviewerStatus(str, enum.Enum):
    INVITED = "INVITED"       # Đã gửi lời mời, chờ phản hồi
    ACCEPTED = "ACCEPTED"     # Đã chấp nhận tham gia Ban Phản biện
    DECLINED = "DECLINED"     # Đã từ chối tham gia
    REVOKED = "REVOKED"       # Đã bị Chair hủy tư cách phản biện

class ConferenceReviewer(Base):
    __tablename__ = "conference_reviewers"

    id = Column(Integer, primary_key=True, index=True)
    conference_id = Column(
        Integer,
        ForeignKey("conferences.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id = Column(Integer, nullable=True, index=True)  # ID từ identity-service nếu đã có tài khoản
    reviewer_email = Column(String(255), nullable=False, index=True)
    reviewer_name = Column(String(255), nullable=True)

    track_id = Column(
        Integer,
        ForeignKey("tracks.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    status = Column(
        Enum(ReviewerStatus),
        default=ReviewerStatus.INVITED,
        nullable=False
    )
    max_papers = Column(Integer, default=3, nullable=False)  # Giới hạn số bài tối đa nhận phản biện

    invited_at = Column(DateTime(timezone=True), server_default=func.now())
    responded_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    conference = relationship("Conference", back_populates="reviewers")
    track = relationship("Track")

    __table_args__ = (
        UniqueConstraint("conference_id", "reviewer_email", name="uq_conference_reviewer_email"),
    )
