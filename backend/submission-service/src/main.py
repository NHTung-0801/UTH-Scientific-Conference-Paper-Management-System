<<<<<<< HEAD
# backend/submission-service/src/main.py
from fastapi import FastAPI
from src.database import Base, engine
from src.routers import submissions 

# Tạo bảng DB
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Submission Service")

# Gắn router
app.include_router(submissions.router) 
=======
import os  # <--- 1. Thêm thư viện này
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .database import engine, Base
from .routers import submissions

Base.metadata.create_all(bind=engine)

app = FastAPI(title="UTH Conference Submission Service")

if not os.path.exists("uploads"):
    os.makedirs("uploads")

app.mount("/static", StaticFiles(directory="uploads"), name="static")

app.include_router(submissions.router)

@app.get("/")
def root():
    return {"message": "Service is running!"}
>>>>>>> a4399b3c71fb9a397bf2621bf4d07e74019f8161
