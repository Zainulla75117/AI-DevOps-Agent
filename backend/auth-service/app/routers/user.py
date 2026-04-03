from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from datetime import timedelta
from app.database.connection import get_db
from app.schemas.user import UserCreate, UserResponse, UserLogin, UserUpdate, TokenResponse, TokenUser
from app.crud import user as crud_user
from app.models.user import User
from app.auth.jwt import create_access_token
from app.config import settings

router = APIRouter(prefix="/api/users", tags=["users"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    """
    Register a new user and return JWT token.
    
    Args:
        user: UserCreate schema with user data
        db: MongoDB database instance
        
    Returns:
        JWT token response with user info
    """
    # Check if username already exists
    existing_user = await crud_user.get_user_by_username(db, user.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Create new user
    try:
        created_user = await crud_user.create_user(db, user)
        print(f"✅ User registration successful: {created_user.username}")
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": created_user.username},
            expires_delta=access_token_expires
        )
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=TokenUser(
                username=created_user.username,
                email=created_user.email
            )
        )
    except Exception as e:
        print(f"❌ Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )

@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def login(user: UserLogin, db: AsyncIOMotorDatabase = Depends(get_db)):
    """
    Login a user and return JWT token.
    
    Args:
        user: UserLogin schema with username and password
        db: MongoDB database instance
        
    Returns:
        JWT token response with user info
    """
    db_user = await crud_user.get_user_by_username(db, user.username)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    if db_user.password != user.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    if not db_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.username},
        expires_delta=access_token_expires
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=TokenUser(
            username=db_user.username,
            email=db_user.email
        )
    )

@router.get("", response_model=List[UserResponse], status_code=status.HTTP_200_OK)
async def get_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Get all users with pagination.
    
    Args:
        skip: Number of users to skip
        limit: Maximum number of users to return
        db: MongoDB database instance
        
    Returns:
        List of user responses
    """
    users = await crud_user.get_all_users(db, skip=skip, limit=limit)
    return [
        UserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
        for user in users
    ]

@router.get("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def get_user(user_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """
    Get a user by ID.
    
    Args:
        user_id: User ID
        db: MongoDB database instance
        
    Returns:
        User response
    """
    user = await crud_user.get_user(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at
    )

@router.put("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Update a user by ID.
    
    Args:
        user_id: User ID
        user_update: UserUpdate schema with fields to update
        db: MongoDB database instance
        
    Returns:
        Updated user response
    """
    # Check if user exists
    existing_user = await crud_user.get_user(db, user_id)
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if username is being updated and if it's already taken
    if user_update.username and user_update.username != existing_user.username:
        username_taken = await crud_user.get_user_by_username(db, user_update.username)
        if username_taken:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
    
    # Prepare update data (exclude None values)
    update_data = user_update.model_dump(exclude_unset=True)
    
    updated_user = await crud_user.update_user(db, user_id, update_data)
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        id=str(updated_user.id),
        username=updated_user.username,
        email=updated_user.email,
        is_active=updated_user.is_active,
        created_at=updated_user.created_at,
        updated_at=updated_user.updated_at
    )

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """
    Delete a user by ID.
    
    Args:
        user_id: User ID
        db: MongoDB database instance
        
    Returns:
        No content on success
    """
    deleted = await crud_user.delete_user(db, user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return None

