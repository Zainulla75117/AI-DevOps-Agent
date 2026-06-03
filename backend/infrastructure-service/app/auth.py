"""
Authentication and JWT validation.
"""

import jwt
from fastapi import HTTPException
import logging
from config import settings
from typing import Optional

logger = logging.getLogger(__name__)

def extract_token(token_query: Optional[str], authorization: Optional[str]) -> str:
    if authorization and authorization.startswith("Bearer "):
        return authorization.replace("Bearer ", "")
    if token_query:
        return token_query
    raise HTTPException(status_code=401, detail="Not authenticated")

def validate_jwt(token_query: Optional[str], authorization: Optional[str]) -> bool:
    try:
        token = extract_token(token_query, authorization)
        jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return True
    except Exception as e:
        logger.warning(f"JWT Validation failed: {e}")
        return False

def extract_user_id(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("sub") or payload.get("user_id") or payload.get("id")
    except Exception:
        return None

def require_auth(token: Optional[str] = None, authorization: Optional[str] = None) -> str:
    t = extract_token(token, authorization)
    if not validate_jwt(t, f"Bearer {t}"):
        raise HTTPException(status_code=401, detail="Invalid token")
    return t
