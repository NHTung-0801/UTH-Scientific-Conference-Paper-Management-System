from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 1. Database
    DATABASE_URL: str = "mysql+pymysql://root:root@localhost:3306/submission_db"

    # 2. Microservice URLs
    SUBMISSION_SERVICE_URL: str = "http://localhost:8000"
    NOTIFICATION_SERVICE_URL: str = "http://localhost:8001/notifications/send"
    CONFERENCE_SERVICE_URL: str = "http://localhost:8002"

    # 3. Security
    SECRET_KEY: str = "SECRET_KEY_CHANGE_ME"
    ALGORITHM: str = "HS256"

    # 4. Upload
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 10

    class Config:
        env_file = ".env"


settings = Settings()

SUBMISSION_SERVICE_URL = settings.SUBMISSION_SERVICE_URL
