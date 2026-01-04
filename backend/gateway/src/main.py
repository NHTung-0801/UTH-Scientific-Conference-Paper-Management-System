from fastapi import FastAPI
from src.routers import auth, conference

app = FastAPI(title="UTH Conference Gateway")

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(conference.router, prefix="/conferences", tags=["Conferences"])
