"""
Unified Infrastructure Resource model.

Replaces the former separate models: NetworkInfra, ServersInfra,
ServerlessInfra, CloudManagedInfra.

Every infrastructure component — regardless of type — is stored as a single
document in the `infra_resources` collection.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, Field, field_serializer

from app.models.common import PyObjectId, serialize_object_id


class InfraResource(BaseModel):
    """Single unified infrastructure resource document."""

    id: Optional[PyObjectId] = Field(default_factory=ObjectId, alias="_id")

    # ── Project reference (strong ObjectId link) ──────────────────────
    project_id: Optional[PyObjectId] = None

    # ── Classification ───────────────────────────────────────────────
    type: str  # "network" | "compute" | "serverless" | "database" | "cache" | etc.
    name: str  # Human-readable resource name
    provider: str = "aws"  # "aws" | "azure" | "gcp"
    region: str = "us-east-1"
    env: str = "dev"  # "dev" | "staging" | "prod"

    # ── Core state fields ────────────────────────────────────────────
    config: Dict[str, Any] = Field(default_factory=dict)
    actual_state: Optional[Dict[str, Any]] = None
    iac_context: Optional[Dict[str, Any]] = None  # LLM's IaC reasoning, Terraform hints, cost estimates
    state: str = "planned"  # "planned" | "provisioning" | "provisioned" | "failed"
    version: int = 1

    # ── Relationships ────────────────────────────────────────────────
    depends_on: List[PyObjectId] = Field(default_factory=list)

    # ── Metadata ─────────────────────────────────────────────────────
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_applied_at: Optional[datetime] = None
    last_applied_by: Optional[str] = None

    # ── Serializers ──────────────────────────────────────────────────
    @field_serializer("id")
    def serialize_id(self, value: Optional[ObjectId]) -> Optional[str]:
        return serialize_object_id(value)

    @field_serializer("project_id")
    def serialize_project_id(self, value: Optional[ObjectId]) -> Optional[str]:
        return serialize_object_id(value)

    @field_serializer("depends_on")
    def serialize_depends_on(self, value: List[ObjectId]) -> List[str]:
        return [str(v) for v in value] if value else []

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
