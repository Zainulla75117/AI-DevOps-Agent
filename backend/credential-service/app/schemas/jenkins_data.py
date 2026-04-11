from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any, List

class SyncJenkinsDataRequest(BaseModel):
    """Schema for syncing Jenkins data request."""
    jenkins_id: str
    user_name: str

class JenkinsDataResponse(BaseModel):
    """Schema for Jenkins data response."""
    id: str
    jenkins_id: str
    user_name: str
    jenkins_data: Dict[str, Any]
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class SyncJenkinsDataResponse(BaseModel):
    """Schema for sync Jenkins data response."""
    message: str
    jenkins_id: str
    user_name: str
    jobs_count: int
    nodes_count: int
    plugins_count: int

