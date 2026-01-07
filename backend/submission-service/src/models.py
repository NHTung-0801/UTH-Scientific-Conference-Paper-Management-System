from datetime import datetime
import enum

from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime, Text, Boolean, Enum
)
from sqlalchemy.orm import relationship

from .database import Base


class PaperStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    CAMERA_READY = "CAMERA_READY"


class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String(255), nullable=False)
    abstract = Column(Text, nullable=False)
    keywords = Column(String(255), nullable=True)

    conference_id = Column(Integer, nullable=False)
    track_id = Column(Integer, nullable=False)
    submitter_id = Column(Integer, nullable=False)

    is_blind_mode = Column(Boolean, default=True)
    status = Column(Enum(PaperStatus), default=PaperStatus.SUBMITTED)

    submitted_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    authors = relationship("PaperAuthor", back_populates="paper", cascade="all, delete-orphan")
    topics = relationship("PaperTopic", back_populates="paper", cascade="all, delete-orphan")
    versions = relationship("PaperVersion", back_populates="paper", cascade="all, delete-orphan")


class PaperAuthor(Base):
    __tablename__ = "paper_authors"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id"), nullable=False)

    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=True)

    is_corresponding = Column(Boolean, default=False)
    user_id = Column(Integer, nullable=True)

    paper = relationship("Paper", back_populates="authors")


class PaperTopic(Base):
    __tablename__ = "paper_topics"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id"), nullable=False)
    topic_id = Column(Integer, nullable=False)

    paper = relationship("Paper", back_populates="topics")


class PaperVersion(Base):
    __tablename__ = "paper_versions"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id"), nullable=False)

    version_number = Column(Integer, nullable=False)
    file_url = Column(String(512), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    is_camera_ready = Column(Boolean, default=False)
    is_anonymous = Column(Boolean, default=True)

    paper = relationship("Paper", back_populates="versions")
