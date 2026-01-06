from fastapi import APIRouter, Request
import httpx

router = APIRouter()

CONFERENCE_SERVICE_URL = "http://127.0.0.1:8002"

@router.post("/")
async def create_conference(request: Request):
    body = await request.json()
    headers = dict(request.headers)

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{CONFERENCE_SERVICE_URL}/conferences/",
            json=body,
            headers=headers
        )

    return response.json()
