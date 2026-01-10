# src/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Cập nhật pass 123456 và db uth_conference
    DATABASE_URL: str = "mysql+pymysql://root:123456@localhost:3306/uth_conference"
    
    PROJECT_NAME: str = "Identity Service"

    class Config:
        env_file = ".env"

settings = Settings()