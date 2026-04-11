from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional, Literal

class JenkinsCredentialsCreate(BaseModel):
    """Schema for creating Jenkins credentials."""
    jenkins_url: str
    username: str
    token: str
    type: Literal["public", "private"]
    user_name: str
    
    @field_validator('jenkins_url')
    @classmethod
    def validate_jenkins_url(cls, v: str) -> str:
        """Validate Jenkins URL format."""
        if not v.startswith(('http://', 'https://')):
            raise ValueError('jenkins_url must start with http:// or https://')
        return v

class JenkinsCredentialsUpdate(BaseModel):
    """Schema for updating Jenkins credentials."""
    jenkins_url: Optional[str] = None
    username: Optional[str] = None
    token: Optional[str] = None
    type: Optional[Literal["public", "private"]] = None
    user_name: Optional[str] = None
    
    @field_validator('jenkins_url')
    @classmethod
    def validate_jenkins_url(cls, v: Optional[str]) -> Optional[str]:
        """Validate Jenkins URL format."""
        if v is not None and not v.startswith(('http://', 'https://')):
            raise ValueError('jenkins_url must start with http:// or https://')
        return v

class JenkinsCredentialsResponse(BaseModel):
    """Schema for Jenkins credentials response."""
    id: str
    jenkins_url: str
    username: str
    token: str
    type: Literal["public", "private"]
    user_name: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

