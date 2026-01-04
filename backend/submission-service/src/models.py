
from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean, Enum
from sqlalchemy.orm import relationship
from .database import Base
import enum


# Định nghĩa Enum
class PaperStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"

class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    abstract = Column(Text, nullable=False)
    conference_id = Column(Integer, nullable=False) 
    submitter_id = Column(Integer, nullable=False)  
    status = Column(String, default="submitted")    
    
    # Relationships
    authors = relationship("PaperAuthor", back_populates="paper")
    versions = relationship("PaperVersion", back_populates="paper")

class PaperAuthor(Base):
    __tablename__ = "paper_authors"
    
    id = Column(Integer, primary_key=True)
    paper_id = Column(Integer, ForeignKey("papers.id"))
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    organization = Column(String, nullable=False)
    
    # --- QUAN TRỌNG: Đã thêm cột này ---
    display_order = Column(Integer, default=1) 
    
    title = Column(String(255), nullable=False)
    abstract = Column(Text, nullable=False)
    keywords = Column(String(255), nullable=True, comment="Từ khóa bài báo")

    conference_id = Column(Integer, nullable=False)
    track_id = Column(Integer, nullable=False)
    submitter_id = Column(Integer, nullable=False)

    is_blind_mode = Column(Boolean, default=True)
    status = Column(Enum(PaperStatus), default=PaperStatus.SUBMITTED)

    submitted_at = Column(DateTime, default=datetime.utcnow)

    created_at = Column(DateTime, default=datetime.utcnow)

    # 1 paper có nhiều versions
    versions = relationship("PaperVersion", back_populates="paper", cascade="all, delete-orphan")
    # 1 paper có nhiều authors
    authors = relationship("PaperAuthor", back_populates="paper", cascade="all, delete-orphan")
    # 1 paper có nhiều topics
    topics = relationship("PaperTopic", back_populates="paper", cascade="all, delete-orphan")


class PaperAuthor(Base):
    __tablename__ = "paper_authors"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id"))

    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=True)

    is_corresponding = Column(Boolean, default=False)
    user_id = Column(Integer, nullable=True) 

    paper = relationship("Paper", back_populates="authors")

class PaperVersion(Base):
    __tablename__ = "paper_versions"
    
    id = Column(Integer, primary_key=True)
    paper_id = Column(Integer, ForeignKey("papers.id"))
    version_number = Column(Integer, nullable=False) 
    file_path = Column(String, nullable=False)       
    created_at = Column(DateTime, default=datetime.utcnow)
    
    paper = relationship("Paper", back_populates="versions")

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id"))

    version_number = Column(Integer, nullable=False)
    file_url = Column(String(500), nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    is_camera_ready = Column(Boolean, default=False)
    is_anonymous = Column(Boolean, default=True)

    paper = relationship("Paper", back_populates="versions")

class PaperTopic(Base):
    __tablename__ = "paper_topics"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id"))
    topic_id = Column(Integer, nullable=False)

    paper = relationship("Paper", back_populates="topics")