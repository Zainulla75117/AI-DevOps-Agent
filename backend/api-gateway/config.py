from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):
    # Application settings
    APP_NAME: str = "InfraX API Gateway"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # CORS settings
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:8080,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:8080,https://infraxai.vercel.app"
    )
    
    # JWT settings (for verification only — tokens are created by auth-service)
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    
    # Downstream service URLs
    AUTH_SERVICE_URL: str = os.getenv("AUTH_SERVICE_URL", "http://localhost:8001")
    PROJECT_SERVICE_URL: str = os.getenv("PROJECT_SERVICE_URL", "http://localhost:8002")
    CREDENTIAL_SERVICE_URL: str = os.getenv("CREDENTIAL_SERVICE_URL", "http://localhost:8003")
    JENKINS_SERVICE_URL: str = os.getenv("JENKINS_SERVICE_URL", "http://localhost:8081")
    INFRA_SERVICE_URL: str = os.getenv("INFRA_SERVICE_URL", "http://localhost:8004")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

# Route mapping: URL prefix → downstream service URL
# Order matters — more specific prefixes must come first
ROUTE_MAP = [
    ("/api/jenkins/credentials", settings.CREDENTIAL_SERVICE_URL),
    ("/api/jenkins",            settings.JENKINS_SERVICE_URL),
    ("/api/infrastructure",     settings.PROJECT_SERVICE_URL),
    ("/api/infra",              settings.INFRA_SERVICE_URL),
    ("/api/users",              settings.AUTH_SERVICE_URL),
    ("/api/crypto",             settings.AUTH_SERVICE_URL),
    ("/api/projects",           settings.PROJECT_SERVICE_URL),
    ("/api/create",             settings.PROJECT_SERVICE_URL),
    ("/api/scm",                settings.CREDENTIAL_SERVICE_URL),
    ("/api/credentials",        settings.CREDENTIAL_SERVICE_URL),
]

# Routes that do NOT require JWT authentication
PUBLIC_ROUTES = [
    "/api/users/login",
    "/api/users/register",
    "/api/users/github/login",
    "/api/users/github/callback",
    "/api/users/google/login",
    "/api/users/google/callback",
    "/api/crypto/public-key",
    "/api/health",
    "/docs",
    "/openapi.json",
    "/",
]

def get_downstream_url(path: str) -> str | None:
    """Resolve a request path to the downstream service URL."""
    for prefix, service_url in ROUTE_MAP:
        if path.startswith(prefix):
            return service_url
    return None

def is_public_route(path: str) -> bool:
    """Check if a route is public (no authentication required)."""
    return any(path.startswith(route) for route in PUBLIC_ROUTES)
