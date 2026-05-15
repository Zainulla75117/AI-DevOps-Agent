from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from bson import ObjectId

from app.models.common import PyObjectId

class ProvisioningContext(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    project_id: str
    session_id: str
    resources: List[Dict[str, Any]]
    status: str = "confirmed"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

    from pydantic import field_serializer
    from app.models.common import serialize_object_id

    @field_serializer("id")
    def serialize_id(self, value: Optional[ObjectId]) -> Optional[str]:
        return serialize_object_id(value)
