from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from app.models.scm import SCM
from app.schemas.scm import SCMCreate

async def create_scm(db: AsyncIOMotorDatabase, scm: SCMCreate) -> SCM:
    """
    Create new SCM credentials in the database.
    
    Args:
        db: MongoDB database instance
        scm: SCMCreate schema with SCM data
        
    Returns:
        Created SCM model
    """
    try:
        from app.config import settings
        
        scm_dict = scm.model_dump()
        scm_dict["created_at"] = datetime.utcnow()
        
        print(f"📝 Attempting to insert SCM credentials into database: {settings.DATABASE_NAME}")
        print(f"📝 Collection name: user_scm_credentials")
        print(f"📝 SCM data: {scm_dict}")
        
        # Insert into the user_scm_credentials collection
        result = await db.user_scm_credentials.insert_one(scm_dict)
        
        print(f"📝 Insert result: {result.inserted_id}")
        print(f"📝 Acknowledged: {result.acknowledged}")
        
        if not result.inserted_id:
            raise Exception("Failed to insert SCM credentials - no inserted_id returned")
        
        # Verify the insert by finding the document
        created_scm = await db.user_scm_credentials.find_one({"_id": result.inserted_id})
        
        if not created_scm:
            raise Exception(f"SCM credentials inserted but not found with id: {result.inserted_id}")
        
        # Verify document count
        count = await db.user_scm_credentials.count_documents({})
        print(f"✅ SCM credentials created successfully with ID: {result.inserted_id}")
        print(f"✅ Total documents in collection: {count}")
        print(f"✅ Database: {settings.DATABASE_NAME}, Collection: user_scm_credentials")
        
        return SCM(**created_scm)
    except Exception as e:
        print(f"❌ Error creating SCM credentials: {e}")
        print(f"❌ SCM data: {scm_dict}")
        import traceback
        traceback.print_exc()
        raise

async def get_scm(db: AsyncIOMotorDatabase, scm_id: str) -> Optional[SCM]:
    """
    Get SCM credentials by ID.
    
    Args:
        db: MongoDB database instance
        scm_id: SCM ID as string
        
    Returns:
        SCM model if found, None otherwise
    """
    if not ObjectId.is_valid(scm_id):
        return None
    
    scm = await db.user_scm_credentials.find_one({"_id": ObjectId(scm_id)})
    if scm:
        return SCM(**scm)
    return None

async def get_all_scm(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100) -> List[SCM]:
    """
    Get all SCM credentials with pagination.
    
    Args:
        db: MongoDB database instance
        skip: Number of documents to skip
        limit: Maximum number of documents to return
        
    Returns:
        List of SCM models
    """
    cursor = db.user_scm_credentials.find().skip(skip).limit(limit)
    scm_list = await cursor.to_list(length=limit)
    return [SCM(**scm) for scm in scm_list]

async def get_scm_by_name(db: AsyncIOMotorDatabase, scm_name: str) -> Optional[SCM]:
    """
    Get SCM credentials by SCM name.
    
    Args:
        db: MongoDB database instance
        scm_name: SCM name (e.g., "github")
        
    Returns:
        SCM model if found, None otherwise
    """
    scm = await db.user_scm_credentials.find_one({"scm_name": scm_name})
    if scm:
        return SCM(**scm)
    return None

async def update_scm(db: AsyncIOMotorDatabase, scm_id: str, scm_update: dict) -> Optional[SCM]:
    """
    Update SCM credentials by ID.
    
    Args:
        db: MongoDB database instance
        scm_id: SCM ID as string
        scm_update: Dictionary with fields to update
        
    Returns:
        Updated SCM model if found, None otherwise
    """
    if not ObjectId.is_valid(scm_id):
        return None
    
    scm_update["updated_at"] = datetime.utcnow()
    result = await db.user_scm_credentials.update_one(
        {"_id": ObjectId(scm_id)},
        {"$set": scm_update}
    )
    
    if result.modified_count:
        updated_scm = await db.user_scm_credentials.find_one({"_id": ObjectId(scm_id)})
        if updated_scm:
            return SCM(**updated_scm)
    return None

async def delete_scm(db: AsyncIOMotorDatabase, scm_id: str) -> bool:
    """
    Delete SCM credentials by ID.
    
    Args:
        db: MongoDB database instance
        scm_id: SCM ID as string
        
    Returns:
        True if SCM credentials were deleted, False otherwise
    """
    if not ObjectId.is_valid(scm_id):
        return False
    
    result = await db.user_scm_credentials.delete_one({"_id": ObjectId(scm_id)})
    return result.deleted_count > 0

