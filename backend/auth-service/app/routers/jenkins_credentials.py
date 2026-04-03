from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from app.database.connection import get_db
from app.schemas.jenkins_credentials import (
    JenkinsCredentialsCreate, 
    JenkinsCredentialsResponse, 
    JenkinsCredentialsUpdate
)
from app.schemas.jenkins_data import (
    SyncJenkinsDataRequest,
    SyncJenkinsDataResponse
)
from app.crud import jenkins_credentials as crud_jenkins_credentials
from app.crud import jenkins_data as crud_jenkins_data
from app.services.jenkins_service import fetch_jenkins_data
from app.models.user import User
from app.auth.jwt import get_current_user

router = APIRouter(prefix="/api/jenkins", tags=["jenkins"])

@router.post("/credentials", response_model=JenkinsCredentialsResponse, status_code=status.HTTP_201_CREATED)
async def create_jenkins_credentials(
    jenkins_credentials: JenkinsCredentialsCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create new Jenkins credentials (requires authentication).
    
    Args:
        jenkins_credentials: JenkinsCredentialsCreate schema with Jenkins credentials data
        db: MongoDB database instance
        current_user: Authenticated user from JWT token
        
    Returns:
        Created Jenkins credentials response
    """
    try:
        created_credentials = await crud_jenkins_credentials.create_jenkins_credentials(
            db, 
            jenkins_credentials
        )
        print(f"✅ Jenkins credentials creation successful: {created_credentials.jenkins_url}")
        return JenkinsCredentialsResponse(
            id=str(created_credentials.id),
            jenkins_url=created_credentials.jenkins_url,
            username=created_credentials.username,
            token=created_credentials.token,
            type=created_credentials.type,
            user_name=created_credentials.user_name,
            created_at=created_credentials.created_at,
            updated_at=created_credentials.updated_at
        )
    except Exception as e:
        print(f"❌ Jenkins credentials creation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Jenkins credentials: {str(e)}"
        )

@router.get("/credentials", response_model=List[JenkinsCredentialsResponse], status_code=status.HTTP_200_OK)
async def get_all_jenkins_credentials(
    skip: int = 0,
    limit: int = 100,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all Jenkins credentials with pagination (requires authentication).
    
    Args:
        skip: Number of credentials to skip
        limit: Maximum number of credentials to return
        db: MongoDB database instance
        current_user: Authenticated user from JWT token
        
    Returns:
        List of Jenkins credentials responses
    """
    credentials_list = await crud_jenkins_credentials.get_all_jenkins_credentials(
        db, 
        skip=skip, 
        limit=limit
    )
    return [
        JenkinsCredentialsResponse(
            id=str(cred.id),
            jenkins_url=cred.jenkins_url,
            username=cred.username,
            token=cred.token,
            type=cred.type,
            user_name=cred.user_name,
            created_at=cred.created_at,
            updated_at=cred.updated_at
        )
        for cred in credentials_list
    ]

@router.get("/credentials/{credentials_id}", response_model=JenkinsCredentialsResponse, status_code=status.HTTP_200_OK)
async def get_jenkins_credentials(
    credentials_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get Jenkins credentials by ID (requires authentication).
    
    Args:
        credentials_id: Jenkins credentials ID
        db: MongoDB database instance
        current_user: Authenticated user from JWT token
        
    Returns:
        Jenkins credentials response
    """
    credentials = await crud_jenkins_credentials.get_jenkins_credentials(db, credentials_id)
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jenkins credentials not found"
        )
    
    return JenkinsCredentialsResponse(
        id=str(credentials.id),
        jenkins_url=credentials.jenkins_url,
        username=credentials.username,
        token=credentials.token,
        type=credentials.type,
        user_name=credentials.user_name,
        created_at=credentials.created_at,
        updated_at=credentials.updated_at
    )

@router.put("/credentials/{credentials_id}", response_model=JenkinsCredentialsResponse, status_code=status.HTTP_200_OK)
async def update_jenkins_credentials(
    credentials_id: str,
    credentials_update: JenkinsCredentialsUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update Jenkins credentials by ID (requires authentication).
    
    Args:
        credentials_id: Jenkins credentials ID
        credentials_update: JenkinsCredentialsUpdate schema with fields to update
        db: MongoDB database instance
        current_user: Authenticated user from JWT token
        
    Returns:
        Updated Jenkins credentials response
    """
    # Check if Jenkins credentials exist
    existing_credentials = await crud_jenkins_credentials.get_jenkins_credentials(db, credentials_id)
    if not existing_credentials:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jenkins credentials not found"
        )
    
    # Prepare update data (exclude None values)
    update_data = credentials_update.model_dump(exclude_unset=True)
    
    updated_credentials = await crud_jenkins_credentials.update_jenkins_credentials(
        db, 
        credentials_id, 
        update_data
    )
    if not updated_credentials:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jenkins credentials not found"
        )
    
    return JenkinsCredentialsResponse(
        id=str(updated_credentials.id),
        jenkins_url=updated_credentials.jenkins_url,
        username=updated_credentials.username,
        token=updated_credentials.token,
        type=updated_credentials.type,
        user_name=updated_credentials.user_name,
        created_at=updated_credentials.created_at,
        updated_at=updated_credentials.updated_at
    )

