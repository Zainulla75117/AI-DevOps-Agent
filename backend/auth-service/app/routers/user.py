from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from datetime import timedelta
import httpx
from urllib.parse import quote
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

@router.post("/token", response_model=TokenResponse)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncIOMotorDatabase = Depends(get_db)):
    """Swagger UI specific token endpoint (expects form data)."""
    db_user = await crud_user.get_user_by_username(db, form_data.username)
    if not db_user or db_user.password != form_data.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not db_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.username}, expires_delta=access_token_expires
    )
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=TokenUser(username=db_user.username)
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
    
    if db_user.password is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account uses GitHub login. Please use 'Continue with GitHub' instead."
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
            username=db_user.username
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


# ═══════════════════════════════════════════════════════════════════════
#  GitHub OAuth Endpoints
# ═══════════════════════════════════════════════════════════════════════

@router.get("/github/login")
async def github_login():
    """
    Redirect the user to GitHub's OAuth authorization page.
    The user will be asked to authorize the InfraX application.
    """
    if not settings.GITHUB_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub OAuth is not configured. Set GITHUB_CLIENT_ID in .env"
        )
    
    github_auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.GITHUB_CLIENT_ID}"
        f"&redirect_uri={quote(settings.GITHUB_REDIRECT_URI)}"
        f"&scope=user:email"
    )
    return RedirectResponse(url=github_auth_url)


@router.get("/github/callback")
async def github_callback(code: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """
    Handle the GitHub OAuth callback.
    
    Flow:
    1. Exchange the authorization code for a GitHub access token.
    2. Fetch the GitHub user's profile.
    3. Find or create the user in MongoDB.
    4. Create a JWT token and redirect to the frontend.
    """
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing authorization code"
        )

    # 1. Exchange code for GitHub access token
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_resp = await client.post(
                "https://github.com/login/oauth/access_token",
                json={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                },
                headers={"Accept": "application/json"},
            )
            token_data = token_resp.json()
    except Exception as e:
        print(f"❌ GitHub token exchange failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to exchange code with GitHub: {str(e)}"
        )

    gh_access_token = token_data.get("access_token")
    if not gh_access_token:
        error_desc = token_data.get("error_description", token_data.get("error", "Unknown error"))
        print(f"❌ GitHub OAuth error: {error_desc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub OAuth error: {error_desc}"
        )

    # 2. Fetch GitHub user profile
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            user_resp = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {gh_access_token}",
                    "Accept": "application/vnd.github+json",
                },
            )
            gh_user = user_resp.json()

            # Fetch primary email if not public
            email = gh_user.get("email") or ""
            if not email:
                emails_resp = await client.get(
                    "https://api.github.com/user/emails",
                    headers={
                        "Authorization": f"Bearer {gh_access_token}",
                        "Accept": "application/vnd.github+json",
                    },
                )
                if emails_resp.status_code == 200:
                    emails = emails_resp.json()
                    primary = next((e for e in emails if e.get("primary")), None)
                    if primary:
                        email = primary["email"]
    except Exception as e:
        print(f"❌ GitHub user fetch failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch GitHub user profile: {str(e)}"
        )

    github_id = gh_user.get("id")
    username = gh_user.get("login", "")
    avatar_url = gh_user.get("avatar_url", "")

    if not github_id or not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid GitHub user profile"
        )

    print(f"🔑 GitHub user authenticated: {username} (id={github_id}, email={email})")

    # 3. Find or create user in MongoDB
    db_user = await crud_user.get_or_create_github_user(
        db,
        github_id=github_id,
        username=username,
        email=email,
        avatar_url=avatar_url,
    )

    # 4. Create JWT token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.username},
        expires_delta=access_token_expires,
    )

    # 5. Redirect to frontend with token in URL params
    frontend_url = settings.FRONTEND_URL
    redirect_url = (
        f"{frontend_url}/auth/github/callback"
        f"?token={access_token}"
        f"&username={quote(db_user.username)}"
        f"&email={quote(db_user.email or '')}"
        f"&avatar_url={quote(db_user.avatar_url or '')}"
    )
    
    print(f"✅ GitHub OAuth complete for {db_user.username}, redirecting to frontend")
    return RedirectResponse(url=redirect_url)


# ═══════════════════════════════════════════════════════════════════════
#  Google OAuth Endpoints
# ═══════════════════════════════════════════════════════════════════════

@router.get("/google/login")
async def google_login():
    """
    Redirect the user to Google's OAuth authorization page.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth is not configured. Set GOOGLE_CLIENT_ID in .env"
        )
    
    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={quote(settings.GOOGLE_REDIRECT_URI)}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&access_type=offline"
    )
    return RedirectResponse(url=google_auth_url)


@router.get("/google/callback")
async def google_callback(code: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """
    Handle the Google OAuth callback.
    
    Flow:
    1. Exchange the authorization code for tokens.
    2. Fetch the Google user's profile from the userinfo endpoint.
    3. Find or create the user in MongoDB.
    4. Create a JWT token and redirect to the frontend.
    """
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing authorization code"
        )

    # 1. Exchange code for Google tokens
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_data = token_resp.json()
    except Exception as e:
        print(f"❌ Google token exchange failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to exchange code with Google: {str(e)}"
        )

    google_access_token = token_data.get("access_token")
    if not google_access_token:
        error_desc = token_data.get("error_description", token_data.get("error", "Unknown error"))
        print(f"❌ Google OAuth error: {error_desc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google OAuth error: {error_desc}"
        )

    # 2. Fetch Google user profile
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            user_resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {google_access_token}"},
            )
            g_user = user_resp.json()
    except Exception as e:
        print(f"❌ Google user fetch failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch Google user profile: {str(e)}"
        )

    google_id = g_user.get("sub")
    email = g_user.get("email", "")
    name = g_user.get("name", "")
    avatar_url = g_user.get("picture", "")

    if not google_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Google user profile"
        )

    # Use email prefix as username (Google doesn't have a 'login' like GitHub)
    username = email.split("@")[0] if email else name.replace(" ", "").lower()

    print(f"🔑 Google user authenticated: {username} (id={google_id}, email={email})")

    # 3. Find or create user in MongoDB
    db_user = await crud_user.get_or_create_google_user(
        db,
        google_id=google_id,
        username=username,
        email=email,
        avatar_url=avatar_url,
    )

    # 4. Create JWT token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.username},
        expires_delta=access_token_expires,
    )

    # 5. Redirect to frontend with token
    frontend_url = settings.FRONTEND_URL
    redirect_url = (
        f"{frontend_url}/auth/google/callback"
        f"?token={access_token}"
        f"&username={quote(db_user.username)}"
        f"&email={quote(db_user.email or '')}"
        f"&avatar_url={quote(db_user.avatar_url or '')}"
    )
    
    print(f"✅ Google OAuth complete for {db_user.username}, redirecting to frontend")
    return RedirectResponse(url=redirect_url)
