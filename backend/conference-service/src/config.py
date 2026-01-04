from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DB_USER: str = "root"
    DB_PASSWORD: str = ""   # nếu root có mật khẩu thì điền vào
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "uth_conference"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:"
            f"{self.DB_PASSWORD}@{self.DB_HOST}:"
            f"{self.DB_PORT}/{self.DB_NAME}"
        )

settings = Settings()