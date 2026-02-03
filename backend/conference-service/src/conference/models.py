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

    tracks = relationship(
    "Track",
    back_populates="conference",
    cascade="all, delete"
)
