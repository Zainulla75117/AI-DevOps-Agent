from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

class ProvisioningContextCreate(BaseModel):
    project_id: str
    session_id: str
    resources: List[Dict[str, Any]]
    status: Optional[str] = "confirmed"

class ProvisioningContextResponse(BaseModel):
    id: str
    project_id: str
    session_id: str
    resources: List[Dict[str, Any]]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
