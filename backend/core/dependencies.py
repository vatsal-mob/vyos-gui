"""FastAPI dependency injection."""
from fastapi import Cookie, HTTPException, status
from jose import JWTError

from core.security import decrypt_vyos_creds, decode_access_token
from vyos.client import VyOSClient
from vyos.models import VyOSCredentials


def get_vyos_client(session: str | None = Cookie(default=None)) -> VyOSClient:
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token(session)
        encrypted_creds = payload.get("vyos_creds")
        if not encrypted_creds:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
        creds_dict = decrypt_vyos_creds(encrypted_creds)
        creds = VyOSCredentials(**creds_dict)
    except (JWTError, Exception):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")
    return VyOSClient(creds)
