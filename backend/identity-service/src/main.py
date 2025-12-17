from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.models import User
from src.schemas import LoginRequest, TokenResponse
from src.auth import verify_password, create_access_token, create_refresh_token

app = FastAPI(title="Identity Service")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def root():
    return {"message": "identity-service is running"}

@app.post("/api/auth/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token({
        "sub": user.email,
        "role": user.role
    })
    refresh_token = create_refresh_token({
        "sub": user.email
    })

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@app.post("/api/auth/logout")
def logout():
    return {"message": "Logout successful"}
