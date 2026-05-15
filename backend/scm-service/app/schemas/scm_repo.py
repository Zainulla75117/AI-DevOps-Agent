from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional, Any
from dateutil import parser as date_parser

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

class SCMRepoCreate(BaseModel):
    """Schema for creating SCM repository data."""
    id: int  # Repository ID from GitLab/GitHub
    description: Optional[str] = None
    name: str
    name_with_namespace: str
    default_branch: Optional[str] = None
    http_url_to_repo: str
    username: Optional[str] = None
    user_id: Optional[str] = None
    
    # SCM Provider Tracking
    scm_provider: str  # "gitlab", "github", "bitbucket"
    scm_id: str  # SCM credentials ID
    base_url: Optional[str] = None
    
    # Additional URLs
    web_url: Optional[str] = None
    ssh_url_to_repo: Optional[str] = None
    
    # Repository Metadata
    visibility: Optional[str] = None
    is_archived: Optional[bool] = None
    is_fork: Optional[bool] = None
    
    # Additional Info
    path: Optional[str] = None
    path_with_namespace: Optional[str] = None
    star_count: Optional[int] = None
    fork_count: Optional[int] = None
    
    # Timestamps from SCM
    repo_created_at: Optional[datetime] = None
    repo_updated_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None
    
    # Sync tracking
    last_synced_at: Optional[datetime] = None

    @field_validator('description', mode='before')
    @classmethod
    def normalize_description(cls, v):
        """Normalize description field from GitLab."""
        return normalize_gitlab_value(v)

    @field_validator('id', mode='before')
    @classmethod
    def normalize_id(cls, v):
        """Ensure id is an integer."""
        if isinstance(v, str):
            try:
                return int(v)
            except ValueError:
                return v
        return v
    
    @field_validator('repo_created_at', 'repo_updated_at', 'last_activity_at', mode='before')
    @classmethod
    def parse_datetime(cls, v):
        """Parse datetime strings from SCM APIs."""
        if v is None:
            return None
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            try:
                return date_parser.parse(v)
            except (ValueError, TypeError):
                return None
        return None
    
    @field_validator('is_archived', 'is_fork', mode='before')
    @classmethod
    def normalize_boolean(cls, v):
        """Normalize boolean values from SCM APIs."""
        if v is None:
            return None
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ('true', '1', 'yes')
        return bool(v)

class SCMRepoUpdate(BaseModel):
    """Schema for updating SCM repository data."""
    description: Optional[str] = None
    name: Optional[str] = None
    name_with_namespace: Optional[str] = None
    default_branch: Optional[str] = None
    http_url_to_repo: Optional[str] = None
    web_url: Optional[str] = None
    ssh_url_to_repo: Optional[str] = None
    visibility: Optional[str] = None
    is_archived: Optional[bool] = None
    is_fork: Optional[bool] = None
    path: Optional[str] = None
    path_with_namespace: Optional[str] = None
    star_count: Optional[int] = None
    fork_count: Optional[int] = None
    repo_created_at: Optional[datetime] = None
    repo_updated_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    
    @field_validator('repo_created_at', 'repo_updated_at', 'last_activity_at', mode='before')
    @classmethod
    def parse_datetime(cls, v):
        """Parse datetime strings from SCM APIs."""
        if v is None:
            return None
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            try:
                return date_parser.parse(v)
            except (ValueError, TypeError):
                return None
        return None

class SCMRepoResponse(BaseModel):
    """Schema for SCM repository response."""
    id: str  # MongoDB _id
    repo_id: int  # GitLab/GitHub repository ID
    description: Optional[str] = None
    name: str
    name_with_namespace: str
    default_branch: Optional[str] = None
    http_url_to_repo: str
    username: Optional[str] = None
    user_id: Optional[str] = None
    
    # SCM Provider Tracking
    scm_provider: str
    scm_id: str
    base_url: Optional[str] = None
    
    # Additional URLs
    web_url: Optional[str] = None
    ssh_url_to_repo: Optional[str] = None
    
    # Repository Metadata
    visibility: Optional[str] = None
    is_archived: Optional[bool] = None
    is_fork: Optional[bool] = None
    
    # Additional Info
    path: Optional[str] = None
    path_with_namespace: Optional[str] = None
    star_count: Optional[int] = None
    fork_count: Optional[int] = None
    
    # Timestamps from SCM
    repo_created_at: Optional[datetime] = None
    repo_updated_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None
    
    # Our DB Timestamps
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
