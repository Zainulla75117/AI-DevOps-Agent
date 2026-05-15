from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "devops_poc")
    APP_NAME: str = "InfraX SCM Service"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    
    # GitHub App Integration (replaces standard OAuth for SCM access)
    GITHUB_APP_ID: str = os.getenv("GITHUB_APP_ID", "")
    GITHUB_APP_NAME: str = os.getenv("GITHUB_APP_NAME", "infrax-scm-agent")
    GITHUB_APP_PRIVATE_KEY: str = os.getenv("GITHUB_APP_PRIVATE_KEY", "")
    
    # We keep the OAuth client ID/Secret as some App setups use them for user-to-server tokens, 
    # but primarily we use the App ID and Private Key for installation tokens.
    GITHUB_SCM_CLIENT_ID: str = os.getenv("GITHUB_SCM_CLIENT_ID", "")
    GITHUB_SCM_CLIENT_SECRET: str = os.getenv("GITHUB_SCM_CLIENT_SECRET", "")
    GITHUB_SCM_REDIRECT_URI: str = os.getenv(
        "GITHUB_SCM_REDIRECT_URI",
        "http://localhost:8000/api/scm/oauth/github/callback"
    )
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
