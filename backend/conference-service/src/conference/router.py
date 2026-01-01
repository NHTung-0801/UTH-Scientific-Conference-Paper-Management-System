from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from src.database import get_db
from src.conference.models import Conference
from src.conference.schemas import ConferenceCreate, ConferenceResponse

router = APIRouter(
    prefix="/conferences",
    tags=["Conferences"]
)

security = HTTPBearer()


@router.post("/", response_model=ConferenceResponse)
def create_conference(
    data: ConferenceCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials

    # 🚨 TẠM THỜI: giả lập user (sau này decode JWT)
    fake_user_id = 1
    fake_role = "CHAIR"

    if fake_role != "CHAIR":
        raise HTTPException(status_code=403, detail="Only CHAIR can create conference")

    conf = Conference(
        name=data.name,
        logo=data.logo,
        description=data.description,
        created_by=fake_user_id
    )

    db.add(conf)
    db.commit()
    db.refresh(conf)

    return conf
