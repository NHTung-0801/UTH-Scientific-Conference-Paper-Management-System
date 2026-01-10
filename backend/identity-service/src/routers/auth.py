from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

# Import từ các module trong src
from src.database import get_db
from src import schemas, crud
# Lưu ý: Các hàm bảo mật (hash/jwt) của bạn đang nằm ở src/auth.py hoặc src/security.py
# Dựa trên code cũ bạn gửi, tôi giả định bạn để ở src.auth
from src.auth import verify_password, create_access_token, create_refresh_token

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)

# --- 1. API ĐĂNG KÝ (Register) ---
@router.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Kiểm tra email đã tồn tại chưa
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=400, 
            detail="Email already registered"
        )
    # Tạo user mới
    return crud.create_user(db=db, user=user)

# --- 2. API ĐĂNG NHẬP (Login) ---
@router.post("/login", response_model=schemas.TokenResponse)
def login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    # Tìm user trong DB
    user = crud.get_user_by_email(db, data.email)
    
    # Kiểm tra user và mật khẩu
    # LƯU Ý: Model mới dùng cột password_hash
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Lấy danh sách tên quyền (List[str]) từ relationship roles
    # Ví dụ: user.roles là [Role(name='ADMIN'), Role(name='USER')]
    # -> role_names sẽ là ["ADMIN", "USER"]
    role_names = [role.role_name for role in user.roles]

    # Tạo Access Token chứa danh sách quyền
    access_token = create_access_token(
        data={
            "sub": user.email, 
            "roles": role_names,  # Truyền list quyền vào token
            "user_id": user.id
        }
    )
    
    refresh_token = create_refresh_token(
        data={"sub": user.email}
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

# --- 3. API ĐĂNG XUẤT ---
@router.post("/logout")
def logout():
    return {"message": "Logout successful"}