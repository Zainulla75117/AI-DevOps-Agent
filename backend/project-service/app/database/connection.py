from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from typing import Optional

# Global MongoDB client
_client: Optional[AsyncIOMotorClient] = None
_database = None

def get_client() -> AsyncIOMotorClient:
    """Get or create MongoDB client."""
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGODB_URL)
    return _client

def get_database():
    """Get database instance."""
    global _database
    if _database is None:
        client = get_client()
        _database = client[settings.DATABASE_NAME]
    return _database

async def close_db():
    """Close MongoDB connection."""
    global _client
    if _client:
        _client.close()
        _client = None

async def check_db_connection() -> bool:
    try:
        client = get_client()
        await client.admin.command('ping')
        return True
    except Exception as e:
        print(f"Database connection check failed: {e}")
        return False

async def get_db():
    """Database dependency for FastAPI."""
    db = get_database()
    yield db
