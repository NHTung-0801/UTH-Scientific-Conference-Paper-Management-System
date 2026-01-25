from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.database import Base, engine

# routers
from src.conference.router import router as conference_router
from src.conference.tracks.router import router as track_router
from src.conference.topics.router import router as topic_router
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="UTH Conference Conference Service")

origins = [
    "http://localhost:3000",      # React chạy local
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# tạo bảng khi khởi động
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "Conference service running"}

# include routers
<<<<<<< HEAD
app.include_router(conference_router, tags=["Conferences"])
app.include_router(track_router, prefix="/tracks", tags=["Tracks"])
app.include_router(topic_router, prefix="/topics", tags=["Topics"])
=======
app.include_router(conference_router, prefix="/conferences")
app.include_router(track_router, prefix="/tracks")
app.include_router(topic_router, prefix="/topics")


>>>>>>> cf0e6ac3f0419f02d43e96e61ebb8f07149004f1

@app.get("/")
def root():
    return {"message": "Conference Service is running"}
