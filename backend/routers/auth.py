"""GUI authentication: login / logout."""
import logging
from typing import Annotated

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel

from core.config import settings
from core.security import (
    create_access_token,
    encrypt_vyos_creds,
    verify_password,
)
from vyos.models import VyOSCredentials

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)

COOKIE_NAME = "session"


class LoginRequest(BaseModel):
    username: str
    password: str
    # VyOS connection overrides (optional — fall back to env defaults)
    vyos_host: str | None = None
    vyos_port: int | None = None
    vyos_ssh_user: str | None = None
    vyos_ssh_password: str | None = None
    vyos_api_key: str | None = None
    vyos_api_url: str | None = None
    vyos_tls_verify: bool | None = None


@router.post("/login")
async def login(req: LoginRequest, response: Response):
    if req.username != settings.gui_username or not verify_password(req.password, settings.gui_password_hash):
        logger.warning("Failed login attempt for user %r", req.username)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    creds = VyOSCredentials(
        host=req.vyos_host or settings.vyos_host,
        port=req.vyos_port or settings.vyos_port,
        ssh_user=req.vyos_ssh_user or settings.vyos_ssh_user,
        ssh_password=req.vyos_ssh_password or settings.vyos_ssh_password,
        api_key=req.vyos_api_key or settings.vyos_api_key,
        api_url=req.vyos_api_url or settings.vyos_api_url,
        tls_verify=req.vyos_tls_verify if req.vyos_tls_verify is not None else settings.vyos_tls_verify,
    )
    encrypted = encrypt_vyos_creds(creds.model_dump())
    token = create_access_token({"sub": req.username, "vyos_creds": encrypted})

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,  # set True in production with HTTPS
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
    )
    logger.info('{"event": "login", "user": "%s"}', req.username)
    return {"status": "ok", "username": req.username}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME)
    return {"status": "ok"}
