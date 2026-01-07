from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./review.db"
    SUBMISSION_SERVICE_URL: str = "http://submission-service:8000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

# để papers.py vẫn import kiểu cũ được
SUBMISSION_SERVICE_URL = settings.SUBMISSION_SERVICE_URL
