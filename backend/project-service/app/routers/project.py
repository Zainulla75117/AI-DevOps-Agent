from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
import httpx
import asyncio
from app.config import settings
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from app.database.connection import get_db
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.crud import project as crud_project
from app.models.project import Project
from app.auth.jwt import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api", tags=["projects"])

@router.post("/create/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project: ProjectCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        created_project = await crud_project.create_project(db, project, current_user.username)
        print(f"✅ Project creation successful: {created_project.project_name}")
        
        # Trigger SCM sync for linked repositories
        if created_project.linked_repositories:
            auth_header = request.headers.get("Authorization")
            if auth_header:
                async def trigger_sync(repos, auth):
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        for repo in repos:
                            if repo.repo_id:
                                try:
                                    await client.post(
                                        f"{settings.SCM_SERVICE_URL}/api/scm/repos/{repo.repo_id}/sync",
                                        headers={"Authorization": auth}
                                    )
                                    print(f"✅ Triggered sync for repo {repo.repo_id}")
                                except Exception as e:
                                    print(f"❌ Failed to trigger sync for repo {repo.repo_id}: {e}")
                
                background_tasks.add_task(trigger_sync, created_project.linked_repositories, auth_header)
        return ProjectResponse(
            id=str(created_project.id),
            project_name=created_project.project_name,
            owner_username=created_project.owner_username,
            description=created_project.description,
            domain=created_project.domain,
            platform=created_project.platform,
            cloud_provider=created_project.cloud_provider,
            region=created_project.region,
            iam_name=created_project.iam_name,
            environment=created_project.environment,
            expected_traffic=created_project.expected_traffic,
            cost_preference=created_project.cost_preference,
            linked_repositories=[repo.model_dump() for repo in created_project.linked_repositories] if created_project.linked_repositories else [],
            created_at=created_project.created_at,
            updated_at=created_project.updated_at
        )
    except Exception as e:
        print(f"❌ Project creation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create project: {str(e)}"
        )

@router.get("/projects/view", response_model=List[ProjectResponse], status_code=status.HTTP_200_OK)
async def get_projects(
    skip: int = 0,
    limit: int = 100,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    projects = await crud_project.get_all_projects(db, current_user.username, skip=skip, limit=limit)
    return [
        ProjectResponse(
            id=str(project.id),
            project_name=project.project_name,
            owner_username=project.owner_username,
            description=project.description,
            domain=project.domain,
            platform=project.platform,
            cloud_provider=project.cloud_provider,
            region=project.region,
            iam_name=project.iam_name,
            environment=project.environment,
            expected_traffic=project.expected_traffic,
            cost_preference=project.cost_preference,
            linked_repositories=[repo.model_dump() for repo in project.linked_repositories] if project.linked_repositories else [],
            created_at=project.created_at,
            updated_at=project.updated_at
        )
        for project in projects
    ]

@router.get("/projects/{project_id}", response_model=ProjectResponse, status_code=status.HTTP_200_OK)
async def get_project(
    project_id: str, 
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = await crud_project.get_project(db, project_id, current_user.username)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return ProjectResponse(
        id=str(project.id), project_name=project.project_name, owner_username=project.owner_username, description=project.description,
        domain=project.domain, platform=project.platform, cloud_provider=project.cloud_provider,
        region=project.region, iam_name=project.iam_name, environment=project.environment,
        expected_traffic=project.expected_traffic, cost_preference=project.cost_preference,
        linked_repositories=[repo.model_dump() for repo in project.linked_repositories] if project.linked_repositories else [],
        created_at=project.created_at, updated_at=project.updated_at
    )

@router.put("/projects/{project_id}", response_model=ProjectResponse, status_code=status.HTTP_200_OK)
async def update_project(
    project_id: str, 
    project_update: ProjectUpdate, 
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing_project = await crud_project.get_project(db, project_id, current_user.username)
    if not existing_project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    update_data = project_update.model_dump(exclude_unset=True)
    updated_project = await crud_project.update_project(db, project_id, current_user.username, update_data)
    if not updated_project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return ProjectResponse(
        id=str(updated_project.id), project_name=updated_project.project_name, owner_username=updated_project.owner_username, description=updated_project.description,
        domain=updated_project.domain, platform=updated_project.platform, cloud_provider=updated_project.cloud_provider,
        region=updated_project.region, iam_name=updated_project.iam_name, environment=updated_project.environment,
        expected_traffic=updated_project.expected_traffic, cost_preference=updated_project.cost_preference,
        linked_repositories=[repo.model_dump() for repo in updated_project.linked_repositories] if updated_project.linked_repositories else [],
        created_at=updated_project.created_at, updated_at=updated_project.updated_at
    )

@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str, 
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Guard: block deletion if infrastructure resources still exist
    from bson import ObjectId as _OID
    if _OID.is_valid(project_id):
        resource_count = await db.infra_resources.count_documents({"project_id": _OID(project_id)})
        if resource_count > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete project: {resource_count} infrastructure resource(s) still exist. Delete all resources first."
            )

    deleted = await crud_project.delete_project(db, project_id, current_user.username)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return None
