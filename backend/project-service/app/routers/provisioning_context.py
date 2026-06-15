from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.connection import get_db
from app.schemas.provisioning_context import ProvisioningContextCreate, ProvisioningContextResponse
from app.crud import provisioning_context as crud_provisioning_context
from app.auth.jwt import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/projects/{project_id}/provision-context", tags=["provisioning-context"])

@router.post("", response_model=ProvisioningContextResponse, status_code=status.HTTP_201_CREATED)
async def create_provisioning_context(
    project_id: str,
    context_in: ProvisioningContextCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if project_id != context_in.project_id:
        raise HTTPException(status_code=400, detail="Project ID mismatch")
        
    created = await crud_provisioning_context.create_provisioning_context(db, context_in)
    return ProvisioningContextResponse(
        id=str(created.id),
        project_id=created.project_id,
        session_id=created.session_id,
        resources=created.resources,
        status=created.status,
        created_at=created.created_at,
        updated_at=created.updated_at
    )

@router.get("", response_model=Optional[ProvisioningContextResponse])
async def get_latest_provisioning_context(
    project_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    context = await crud_provisioning_context.get_latest_provisioning_context(db, project_id)
    if not context:
        return None
        
    return ProvisioningContextResponse(
        id=str(context.id),
        project_id=context.project_id,
        session_id=context.session_id,
        resources=context.resources,
        status=context.status,
        created_at=context.created_at,
        updated_at=context.updated_at
    )
