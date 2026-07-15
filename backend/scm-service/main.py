"""
InfraX SCM Service (port 8005)
Handles SCM business logic: repository sync, browsing, and namespace management.
SCM credential storage is handled by credential-service.
"""

from fastapi import FastAPI
from app.config import settings
from app.routers import scm_router, scm_repo_router, scm_oauth_router
from app.database.connection import close_db, check_db_connection

app = FastAPI(
    title="InfraX SCM Service",
    debug=settings.DEBUG
)

# Include routers
app.include_router(scm_router)
app.include_router(scm_repo_router)
app.include_router(scm_oauth_router)

@app.on_event("startup")
async def startup_event():
    print("Checking database connection...")
    is_connected = await check_db_connection()
    if is_connected:
        print(f"✅ [scm-service] DB connected: {settings.MONGODB_URL}")
        print(f"✅ Using database: {settings.DATABASE_NAME}")
        # Ensure unique index on user_scm_data to prevent duplicate repos
        from app.database.connection import get_database
        db = get_database()
        await db.user_scm_data.create_index(
            [("repo_id", 1), ("scm_provider", 1), ("scm_id", 1), ("user_id", 1)],
            unique=True,
            name="uq_repo_per_user_per_scm",
            background=True
        )
        print("✅ [scm-service] Unique index ensured on user_scm_data")
        # Ensure repo_analyses indexes
        from app.crud.repo_analysis import ensure_indexes
        await ensure_indexes(db)
    else:
        print(f"❌ [scm-service] DB connection failed: {settings.MONGODB_URL}")
    
    # Initialize Qdrant collection
    try:
        from app.services.qdrant_service import ensure_collection
        await ensure_collection(url=settings.QDRANT_URL)
        print(f"✅ [scm-service] Qdrant connected: {settings.QDRANT_URL}")
    except Exception as e:
        print(f"⚠️ [scm-service] Qdrant not available (non-fatal): {e}")

@app.on_event("shutdown")
async def shutdown_event():
    await close_db()

@app.get("/")
async def root():
    return {"service": "scm-service", "status": "running"}

@app.get("/api/health")
async def health():
    db_status = await check_db_connection()
    return {
        "status": "healthy" if db_status else "degraded",
        "service": "scm-service",
        "database": "connected" if db_status else "disconnected"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8005, reload=True)