@router.delete("/credentials/{credentials_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_jenkins_credentials(
    credentials_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete Jenkins credentials by ID (requires authentication).
    
    Args:
        credentials_id: Jenkins credentials ID
        db: MongoDB database instance
        current_user: Authenticated user from JWT token
        
    Returns:
        No content on success
    """
    deleted = await crud_jenkins_credentials.delete_jenkins_credentials(db, credentials_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jenkins credentials not found"
        )
    
    return None

@router.post("/credentials/{jenkins_id}/sync-data", response_model=SyncJenkinsDataResponse, status_code=status.HTTP_200_OK)
async def sync_jenkins_data(
    jenkins_id: str,
    request: SyncJenkinsDataRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sync Jenkins data from Jenkins server using credentials.
    Fetches jobs, builds, nodes, and other Jenkins information and saves to database.
    
    Args:
        jenkins_id: Jenkins credentials ID from path
        request: SyncJenkinsDataRequest with jenkins_id and user_name
        db: MongoDB database instance
        current_user: Authenticated user from JWT token
        
    Returns:
        Sync response with count of synced data
    """
    try:
        # Validate jenkins_id from body matches path
        if request.jenkins_id != jenkins_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="jenkins_id in body must match jenkins_id in path"
            )
        
        # Fetch Jenkins credentials from database
        jenkins_credentials = await crud_jenkins_credentials.get_jenkins_credentials(db, jenkins_id)
        if not jenkins_credentials:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Jenkins credentials not found"
            )
        
        print(f"📝 Syncing Jenkins data for jenkins_id: {jenkins_id}, user_name: {request.user_name}")
        print(f"📝 Jenkins URL: {jenkins_credentials.jenkins_url}")
        
        # Fetch Jenkins data using Jenkins SDK
        jenkins_data = await fetch_jenkins_data(jenkins_credentials)
        
        if not jenkins_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch Jenkins data"
            )
        
        # Save Jenkins data to database
        saved_data = await crud_jenkins_data.create_jenkins_data(
            db=db,
            jenkins_id=jenkins_id,
            user_name=request.user_name,
            jenkins_data=jenkins_data
        )
        
        jobs_count = jenkins_data.get('jobs_count', 0)
        nodes_count = jenkins_data.get('nodes_count', 0)
        plugins_count = jenkins_data.get('plugins_count', 0)
        credentials_count = jenkins_data.get('credentials_count', 0)
        tools_count = jenkins_data.get('tools_count', 0)
        
        print(f"✅ Jenkins data synced successfully: {jobs_count} jobs, {nodes_count} nodes, {plugins_count} plugins, {credentials_count} credentials, {tools_count} tools")
        
        return SyncJenkinsDataResponse(
            message=f"Successfully synced Jenkins data: {jobs_count} jobs, {nodes_count} nodes, {plugins_count} plugins, {credentials_count} credentials, {tools_count} tools",
            jenkins_id=jenkins_id,
            user_name=request.user_name,
            jobs_count=jobs_count,
            nodes_count=nodes_count,
            plugins_count=plugins_count
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Sync Jenkins data error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync Jenkins data: {str(e)}"
        )

