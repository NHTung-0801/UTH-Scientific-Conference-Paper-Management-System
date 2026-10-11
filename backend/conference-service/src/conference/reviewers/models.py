import enum
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
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
    messages = relationship(
        "ReviewerMessage",
        back_populates="reviewer",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("conference_id", "reviewer_email", name="uq_conference_reviewer_email"),
    )


class ReviewerMessage(Base):
    """
    Kênh trao đổi / tin nhắn trực tiếp giữa Chair và Reviewer trong phạm vi Hội nghị.
    """
    __tablename__ = "conference_reviewer_messages"

    id = Column(Integer, primary_key=True, index=True)
    conference_id = Column(
        Integer,
        ForeignKey("conferences.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    reviewer_pool_id = Column(
        Integer,
        ForeignKey("conference_reviewers.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    sender_id = Column(Integer, nullable=False, index=True)  # user_id của người gửi (Chair hoặc Reviewer)
    sender_role = Column(String(50), nullable=False)         # "CHAIR" hoặc "REVIEWER"
    sender_name = Column(String(255), nullable=True)
    subject = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    reviewer = relationship("ConferenceReviewer", back_populates="messages")
    conference = relationship("Conference")
