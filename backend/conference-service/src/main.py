from fastapi import FastAPI
from src.database import Base, engine

# routers
from src.conference.router import router as conference_router
from src.conference.tracks.router import router as track_router
from src.conference.topics.router import router as topic_router

app = FastAPI(title="Conference Service")

# tạo bảng khi khởi động
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

# include routers
app.include_router(conference_router, prefix="/conferences", tags=["Conferences"])
app.include_router(track_router, prefix="/tracks", tags=["Tracks"])
app.include_router(topic_router)