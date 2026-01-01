# backend/submission-service/src/main.py
from fastapi import FastAPI
from src.database import Base, engine
from src.routers import submissions 

# Tạo bảng DB
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Submission Service")

# Gắn router
app.include_router(submissions.router) 