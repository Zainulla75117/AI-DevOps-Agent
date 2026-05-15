from typing import Optional, Any
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, Field, field_serializer
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema
from typing_extensions import Annotated

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

class SCM(BaseModel):
    """
    SCM credentials model for MongoDB documents.
    Used read-only by scm-service to fetch credentials for repo sync.
    Credential CRUD is handled by credential-service.
    """
    id: Optional[PyObjectId] = Field(default_factory=ObjectId, alias="_id")
    scm_name: str
    username: str
    pat: Optional[str] = None  # None for OAuth credentials
    base_url: Optional[str] = None  # For self-hosted GitLab/GitHub/Bitbucket instances
    auth_type: str = "pat"  # "pat", "oauth", or "github_app"
    oauth_access_token: Optional[str] = None  # OAuth access token (when auth_type="oauth")
    oauth_scopes: Optional[str] = None  # Scopes granted by the OAuth provider
    installation_id: Optional[str] = None  # GitHub App Installation ID (when auth_type="github_app")
    user_id: Optional[str] = None  # InfraX user who owns this credential
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    @field_serializer('id')
    def serialize_id(self, value: Optional[ObjectId]) -> Optional[str]:
        """Serialize ObjectId to string."""
        return str(value) if value else None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
