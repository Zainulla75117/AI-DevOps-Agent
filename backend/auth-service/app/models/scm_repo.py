from typing import Optional, Any
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, Field, field_serializer, field_validator
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

def normalize_gitlab_value(value: Any) -> Optional[str]:
    """Normalize GitLab values (handle 'null', 'true', 'false' as strings)."""
    if value is None:
        return None
    if isinstance(value, str):
        if value.lower() == 'null':
            return None
        if value.lower() == 'true':
            return 'true'
        if value.lower() == 'false':
            return 'false'
        return value
    return str(value) if value is not None else None

class SCMRepo(BaseModel):
    """
    SCM repository model for MongoDB documents.
    """
    id: Optional[PyObjectId] = Field(default_factory=ObjectId, alias="_id")
    repo_id: int  # GitLab/GitHub repository ID
    description: Optional[str] = None
    name: str
    name_with_namespace: str
    default_branch: Optional[str] = None
    http_url_to_repo: str
    username: Optional[str] = None  # Username to identify which user's data
    user_id: Optional[str] = None  # User ID to identify which user's data
    
    # SCM Provider Tracking
    scm_provider: str  # "gitlab", "github", "bitbucket"
    scm_id: str  # SCM credentials ID used to fetch this repository
    base_url: Optional[str] = None  # Base URL of SCM instance (for self-hosted)
    
    # Additional URLs
    web_url: Optional[str] = None  # Web URL to view repository in browser
    ssh_url_to_repo: Optional[str] = None  # SSH clone URL
    
    # Repository Metadata
    visibility: Optional[str] = None  # "private", "public", "internal"
    is_archived: Optional[bool] = None
    is_fork: Optional[bool] = None
    
    # Additional Info
    path: Optional[str] = None  # Repository path (without namespace)
    path_with_namespace: Optional[str] = None  # Full path with namespace
    star_count: Optional[int] = None  # Number of stars
    fork_count: Optional[int] = None  # Number of forks
    
    # Timestamps from SCM
    repo_created_at: Optional[datetime] = None  # When repository was created in SCM
    repo_updated_at: Optional[datetime] = None  # When repository was last updated in SCM
    last_activity_at: Optional[datetime] = None  # Last activity timestamp from SCM
    
    # Our DB Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    @field_validator('description', mode='before')
    @classmethod
    def normalize_description(cls, v):
        """Normalize description field from GitLab."""
        return normalize_gitlab_value(v)

    @field_serializer('id')
    def serialize_id(self, value: Optional[ObjectId]) -> Optional[str]:
        """Serialize ObjectId to string."""
        return str(value) if value else None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

