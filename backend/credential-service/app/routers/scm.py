from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from app.database.connection import get_db
from app.schemas.scm import (
    SCMCreate, SCMResponse, SCMUpdate, FormSubmissionRequest, FormSubmissionResponse,
    SyncRepositoriesRequest, SyncRepositoriesResponse, RepoNamespaceResponse, RepoNamespaceOption
)
from app.crud import scm as crud_scm, scm_repo as crud_scm_repo
from collections import Counter
from app.models.scm import SCM
from app.schemas.scm_repo import SCMRepoCreate
from app.services.scm_service import fetch_repositories
from app.auth.jwt import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api", tags=["scm"])

@router.post("/scm/credentials", response_model=SCMResponse, status_code=status.HTTP_201_CREATED)
async def create_scm_credentials(
    scm: SCMCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create new SCM credentials (requires authentication).
    
    Args:
        scm: SCMCreate schema with SCM credentials data
        db: MongoDB database instance
        current_user: Authenticated user from JWT token
        
    Returns:
        Created SCM credentials response
    """
    try:
        created_scm = await crud_scm.create_scm(db, scm)
        print(f"✅ SCM credentials creation successful: {created_scm.scm_name}")
        return SCMResponse(
            id=str(created_scm.id),
            scm_name=created_scm.scm_name,
            username=created_scm.username,
            pat=created_scm.pat,
            base_url=created_scm.base_url,
            created_at=created_scm.created_at,
            updated_at=created_scm.updated_at
        )
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
    Frontend can fetch from this endpoint to get SCM details.
    
    Args:
        db: MongoDB database instance
        current_user: Authenticated user from JWT token
        
    Returns:
        List of SCM credentials responses
    """
    scm_list = await crud_scm.get_all_scm(db, skip=0, limit=100)
    return [
        SCMResponse(
            id=str(scm.id),
            scm_name=scm.scm_name,
            username=scm.username,
            pat=scm.pat,
            base_url=scm.base_url,
            created_at=scm.created_at,
            updated_at=scm.updated_at
        )
        for scm in scm_list
    ]

@router.get("/scm/credentials", response_model=List[SCMResponse], status_code=status.HTTP_200_OK)
async def get_all_scm_credentials(
    skip: int = 0,
    limit: int = 100,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all SCM credentials with pagination (requires authentication).
    
    Args:
        skip: Number of credentials to skip
        limit: Maximum number of credentials to return
        db: MongoDB database instance
        current_user: Authenticated user from JWT token
        
    Returns:
        List of SCM credentials responses
    """
    scm_list = await crud_scm.get_all_scm(db, skip=skip, limit=limit)
    return [
        SCMResponse(
            id=str(scm.id),
            scm_name=scm.scm_name,
            username=scm.username,
            pat=scm.pat,
            base_url=scm.base_url,
            created_at=scm.created_at,
            updated_at=scm.updated_at
        )
        for scm in scm_list
    ]

@router.get("/scm/credentials/{scm_id}", response_model=SCMResponse, status_code=status.HTTP_200_OK)
async def get_scm_credentials(
    scm_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get SCM credentials by ID (requires authentication).
    
    Args:
        scm_id: SCM credentials ID
        db: MongoDB database instance
        current_user: Authenticated user from JWT token
        
    Returns:
        SCM credentials response
    """
    scm = await crud_scm.get_scm(db, scm_id)
    if not scm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM credentials not found"
        )
    
    return SCMResponse(
        id=str(scm.id),
        scm_name=scm.scm_name,
        username=scm.username,
        pat=scm.pat,
        base_url=scm.base_url,
        created_at=scm.created_at,
        updated_at=scm.updated_at
    )

@router.put("/scm/credentials/{scm_id}", response_model=SCMResponse, status_code=status.HTTP_200_OK)
async def update_scm_credentials(
    scm_id: str,
    scm_update: SCMUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update SCM credentials by ID (requires authentication).
    
    Args:
        scm_id: SCM credentials ID
        scm_update: SCMUpdate schema with fields to update
        db: MongoDB database instance
        current_user: Authenticated user from JWT token
        
    Returns:
        Updated SCM credentials response
    """
    # Check if SCM credentials exist
    existing_scm = await crud_scm.get_scm(db, scm_id)
    if not existing_scm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM credentials not found"
        )
    
    # Prepare update data (exclude None values)
    update_data = scm_update.model_dump(exclude_unset=True)
    
    updated_scm = await crud_scm.update_scm(db, scm_id, update_data)
    if not updated_scm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM credentials not found"
        )
    
    return SCMResponse(
        id=str(updated_scm.id),
        scm_name=updated_scm.scm_name,
        username=updated_scm.username,
        pat=updated_scm.pat,
        base_url=updated_scm.base_url,
        created_at=updated_scm.created_at,
        updated_at=updated_scm.updated_at
    )

@router.delete("/scm/credentials/{scm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scm_credentials(
    scm_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete SCM credentials by ID (requires authentication).
    
    Args:
        scm_id: SCM credentials ID
        db: MongoDB database instance
        current_user: Authenticated user from JWT token
        
    Returns:
        No content on success
    """
    deleted = await crud_scm.delete_scm(db, scm_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SCM credentials not found"
        )
    
    return None

@router.post("/scm/submit", response_model=FormSubmissionResponse, status_code=status.HTTP_200_OK)
async def handle_form_submission(
    request: FormSubmissionRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Handle form submission and return SCM details if source_type is "SCM".
    
    Args:
        request: FormSubmissionRequest with query, session_id, and form_data
        db: MongoDB database instance
        current_user: Authenticated user from JWT token
        
    Returns:
        FormSubmissionResponse with SCM details if source_type is "SCM"
    """
    try:
        # Check if source_type is "SCM"
        source_type = request.form_data.get("source_type")
        
        if source_type == "SCM":
            # Fetch all SCM credentials from database
            scm_list = await crud_scm.get_all_scm(db, skip=0, limit=100)
            
            scm_details = [
                SCMResponse(
                    id=str(scm.id),
                    scm_name=scm.scm_name,
                    username=scm.username,
                    pat=scm.pat,
                    base_url=scm.base_url,
                    created_at=scm.created_at,
                    updated_at=scm.updated_at
                )
                for scm in scm_list
            ]
            
            return FormSubmissionResponse(
                session_id=request.session_id,
                scm_details=scm_details,
                message="SCM details retrieved successfully"
            )
        else:
            return FormSubmissionResponse(
                session_id=request.session_id,
                scm_details=None,
                message=f"Form submitted for source_type: {source_type}"
            )
    except Exception as e:
        print(f"❌ Form submission error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process form submission: {str(e)}"
        )

@router.post("/scm/credentials/{scm_id}/sync-repositories", response_model=SyncRepositoriesResponse, status_code=status.HTTP_200_OK)
async def sync_repositories(
    scm_id: str,
    request: Optional[SyncRepositoriesRequest] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sync repositories from SCM provider (GitLab/GitHub/Bitbucket).
    
    Args:
        scm_id: SCM credentials ID from path
        request: Optional request body with scm_id for validation
        db: MongoDB database instance
        current_user: Authenticated user from JWT token
        
    Returns:
        Sync response with count of synced repositories
    """
    try:
        # Validate scm_id from body matches path if provided
        if request and request.scm_id != scm_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="scm_id in body must match scm_id in path"
            )
        
        # Fetch SCM credentials from database
        scm = await crud_scm.get_scm(db, scm_id)
        if not scm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="SCM credentials not found"
            )
        
        print(f"📝 Syncing repositories for SCM: {scm.scm_name} (ID: {scm_id})")
        
        # Fetch repositories from SCM provider
        repositories = await fetch_repositories(scm)
        
        if not repositories:
            return SyncRepositoriesResponse(
                message=f"No repositories found for {scm.scm_name}",
                repositories_count=0,
                scm_id=scm_id
            )
        
        # Determine base URL for repositories
        base_url = scm.base_url if scm.base_url else (
            "https://gitlab.com" if scm.scm_name.lower() == "gitlab" else
            "https://github.com" if scm.scm_name.lower() == "github" else
            "https://bitbucket.org" if scm.scm_name.lower() == "bitbucket" else None
        )
        
        # Save each repository to database
        saved_count = 0
        updated_count = 0
        skipped_count = 0
        
        scm_provider_lower = scm.scm_name.lower()
        current_user_id = str(current_user.id)
        
        for repo_data in repositories:
            try:
                repo_id = repo_data.get("id")
                
                # Check for duplicate using unique key: repo_id + scm_provider + scm_id + user_id
                existing_repo = await crud_scm_repo.get_scm_repo_by_unique_key(
                    db=db,
                    repo_id=repo_id,
                    scm_provider=scm_provider_lower,
                    scm_id=scm_id,
                    user_id=current_user_id
                )
                
                if existing_repo:
                    # Repository already exists - update it with latest data
                    repo_update = {
                        "description": repo_data.get("description"),
                        "name": repo_data.get("name"),
                        "name_with_namespace": repo_data.get("name_with_namespace"),
                        "default_branch": repo_data.get("default_branch"),
                        "http_url_to_repo": repo_data.get("http_url_to_repo"),
                        "web_url": repo_data.get("web_url"),
                        "ssh_url_to_repo": repo_data.get("ssh_url_to_repo"),
                        "visibility": repo_data.get("visibility"),
                        "is_archived": repo_data.get("is_archived"),
                        "is_fork": repo_data.get("is_fork"),
                        "path": repo_data.get("path"),
                        "path_with_namespace": repo_data.get("path_with_namespace"),
                        "star_count": repo_data.get("star_count"),
                        "fork_count": repo_data.get("fork_count"),
                        "repo_created_at": repo_data.get("repo_created_at"),
                        "repo_updated_at": repo_data.get("repo_updated_at"),
                        "last_activity_at": repo_data.get("last_activity_at"),
                        "base_url": base_url  # Update base_url in case it changed
                    }
                    await crud_scm_repo.update_scm_repo(db, str(existing_repo.id), repo_update)
                    updated_count += 1
                    print(f"🔄 Updated existing repository: {repo_data.get('name')} (ID: {repo_id})")
                else:
                    # New repository - create it
                    repo_create = SCMRepoCreate(
                        id=repo_id,
                        description=repo_data.get("description"),
                        name=repo_data.get("name"),
                        name_with_namespace=repo_data.get("name_with_namespace"),
                        default_branch=repo_data.get("default_branch"),
                        http_url_to_repo=repo_data.get("http_url_to_repo"),
                        username=current_user.username,
                        user_id=current_user_id,
                        scm_provider=scm_provider_lower,
                        scm_id=scm_id,
                        base_url=base_url,
                        web_url=repo_data.get("web_url"),
                        ssh_url_to_repo=repo_data.get("ssh_url_to_repo"),
                        visibility=repo_data.get("visibility"),
                        is_archived=repo_data.get("is_archived"),
                        is_fork=repo_data.get("is_fork"),
                        path=repo_data.get("path"),
                        path_with_namespace=repo_data.get("path_with_namespace"),
                        star_count=repo_data.get("star_count"),
                        fork_count=repo_data.get("fork_count"),
                        repo_created_at=repo_data.get("repo_created_at"),
                        repo_updated_at=repo_data.get("repo_updated_at"),
                        last_activity_at=repo_data.get("last_activity_at")
                    )
                    await crud_scm_repo.create_scm_repo(db, repo_create)
                    saved_count += 1
                    print(f"✅ Created new repository: {repo_data.get('name')} (ID: {repo_id})")
                
            except Exception as e:
                print(f"⚠️ Error saving repository {repo_data.get('name')}: {e}")
                import traceback
                traceback.print_exc()
                skipped_count += 1
                continue
        
        total_processed = saved_count + updated_count
        scm_provider_name = scm.scm_name.capitalize()
        
        print(f"📊 Sync Summary: {total_processed} processed ({saved_count} new, {updated_count} updated, {skipped_count} skipped)")
        
        scm_provider_name = scm.scm_name.capitalize()
        total_processed = saved_count + updated_count
        
        if saved_count > 0 and updated_count > 0:
            message = f"Successfully synced {total_processed} repositories from {scm_provider_name} ({saved_count} new, {updated_count} updated)"
        elif saved_count > 0:
            message = f"Successfully synced {saved_count} new repositories from {scm_provider_name}"
        elif updated_count > 0:
            message = f"Updated {updated_count} existing repositories from {scm_provider_name} (no new repositories)"
        else:
            message = f"No repositories to sync from {scm_provider_name}"
        
        return SyncRepositoriesResponse(
            message=message,
            repositories_count=total_processed,
            scm_id=scm_id
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Sync repositories error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync repositories: {str(e)}"
        )

@router.get("/scm/repo-namespaces", response_model=RepoNamespaceResponse, status_code=status.HTTP_200_OK)
async def get_repo_namespaces(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get unique repository namespaces for dropdown.
    Extracts namespaces from stored repositories for the current user.
    
    Args:
        db: MongoDB database instance
        current_user: Authenticated user from JWT token
        
    Returns:
        RepoNamespaceResponse with list of unique namespaces
    """
    try:
        # Get all repositories for the current user
        repos = await crud_scm_repo.get_scm_repos_by_user(
            db=db,
            user_id=str(current_user.id)
        )
        
        if not repos:
            return RepoNamespaceResponse(
                namespaces=[],
                total_namespaces=0,
                total_repositories=0
            )
        
        # Extract namespaces from name_with_namespace or path_with_namespace
        namespace_counter = Counter()
        
        for repo in repos:
            # Try to get namespace from name_with_namespace or path_with_namespace
            namespace = None
            
            if repo.path_with_namespace:
                # Extract namespace (everything before the last '/')
                parts = repo.path_with_namespace.split('/')
                if len(parts) > 1:
                    namespace = '/'.join(parts[:-1])  # All parts except the last (repo name)
            elif repo.name_with_namespace:
                # Extract namespace (everything before the last '/')
                parts = repo.name_with_namespace.split('/')
                if len(parts) > 1:
                    namespace = '/'.join(parts[:-1])  # All parts except the last (repo name)
            
            if namespace:
                namespace_counter[namespace] += 1
        
        # Convert to list of RepoNamespaceOption
        namespaces = [
            RepoNamespaceOption(
                value=namespace,
                label=namespace,
                count=count
            )
            for namespace, count in sorted(namespace_counter.items())
        ]
        
        total_repositories = len(repos)
        total_namespaces = len(namespaces)
        
        print(f"📊 Found {total_namespaces} unique namespaces from {total_repositories} repositories")
        
        return RepoNamespaceResponse(
            namespaces=namespaces,
            total_namespaces=total_namespaces,
            total_repositories=total_repositories
        )
    except Exception as e:
        print(f"❌ Error fetching repository namespaces: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch repository namespaces: {str(e)}"
        )

