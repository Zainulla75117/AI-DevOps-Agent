"""
Unified Infrastructure Resource API endpoints.

Replaces the former per-type endpoints (/network, /servers, /serverless, /cloud-managed)
with a single resource-oriented CRUD interface.

All endpoints require JWT authentication.
"""

import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional

from app.database.connection import get_db
from app.config import settings
from app.crud import infra_resource as crud_infra
from app.schemas.infra_resource import (
    InfraResourceCreate,
    InfraResourceUpdate,
    InfraResourceResponse,
    InfraVersionResponse,
    InfraExecutionCreate,
    InfraExecutionUpdate,
    InfraExecutionResponse,
    InfraResponse,
)
from app.auth.jwt import get_current_user
from app.models.user import User

logger = logging.getLogger("project-service.infra")

router = APIRouter(prefix="/api/infrastructure", tags=["infrastructure"])


# ═══════════════════════════════════════════════════════════════════════
#  INFRA-SERVICE CLEANUP HELPER
# ═══════════════════════════════════════════════════════════════════════

async def _notify_infra_cleanup(
    scope: str,
    target_id: str,
    request: Request,
    project_id: Optional[str] = None,
):
    """
    Best-effort call to infrastructure-service to clean up PostgreSQL
    after a MongoDB deletion. Non-blocking — if infra-service is down,
    MongoDB deletion still succeeds.

    Args:
        scope: "project" or "resource"
        target_id: The project_id or resource_id being deleted
        request: FastAPI Request (to forward the Authorization header)
        project_id: For resource scope, the parent project_id (for cache invalidation)
    """
    try:
        auth_header = request.headers.get("authorization", "")
        url = f"{settings.INFRA_SERVICE_URL}/api/infra/cleanup/{scope}/{target_id}"
        params = {}
        if scope == "resource" and project_id:
            params["project_id"] = project_id

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.delete(
                url,
                headers={"Authorization": auth_header},
                params=params,
            )
            if resp.status_code == 200:
                logger.info(f"✅ Infra cleanup [{scope}/{target_id}] succeeded: {resp.json()}")
            else:
                logger.warning(f"Infra cleanup [{scope}/{target_id}] returned {resp.status_code}: {resp.text[:200]}")
    except httpx.ConnectError:
        logger.warning(f"Infra cleanup [{scope}/{target_id}] skipped — infrastructure-service unreachable")
    except Exception as e:
        logger.warning(f"Infra cleanup [{scope}/{target_id}] failed (non-blocking): {e}")


# ═══════════════════════════════════════════════════════════════════════
#  RESOURCE CRUD
# ═══════════════════════════════════════════════════════════════════════

