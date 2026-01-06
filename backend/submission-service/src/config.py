import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 1. Cấu hình Database (MySQL)
    # Định dạng: mysql+pymysql://<username>:<password>@<host>:<port>/<db_name>
    DATABASE_URL: str = "mysql+pymysql://root:root@localhost:3306/submission_db"

    # 2. Cấu hình Bảo mật (Dùng để xác thực Token từ Identity Service gửi sang)
    SECRET_KEY: str = "SECRET_KEY_CHANGE_ME"  # Phải khớp với Identity Service
    ALGORITHM: str = "HS256"

    # 3. Cấu hình Upload
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 10

    # 4. Cấu hình liên kết Microservices (để gọi API sang service khác)
    CONFERENCE_SERVICE_URL: str = "http://localhost:8001" 

    class Config:
        # Tự động đọc file .env nếu có
        env_file = ".env"

# Khởi tạo đối tượng settings để dùng ở các file khác
settings = Settings()