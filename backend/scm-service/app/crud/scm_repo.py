from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from app.models.scm_repo import SCMRepo
from app.schemas.scm_repo import SCMRepoCreate

async def create_scm_repo(db: AsyncIOMotorDatabase, repo: SCMRepoCreate) -> SCMRepo:
    """
    Create new SCM repository data in the database.
    """
    try:
        repo_dict = repo.model_dump()
        # Rename 'id' to 'repo_id' to avoid conflict with MongoDB _id
        repo_dict["repo_id"] = repo_dict.pop("id")
        repo_dict["created_at"] = datetime.utcnow()
        
        result = await db.user_scm_data.insert_one(repo_dict)
        
        if not result.inserted_id:
            raise Exception("Failed to insert SCM repo - no inserted_id returned")
        
        created_repo = await db.user_scm_data.find_one({"_id": result.inserted_id})
        
        if not created_repo:
            raise Exception(f"SCM repo inserted but not found with id: {result.inserted_id}")
        
        return SCMRepo(**created_repo)
    except Exception as e:
        print(f"❌ Error creating SCM repo: {e}")
        raise

async def get_scm_repo(db: AsyncIOMotorDatabase, repo_id: str) -> Optional[SCMRepo]:
    """Get SCM repository by MongoDB ID."""
    if not ObjectId.is_valid(repo_id):
        return None
    
    repo = await db.user_scm_data.find_one({"_id": ObjectId(repo_id)})
    if repo:
        return SCMRepo(**repo)
    return None

async def get_scm_repo_by_repo_id(db: AsyncIOMotorDatabase, repo_id: int) -> Optional[SCMRepo]:
    """Get SCM repository by GitLab/GitHub repository ID."""
    repo = await db.user_scm_data.find_one({"repo_id": repo_id})
    if repo:
        return SCMRepo(**repo)
    return None

async def get_scm_repo_by_unique_key(
    db: AsyncIOMotorDatabase, 
    repo_id: int, 
    scm_provider: str, 
    scm_id: str, 
    user_id: str
) -> Optional[SCMRepo]:
    """
    Get SCM repository by unique key to check for duplicates.
    """
    query = {
        "repo_id": repo_id,
        "scm_provider": scm_provider.lower(),
        "scm_id": scm_id,
        "user_id": user_id
    }
    
    repo = await db.user_scm_data.find_one(query)
    if repo:
        return SCMRepo(**repo)
    return None

async def get_scm_repos_by_user(db: AsyncIOMotorDatabase, username: Optional[str] = None, user_id: Optional[str] = None) -> List[SCMRepo]:
    """Get all SCM repositories for a specific user."""
    query = {}
    if username:
        query["username"] = username
    if user_id:
        query["user_id"] = user_id
    
    cursor = db.user_scm_data.find(query)
    repos = await cursor.to_list(length=1000)
    return [SCMRepo(**repo) for repo in repos]

async def get_all_scm_repos(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100) -> List[SCMRepo]:
    """Get all SCM repositories with pagination."""
    cursor = db.user_scm_data.find().skip(skip).limit(limit)
    repos = await cursor.to_list(length=limit)
    return [SCMRepo(**repo) for repo in repos]

async def get_scm_repos_by_namespace(
    db: AsyncIOMotorDatabase, 
    namespace: str,
    user_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[SCMRepo]:
    """Get SCM repositories filtered by namespace."""
    query = {}
    
    if user_id:
        query["user_id"] = user_id
    
    namespace_pattern = f"^{namespace}/"
    
    query["$or"] = [
        {"name_with_namespace": {"$regex": namespace_pattern, "$options": "i"}},
        {"path_with_namespace": {"$regex": namespace_pattern, "$options": "i"}}
    ]
    
    cursor = db.user_scm_data.find(query).skip(skip).limit(limit)
    repos = await cursor.to_list(length=limit)
    
    # Additional filtering to ensure exact namespace match
    filtered_repos = []
    for repo in repos:
        repo_obj = SCMRepo(**repo)
        
        repo_namespace = None
        if repo_obj.path_with_namespace:
            parts = repo_obj.path_with_namespace.split('/')
            if len(parts) > 1:
                repo_namespace = '/'.join(parts[:-1])
        elif repo_obj.name_with_namespace:
            parts = repo_obj.name_with_namespace.split('/')
            if len(parts) > 1:
                repo_namespace = '/'.join(parts[:-1])
        
        if repo_namespace == namespace:
            filtered_repos.append(repo_obj)
    
    return filtered_repos

async def update_scm_repo(db: AsyncIOMotorDatabase, repo_id: str, repo_update: dict) -> Optional[SCMRepo]:
    """Update SCM repository by MongoDB ID."""
    if not ObjectId.is_valid(repo_id):
        return None
    
    repo_update["updated_at"] = datetime.utcnow()
    result = await db.user_scm_data.update_one(
        {"_id": ObjectId(repo_id)},
        {"$set": repo_update}
    )
    
    if result.modified_count:
        updated_repo = await db.user_scm_data.find_one({"_id": ObjectId(repo_id)})
        if updated_repo:
            return SCMRepo(**updated_repo)
    return None

async def delete_scm_repo(db: AsyncIOMotorDatabase, repo_id: str) -> bool:
    """Delete SCM repository by MongoDB ID."""
    if not ObjectId.is_valid(repo_id):
        return False
    
    result = await db.user_scm_data.delete_one({"_id": ObjectId(repo_id)})
    return result.deleted_count > 0
