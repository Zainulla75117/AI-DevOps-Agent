from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from app.models.jenkins_data import JenkinsData

async def create_jenkins_data(
    db: AsyncIOMotorDatabase,
    jenkins_id: str,
    user_name: str,
    jenkins_data: dict
) -> JenkinsData:
    """
    Create or update Jenkins data in the database.
    If data exists for jenkins_id and user_name, update it; otherwise create new.
    
    Args:
        db: MongoDB database instance
        jenkins_id: Jenkins credentials ID
        user_name: User name
        jenkins_data: Jenkins data dictionary from API
        
    Returns:
        Created or updated JenkinsData model
    """
    try:
        from app.config import settings
        
        # Check if data already exists for this jenkins_id and user_name
        existing_data = await db.user_jenkins_data.find_one({
            "jenkins_id": jenkins_id,
            "user_name": user_name
        })
        
        data_dict = {
            "jenkins_id": jenkins_id,
            "user_name": user_name,
            "jenkins_data": jenkins_data,
            "updated_at": datetime.utcnow()
        }
        
        if existing_data:
            # Update existing document
            print(f"📝 Updating existing Jenkins data for jenkins_id: {jenkins_id}, user_name: {user_name}")
            data_dict["created_at"] = existing_data.get("created_at", datetime.utcnow())
            
            result = await db.user_jenkins_data.update_one(
                {"_id": existing_data["_id"]},
                {"$set": data_dict}
            )
            
            if result.modified_count:
                updated_data = await db.user_jenkins_data.find_one({"_id": existing_data["_id"]})
                if updated_data:
                    print(f"✅ Jenkins data updated successfully with ID: {existing_data['_id']}")
                    return JenkinsData(**updated_data)
        else:
            # Create new document
            print(f"📝 Creating new Jenkins data for jenkins_id: {jenkins_id}, user_name: {user_name}")
            data_dict["created_at"] = datetime.utcnow()
            
            result = await db.user_jenkins_data.insert_one(data_dict)
            
            if not result.inserted_id:
                raise Exception("Failed to insert Jenkins data - no inserted_id returned")
            
            created_data = await db.user_jenkins_data.find_one({"_id": result.inserted_id})
            
            if not created_data:
                raise Exception(f"Jenkins data inserted but not found with id: {result.inserted_id}")
            
            count = await db.user_jenkins_data.count_documents({})
            print(f"✅ Jenkins data created successfully with ID: {result.inserted_id}")
            print(f"✅ Total documents in collection: {count}")
            print(f"✅ Database: {settings.DATABASE_NAME}, Collection: user_jenkins_data")
            
            return JenkinsData(**created_data)
            
    except Exception as e:
        print(f"❌ Error creating/updating Jenkins data: {e}")
        import traceback
        traceback.print_exc()
        raise

async def get_jenkins_data(
    db: AsyncIOMotorDatabase,
    data_id: str
) -> Optional[JenkinsData]:
    """
    Get Jenkins data by ID.
    
    Args:
        db: MongoDB database instance
        data_id: Jenkins data ID as string
        
    Returns:
        JenkinsData model if found, None otherwise
    """
    if not ObjectId.is_valid(data_id):
        return None
    
    data = await db.user_jenkins_data.find_one({"_id": ObjectId(data_id)})
    if data:
        return JenkinsData(**data)
    return None

async def get_jenkins_data_by_jenkins_id_and_user(
    db: AsyncIOMotorDatabase,
    jenkins_id: str,
    user_name: str
) -> Optional[JenkinsData]:
    """
    Get Jenkins data by jenkins_id and user_name.
    
    Args:
        db: MongoDB database instance
        jenkins_id: Jenkins credentials ID
        user_name: User name
        
    Returns:
        JenkinsData model if found, None otherwise
    """
    data = await db.user_jenkins_data.find_one({
        "jenkins_id": jenkins_id,
        "user_name": user_name
    })
    if data:
        return JenkinsData(**data)
    return None

async def get_all_jenkins_data(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 100
) -> List[JenkinsData]:
    """
    Get all Jenkins data with pagination.
    
    Args:
        db: MongoDB database instance
        skip: Number of documents to skip
        limit: Maximum number of documents to return
        
    Returns:
        List of JenkinsData models
    """
    cursor = db.user_jenkins_data.find().skip(skip).limit(limit)
    data_list = await cursor.to_list(length=limit)
    return [JenkinsData(**data) for data in data_list]

async def get_jenkins_data_by_user(
    db: AsyncIOMotorDatabase,
    user_name: str,
    skip: int = 0,
    limit: int = 100
) -> List[JenkinsData]:
    """
    Get all Jenkins data for a specific user.
    
    Args:
        db: MongoDB database instance
        user_name: User name
        skip: Number of documents to skip
        limit: Maximum number of documents to return
        
    Returns:
        List of JenkinsData models
    """
    cursor = db.user_jenkins_data.find({"user_name": user_name}).skip(skip).limit(limit)
    data_list = await cursor.to_list(length=limit)
    return [JenkinsData(**data) for data in data_list]

async def delete_jenkins_data(
    db: AsyncIOMotorDatabase,
    data_id: str
) -> bool:
    """
    Delete Jenkins data by ID.
    
    Args:
        db: MongoDB database instance
        data_id: Jenkins data ID as string
        
    Returns:
        True if Jenkins data was deleted, False otherwise
    """
    if not ObjectId.is_valid(data_id):
        return False
    
    result = await db.user_jenkins_data.delete_one({"_id": ObjectId(data_id)})
    return result.deleted_count > 0

