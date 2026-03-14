"""GUI auth: JWT sessions with VyOS credentials encrypted inside."""
import base64
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import hashlib
import hmac
from cryptography.fernet import Fernet
from jose import JWTError, jwt

from .config import settings

ALGORITHM = "HS256"

# PBKDF2-SHA256: produces a plain hex digest (no $ signs) — safe in .env files
_ITERATIONS = 260_000


def _pbkdf2(plain: str) -> str:
    salt = settings.secret_key.encode()[:16]
    return hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, _ITERATIONS).hex()


def verify_password(plain: str, stored: str) -> bool:
    return hmac.compare_digest(_pbkdf2(plain), stored)


def hash_password(plain: str) -> str:
    return _pbkdf2(plain)


def _fernet() -> Fernet:
    """Derive a Fernet key from SECRET_KEY (first 32 bytes, base64-url-encoded)."""
    raw = settings.secret_key.encode()[:32].ljust(32, b"\x00")
    key = base64.urlsafe_b64encode(raw)
    return Fernet(key)


def encrypt_vyos_creds(creds: dict[str, Any]) -> str:
    return _fernet().encrypt(json.dumps(creds).encode()).decode()


def decrypt_vyos_creds(token: str) -> dict[str, Any]:
    return json.loads(_fernet().decrypt(token.encode()))


def create_access_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
