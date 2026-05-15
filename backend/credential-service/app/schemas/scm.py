"""
SCM Credential schemas (credential-service).
Only credential CRUD schemas. Business logic schemas are in scm-service.
"""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SCMCreate(BaseModel):
    """Schema for creating SCM credentials."""
    scm_name: str
    username: str
    pat: Optional[str] = None  # Optional for OAuth credentials
    base_url: Optional[str] = None  # For self-hosted instances
    auth_type: str = "pat"  # "pat" or "oauth"

class SCMUpdate(BaseModel):
    """Schema for updating SCM credentials."""
    scm_name: Optional[str] = None
    username: Optional[str] = None
    pat: Optional[str] = None
    base_url: Optional[str] = None

class SCMResponse(BaseModel):
    """
    Schema for SCM credentials response.
    Note: oauth_access_token is intentionally NOT included for security.
    """
    id: str
    scm_name: str
    username: str
    pat: Optional[str] = None
    base_url: Optional[str] = None
    auth_type: str = "pat"
    oauth_scopes: Optional[str] = None  # Show what was granted (not the token itself)
    installation_id: Optional[str] = None  # GitHub App Installation ID
    user_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
