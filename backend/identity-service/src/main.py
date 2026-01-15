from fastapi import FastAPI
from src.database import engine, SessionLocal
from src import models
from src.routers import auth  # <--- Import router auth chúng ta vừa viết

# 1. Tạo bảng trong database nếu chưa tồn tại
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Identity Service")

# 2. Đăng ký Router (Quan trọng)
# Dòng này sẽ kích hoạt toàn bộ API: /api/auth/login, /register, /logout từ file auth.py
app.include_router(auth.router)

# 3. Hàm khởi tạo dữ liệu mẫu (Role) - Chạy 1 lần khi start app
def init_db():
    db = SessionLocal()
    try:
        # Kiểm tra nếu chưa có Role nào thì tạo mới
        if not db.query(models.Role).first():
            roles = [
                models.Role(role_name="ADMIN"),
                models.Role(role_name="USER"),
                models.Role(role_name="AUTHOR")
            ]
            db.add_all(roles)
            db.commit()
            print("--- Đã khởi tạo dữ liệu mẫu: ADMIN, USER, AUTHOR ---")
    except Exception as e:
        print(f"Lỗi khởi tạo DB: {e}")
    finally:
        db.close()

# Gọi hàm khởi tạo
init_db()

@app.get("/")
def root():
    return {"message": "identity-service is running"}