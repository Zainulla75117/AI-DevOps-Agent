"""
Cleanup endpoints.
"""
from typing import Optional
from fastapi import APIRouter, Header, Query, HTTPException
import logging

from app.auth import require_auth
from app.schemas.response_schemas import CleanupResponse, DeletedHistoryResponse
from app.services.session_manager import session_manager
from postgres import conversation_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/infra")

@router.delete("/cleanup/project/{project_id}", response_model=CleanupResponse)
async def cleanup_project_infra(
    project_id: str,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    require_auth(token, authorization)

    result = await conversation_store.archive_infra_and_cleanup(project_id)

    purged_sessions = session_manager.purge_project_sessions(project_id)

    return {
        "status": "cleaned",
        "project_id": project_id,
        "summaries_deleted": result.get("summaries_deleted", 0),
        "memory_cleaned": result.get("memory_cleaned", []),
        "sessions_purged": purged_sessions,
        "infra_state_invalidated": False
    }

@router.delete("/cleanup/resource/{resource_id}", response_model=CleanupResponse)
async def cleanup_resource_infra(
    resource_id: str,
    project_id: Optional[str] = Query(None, description="Project ID for session purge"),
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    require_auth(token, authorization)

    memory_deleted = 0
    purged_sessions = 0

    if project_id:
        memory_deleted = await conversation_store.delete_project_memory_by_type(
            project_id, "infra_state"
        )
        purged_sessions = session_manager.purge_project_sessions(project_id)

    return {
        "status": "cleaned",
        "resource_id": resource_id,
        "summaries_deleted": 0,
        "memory_cleaned": [],
        "infra_state_invalidated": memory_deleted > 0,
        "sessions_purged": purged_sessions,
    }

@router.get("/deleted-history/{project_id}", response_model=DeletedHistoryResponse)
async def get_deleted_infra_history(
    project_id: str,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    require_auth(token, authorization)
    record = await conversation_store.get_project_memory_by_type(project_id, "deleted_infra_history")

    if not record:
        return {"has_history": False, "history": None}

    return {
        "has_history": True,
        "history": {
            "content": record.get("content", ""),
            "deleted_at": record.get("structured_data", {}).get("deleted_at"),
            "original_data": record.get("structured_data", {}).get("original_data", {}),
            "updated_at": record.get("updated_at").isoformat() if record.get("updated_at") else None,
        },
    }
