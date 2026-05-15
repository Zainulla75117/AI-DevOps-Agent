"""
SCM Business Logic Router
Handles: repository sync, form submission, namespace browsing.
Credential CRUD is handled by credential-service.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from app.database.connection import get_db
from app.schemas.scm import (
    FormSubmissionRequest, FormSubmissionResponse,
    SyncRepositoriesRequest, SyncRepositoriesResponse,
    RepoNamespaceResponse, RepoNamespaceOption,
    SCMResponse
)
from app.crud import scm as crud_scm, scm_repo as crud_scm_repo
from collections import Counter
from datetime import datetime
from app.models.scm import SCM
from app.schemas.scm_repo import SCMRepoCreate
from app.services.scm_service import fetch_repositories
from app.auth.jwt import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api", tags=["scm"])


@router.post("/scm/submit", response_model=FormSubmissionResponse, status_code=status.HTTP_200_OK)
async def handle_form_submission(
    request: FormSubmissionRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Handle form submission and return SCM details if source_type is "SCM".
    """
    try:
        source_type = request.form_data.get("source_type")
        
        if source_type == "SCM":
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


@router.post("/scm/sync/{scm_id}", response_model=SyncRepositoriesResponse, status_code=status.HTTP_200_OK)
async def sync_repositories(
    scm_id: str,
    request: Optional[SyncRepositoriesRequest] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sync repositories from SCM provider (GitLab/GitHub/Bitbucket).
    Reads SCM credentials from DB, fetches repos from provider API, stores them.
    """
    try:
        if request and request.scm_id != scm_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="scm_id in body must match scm_id in path"
            )
        
        # Read SCM credentials (stored by credential-service)
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
                
                # Check for duplicate
                existing_repo = await crud_scm_repo.get_scm_repo_by_unique_key(
                    db=db,
                    repo_id=repo_id,
                    scm_provider=scm_provider_lower,
                    scm_id=scm_id,
                    user_id=current_user_id
                )
                
                if existing_repo:
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
                        "base_url": base_url,
                        "last_synced_at": datetime.utcnow()
                    }
                    await crud_scm_repo.update_scm_repo(db, str(existing_repo.id), repo_update)
                    updated_count += 1
                    print(f"🔄 Updated existing repository: {repo_data.get('name')} (ID: {repo_id})")
                else:
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
                        last_activity_at=repo_data.get("last_activity_at"),
                        last_synced_at=datetime.utcnow()
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
    """
    try:
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
        
        namespace_counter = Counter()
        
        for repo in repos:
            namespace = None
            
            if repo.path_with_namespace:
                parts = repo.path_with_namespace.split('/')
                if len(parts) > 1:
                    namespace = '/'.join(parts[:-1])
            elif repo.name_with_namespace:
                parts = repo.name_with_namespace.split('/')
                if len(parts) > 1:
                    namespace = '/'.join(parts[:-1])
            
            if namespace:
                namespace_counter[namespace] += 1
        
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
