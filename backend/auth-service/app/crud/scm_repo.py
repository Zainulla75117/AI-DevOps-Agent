from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from app.models.scm_repo import SCMRepo
from app.schemas.scm_repo import SCMRepoCreate

async def create_scm_repo(db: AsyncIOMotorDatabase, repo: SCMRepoCreate) -> SCMRepo:
    """
    Create new SCM repository data in the database.
    
    Args:
        db: MongoDB database instance
        repo: SCMRepoCreate schema with repository data
        
    Returns:
        Created SCMRepo model
    """
    try:
        from app.config import settings
        
        repo_dict = repo.model_dump()
        # Rename 'id' to 'repo_id' to avoid conflict with MongoDB _id
        repo_dict["repo_id"] = repo_dict.pop("id")
        repo_dict["created_at"] = datetime.utcnow()
        
        print(f"📝 Attempting to insert SCM repo into database: {settings.DATABASE_NAME}")
        print(f"📝 Collection name: user_scm_data")
        print(f"📝 Repo data: {repo_dict}")
        
        # Insert into the user_scm_data collection
        result = await db.user_scm_data.insert_one(repo_dict)
        
        print(f"📝 Insert result: {result.inserted_id}")
        print(f"📝 Acknowledged: {result.acknowledged}")
        
        if not result.inserted_id:
            raise Exception("Failed to insert SCM repo - no inserted_id returned")
        
        # Verify the insert by finding the document
        created_repo = await db.user_scm_data.find_one({"_id": result.inserted_id})
        
        if not created_repo:
            raise Exception(f"SCM repo inserted but not found with id: {result.inserted_id}")
        
        # Verify document count
        count = await db.user_scm_data.count_documents({})
        print(f"✅ SCM repo created successfully with ID: {result.inserted_id}")
        print(f"✅ Total documents in collection: {count}")
        print(f"✅ Database: {settings.DATABASE_NAME}, Collection: user_scm_data")
        
        return SCMRepo(**created_repo)
    except Exception as e:
        print(f"❌ Error creating SCM repo: {e}")
        print(f"❌ Repo data: {repo_dict}")
        import traceback
        traceback.print_exc()
        raise

async def get_scm_repo(db: AsyncIOMotorDatabase, repo_id: str) -> Optional[SCMRepo]:
    """
    Get SCM repository by MongoDB ID.
    
    Args:
        db: MongoDB database instance
        repo_id: MongoDB document ID as string
        
    Returns:
        SCMRepo model if found, None otherwise
    """
    if not ObjectId.is_valid(repo_id):
        return None
    
    repo = await db.user_scm_data.find_one({"_id": ObjectId(repo_id)})
    if repo:
        return SCMRepo(**repo)
    return None

async def get_scm_repo_by_repo_id(db: AsyncIOMotorDatabase, repo_id: int) -> Optional[SCMRepo]:
    """
    Get SCM repository by GitLab/GitHub repository ID.
    
    Args:
        db: MongoDB database instance
        repo_id: GitLab/GitHub repository ID
        
    Returns:
        SCMRepo model if found, None otherwise
    """
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
    A repository is considered duplicate if it has the same:
    - repo_id (from SCM)
    - scm_provider (gitlab, github, bitbucket)
    - scm_id (SCM credentials ID)
    - user_id (user who owns it)
    
    Args:
        db: MongoDB database instance
        repo_id: GitLab/GitHub repository ID
        scm_provider: SCM provider name
        scm_id: SCM credentials ID
        user_id: User ID
        
    Returns:
        SCMRepo model if found (duplicate), None otherwise
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
    """
    Get all SCM repositories for a specific user.
    
    Args:
        db: MongoDB database instance
        username: Username to filter by
        user_id: User ID to filter by
        
    Returns:
        List of SCMRepo models
    """
    query = {}
    if username:
        query["username"] = username
    if user_id:
        query["user_id"] = user_id
    
    cursor = db.user_scm_data.find(query)
    repos = await cursor.to_list(length=1000)
    return [SCMRepo(**repo) for repo in repos]

async def get_all_scm_repos(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100) -> List[SCMRepo]:
    """
    Get all SCM repositories with pagination.
    
    Args:
        db: MongoDB database instance
        skip: Number of documents to skip
        limit: Maximum number of documents to return
        
    Returns:
        List of SCMRepo models
    """
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
    """
    Get SCM repositories filtered by namespace.
    Namespace is everything before the last '/' in name_with_namespace or path_with_namespace.
    
    Args:
        db: MongoDB database instance
        namespace: Namespace to filter by (e.g., "ryvyl/zcart/be")
        user_id: Optional user_id to filter by
        skip: Number of documents to skip
        limit: Maximum number of documents to return
        
    Returns:
        List of SCMRepo models matching the namespace
    """
    query = {}
    
    # Add user_id filter if provided
    if user_id:
        query["user_id"] = user_id
    
    # Fetch all matching repositories (we'll filter by namespace in Python)
    # MongoDB regex can be used, but we need to match the namespace prefix
    # We'll use a regex pattern that matches repositories starting with namespace/
    namespace_pattern = f"^{namespace}/"
    
    # Build query with $or to check both name_with_namespace and path_with_namespace
    query["$or"] = [
        {"name_with_namespace": {"$regex": namespace_pattern, "$options": "i"}},
        {"path_with_namespace": {"$regex": namespace_pattern, "$options": "i"}}
    ]
    
    cursor = db.user_scm_data.find(query).skip(skip).limit(limit)
    repos = await cursor.to_list(length=limit)
    
    # Additional filtering to ensure exact namespace match (everything before last /)
    filtered_repos = []
    for repo in repos:
        repo_obj = SCMRepo(**repo)
        
        # Extract namespace from name_with_namespace or path_with_namespace
        repo_namespace = None
        if repo_obj.path_with_namespace:
            parts = repo_obj.path_with_namespace.split('/')
            if len(parts) > 1:
                repo_namespace = '/'.join(parts[:-1])
        elif repo_obj.name_with_namespace:
            parts = repo_obj.name_with_namespace.split('/')
            if len(parts) > 1:
                repo_namespace = '/'.join(parts[:-1])
        
        # Only include if namespace matches exactly
        if repo_namespace == namespace:
            filtered_repos.append(repo_obj)
    
    return filtered_repos

async def update_scm_repo(db: AsyncIOMotorDatabase, repo_id: str, repo_update: dict) -> Optional[SCMRepo]:
    """
    Update SCM repository by MongoDB ID.
    
    Args:
        db: MongoDB database instance
        repo_id: MongoDB document ID as string
        repo_update: Dictionary with fields to update
        
    Returns:
        Updated SCMRepo model if found, None otherwise
    """
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
    """
    Delete SCM repository by MongoDB ID.
    
    Args:
        db: MongoDB database instance
        repo_id: MongoDB document ID as string
        
    Returns:
        True if repository was deleted, False otherwise
    """
    if not ObjectId.is_valid(repo_id):
        return False
    
    result = await db.user_scm_data.delete_one({"_id": ObjectId(repo_id)})
    return result.deleted_count > 0

