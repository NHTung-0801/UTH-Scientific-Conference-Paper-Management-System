from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from src.database import get_db
from src import models, schemas

from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from src.auth import SECRET_KEY, ALGORITHM

# tokenUrl chỉ dùng cho Swagger "Authorize" UI
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_user(payload=Depends(lambda token=Depends(oauth2_scheme): decode_token(token))):
    # chỉ cần token hợp lệ
    return payload


def require_admin(payload=Depends(require_user)):
    roles = payload.get("roles") or []
    if isinstance(roles, str):
        roles = [roles]
    roles = [str(r).upper() for r in roles]
    if "ADMIN" not in roles:
        raise HTTPException(status_code=403, detail="Admin only")
    return payload


class UpdateRoleRequest(BaseModel):
    role_name: str


router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get(
    "/me",
    response_model=schemas.UserResponse,
    summary="Get current user (from access token)"
)
def get_me(
    db: Session = Depends(get_db),
    payload=Depends(require_user),
):
    """
    Lấy thông tin user hiện tại từ JWT access token.
    Token payload do create_access_token tạo ra thường có:
      - sub: email
      - user_id: id
      - roles: [...]
    """
    user_id = payload.get("user_id")
    email = payload.get("sub")

    q = db.query(models.User).options(joinedload(models.User.roles))

    user = None
    if user_id is not None:
        user = q.filter(models.User.id == int(user_id)).first()
    if user is None and email:
        user = q.filter(models.User.email == str(email)).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


@router.get("/", response_model=list[schemas.UserResponse], summary="List all users")
def list_users(
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    # joinedload để roles luôn có trong response
    return db.query(models.User).options(joinedload(models.User.roles)).all()


@router.put("/{user_id}/role", summary="Update a user's role")
def update_user_role(
    user_id: int,
    body: UpdateRoleRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    role_name = body.role_name.strip().upper()

    user = (
        db.query(models.User)
        .options(joinedload(models.User.roles))
        .filter(models.User.id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = db.query(models.Role).filter(models.Role.role_name == role_name).first()
    if not role:
        raise HTTPException(status_code=404, detail=f"Role not found: {role_name}")

    user.roles = [role]
    db.commit()
    db.refresh(user)

    return {"message": "Role updated", "user_id": user_id, "role": role_name}
