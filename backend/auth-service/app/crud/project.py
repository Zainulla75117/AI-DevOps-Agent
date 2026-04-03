from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from app.models.project import Project
from app.schemas.project import ProjectCreate

async def create_project(db: AsyncIOMotorDatabase, project: ProjectCreate) -> Project:
    """
    Create a new project in the database.
    
    Args:
        db: MongoDB database instance
        project: ProjectCreate schema with project data
        
    Returns:
        Created Project model
    """
    try:
        from app.config import settings
        
        project_dict = project.model_dump()
        project_dict["created_at"] = datetime.utcnow()
        
        print(f"📝 Attempting to insert project into database: {settings.DATABASE_NAME}")
        print(f"📝 Collection name: user_projects")
        print(f"📝 Project data: {project_dict}")
        
        # Insert into the user_projects collection
        result = await db.user_projects.insert_one(project_dict)
        
        print(f"📝 Insert result: {result.inserted_id}")
        print(f"📝 Acknowledged: {result.acknowledged}")
        
        if not result.inserted_id:
            raise Exception("Failed to insert project - no inserted_id returned")
        
        # Verify the insert by finding the document
        created_project = await db.user_projects.find_one({"_id": result.inserted_id})
        
        if not created_project:
            raise Exception(f"Project inserted but not found with id: {result.inserted_id}")
        
        # Verify document count
        count = await db.user_projects.count_documents({})
        print(f"✅ Project created successfully with ID: {result.inserted_id}")
        print(f"✅ Total documents in collection: {count}")
        print(f"✅ Database: {settings.DATABASE_NAME}, Collection: user_projects")
        
        return Project(**created_project)
    except Exception as e:
        print(f"❌ Error creating project: {e}")
        print(f"❌ Project data: {project_dict}")
        import traceback
        traceback.print_exc()
        raise

async def get_project(db: AsyncIOMotorDatabase, project_id: str) -> Optional[Project]:
    """
    Get a project by ID.
    
    Args:
        db: MongoDB database instance
        project_id: Project ID as string
        
    Returns:
        Project model if found, None otherwise
    """
    if not ObjectId.is_valid(project_id):
        return None
    
    project = await db.user_projects.find_one({"_id": ObjectId(project_id)})
    if project:
        return Project(**project)
    return None

async def get_all_projects(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100) -> List[Project]:
    """
    Get all projects with pagination.
    
    Args:
        db: MongoDB database instance
        skip: Number of documents to skip
        limit: Maximum number of documents to return
        
    Returns:
        List of Project models
    """
    cursor = db.user_projects.find().skip(skip).limit(limit)
    projects = await cursor.to_list(length=limit)
    return [Project(**project) for project in projects]

async def update_project(db: AsyncIOMotorDatabase, project_id: str, project_update: dict) -> Optional[Project]:
    """
    Update a project by ID.
    
    Args:
        db: MongoDB database instance
        project_id: Project ID as string
        project_update: Dictionary with fields to update
        
    Returns:
        Updated Project model if found, None otherwise
    """
    if not ObjectId.is_valid(project_id):
        return None
    
    project_update["updated_at"] = datetime.utcnow()
    result = await db.user_projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": project_update}
    )
    
    if result.modified_count:
        updated_project = await db.user_projects.find_one({"_id": ObjectId(project_id)})
        if updated_project:
            return Project(**updated_project)
    return None

async def delete_project(db: AsyncIOMotorDatabase, project_id: str) -> bool:
    """
    Delete a project by ID.
    
    Args:
        db: MongoDB database instance
        project_id: Project ID as string
        
    Returns:
        True if project was deleted, False otherwise
    """
    if not ObjectId.is_valid(project_id):
        return False
    
    result = await db.user_projects.delete_one({"_id": ObjectId(project_id)})
    return result.deleted_count > 0

