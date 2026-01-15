from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Table
from sqlalchemy.orm import relationship
from src.database import Base

# 1. Bảng trung gian (Association Table) để nối User và Role
# Bảng này không cần tạo Class Model, chỉ cần khai báo Table
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
)

# 2. Model cho Roles (Quyền hạn)
class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String(50), unique=True, nullable=False)  # VD: ADMIN, USER, AUTHOR

    # Quan hệ ngược lại để truy vấn xem Role này có những User nào
    users = relationship("User", secondary=user_roles, back_populates="roles")

# 3. Model cho Users
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    # MySQL cần độ dài cụ thể cho String để tối ưu đánh index (VD: 100 ký tự)
    email = Column(String(100), unique=True, index=True, nullable=False)
    
    # Đổi tên hashed_password -> password_hash cho giống ERD (hoặc giữ nguyên tùy bạn)
    password_hash = Column(String(255), nullable=False) 
    
    # Các trường bổ sung theo ERD
    full_name = Column(String(100))
    organization = Column(String(100))
    is_active = Column(Boolean, default=True)

    # Thay vì cột 'role' string, ta dùng relationship để nối sang bảng Role
    roles = relationship("Role", secondary=user_roles, back_populates="users")