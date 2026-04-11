from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):
    # MongoDB settings
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "devops_poc")
    
    # Application settings
    APP_NAME: str = "InfraX Project Service"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # JWT settings (for token verification)
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
