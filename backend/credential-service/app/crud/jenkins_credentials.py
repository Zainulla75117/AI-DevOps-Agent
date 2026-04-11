from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from app.models.jenkins_credentials import JenkinsCredentials
from app.schemas.jenkins_credentials import JenkinsCredentialsCreate

async def create_jenkins_credentials(
    db: AsyncIOMotorDatabase, 
    jenkins_credentials: JenkinsCredentialsCreate
) -> JenkinsCredentials:
    """
    Create new Jenkins credentials in the database.
    
    Args:
        db: MongoDB database instance
        jenkins_credentials: JenkinsCredentialsCreate schema with Jenkins credentials data
        
    Returns:
        Created JenkinsCredentials model
    """
    try:
        from app.config import settings
        
        credentials_dict = jenkins_credentials.model_dump()
        credentials_dict["created_at"] = datetime.utcnow()
        
        print(f"📝 Attempting to insert Jenkins credentials into database: {settings.DATABASE_NAME}")
        print(f"📝 Collection name: user_jenkins_credentials")
        print(f"📝 Jenkins credentials data: {credentials_dict}")
        
        # Insert into the user_jenkins_credentials collection
        result = await db.user_jenkins_credentials.insert_one(credentials_dict)
        
        print(f"📝 Insert result: {result.inserted_id}")
        print(f"📝 Acknowledged: {result.acknowledged}")
        
        if not result.inserted_id:
            raise Exception("Failed to insert Jenkins credentials - no inserted_id returned")
        
        # Verify the insert by finding the document
        created_credentials = await db.user_jenkins_credentials.find_one({"_id": result.inserted_id})
        
        if not created_credentials:
            raise Exception(f"Jenkins credentials inserted but not found with id: {result.inserted_id}")
        
        # Verify document count
        count = await db.user_jenkins_credentials.count_documents({})
        print(f"✅ Jenkins credentials created successfully with ID: {result.inserted_id}")
        print(f"✅ Total documents in collection: {count}")
        print(f"✅ Database: {settings.DATABASE_NAME}, Collection: user_jenkins_credentials")
        
        return JenkinsCredentials(**created_credentials)
    except Exception as e:
        print(f"❌ Error creating Jenkins credentials: {e}")
        print(f"❌ Jenkins credentials data: {credentials_dict}")
        import traceback
        traceback.print_exc()
        raise

async def get_jenkins_credentials(
    db: AsyncIOMotorDatabase, 
    credentials_id: str
) -> Optional[JenkinsCredentials]:
    """
    Get Jenkins credentials by ID.
    
    Args:
        db: MongoDB database instance
        credentials_id: Jenkins credentials ID as string
        
    Returns:
        JenkinsCredentials model if found, None otherwise
    """
    if not ObjectId.is_valid(credentials_id):
        return None
    
    credentials = await db.user_jenkins_credentials.find_one({"_id": ObjectId(credentials_id)})
    if credentials:
        return JenkinsCredentials(**credentials)
    return None

async def get_all_jenkins_credentials(
    db: AsyncIOMotorDatabase, 
    skip: int = 0, 
    limit: int = 100
) -> List[JenkinsCredentials]:
    """
    Get all Jenkins credentials with pagination.
    
    Args:
        db: MongoDB database instance
        skip: Number of documents to skip
        limit: Maximum number of documents to return
        
    Returns:
        List of JenkinsCredentials models
    """
    cursor = db.user_jenkins_credentials.find().skip(skip).limit(limit)
    credentials_list = await cursor.to_list(length=limit)
    return [JenkinsCredentials(**cred) for cred in credentials_list]

async def update_jenkins_credentials(
    db: AsyncIOMotorDatabase, 
    credentials_id: str, 
    credentials_update: dict
) -> Optional[JenkinsCredentials]:
    """
    Update Jenkins credentials by ID.
    
    Args:
        db: MongoDB database instance
        credentials_id: Jenkins credentials ID as string
        credentials_update: Dictionary with fields to update
        
    Returns:
        Updated JenkinsCredentials model if found, None otherwise
    """
    if not ObjectId.is_valid(credentials_id):
        return None
    
    credentials_update["updated_at"] = datetime.utcnow()
    result = await db.user_jenkins_credentials.update_one(
        {"_id": ObjectId(credentials_id)},
        {"$set": credentials_update}
    )
    
    if result.modified_count:
        updated_credentials = await db.user_jenkins_credentials.find_one({"_id": ObjectId(credentials_id)})
        if updated_credentials:
            return JenkinsCredentials(**updated_credentials)
    return None

async def delete_jenkins_credentials(
    db: AsyncIOMotorDatabase, 
    credentials_id: str
) -> bool:
    """
    Delete Jenkins credentials by ID.
    
    Args:
        db: MongoDB database instance
        credentials_id: Jenkins credentials ID as string
        
    Returns:
        True if Jenkins credentials were deleted, False otherwise
    """
    if not ObjectId.is_valid(credentials_id):
        return False
    
    result = await db.user_jenkins_credentials.delete_one({"_id": ObjectId(credentials_id)})
    return result.deleted_count > 0

