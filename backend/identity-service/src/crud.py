from sqlalchemy.orm import Session
from src import models, schemas
from src.auth import get_password_hash

def get_user_by_email(db: Session, email: str):
    """Tìm user theo email"""
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_id(db: Session, user_id: int):
    """Tìm user theo ID"""
    return db.query(models.User).filter(models.User.id == user_id).first()

def create_user(db: Session, user: schemas.UserCreate):
    """
    Tạo user mới:
    1. Hash password
    2. Tìm và gán Roles tương ứng
    3. Lưu vào DB
    """
    # 1. Mã hóa mật khẩu
    hashed_password = get_password_hash(user.password)
    
    # 2. Tạo đối tượng User (chưa có roles)
    db_user = models.User(
        email=user.email,
        password_hash=hashed_password, # Lưu password đã mã hóa
        full_name=user.full_name,
        organization=user.organization,
        is_active=user.is_active
    )

    # 3. Xử lý gán Quyền (Roles)
    # user.roles là danh sách string (VD: ["USER", "ADMIN"]) từ input
    if user.roles:
        for role_name in user.roles:
            # Tìm role trong DB theo tên
            role_obj = db.query(models.Role).filter(models.Role.role_name == role_name).first()
            if role_obj:
                # Nếu tìm thấy role, thêm vào danh sách roles của user
                db_user.roles.append(role_obj)
            else:
                # (Tùy chọn) Nếu role không tồn tại, có thể bỏ qua hoặc báo lỗi
                # Ở đây ta mặc định bỏ qua role sai tên
                pass
    else:
        # Nếu không gửi role nào, mặc định gán role USER
        default_role = db.query(models.Role).filter(models.Role.role_name == "USER").first()
        if default_role:
            db_user.roles.append(default_role)

    # 4. Lưu vào Database
    db.add(db_user)
    db.commit()
    db.refresh(db_user) # Refresh để lấy lại ID và thông tin vừa tạo
    
    return db_user