from typing import Optional, Any
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, Field, field_serializer
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema
from typing_extensions import Annotated, Literal

def validate_object_id(v: Any) -> ObjectId:
    """Validate ObjectId."""
    if isinstance(v, ObjectId):
        return v
    if isinstance(v, str):
        if ObjectId.is_valid(v):
            return ObjectId(v)
        raise ValueError("Invalid ObjectId string")
    raise ValueError("Invalid ObjectId")

def get_pydantic_json_schema(_schema: core_schema.CoreSchema, handler) -> JsonSchemaValue:
    """Get JSON schema for ObjectId."""
    return {"type": "string"}

PyObjectId = Annotated[
    ObjectId,
    core_schema.no_info_plain_validator_function(validate_object_id),
    core_schema.json_schema(get_pydantic_json_schema)
]

class JenkinsCredentials(BaseModel):
    """
    Jenkins credentials model for MongoDB documents.
    """
    id: Optional[PyObjectId] = Field(default_factory=ObjectId, alias="_id")
    jenkins_url: str
    username: str
    token: str
    type: Literal["public", "private"]
    user_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    @field_serializer('id')
    def serialize_id(self, value: Optional[ObjectId]) -> Optional[str]:
        """Serialize ObjectId to string."""
        return str(value) if value else None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

