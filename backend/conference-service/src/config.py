from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Các biến mặc định (dùng khi chạy Local)
    DB_USER: str = "root"
    DB_PASSWORD: str = "root"
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "conference_db"

    # --- SỬA ĐỔI QUAN TRỌNG Ở ĐÂY ---
    # 1. Khai báo DATABASE_URL là một BIẾN (Field), không phải hàm @property
    # Để Pydantic có thể nạp giá trị từ Docker vào đây.
    DATABASE_URL: Optional[str] = None

    # 2. Hàm này tự động chạy sau khi class khởi tạo
    # Nếu không có biến môi trường (chạy local), nó mới tự tính toán.
    def model_post_init(self, __context):
        if self.DATABASE_URL is None:
            self.DATABASE_URL = (
                f"mysql+pymysql://{self.DB_USER}:"
                f"{self.DB_PASSWORD}@{self.DB_HOST}:"
                f"{self.DB_PORT}/{self.DB_NAME}"
            )

settings = Settings()