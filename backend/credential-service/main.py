"""
InfraX Credential Service (port 8003)
Handles SCM credentials, Jenkins credentials, and repository sync.
"""

from fastapi import FastAPI
from app.config import settings
from app.routers import scm_router, scm_repo_router, jenkins_credentials_router
from app.database.connection import close_db, check_db_connection

app = FastAPI(
    title="InfraX Credential Service",
    debug=settings.DEBUG
)

# Include routers
app.include_router(scm_router)
app.include_router(scm_repo_router)
app.include_router(jenkins_credentials_router)

@app.on_event("startup")
async def startup_event():
    print("Checking database connection...")
    is_connected = await check_db_connection()
    if is_connected:
        print(f"✅ [credential-service] DB connected: {settings.MONGODB_URL}")
        print(f"✅ Using database: {settings.DATABASE_NAME}")
    else:
        print(f"❌ [credential-service] DB connection failed: {settings.MONGODB_URL}")

@app.on_event("shutdown")
async def shutdown_event():
    await close_db()

@app.get("/")
async def root():
    return {"service": "credential-service", "status": "running"}

@app.get("/api/health")
async def health():
    db_status = await check_db_connection()
    return {
        "status": "healthy" if db_status else "degraded",
        "service": "credential-service",
        "database": "connected" if db_status else "disconnected"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=True)
