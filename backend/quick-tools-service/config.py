"""
InfraX Quick Tools Service — Configuration
"""

from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

load_dotenv()


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "InfraX Quick Tools Service"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"

    # LLM
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-2.5-flash")

    # JWT (same secret as all other services — for token validation only)
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")

    # CORS
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:8080,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:8080,https://infraxai.vercel.app"
    )

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
