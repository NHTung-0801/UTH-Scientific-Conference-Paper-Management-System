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