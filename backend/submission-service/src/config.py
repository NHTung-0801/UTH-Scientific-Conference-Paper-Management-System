import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+pymysql://root:root@localhost:3306/submission_db"
    NOTIFICATION_SERVICE_URL: str = "http://localhost:8001/notifications/send" 

    SECRET_KEY: str = "SECRET_KEY_CHANGE_ME" 
    ALGORITHM: str = "HS256"

    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 10

    CONFERENCE_SERVICE_URL: str = "http://localhost:8001" 
    CONFERENCE_SERVICE_URL: str = os.getenv("CONFERENCE_SERVICE_URL", "http://localhost:8001/conferences")
    
    class Config:
        env_file = ".env"

settings = Settings()