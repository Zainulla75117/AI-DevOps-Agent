from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class LinkedRepositorySchema(BaseModel):
    repo_full_name: str
    credential_id: str
    provider: str
    repo_id: Optional[str] = None  # ObjectId ref to user_scm_data document

class ProjectCreate(BaseModel):
    project_name: str
    description: Optional[str] = None
    domain: Optional[str] = None
    platform: Optional[str] = None
    cloud_provider: Optional[str] = None
    region: Optional[str] = None
    iam_name: Optional[str] = None
    environment: Optional[str] = None
    expected_traffic: Optional[str] = None
    cost_preference: Optional[str] = None
    linked_repositories: Optional[list[LinkedRepositorySchema]] = None

class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    description: Optional[str] = None
    domain: Optional[str] = None
    platform: Optional[str] = None
    cloud_provider: Optional[str] = None
    region: Optional[str] = None
    iam_name: Optional[str] = None
    environment: Optional[str] = None
    expected_traffic: Optional[str] = None
    cost_preference: Optional[str] = None
    linked_repositories: Optional[list[LinkedRepositorySchema]] = None

class ProjectResponse(BaseModel):
    id: str
    project_name: str
    owner_username: str
    description: Optional[str] = None
    domain: Optional[str] = None
    platform: Optional[str] = None
    cloud_provider: Optional[str] = None
    region: Optional[str] = None
    iam_name: Optional[str] = None
    environment: Optional[str] = None
    expected_traffic: Optional[str] = None
    cost_preference: Optional[str] = None
    linked_repositories: Optional[list[LinkedRepositorySchema]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
