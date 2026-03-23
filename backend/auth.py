"""
Authentication module for TimeSlot Pro
Supports both JWT-based auth and Emergent Google OAuth
"""
import os
import uuid
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from fastapi import HTTPException, Request, Response
from passlib.context import CryptContext
import jwt
import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from models import User, UserSession, generate_id

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings - REQUIRE secret in production
JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    logger.warning("JWT_SECRET not set - generating random secret (not suitable for production)")
    JWT_SECRET = secrets.token_hex(32)
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Emergent OAuth settings
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_jwt_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


async def get_current_user(
    request: Request, db: AsyncIOMotorDatabase
) -> Optional[User]:
    """
    Get current user from session token (cookie) or Authorization header (JWT/Bearer)
    """
    # Try cookie first (for Emergent OAuth)
    session_token = request.cookies.get("session_token")
    
    if session_token:
        # Validate session
        session_doc = await db.user_sessions.find_one(
            {"session_token": session_token},
            {"_id": 0}
        )
        if session_doc:
            expires_at = session_doc.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if expires_at > datetime.now(timezone.utc):
                user_doc = await db.users.find_one(
                    {"user_id": session_doc["user_id"]},
                    {"_id": 0}
                )
                if user_doc:
                    return User(**user_doc)
    
    # Try Authorization header (for JWT)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        
        # First try as session token
        session_doc = await db.user_sessions.find_one(
            {"session_token": token},
            {"_id": 0}
        )
        if session_doc:
            expires_at = session_doc.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if expires_at > datetime.now(timezone.utc):
                user_doc = await db.users.find_one(
                    {"user_id": session_doc["user_id"]},
                    {"_id": 0}
                )
                if user_doc:
                    return User(**user_doc)
        
        # Then try as JWT
        payload = decode_jwt_token(token)
        if payload:
            user_doc = await db.users.find_one(
                {"user_id": payload["user_id"]},
                {"_id": 0}
            )
            if user_doc:
                return User(**user_doc)
    
    return None


async def require_auth(request: Request, db: AsyncIOMotorDatabase) -> User:
    """Require authentication - raises 401 if not authenticated"""
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def exchange_emergent_session(session_id: str) -> Optional[dict]:
    """
    Exchange Emergent session_id for user data
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                EMERGENT_SESSION_URL,
                headers={"X-Session-ID": session_id}
            )
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        print(f"Error exchanging Emergent session: {e}")
    return None


async def create_user_session(
    db: AsyncIOMotorDatabase,
    user_id: str,
    session_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> UserSession:
    """Create a new user session"""
    session = UserSession(
        user_id=user_id,
        session_token=session_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    doc = session.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    doc["expires_at"] = doc["expires_at"].isoformat()
    
    await db.user_sessions.insert_one(doc)
    return session


async def invalidate_session(db: AsyncIOMotorDatabase, session_token: str):
    """Invalidate a session"""
    await db.user_sessions.delete_one({"session_token": session_token})


def set_session_cookie(response: Response, session_token: str):
    """Set session cookie with proper settings"""
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=60 * 60 * 24 * 7  # 7 days
    )


def clear_session_cookie(response: Response):
    """Clear session cookie"""
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )


# API Key authentication for Moltbot/integrations
def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def generate_api_key() -> Tuple[str, str, str]:
    """Generate API key, returns (full_key, key_hash, key_prefix)"""
    key = f"tsp_{secrets.token_urlsafe(32)}"
    key_hash = hash_api_key(key)
    key_prefix = key[:12]
    return key, key_hash, key_prefix


async def validate_api_key(
    request: Request, db: AsyncIOMotorDatabase
) -> Optional[dict]:
    """Validate API key from X-API-Key header"""
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        return None
    
    key_hash = hash_api_key(api_key)
    api_key_doc = await db.api_keys.find_one(
        {"key_hash": key_hash, "is_active": True},
        {"_id": 0}
    )
    
    if api_key_doc:
        # Update last used
        await db.api_keys.update_one(
            {"key_hash": key_hash},
            {"$set": {"last_used": datetime.now(timezone.utc).isoformat()}}
        )
        return api_key_doc
    
    return None
