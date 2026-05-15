from typing import Optional, Any
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, Field, field_serializer
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema
from typing_extensions import Annotated

def validate_object_id(v: Any) -> ObjectId:
    if isinstance(v, ObjectId):
        return v
    if isinstance(v, str):
        if ObjectId.is_valid(v):
            return ObjectId(v)
        raise ValueError("Invalid ObjectId string")
    raise ValueError("Invalid ObjectId")

def get_pydantic_json_schema(_schema: core_schema.CoreSchema, handler) -> JsonSchemaValue:
    return {"type": "string"}

PyObjectId = Annotated[
    ObjectId,
    core_schema.no_info_plain_validator_function(validate_object_id),
    core_schema.json_schema(get_pydantic_json_schema)
]

class LinkedRepository(BaseModel):
    repo_full_name: str
    credential_id: str
    provider: str
    repo_id: Optional[str] = None  # ObjectId ref to user_scm_data document

class Project(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=ObjectId, alias="_id")
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
    linked_repositories: list[LinkedRepository] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    @field_serializer('id')
    def serialize_id(self, value: Optional[ObjectId]) -> Optional[str]:
        return str(value) if value else None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
