"""
InfraX Project Service (port 8002)
Handles project CRUD and unified infrastructure resource management.
"""

from fastapi import FastAPI
from app.config import settings
from app.routers import project_router
from app.routers.infra_resource import router as infrastructure_router
from app.routers.provisioning_context import router as provisioning_context_router
from app.database.connection import close_db, check_db_connection, get_database

app = FastAPI(
    title="InfraX Project Service",
    debug=settings.DEBUG
)

# Include routers
app.include_router(project_router)
app.include_router(infrastructure_router)
app.include_router(provisioning_context_router)


async def create_indexes():
    """Create performance indexes on the new unified collections."""
    db = get_database()
    try:
        # infra_resources indexes
        await db.infra_resources.create_index(
            [("project_id", 1), ("env", 1)],
            name="idx_project_env",
            background=True,
        )
        await db.infra_resources.create_index(
            [("type", 1)],
            name="idx_type",
            background=True,
        )
        await db.infra_resources.create_index(
            [("project_id", 1), ("type", 1)],
            name="idx_project_type",
            background=True,
        )
        await db.infra_resources.create_index(
            [("state", 1)],
            name="idx_state",
            background=True,
        )

        # infra_versions indexes
        await db.infra_versions.create_index(
            [("resource_id", 1), ("version", -1)],
            name="idx_resource_version",
            background=True,
        )

        # infra_executions indexes
        await db.infra_executions.create_index(
            [("project_id", 1), ("started_at", -1)],
            name="idx_project_executions",
            background=True,
        )
        await db.infra_executions.create_index(
            [("execution_id", 1)],
            name="idx_execution_id",
            unique=True,
            background=True,
        )
        print("✅ [project-service] Database indexes created/verified")
    except Exception as e:
        print(f"⚠️  [project-service] Index creation warning: {e}")


@app.on_event("startup")
async def startup_event():
    print("Checking database connection...")
    is_connected = await check_db_connection()
    if is_connected:
        print(f"✅ [project-service] DB connected: {settings.MONGODB_URL}")
        print(f"✅ Using database: {settings.DATABASE_NAME}")
        await create_indexes()
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
