from fastapi import FastAPI
from src.database import Base, engine
from src.routers import assignments, reviews, coi, discussions, papers

app = FastAPI(title="UTH Conference Review Service")

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "review-service is running"}

app.include_router(assignments.router)
app.include_router(reviews.router)
app.include_router(coi.router)
app.include_router(discussions.router)
app.include_router(papers.router)
