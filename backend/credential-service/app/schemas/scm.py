from pydantic import BaseModel, model_validator
from datetime import datetime
from typing import Optional, Dict, Any, List

class SCMCreate(BaseModel):
    """Schema for creating SCM credentials."""
    scm_name: str
    username: str
    pat: str
    base_url: Optional[str] = None  # For self-hosted instances (e.g., "https://gitlab.example.com")

class SCMUpdate(BaseModel):
    """Schema for updating SCM credentials."""
    scm_name: Optional[str] = None
    username: Optional[str] = None
    pat: Optional[str] = None
    base_url: Optional[str] = None

class SCMResponse(BaseModel):
    """Schema for SCM credentials response."""
    id: str
    scm_name: str
    username: str
    pat: str
    base_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class FormSubmissionRequest(BaseModel):
    """Schema for form submission request."""
    query: str
    session_id: str
    is_form_submission: bool
    form_data: Dict[str, Any]

class FormSubmissionResponse(BaseModel):
    """Schema for form submission response."""
    session_id: str
    scm_details: Optional[List[SCMResponse]] = None
    message: Optional[str] = None

class SyncRepositoriesRequest(BaseModel):
    """Schema for sync repositories request."""
    scm_id: str

class SyncRepositoriesResponse(BaseModel):
    """Schema for sync repositories response."""
    message: str
    repositories_count: int
    scm_id: str

class RepoNamespaceOption(BaseModel):
    """Schema for repository namespace dropdown option."""
    value: str  # Namespace value (e.g., "group", "username", "org/team")
    label: str  # Display label (e.g., "group", "username", "org/team")
    count: int  # Number of repositories in this namespace

class RepoNamespaceResponse(BaseModel):
    """Schema for repository namespaces response."""
    namespaces: List[RepoNamespaceOption]
    total_namespaces: int
    total_repositories: int
