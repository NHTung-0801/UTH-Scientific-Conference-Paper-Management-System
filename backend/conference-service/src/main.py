from fastapi import FastAPI
from src.conference.router import router as conference_router
from src.database import Base, engine

# tạo bảng DB
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Conference Service",
    description="Quản lý hội nghị khoa học UTH",
    version="1.0.0"
)

# gắn router
app.include_router(conference_router)
