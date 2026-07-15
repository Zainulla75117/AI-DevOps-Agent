"""
InfraX Infrastructure Service — Configuration
"""

from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

load_dotenv()


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "InfraX Infrastructure Service"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"

    # LLM
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "gemini")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-2.5-flash-lite")

    # AWS
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")

    # Inter-service communication
    PROJECT_SERVICE_URL: str = os.getenv("PROJECT_SERVICE_URL", "http://localhost:8002")
    SCM_SERVICE_URL: str = os.getenv("SCM_SERVICE_URL", "http://localhost:8005")

    # PostgreSQL (infrastructure summary persistence)
    POSTGRES_DSN: str = os.getenv("POSTGRES_DSN", "postgresql://postgres:postgres@localhost:5432/infrax")

    # JWT (same secret as all other services — for token validation only)
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")

    # Qdrant Vector Database
    QDRANT_URL: str = os.getenv("QDRANT_URL", "http://localhost:6333")

    # CORS
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:8080,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:8080,https://infraxai.vercel.app"
    )

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
