<<<<<<< HEAD
# backend/submission-service/src/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Đặt tên file database riêng cho service này
DATABASE_URL = "sqlite:///./submission.db"

# connect_args={"check_same_thread": False} là bắt buộc với SQLite + FastAPI
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency để lấy database session (Dùng trong router)
=======
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from src.config import settings


engine = create_engine(
    settings.DATABASE_URL, 
    pool_pre_ping=True
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


Base = declarative_base()

>>>>>>> a4399b3c71fb9a397bf2621bf4d07e74019f8161
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()