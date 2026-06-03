"""
InfraX Infrastructure Service (port 8004)
==========================================
AI-driven infrastructure provisioning via conversational chat.
"""

import logging
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from config import settings
from postgres.connection import init_pg_pool, close_pg_pool
from postgres.models import ensure_tables, auto_prune_conversations
from app.routers import chat, conversations, cleanup
from chat.langgraph_flow import is_available as is_chat_available
from app.services.resource_service import resource_service
from app.schemas.response_schemas import HealthResponse

# ═══════════════════════════════════════════════════════════════════════
#  LOGGING
# ═══════════════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-28s | %(levelname)-5s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("infra-service")

# ═══════════════════════════════════════════════════════════════════════
#  LIFECYCLE
# ═══════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_pg_pool(settings.POSTGRES_DSN)
    await ensure_tables()
    await auto_prune_conversations(retention_days=90)
    
    yield
    
    # Shutdown
    await close_pg_pool()
    await resource_service.close()

# ═══════════════════════════════════════════════════════════════════════
#  FASTAPI APP
# ═══════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="InfraX Infrastructure Service",
    description="AI-driven infrastructure provisioning via chat",
    version="1.0.0",
    lifespan=lifespan,
)

cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════════════════════
#  ROUTERS
# ═══════════════════════════════════════════════════════════════════════

app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(cleanup.router)

# ═══════════════════════════════════════════════════════════════════════
#  HEALTH CHECK ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

@app.get("/")
def read_root():
    return {"service": "infrastructure-service", "status": "online"}

@app.get("/api/health", response_model=HealthResponse)
async def check_health():
    chat_engine = "ready" if is_chat_available() else "unavailable"
    project_svc = "ready"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{resource_service.base_url}/api/health")
            project_svc = "ready" if resp.status_code == 200 else "degraded"
    except Exception:
        project_svc = "degraded"
        
    status = "healthy" if chat_engine == "ready" and project_svc == "ready" else "degraded"
    return HealthResponse(
        status=status,
        chat_engine=chat_engine,
        project_service=project_svc
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8004, reload=True)
