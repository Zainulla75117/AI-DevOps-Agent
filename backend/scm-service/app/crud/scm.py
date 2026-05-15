"""
Read-only SCM credential access for scm-service.
Credential CRUD (create/update/delete) is handled by credential-service.
"""

from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from app.models.scm import SCM


async def get_scm(db: AsyncIOMotorDatabase, scm_id: str) -> Optional[SCM]:
    """
    Get SCM credentials by ID (read-only).
    
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
    Get all SCM credentials with pagination (read-only).
    
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
