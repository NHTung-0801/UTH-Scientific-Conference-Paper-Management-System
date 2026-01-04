from fastapi import APIRouter
import httpx
from src.schemas.auth import LoginRequest

router = APIRouter()

IDENTITY_SERVICE_URL = "http://127.0.0.1:8000"

@router.post("/login")
async def login(data: LoginRequest):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{IDENTITY_SERVICE_URL}/login",
            json=data.dict()
        )
    return response.json()
