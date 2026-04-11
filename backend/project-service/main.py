"""
InfraX Project Service (port 8002)
Handles project CRUD and infrastructure creation.
"""

from fastapi import FastAPI
from app.config import settings
from app.routers import project_router
from app.database.connection import close_db, check_db_connection

app = FastAPI(
    title="InfraX Project Service",
    debug=settings.DEBUG
)

# Include routers
app.include_router(project_router)

@app.on_event("startup")
async def startup_event():
    print("Checking database connection...")
    is_connected = await check_db_connection()
    if is_connected:
        print(f"✅ [project-service] DB connected: {settings.MONGODB_URL}")
        print(f"✅ Using database: {settings.DATABASE_NAME}")
    else:
        print(f"❌ [project-service] DB connection failed: {settings.MONGODB_URL}")

@app.on_event("shutdown")
async def shutdown_event():
    await close_db()

@app.get("/")
async def root():
    return {"service": "project-service", "status": "running"}

@app.get("/api/health")
async def health():
    db_status = await check_db_connection()
    return {
        "status": "healthy" if db_status else "degraded",
        "service": "project-service",
        "database": "connected" if db_status else "disconnected"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
