"""
Pydantic schemas for the unified infrastructure resource API.

Defines request / response contracts for:
- InfraResource  (create, update, response)
- InfraVersion   (response)
- InfraExecution  (create, response)
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════
#  INFRA RESOURCE
# ═══════════════════════════════════════════════════════════════════════

class InfraResourceCreate(BaseModel):
    """Request body for creating a new infrastructure resource."""
    project_id: str
    type: str                          # "network" | "compute" | "serverless" | "database"
    name: str                          # Human-readable name
    provider: str = "aws"              # "aws" | "azure" | "gcp"
    region: str = "us-east-1"
    env: str = "dev"                   # "dev" | "staging" | "prod"
    config: Dict[str, Any] = Field(default_factory=dict)
    depends_on: List[str] = Field(default_factory=list)  # Resource ID strings
    state: str = "planned"


class InfraResourceUpdate(BaseModel):
    """Request body for updating an existing resource's config."""
    config: Optional[Dict[str, Any]] = None
    name: Optional[str] = None
    state: Optional[str] = None
    actual_state: Optional[Dict[str, Any]] = None
    depends_on: Optional[List[str]] = None
    change_reason: str = "Configuration update"
    changed_by: str = "system"


class InfraResourceResponse(BaseModel):
    """Full response for a single infrastructure resource."""
    id: str
    project_id: Optional[str] = None
    type: str
    name: str
    provider: str
    region: str
    env: str
    config: Dict[str, Any]
    actual_state: Optional[Dict[str, Any]] = None
    state: str
    version: int
    depends_on: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    last_applied_at: Optional[datetime] = None
    last_applied_by: Optional[str] = None

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════
#  INFRA VERSION
# ═══════════════════════════════════════════════════════════════════════

class InfraVersionResponse(BaseModel):
    """Response for a single version history entry."""
    id: str
    resource_id: str
    version: int
    config: Dict[str, Any]
    changed_by: str
    change_reason: str
    created_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════
#  INFRA EXECUTION
# ═══════════════════════════════════════════════════════════════════════

class InfraExecutionCreate(BaseModel):
    """Request body for creating a new execution run."""
    project_id: str
    resources: List[str] = Field(default_factory=list)  # Resource ID strings


class InfraExecutionUpdate(BaseModel):
    """Request body to update execution status / logs."""
    status: Optional[str] = None
    log_entry: Optional[Dict[str, Any]] = None  # Single log entry to append


class InfraExecutionResponse(BaseModel):
    """Full response for a single execution run."""
    id: str
    project_id: str
    execution_id: str
    status: str
    resources: List[str]
    logs: List[Dict[str, Any]]
    started_at: datetime
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════
#  GENERIC RESPONSE (backward compat)
# ═══════════════════════════════════════════════════════════════════════

class InfraResponse(BaseModel):
    """Legacy-compatible thin response wrapper."""
    id: str
    message: str
    type: str
    data: Any
