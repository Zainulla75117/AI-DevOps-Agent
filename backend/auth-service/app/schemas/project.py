from pydantic import BaseModel, model_validator
from datetime import datetime
from typing import Optional, Literal

class ProjectCreate(BaseModel):
    """Schema for creating a new project with conditional fields based on platform."""
    project_name: str
    description: Optional[str] = None
    domain: Optional[str] = None
    platform: Literal["cloud", "onpremise"]
    cloud_provider: Optional[Literal["aws", "azure", "gcp"]] = None
    region: Optional[str] = None
    iam_name: Optional[str] = None
    environment: Optional[Literal["production", "staging", "development", "testing"]] = None

    @model_validator(mode='after')
    def validate_platform_fields(self):
        """Validate that required fields are present based on platform."""
        if self.platform == "cloud":
            if not self.cloud_provider:
                raise ValueError("cloud_provider is required when platform is 'cloud'")
            if self.cloud_provider not in ["aws", "azure", "gcp"]:
                raise ValueError("cloud_provider must be 'aws', 'azure', or 'gcp'")
            if not self.region:
                raise ValueError("region is required when platform is 'cloud'")
            # iam_name is only valid for AWS
            if self.iam_name and self.cloud_provider != "aws":
                raise ValueError("iam_name is only valid when cloud_provider is 'aws'")
        elif self.platform == "onpremise":
            # For onpremise, cloud_provider, region, and iam_name should not be set
            if self.cloud_provider is not None:
                raise ValueError("cloud_provider should not be provided for onpremise platform")
            if self.region is not None:
                raise ValueError("region should not be provided for onpremise platform")
            if self.iam_name is not None:
                raise ValueError("iam_name should not be provided for onpremise platform")
        
        return self

class ProjectUpdate(BaseModel):
    """Schema for updating a project."""
    project_name: Optional[str] = None
    description: Optional[str] = None
    domain: Optional[str] = None
    platform: Optional[str] = None
    cloud_provider: Optional[str] = None
    region: Optional[str] = None
    iam_name: Optional[str] = None
    environment: Optional[str] = None

class ProjectResponse(BaseModel):
    """Schema for project response."""
    id: str
    project_name: str
    description: Optional[str] = None
    domain: Optional[str] = None
    platform: str
    cloud_provider: Optional[str] = None
    region: Optional[str] = None
    iam_name: Optional[str] = None
    environment: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

