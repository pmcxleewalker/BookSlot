import logging
from datetime import timedelta
from typing import Any, Dict

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr

from core import config
from core.db import db
from core.deps import STAFF_PERMISSIONS, Actor, get_current_user
from core.notify import send_email
from core.security import (clear_auth_cookie, create_jwt_token, hash_password, now_iso, now_utc, new_id,
                           random_token, rate_limit, set_auth_cookie, sha256, validate_password, verify_password)

router = APIRouter()
logger = logging.getLogger("bookslot.auth")


class RegisterBody(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


def public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "picture": user.get("picture"),
        "tenant_id": user.get("tenant_id"),
        "role": user.get("role", "owner"),
        "is_active": user.get("is_active", True),
    }


def issue_session(response: Response, user: Dict[str, Any]) -> Dict[str, Any]:
    token = create_jwt_token(user["user_id"], user.get("tenant_id"), int(user.get("token_version", 0)))
    set_auth_cookie(response, "session_token", token, config.JWT_EXPIRATION_HOURS * 3600)
    return {"user": public_user(user), "token": token}


@router.get("/auth/config")
async def auth_config():
    """Public settings the frontend needs at runtime."""
    return {
        "google_client_id": config.GOOGLE_CLIENT_ID or None,
        "platform_name": config.PLATFORM_NAME,
    }


@router.post("/auth/register")
async def register(body: RegisterBody, request: Request, response: Response):
    rate_limit(request, "register", 10, 3600)
    email = body.email.strip().lower()
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Please enter your name")
    validate_password(body.password)
    if await db.users.find_one({"email": email}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="An account with this email already exists. Try logging in.")
    user = {
        "user_id": new_id("user"), "email": email, "name": name[:120], "picture": None, "tenant_id": None,
        "role": "owner", "is_active": True, "token_version": 0, "password_hash": hash_password(body.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one({**user})
    return issue_session(response, user)


@router.post("/auth/login")
async def login(body: LoginBody, request: Request, response: Response):
    rate_limit(request, "login", 20, 300)
    user = await db.users.find_one({"email": body.email.strip().lower()}, {"_id": 0})
    if not user or not verify_password(body.password, user.get("password_hash")):
        if user and not user.get("password_hash"):
            raise HTTPException(status_code=401, detail="This account uses Google sign-in. Use 'Continue with Google'.")
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="This account has been disabled")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_login_at": now_iso()}})
    return issue_session(response, user)


# Kept for backwards compatibility with older frontends
@router.post("/staff/login")
async def staff_login(body: LoginBody, request: Request, response: Response):
    return await login(body, request, response)


@router.post("/auth/google")
async def google_login(request: Request, response: Response):
    """Sign in with a Google ID token produced by Google Identity Services on the frontend."""
    rate_limit(request, "google", 20, 300)
    if not config.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Google sign-in is not configured")
    body = await request.json()
    credential = body.get("credential")
    if not credential:
        raise HTTPException(status_code=400, detail="Missing Google credential")
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": credential})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Google sign-in failed")
    info = resp.json()
    if info.get("aud") != config.GOOGLE_CLIENT_ID or info.get("iss") not in ("accounts.google.com",
                                                                             "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Google sign-in failed")
    if str(info.get("email_verified")).lower() != "true" or not info.get("email"):
        raise HTTPException(status_code=401, detail="Your Google email address isn't verified")
    email = info["email"].lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="This account has been disabled")
        updates = {"google_sub": info.get("sub"), "last_login_at": now_iso()}
        if info.get("picture"):
            updates["picture"] = info["picture"]
        if not user.get("name") and info.get("name"):
            updates["name"] = info["name"]
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
        user.update(updates)
    else:
        user = {
            "user_id": new_id("user"), "email": email, "name": info.get("name") or email.split("@")[0],
            "picture": info.get("picture"), "tenant_id": None, "role": "owner", "is_active": True,
            "token_version": 0, "google_sub": info.get("sub"), "created_at": now_iso(),
        }
        await db.users.insert_one({**user})
    return issue_session(response, user)


@router.get("/auth/me")
async def get_me(user: Dict = Depends(get_current_user)):
    """Current user plus what they're allowed to do in their business (used to tailor the UI)."""
    out = public_user(user)
    out["is_manager"] = False
    out["permissions"] = {p: False for p in STAFF_PERMISSIONS}
    out["staff_id"] = None
    if user.get("tenant_id"):
        tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
        if tenant:
            staff = await db.staff.find_one({"tenant_id": tenant["tenant_id"], "user_id": user["user_id"]}, {"_id": 0})
            actor = Actor(user=user, tenant=tenant, staff=staff,
                          is_manager=user.get("role", "owner") in ("owner", "admin") or bool(staff and staff.get("role") == "admin"))
            out["is_manager"] = actor.is_manager
            out["permissions"] = {p: actor.can(p) for p in STAFF_PERMISSIONS}
            out["staff_id"] = staff["staff_id"] if staff else None
    if user.get("impersonated_by"):
        out["impersonated"] = True
    return out


@router.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookie(response, "session_token")
    return {"message": "Logged out"}


@router.post("/auth/change-password")
async def change_password(body: Dict[str, Any], response: Response, user: Dict = Depends(get_current_user)):
    current = body.get("current_password") or ""
    new = validate_password(body.get("new_password"))
    if user.get("password_hash") and not verify_password(current, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Your current password is incorrect")
    tv = int(user.get("token_version", 0)) + 1
    await db.users.update_one({"user_id": user["user_id"]},
                              {"$set": {"password_hash": hash_password(new), "token_version": tv}})
    user["token_version"] = tv
    return {**issue_session(response, user), "message": "Password changed"}


@router.post("/auth/forgot-password")
async def forgot_password(body: Dict[str, Any], request: Request):
    rate_limit(request, "forgot", 5, 900)
    email = (body.get("email") or "").strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0}) if email else None
    if user and user.get("is_active", True):
        token = random_token()
        await db.password_resets.insert_one({
            "token_hash": sha256(token), "user_id": user["user_id"], "used": False,
            "expires_at": (now_utc() + timedelta(hours=1)).isoformat(), "created_at": now_iso(),
        })
        link = f"{config.FRONTEND_URL}/reset-password?token={token}"
        await send_email(user.get("tenant_id"), email, f"Reset your {config.PLATFORM_NAME} password",
                         f"Hi {user.get('name') or ''},\n\nWe received a request to reset your password. "
                         f"Use the link below within the next hour:\n\n{link}\n\n"
                         f"If you didn't ask for this you can ignore this email.", "password_reset")
    # Same response either way so the endpoint can't be used to discover accounts
    return {"message": "If an account exists for that email, a reset link has been sent."}


@router.post("/auth/reset-password")
async def reset_password(body: Dict[str, Any], request: Request, response: Response):
    rate_limit(request, "reset", 10, 900)
    token = body.get("token") or ""
    password = validate_password(body.get("password"))
    record = await db.password_resets.find_one({"token_hash": sha256(token), "used": False}, {"_id": 0})
    if not record or record["expires_at"] < now_utc().isoformat():
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")
    user = await db.users.find_one({"user_id": record["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")
    tv = int(user.get("token_version", 0)) + 1
    await db.users.update_one({"user_id": user["user_id"]},
                              {"$set": {"password_hash": hash_password(password), "token_version": tv}})
    await db.password_resets.update_many({"user_id": user["user_id"]}, {"$set": {"used": True}})
    user["token_version"] = tv
    return {**issue_session(response, user), "message": "Password updated"}
