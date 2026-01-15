import os
from dotenv import load_dotenv

# Load file .env
load_dotenv()

class Settings:
    PROJECT_NAME: str = "UTH-ConfMS Intelligent Service"
    PROJECT_VERSION: str = "1.0.0"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "mysql+pymysql://root:root@localhost/intelligent_db")
    
    # Google AI
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY")
    
    if not GOOGLE_API_KEY:
        print("WARNING: GOOGLE_API_KEY is missing in .env file!")

settings = Settings()