"""
Infrastructure Execution tracking model.

Records each provisioning / apply operation with structured logging.
Stored in the `infra_executions` collection.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, Field, field_serializer
import uuid

from app.models.common import PyObjectId, serialize_object_id


class InfraExecution(BaseModel):
    """Tracks a single apply / provisioning execution run."""

    id: Optional[PyObjectId] = Field(default_factory=ObjectId, alias="_id")
    project_id: PyObjectId
    execution_id: str = Field(default_factory=lambda: f"exec-{uuid.uuid4().hex[:12]}")
    status: str = "running"  # "running" | "succeeded" | "failed"
    resources: List[PyObjectId] = Field(default_factory=list)
    logs: List[Dict[str, Any]] = Field(default_factory=list)
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None

    @field_serializer("id")
    def serialize_id(self, value: Optional[ObjectId]) -> Optional[str]:
        return serialize_object_id(value)

    @field_serializer("project_id")
    def serialize_project_id(self, value: Optional[ObjectId]) -> Optional[str]:
        return serialize_object_id(value)

    @field_serializer("resources")
    def serialize_resources(self, value: List[ObjectId]) -> List[str]:
        return [str(v) for v in value] if value else []

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
