from fastapi import FastAPI
from src.database import Base, engine
from src.conference import models
from src.conference.router import router as conference_router
from src.conference.models import Conference
import time

app = FastAPI(title="Conference Service")

Base.metadata.create_all(bind=engine)

app.include_router(conference_router)
