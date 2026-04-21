from fastapi import APIRouter, Depends, HTTPException, status
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
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        created_project = await crud_project.create_project(db, project, current_user.username)
        print(f"✅ Project creation successful: {created_project.project_name}")
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
        created_at=updated_project.created_at, updated_at=updated_project.updated_at
    )

@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str, 
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    deleted = await crud_project.delete_project(db, project_id, current_user.username)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return None
