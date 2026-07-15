"""
MongoDB CRUD operations for repo analysis documents.

Collection: repo_analyses — stores structured repo analysis results.
"""

from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime


async def upsert_repo_analysis(db: AsyncIOMotorDatabase, analysis: Dict[str, Any]) -> Dict[str, Any]:
    """
    Insert or update a repo analysis document.
    Uses repo_id + user_id as the unique key for upsert.
    """
    repo_id = analysis["repo_id"]
    user_id = analysis["user_id"]

    # Remove dep_file_contents from storage (can be large, and we have the parsed deps)
    storage_doc = {k: v for k, v in analysis.items() if k != "dep_file_contents"}

    result = await db.repo_analyses.find_one_and_update(
        {"repo_id": repo_id, "user_id": user_id},
        {"$set": {**storage_doc, "updated_at": datetime.utcnow()}},
        upsert=True,
        return_document=True,
    )

    print(f"✅ Repo analysis upserted for {analysis.get('repo_name', repo_id)}")
    return result


async def get_repo_analysis(
    db: AsyncIOMotorDatabase,
    repo_id: str,
    user_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Get the latest repo analysis by repo_id."""
    query: Dict[str, Any] = {"repo_id": str(repo_id)}
    if user_id:
        query["user_id"] = user_id

    doc = await db.repo_analyses.find_one(
        query,
        sort=[("updated_at", -1)],
    )

    if doc:
        doc["_id"] = str(doc["_id"])
    return doc


async def get_repo_analysis_by_project(
    db: AsyncIOMotorDatabase,
    project_id: str,
) -> Optional[Dict[str, Any]]:
    """Get repo analysis linked to a project."""
    doc = await db.repo_analyses.find_one(
        {"project_id": project_id, "status": "ready"},
        sort=[("updated_at", -1)],
    )
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc


async def delete_repo_analysis(
    db: AsyncIOMotorDatabase,
    repo_id: str,
    user_id: Optional[str] = None,
) -> bool:
    """Delete repo analysis by repo_id."""
    query: Dict[str, Any] = {"repo_id": str(repo_id)}
    if user_id:
        query["user_id"] = user_id

    result = await db.repo_analyses.delete_many(query)
    return result.deleted_count > 0


async def link_analysis_to_project(
    db: AsyncIOMotorDatabase,
    repo_id: str,
    project_id: str,
    user_id: str,
) -> bool:
    """Link a repo analysis to a project."""
    result = await db.repo_analyses.update_one(
        {"repo_id": str(repo_id), "user_id": user_id},
        {"$set": {"project_id": project_id, "updated_at": datetime.utcnow()}},
    )
    return result.modified_count > 0


async def ensure_indexes(db: AsyncIOMotorDatabase):
    """Create indexes for the repo_analyses collection."""
    await db.repo_analyses.create_index(
        [("repo_id", 1), ("user_id", 1)],
        unique=True,
        name="uq_repo_analysis_per_user",
        background=True,
    )
    await db.repo_analyses.create_index(
        [("project_id", 1)],
        name="idx_analysis_project",
        background=True,
    )
    await db.repo_analyses.create_index(
        [("status", 1)],
        name="idx_analysis_status",
        background=True,
    )
    print("✅ [repo_analyses] Indexes ensured")
