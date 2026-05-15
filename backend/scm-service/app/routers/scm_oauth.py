"""
GitHub OAuth Router for SCM Integration.
Handles the OAuth flow to connect a user's GitHub account for repository access.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from urllib.parse import quote
from datetime import datetime
import httpx

from app.config import settings
from app.database.connection import get_db
from app.auth.jwt import verify_token

router = APIRouter(prefix="/api", tags=["scm-oauth"])


@router.get("/scm/oauth/github/login")
async def github_scm_login(token: str):
    """
    Redirect the user to the GitHub App installation page.
    
    The user's JWT is passed as a query param so we can identify them
    on callback (since callbacks are public routes with no JWT header).
    We encode their identity into the 'state' parameter.
    """
    if not settings.GITHUB_APP_NAME:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub App is not configured. Set GITHUB_APP_NAME in .env"
        )
    
    # Verify the JWT to get the username
    try:
        payload = await verify_token(token)
        username = payload.get("sub")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no username found"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}"
        )
    
    # Encode the username into a signed state parameter
    from jose import jwt as jose_jwt
    state_data = {"sub": username, "provider": "github_app"}
    state = jose_jwt.encode(state_data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    
    # Build GitHub App Installation URL
    github_auth_url = f"https://github.com/apps/{settings.GITHUB_APP_NAME}/installations/new?state={state}"
    
    print(f"🔑 GitHub App Installation: Redirecting user '{username}' to GitHub")
    return RedirectResponse(url=github_auth_url)


@router.get("/scm/oauth/github/callback")
async def github_scm_callback(
    installation_id: str = None,
    setup_action: str = None,
    state: str = None,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Handle the GitHub App setup callback.
    
    Flow:
    1. Decode state to identify the InfraX user
    2. Retrieve installation_id from GitHub redirect
    3. Upsert the credential with auth_type=github_app and installation_id
    4. Redirect to the frontend Settings page
    """
    if not installation_id or not state:
        # If user cancelled or something went wrong, they might not have installation_id
        error = "Installation cancelled or failed"
        print(f"❌ GitHub App Installation: {error}")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings?scm_oauth=error&message=Installation+failed+or+cancelled"
        )
    
    # 1. Decode state to get the InfraX username
    try:
        from jose import jwt as jose_jwt
        state_data = jose_jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        infrax_username = state_data.get("sub")
        if not infrax_username:
            raise ValueError("No username in state")
    except Exception as e:
        print(f"❌ GitHub App Installation: Invalid state parameter: {e}")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings?scm_oauth=error&message=Invalid+state+parameter"
        )
    
    print(f"🔑 GitHub App Installation callback for user: {infrax_username}, Installation ID: {installation_id}")
    
    # Look up the user to get their user_id
    user_doc = await db.users.find_one({"username": infrax_username})
    if not user_doc:
        print(f"❌ GitHub App Installation: User '{infrax_username}' not found in DB")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings?scm_oauth=error&message=User+not+found"
        )
    user_id = str(user_doc["_id"])
    
    # 4. Upsert credential in user_scm_credentials
    now = datetime.utcnow()
    
    # Check if a GitHub App credential already exists for this user + github
    existing = await db.user_scm_credentials.find_one({
        "user_id": user_id,
        "scm_name": "github",
        "auth_type": "github_app"
    })
    
    credential_data = {
        "scm_name": "github",
        "username": "github-app-installation",  # Username isn't directly known unless we fetch installation details
        "pat": None,
        "auth_type": "github_app",
        "installation_id": str(installation_id),
        "user_id": user_id,
        "base_url": None,
        "updated_at": now,
    }
    
    if existing:
        # Update existing GitHub App credential
        await db.user_scm_credentials.update_one(
            {"_id": existing["_id"]},
            {"$set": credential_data}
        )
        print(f"🔄 GitHub App: Updated existing installation {installation_id} for {infrax_username}")
    else:
        # Create new GitHub App credential
        credential_data["created_at"] = now
        await db.user_scm_credentials.insert_one(credential_data)
        print(f"✅ GitHub App: Created new installation {installation_id} for {infrax_username}")
    
    # 5. Redirect to frontend Settings page
    redirect_url = f"{settings.FRONTEND_URL}/settings?scm_oauth=success&provider=github"
    print(f"✅ GitHub App setup complete for {infrax_username}, redirecting to frontend")
    return RedirectResponse(url=redirect_url)
