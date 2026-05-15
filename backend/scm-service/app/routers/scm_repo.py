from fastapi import APIRouter, Depends, HTTPException, status, Body, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional, Dict, Any
from app.database.connection import get_db
from app.schemas.scm_repo import SCMRepoCreate, SCMRepoResponse, SCMRepoUpdate
from app.crud import scm_repo as crud_scm_repo
from app.crud import scm as crud_scm
from app.models.scm_repo import SCMRepo
from app.services.scm_service import fetch_repository_tree, download_and_extract_repo_zip
from app.auth.jwt import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api", tags=["scm-repos"])

def normalize_gitlab_value(value: Any) -> Optional[str]:
    """Normalize GitLab values (handle 'null', 'true', 'false' as strings)."""
    if value is None:
        return None
    if isinstance(value, str):
        if value.lower() == 'null':
            return None
        if value.lower() == 'true':
            return 'true'
        if value.lower() == 'false':
            return 'false'
        return value
    return str(value) if value is not None else None

def transform_gitlab_response(gitlab_data: Dict[str, Any], username: Optional[str] = None, user_id: Optional[str] = None) -> SCMRepoCreate:
    """Transform GitLab API response to SCMRepoCreate schema."""
    return SCMRepoCreate(
        id=int(gitlab_data.get("id", 0)),
        description=normalize_gitlab_value(gitlab_data.get("description")),
        name=gitlab_data.get("name", ""),
        name_with_namespace=gitlab_data.get("name_with_namespace", ""),
        default_branch=normalize_gitlab_value(gitlab_data.get("default_branch")),
        http_url_to_repo=gitlab_data.get("http_url_to_repo", ""),
        username=username,
        user_id=user_id
    )

