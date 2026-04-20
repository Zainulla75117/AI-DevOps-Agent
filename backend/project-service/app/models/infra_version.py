"""
Infrastructure Version history model.

Every config change to an InfraResource creates a snapshot in the
`infra_versions` collection for full audit trail.
"""

from typing import Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, Field, field_serializer

from app.models.common import PyObjectId, serialize_object_id


class InfraVersion(BaseModel):
    """Immutable snapshot of a resource config at a specific version."""

    id: Optional[PyObjectId] = Field(default_factory=ObjectId, alias="_id")
    resource_id: PyObjectId
    version: int
    config: Dict[str, Any] = Field(default_factory=dict)
    changed_by: str = "system"
    change_reason: str = "Initial creation"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_serializer("id")
    def serialize_id(self, value: Optional[ObjectId]) -> Optional[str]:
        return serialize_object_id(value)

    @field_serializer("resource_id")
    def serialize_resource_id(self, value: Optional[ObjectId]) -> Optional[str]:
        return serialize_object_id(value)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