@router.post(
    "/resources",
    response_model=InfraResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_resource(
    data: InfraResourceCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new infrastructure resource (any type)."""
    try:
        changed_by = current_user.username if current_user else "system"
        resource = await crud_infra.create_resource(db, data, changed_by=changed_by)
        return InfraResponse(
            id=str(resource.id),
            message=f"{data.type.capitalize()} resource '{data.name}' created successfully!",
            type=data.type,
            data=resource.model_dump(),
        )
    except Exception as e:
        print(f"❌ Resource creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/resources/project/{project_id}",
    response_model=List[InfraResourceResponse],
    status_code=status.HTTP_200_OK,
)
async def get_resources_by_project(
    project_id: str,
    type: Optional[str] = Query(None, description="Filter by resource type"),
    env: Optional[str] = Query(None, description="Filter by environment"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all resources for a project, optionally filtered by type/env."""
    try:
        resources = await crud_infra.get_resources_by_project(
            db, project_id, resource_type=type, env=env
        )
        return [
            InfraResourceResponse(
                id=str(r.id),
                project_id=str(r.project_id) if r.project_id else None,
                type=r.type,
                name=r.name,
                provider=r.provider,
                region=r.region,
                env=r.env,
                config=r.config,
                actual_state=r.actual_state,
                state=r.state,
                version=r.version,
                depends_on=[str(d) for d in r.depends_on] if r.depends_on else [],
                created_at=r.created_at,
                updated_at=r.updated_at,
                last_applied_at=r.last_applied_at,
                last_applied_by=r.last_applied_by,
            )
            for r in resources
        ]
    except Exception as e:
        print(f"❌ Fetching resources error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/resources/{resource_id}",
    response_model=InfraResourceResponse,
    status_code=status.HTTP_200_OK,
)
async def get_resource(
    resource_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single resource by ID."""
    resource = await crud_infra.get_resource(db, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return InfraResourceResponse(
        id=str(resource.id),
        project_id=str(resource.project_id) if resource.project_id else None,
        type=resource.type,
        name=resource.name,
        provider=resource.provider,
        region=resource.region,
        env=resource.env,
        config=resource.config,
        actual_state=resource.actual_state,
        state=resource.state,
        version=resource.version,
        depends_on=[str(d) for d in resource.depends_on] if resource.depends_on else [],
        created_at=resource.created_at,
        updated_at=resource.updated_at,
        last_applied_at=resource.last_applied_at,
        last_applied_by=resource.last_applied_by,
    )


@router.put(
    "/resources/{resource_id}",
    response_model=InfraResourceResponse,
    status_code=status.HTTP_200_OK,
)
async def update_resource(
    resource_id: str,
    data: InfraResourceUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a resource's config/state and auto-bump version."""
    resource = await crud_infra.update_resource(db, resource_id, data)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return InfraResourceResponse(
        id=str(resource.id),
        project_id=str(resource.project_id) if resource.project_id else None,
        type=resource.type,
        name=resource.name,
        provider=resource.provider,
        region=resource.region,
        env=resource.env,
        config=resource.config,
        actual_state=resource.actual_state,
        state=resource.state,
        version=resource.version,
        depends_on=[str(d) for d in resource.depends_on] if resource.depends_on else [],
        created_at=resource.created_at,
        updated_at=resource.updated_at,
        last_applied_at=resource.last_applied_at,
        last_applied_by=resource.last_applied_by,
    )


@router.delete(
    "/resources/{resource_id}",
    status_code=status.HTTP_200_OK,
)
async def delete_resource(
    resource_id: str,
    request: Request,
    project_id: Optional[str] = Query(None, description="Parent project ID for cache invalidation"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a single resource.
    Returns 200 with result — will refuse if other resources depend on it.
    Also notifies infrastructure-service to invalidate PostgreSQL caches.
    """
    # If project_id not in query, try to look it up from the resource
    lookup_project_id = project_id
    if not lookup_project_id:
        resource = await crud_infra.get_resource(db, resource_id)
        if resource and resource.project_id:
            lookup_project_id = str(resource.project_id)

    result = await crud_infra.delete_resource(db, resource_id)
    if not result.get("deleted"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=result.get("reason", "Cannot delete resource"),
        )

    # Notify infrastructure-service to clean up PostgreSQL (best-effort)
    await _notify_infra_cleanup("resource", resource_id, request, project_id=lookup_project_id)

    return {"message": "Resource deleted successfully"}


@router.delete(
    "/resources/project/{project_id}",
    status_code=status.HTTP_200_OK,
)
async def delete_resources_by_project(
    project_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete ALL resources (and their versions) for a project. Also cleans up PostgreSQL."""
    count = await crud_infra.delete_resources_by_project(db, project_id)

    # Notify infrastructure-service to archive + clean up PostgreSQL (best-effort)
    await _notify_infra_cleanup("project", project_id, request)

    return {"message": f"Deleted {count} resources", "deleted_count": count}


# ═══════════════════════════════════════════════════════════════════════
#  VERSION HISTORY
# ═══════════════════════════════════════════════════════════════════════

@router.get(
    "/resources/{resource_id}/versions",
    response_model=List[InfraVersionResponse],
    status_code=status.HTTP_200_OK,
)
async def get_resource_versions(
    resource_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch version history for a resource (newest first)."""
    versions = await crud_infra.get_resource_versions(db, resource_id)
    return [
        InfraVersionResponse(
            id=str(v.id),
            resource_id=str(v.resource_id),
            version=v.version,
            config=v.config,
            changed_by=v.changed_by,
            change_reason=v.change_reason,
            created_at=v.created_at,
        )
        for v in versions
    ]


# ═══════════════════════════════════════════════════════════════════════
#  DEPENDENCY GRAPH
# ═══════════════════════════════════════════════════════════════════════

@router.get(
    "/resources/project/{project_id}/graph",
    status_code=status.HTTP_200_OK,
)
async def get_dependency_graph(
    project_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Build and return the dependency graph for all resources in a project."""
    graph = await crud_infra.get_dependency_graph(db, project_id)
    return {"project_id": project_id, "nodes": graph}


# ═══════════════════════════════════════════════════════════════════════
#  EXECUTIONS
# ═══════════════════════════════════════════════════════════════════════

@router.post(
    "/executions",
    response_model=InfraExecutionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_execution(
    data: InfraExecutionCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new execution run for provisioning."""
    execution = await crud_infra.create_execution(db, data)
    return InfraExecutionResponse(
        id=str(execution.id),
        project_id=str(execution.project_id),
        execution_id=execution.execution_id,
        status=execution.status,
        resources=[str(r) for r in execution.resources] if execution.resources else [],
        logs=execution.logs,
        started_at=execution.started_at,
        ended_at=execution.ended_at,
    )


@router.get(
    "/executions/{execution_id}",
    response_model=InfraExecutionResponse,
    status_code=status.HTTP_200_OK,
)
async def get_execution(
    execution_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get execution details by execution_id."""
    execution = await crud_infra.get_execution(db, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return InfraExecutionResponse(
        id=str(execution.id),
        project_id=str(execution.project_id),
        execution_id=execution.execution_id,
        status=execution.status,
        resources=[str(r) for r in execution.resources] if execution.resources else [],
        logs=execution.logs,
        started_at=execution.started_at,
        ended_at=execution.ended_at,
    )


@router.put(
    "/executions/{execution_id}",
    response_model=InfraExecutionResponse,
    status_code=status.HTTP_200_OK,
)
async def update_execution(
    execution_id: str,
    data: InfraExecutionUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update execution status and/or append log entries."""
    execution = await crud_infra.update_execution(db, execution_id, data)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return InfraExecutionResponse(
        id=str(execution.id),
        project_id=str(execution.project_id),
        execution_id=execution.execution_id,
        status=execution.status,
        resources=[str(r) for r in execution.resources] if execution.resources else [],
        logs=execution.logs,
        started_at=execution.started_at,
        ended_at=execution.ended_at,
    )
