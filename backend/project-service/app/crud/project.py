from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from app.models.project import Project
from app.schemas.project import ProjectCreate

async def create_project(db: AsyncIOMotorDatabase, project: ProjectCreate, owner_username: str) -> Project:
    project_dict = project.model_dump()
    project_dict["owner_username"] = owner_username
    project_dict["created_at"] = datetime.utcnow()
    result = await db.user_projects.insert_one(project_dict)
    created_project = await db.user_projects.find_one({"_id": result.inserted_id})
    return Project(**created_project)

async def get_project(db: AsyncIOMotorDatabase, project_id: str, owner_username: str) -> Optional[Project]:
    if not ObjectId.is_valid(project_id):
        return None
    project = await db.user_projects.find_one({"_id": ObjectId(project_id), "owner_username": owner_username})
    if project:
        return Project(**project)
    return None

async def get_all_projects(db: AsyncIOMotorDatabase, owner_username: str, skip: int = 0, limit: int = 100) -> List[Project]:
    cursor = db.user_projects.find({"owner_username": owner_username}).skip(skip).limit(limit)
    projects = await cursor.to_list(length=limit)
    return [Project(**project) for project in projects]

async def update_project(db: AsyncIOMotorDatabase, project_id: str, owner_username: str, project_update: dict) -> Optional[Project]:
    if not ObjectId.is_valid(project_id):
        return None
    project_update["updated_at"] = datetime.utcnow()
    result = await db.user_projects.update_one(
        {"_id": ObjectId(project_id), "owner_username": owner_username}, 
        {"$set": project_update}
    )
    if result.modified_count:
        updated_project = await db.user_projects.find_one({"_id": ObjectId(project_id)})
        if updated_project:
            return Project(**updated_project)
    return None

async def delete_project(db: AsyncIOMotorDatabase, project_id: str, owner_username: str) -> bool:
    if not ObjectId.is_valid(project_id):
        return False
    result = await db.user_projects.delete_one({"_id": ObjectId(project_id), "owner_username": owner_username})
    return result.deleted_count > 0
