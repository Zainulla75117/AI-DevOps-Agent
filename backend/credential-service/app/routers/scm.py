"""
SCM Credential CRUD Router (credential-service).
Only handles storage of SCM credentials (PATs and OAuth tokens).
Business logic (sync, repos, namespaces) is handled by scm-service.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from app.database.connection import get_db
from app.schemas.scm import SCMCreate, SCMResponse, SCMUpdate
from app.crud import scm as crud_scm
from app.auth.jwt import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api", tags=["scm"])


def _to_response(scm) -> SCMResponse:
    """Convert an SCM model to a response schema (DRY helper)."""
    return SCMResponse(
        id=str(scm.id),
        scm_name=scm.scm_name,
        username=scm.username,
        pat=scm.pat,
        base_url=scm.base_url,
        auth_type=getattr(scm, 'auth_type', 'pat'),
        oauth_scopes=getattr(scm, 'oauth_scopes', None),
        installation_id=getattr(scm, 'installation_id', None),
        user_id=getattr(scm, 'user_id', None),
        created_at=scm.created_at,
        updated_at=scm.updated_at
    )


@router.post("/scm/credentials", response_model=SCMResponse, status_code=status.HTTP_201_CREATED)
async def create_scm_credentials(
    scm: SCMCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create new SCM credentials (requires authentication).
    """
    try:
        created_scm = await crud_scm.create_scm(db, scm)
        print(f"✅ SCM credentials creation successful: {created_scm.scm_name}")
        return _to_response(created_scm)
    except Exception as e:
        print(f"❌ SCM credentials creation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create SCM credentials: {str(e)}"
        )

@router.get("/scm", response_model=List[SCMResponse], status_code=status.HTTP_200_OK)
async def get_scm_data(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all SCM credentials data (requires authentication).
    """
    scm_list = await crud_scm.get_all_scm(db, skip=0, limit=100)
    return [_to_response(scm) for scm in scm_list]

@router.get("/scm/credentials", response_model=List[SCMResponse], status_code=status.HTTP_200_OK)
async def get_all_scm_credentials(
    skip: int = 0,
    limit: int = 100,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all SCM credentials with pagination (requires authentication).
    """
    scm_list = await crud_scm.get_all_scm(db, skip=skip, limit=limit)
    return [_to_response(scm) for scm in scm_list]

@router.get("/scm/credentials/{scm_id}", response_model=SCMResponse, status_code=status.HTTP_200_OK)
async def get_scm_credentials(
    scm_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get SCM credentials by ID (requires authentication).
    """
    scm = await crud_scm.get_scm(db, scm_id)
    if not scm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM credentials not found"
        )
    
    return _to_response(scm)

@router.put("/scm/credentials/{scm_id}", response_model=SCMResponse, status_code=status.HTTP_200_OK)
async def update_scm_credentials(
    scm_id: str,
    scm_update: SCMUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update SCM credentials by ID (requires authentication).
    """
    existing_scm = await crud_scm.get_scm(db, scm_id)
    if not existing_scm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM credentials not found"
        )
    
    update_data = scm_update.model_dump(exclude_unset=True)
    
    updated_scm = await crud_scm.update_scm(db, scm_id, update_data)
    if not updated_scm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM credentials not found"
        )
    
    return _to_response(updated_scm)

@router.delete("/scm/credentials/{scm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scm_credentials(
    scm_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete SCM credentials by ID (requires authentication).
    Also cascade-deletes all synced repository data for this credential.
    """
    # Cascade: remove all synced repos that used this credential
    cascade_result = await db.user_scm_data.delete_many({"scm_id": scm_id})
    if cascade_result.deleted_count > 0:
        print(f"🗑️ Cascade-deleted {cascade_result.deleted_count} synced repos for scm_id={scm_id}")

    deleted = await crud_scm.delete_scm(db, scm_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM credentials not found"
        )
    
    return None
