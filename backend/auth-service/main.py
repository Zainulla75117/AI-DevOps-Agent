from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import user_router, project_router, scm_router, scm_repo_router, jenkins_credentials_router
from app.database.connection import close_db, check_db_connection

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG
)

# Configure CORS
cors_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(user_router)
app.include_router(project_router)
app.include_router(scm_router)
app.include_router(scm_repo_router)
app.include_router(jenkins_credentials_router)

@app.on_event("startup")
async def startup_event():
    """Check database connection on application startup."""
    print("Checking database connection...")
    is_connected = await check_db_connection()
    if is_connected:
        print(f"✅ Database connection successful! Connected to: {settings.MONGODB_URL}")
        print(f"✅ Using database: {settings.DATABASE_NAME}")
    else:
        print(f"❌ Database connection failed! Cannot connect to: {settings.MONGODB_URL}")
        print("⚠️  Application will start but database operations may fail.")
        print("⚠️  Please ensure MongoDB is running and MONGODB_URL is correct.")

@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection on app shutdown."""
    await close_db()

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Welcome to DevOps POC Backend API",
        "docs": "/docs",
        "health": "/api/health"
    }

@app.get("/api/health")
async def health():
    """Health check endpoint with database status."""
    db_status = await check_db_connection()
    return {
        "status": "healthy" if db_status else "degraded",
        "database": "connected" if db_status else "disconnected"
    }

@app.get("/api/debug/db-info")
async def debug_db_info():
    """Debug endpoint to check database and collection info."""
    from app.database.connection import get_database, get_client
    from app.config import settings
    
    try:
        client = get_client()
        db = get_database()
        
        # List all databases
        db_list = await client.list_database_names()
        
        # List all collections in the database
        collections = await db.list_collection_names()
        
        # Count documents in users collection
        count = await db.users.count_documents({})
        
        # Get all documents from users collection
        all_docs = []
        async for doc in db.users.find({}):
            # Convert ObjectId to string for JSON serialization
            doc["_id"] = str(doc["_id"])
            all_docs.append(doc)
        
        # Get a sample document if any exists
        sample = await db.users.find_one({})
        if sample:
            sample["_id"] = str(sample["_id"])
        
        return {
            "database_name": settings.DATABASE_NAME,
            "mongodb_url": settings.MONGODB_URL,
            "available_databases": db_list,
            "collections": collections,
            "users_collection_count": count,
            "all_documents": all_docs,
            "sample_document": sample,
            "database_exists": settings.DATABASE_NAME in db_list,
            "collection_exists": "users" in collections
        }
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc(),
            "database_name": settings.DATABASE_NAME,
            "mongodb_url": settings.MONGODB_URL
        }