from fastapi import APIRouter
from app.services.crypto_service import crypto_service

router = APIRouter(
    prefix="/api/crypto",
    tags=["crypto"],
    responses={404: {"description": "Not found"}},
)

@router.get("/public-key")
async def get_public_key():
    """
    Returns the RSA public key for the frontend to encrypt the symmetric keys.
    """
    return {
        "public_key": crypto_service.get_public_key_pem()
    }
