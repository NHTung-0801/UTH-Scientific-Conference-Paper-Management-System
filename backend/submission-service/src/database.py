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
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()