@router.post("/scm/repos", response_model=SCMRepoResponse, status_code=status.HTTP_201_CREATED)
async def create_scm_repo(
    repo_data: Dict[str, Any] = Body(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create new SCM repository data from GitLab/GitHub response (requires authentication).
    """
    try:
        repo = transform_gitlab_response(
            repo_data,
            username=current_user.username,
            user_id=str(current_user.id)
        )
        
        created_repo = await crud_scm_repo.create_scm_repo(db, repo)
        print(f"✅ SCM repo creation successful: {created_repo.name}")
        return SCMRepoResponse(
            id=str(created_repo.id),
            repo_id=created_repo.repo_id,
            description=created_repo.description,
            name=created_repo.name,
            name_with_namespace=created_repo.name_with_namespace,
            default_branch=created_repo.default_branch,
            http_url_to_repo=created_repo.http_url_to_repo,
            username=created_repo.username,
            user_id=created_repo.user_id,
            scm_provider=created_repo.scm_provider,
            scm_id=created_repo.scm_id,
            base_url=created_repo.base_url,
            web_url=created_repo.web_url,
            ssh_url_to_repo=created_repo.ssh_url_to_repo,
            visibility=created_repo.visibility,
            is_archived=created_repo.is_archived,
            is_fork=created_repo.is_fork,
            path=created_repo.path,
            path_with_namespace=created_repo.path_with_namespace,
            star_count=created_repo.star_count,
            fork_count=created_repo.fork_count,
            repo_created_at=created_repo.repo_created_at,
            repo_updated_at=created_repo.repo_updated_at,
            last_activity_at=created_repo.last_activity_at,
            created_at=created_repo.created_at,
            updated_at=created_repo.updated_at,
            last_synced_at=getattr(created_repo, 'last_synced_at', None)
        )
    except Exception as e:
        print(f"❌ SCM repo creation error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create SCM repo: {str(e)}"
        )

@router.get("/scm/repos", response_model=List[SCMRepoResponse], status_code=status.HTTP_200_OK)
async def get_all_scm_repos(
    skip: int = 0,
    limit: int = 100,
    username: Optional[str] = None,
    user_id: Optional[str] = None,
    namespace: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all SCM repositories (requires authentication).
    Can filter by username, user_id, or namespace.
    """
    filter_user_id = user_id or str(current_user.id)
    
    if namespace:
        repos = await crud_scm_repo.get_scm_repos_by_namespace(
            db=db,
            namespace=namespace,
            user_id=filter_user_id,
            skip=skip,
            limit=limit
        )
    elif username or user_id:
        repos = await crud_scm_repo.get_scm_repos_by_user(db, username=username, user_id=filter_user_id)
    else:
        repos = await crud_scm_repo.get_scm_repos_by_user(db, user_id=filter_user_id)
    
    return [
        SCMRepoResponse(
            id=str(repo.id),
            repo_id=repo.repo_id,
            description=repo.description,
            name=repo.name,
            name_with_namespace=repo.name_with_namespace,
            default_branch=repo.default_branch,
            http_url_to_repo=repo.http_url_to_repo,
            username=repo.username,
            user_id=repo.user_id,
            scm_provider=repo.scm_provider,
            scm_id=repo.scm_id,
            base_url=repo.base_url,
            web_url=repo.web_url,
            ssh_url_to_repo=repo.ssh_url_to_repo,
            visibility=repo.visibility,
            is_archived=repo.is_archived,
            is_fork=repo.is_fork,
            path=repo.path,
            path_with_namespace=repo.path_with_namespace,
            star_count=repo.star_count,
            fork_count=repo.fork_count,
            repo_created_at=repo.repo_created_at,
            repo_updated_at=repo.repo_updated_at,
            last_activity_at=repo.last_activity_at,
            created_at=repo.created_at,
            updated_at=repo.updated_at,
            last_synced_at=getattr(repo, 'last_synced_at', None)
        )
        for repo in repos
    ]

@router.get("/scm/repos/{repo_id}", response_model=SCMRepoResponse, status_code=status.HTTP_200_OK)
async def get_scm_repo(
    repo_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get SCM repository by MongoDB ID (requires authentication)."""
    repo = await crud_scm_repo.get_scm_repo(db, repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM repository not found"
        )
    
    return SCMRepoResponse(
        id=str(repo.id),
        repo_id=repo.repo_id,
        description=repo.description,
        name=repo.name,
        name_with_namespace=repo.name_with_namespace,
        default_branch=repo.default_branch,
        http_url_to_repo=repo.http_url_to_repo,
        username=repo.username,
        user_id=repo.user_id,
        scm_provider=repo.scm_provider,
        scm_id=repo.scm_id,
        base_url=repo.base_url,
        web_url=repo.web_url,
        ssh_url_to_repo=repo.ssh_url_to_repo,
        visibility=repo.visibility,
        is_archived=repo.is_archived,
        is_fork=repo.is_fork,
        path=repo.path,
        path_with_namespace=repo.path_with_namespace,
        star_count=repo.star_count,
        fork_count=repo.fork_count,
        repo_created_at=repo.repo_created_at,
        repo_updated_at=repo.repo_updated_at,
        last_activity_at=repo.last_activity_at,
        created_at=repo.created_at,
        updated_at=repo.updated_at,
        last_synced_at=getattr(repo, 'last_synced_at', None)
    )

@router.put("/scm/repos/{repo_id}", response_model=SCMRepoResponse, status_code=status.HTTP_200_OK)
async def update_scm_repo(
    repo_id: str,
    repo_update: SCMRepoUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update SCM repository by MongoDB ID (requires authentication)."""
    existing_repo = await crud_scm_repo.get_scm_repo(db, repo_id)
    if not existing_repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM repository not found"
        )
    
    update_data = repo_update.model_dump(exclude_unset=True)
    updated_repo = await crud_scm_repo.update_scm_repo(db, repo_id, update_data)
    if not updated_repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM repository not found"
        )
    
    return SCMRepoResponse(
        id=str(updated_repo.id),
        repo_id=updated_repo.repo_id,
        description=updated_repo.description,
        name=updated_repo.name,
        name_with_namespace=updated_repo.name_with_namespace,
        default_branch=updated_repo.default_branch,
        http_url_to_repo=updated_repo.http_url_to_repo,
        username=updated_repo.username,
        user_id=updated_repo.user_id,
        scm_provider=updated_repo.scm_provider,
        scm_id=updated_repo.scm_id,
        base_url=updated_repo.base_url,
        web_url=updated_repo.web_url,
        ssh_url_to_repo=updated_repo.ssh_url_to_repo,
        visibility=updated_repo.visibility,
        is_archived=updated_repo.is_archived,
        is_fork=updated_repo.is_fork,
        path=updated_repo.path,
        path_with_namespace=updated_repo.path_with_namespace,
        star_count=updated_repo.star_count,
        fork_count=updated_repo.fork_count,
        repo_created_at=updated_repo.repo_created_at,
        repo_updated_at=updated_repo.repo_updated_at,
        last_activity_at=updated_repo.last_activity_at,
        created_at=updated_repo.created_at,
        updated_at=updated_repo.updated_at,
        last_synced_at=getattr(updated_repo, 'last_synced_at', None)
    )

@router.get("/scm/repos/{repo_id}/tree", status_code=status.HTTP_200_OK)
async def get_scm_repo_tree(
    repo_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get file tree and dependencies for a specific repository.
    Accepts both MongoDB ObjectId and GitHub/GitLab numeric repo ID.
    """
    # Try MongoDB ObjectId first
    repo = await crud_scm_repo.get_scm_repo(db, repo_id)
    
    # Fallback: try as GitHub/GitLab numeric repo ID
    if not repo:
        try:
            numeric_id = int(repo_id)
            repo = await crud_scm_repo.get_scm_repo_by_repo_id(db, numeric_id)
        except (ValueError, TypeError):
            pass
    
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM repository not found"
        )
        
    scm = await crud_scm.get_scm(db, repo.scm_id)
    if not scm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM credentials not found"
        )
        
    try:
        repo_details = {
            "name_with_namespace": repo.name_with_namespace,
            "default_branch": repo.default_branch,
            "id": repo.repo_id
        }
        tree_data = await fetch_repository_tree(scm, repo_details)
        return tree_data
    except Exception as e:
        print(f"❌ Error fetching repository tree: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch repository tree: {str(e)}"
        )

@router.post("/scm/repos/{repo_id}/sync", status_code=status.HTTP_202_ACCEPTED)
async def sync_scm_repo(
    repo_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger a background sync (download and extract ZIP) of the repository code."""
    repo = await crud_scm_repo.get_scm_repo(db, repo_id)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM repository not found"
        )
        
    scm = await crud_scm.get_scm(db, repo.scm_id)
    if not scm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM credentials not found"
        )
        
    repo_details = {
        "name_with_namespace": repo.name_with_namespace,
        "default_branch": repo.default_branch,
        "id": repo.repo_id
    }
    
    # Run the download in the background so we don't block the API
    background_tasks.add_task(download_and_extract_repo_zip, scm, repo_details)
    
    return {"message": "Sync started in background", "repo_id": repo_id}

@router.delete("/scm/repos/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scm_repo(
    repo_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete SCM repository by MongoDB ID (requires authentication)."""
    deleted = await crud_scm_repo.delete_scm_repo(db, repo_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM repository not found"
        )
    
    return None
