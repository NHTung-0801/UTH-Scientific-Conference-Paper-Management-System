from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from src.database import Base
from datetime import datetime

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
    
    paper = relationship("Paper", back_populates="authors")

class PaperVersion(Base):
    __tablename__ = "paper_versions"
    
    id = Column(Integer, primary_key=True)
    paper_id = Column(Integer, ForeignKey("papers.id"))
    version_number = Column(Integer, nullable=False) 
    file_path = Column(String, nullable=False)       
    created_at = Column(DateTime, default=datetime.utcnow)
    
    paper = relationship("Paper", back_populates="versions")