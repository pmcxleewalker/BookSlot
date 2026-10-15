import hashlib
import secrets
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any, Deque, Dict, Iterable, Optional

import bcrypt
import jwt
from fastapi import HTTPException, Request, Response

from . import config


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


def new_id(prefix: str, length: int = 12) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:length]}"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: Optional[str]) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def validate_password(password: Optional[str]) -> str:
    if not password or len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if len(password) > 128:
        raise HTTPException(status_code=400, detail="Password is too long")
    return password


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def random_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def create_jwt_token(user_id: str, tenant_id: Optional[str] = None, token_version: int = 0) -> str:
    payload = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "tv": token_version,
        "exp": now_utc() + timedelta(hours=config.JWT_EXPIRATION_HOURS),
        "iat": now_utc(),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def decode_jwt_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session")


def set_auth_cookie(response: Response, key: str, value: str, max_age: int) -> None:
    response.set_cookie(
        key=key,
        value=value,
        httponly=True,
        secure=config.COOKIE_SECURE,
        samesite=config.COOKIE_SAMESITE,
        path="/",
        max_age=max_age,
    )


def clear_auth_cookie(response: Response, key: str) -> None:
    response.delete_cookie(key=key, path="/", secure=config.COOKIE_SECURE, samesite=config.COOKIE_SAMESITE)


def bearer_or_cookie(request: Request, cookie_name: str) -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        if token and token not in ("null", "undefined"):
            return token
    return request.cookies.get(cookie_name)


# ---------- Rate limiting (in-memory, per process) ----------
_hits: Dict[str, Deque[float]] = defaultdict(deque)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(request: Request, bucket: str, limit: int, window_seconds: int) -> None:
    if config.RATE_LIMIT_SCALE <= 0:
        return
    limit = max(1, int(limit * config.RATE_LIMIT_SCALE))
    key = f"{bucket}:{client_ip(request)}"
    now = time.monotonic()
    q = _hits[key]
    while q and q[0] <= now - window_seconds:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment and try again.")
    q.append(now)
    if len(_hits) > 50000:  # keep memory bounded
        _hits.clear()


# ---------- Input helpers ----------
def pick(data: Dict[str, Any], allowed: Iterable[str]) -> Dict[str, Any]:
    """Keep only whitelisted keys (prevents mass-assignment of protected fields)."""
    allowed = set(allowed)
    return {k: v for k, v in (data or {}).items() if k in allowed}
