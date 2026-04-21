from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    """Base schema for user with common fields."""
    username: str
    email: Optional[EmailStr] = None

class UserCreate(UserBase):
    """Schema for creating a new user."""
    password: str

class UserUpdate(BaseModel):
    """Schema for updating a user."""
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None

class UserLogin(BaseModel):
    """Schema for user login."""
    username: str
    password: str

class UserResponse(UserBase):
    """Schema for user response."""
    id: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class GitHubCallbackRequest(BaseModel):
    """Schema for GitHub OAuth callback."""
    code: str

class TokenUser(BaseModel):
    """Schema for user info in token response."""
    username: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    auth_provider: str = "local"

class TokenResponse(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str
    user: TokenUser

