from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from app.models.project import Project
from app.schemas.project import ProjectCreate

async def create_project(db: AsyncIOMotorDatabase, project: ProjectCreate) -> Project:
    project_dict = project.model_dump()
    project_dict["created_at"] = datetime.utcnow()
    result = await db.user_projects.insert_one(project_dict)
    created_project = await db.user_projects.find_one({"_id": result.inserted_id})
    return Project(**created_project)

async def get_project(db: AsyncIOMotorDatabase, project_id: str) -> Optional[Project]:
    if not ObjectId.is_valid(project_id):
        return None
    project = await db.user_projects.find_one({"_id": ObjectId(project_id)})
    if project:
        return Project(**project)
    return None

async def get_all_projects(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100) -> List[Project]:
    cursor = db.user_projects.find().skip(skip).limit(limit)
    projects = await cursor.to_list(length=limit)
    return [Project(**project) for project in projects]

async def update_project(db: AsyncIOMotorDatabase, project_id: str, project_update: dict) -> Optional[Project]:
    if not ObjectId.is_valid(project_id):
        return None
    project_update["updated_at"] = datetime.utcnow()
    result = await db.user_projects.update_one({"_id": ObjectId(project_id)}, {"$set": project_update})
    if result.modified_count:
        updated_project = await db.user_projects.find_one({"_id": ObjectId(project_id)})
        if updated_project:
            return Project(**updated_project)
    return None

async def delete_project(db: AsyncIOMotorDatabase, project_id: str) -> bool:
    if not ObjectId.is_valid(project_id):
        return False
    result = await db.user_projects.delete_one({"_id": ObjectId(project_id)})
    return result.deleted_count > 0
