# src/schemas.py
from typing import List, Optional
from pydantic import BaseModel

# --- Phần Token (Giữ nguyên) ---
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    email: str
    password: str

# --- Phần Role (Quyền hạn) ---
# Schema con để hiển thị thông tin Role
class RoleBase(BaseModel):
    role_name: str
    
    class Config:
        from_attributes = True # Để đọc được dữ liệu từ SQLAlchemy model

# --- Phần User (Người dùng) ---
class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    organization: Optional[str] = None
    is_active: bool = True

# Dùng khi Đăng ký (Register) - Cần có password
class UserCreate(UserBase):
    password: str
    # Mặc định tạo user mới sẽ có quyền USER, có thể gửi thêm ["ADMIN"] nếu muốn
    roles: List[str] = ["USER"] 

# Dùng khi Trả về dữ liệu (Response) - Ẩn password, hiện ID và Roles
class UserResponse(UserBase):
    id: int
    roles: List[RoleBase] = [] # Trả về danh sách object Role

    class Config:
        from_attributes = True