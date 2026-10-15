"""Authentication and authorization dependencies."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, Request

from .db import db
from .plans import FEATURE_LABELS, plan_features
from .security import bearer_or_cookie, decode_jwt_token, sha256

STAFF_PERMISSIONS = [
    "can_view_all_bookings",
    "can_edit_services",
    "can_manage_staff",
    "can_view_reports",
    "can_manage_customers",
]


async def get_current_user(request: Request) -> Dict[str, Any]:
    token = bearer_or_cookie(request, "session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_jwt_token(token)
    user = await db.users.find_one({"user_id": payload.get("user_id")}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="This account has been disabled")
    # Tokens issued before a password change/logout-everywhere are rejected
    if int(payload.get("tv", 0)) != int(user.get("token_version", 0)):
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    if payload.get("imp"):
        user["impersonated_by"] = payload["imp"]
    return user


@dataclass
class Actor:
    user: Dict[str, Any]
    tenant: Dict[str, Any]
    staff: Optional[Dict[str, Any]] = None
    is_manager: bool = False
    features: Dict[str, Any] = field(default_factory=dict)

    @property
    def tenant_id(self) -> str:
        return self.tenant["tenant_id"]

    @property
    def user_id(self) -> str:
        return self.user["user_id"]

    def can(self, perm: str) -> bool:
        if self.is_manager:
            return True
        if not self.staff:
            return False
        default = perm == "can_manage_customers"
        return bool(self.staff.get(perm, default))

    def require(self, perm: str, message: str = "You don't have permission to do that") -> None:
        if not self.can(perm):
            raise HTTPException(status_code=403, detail=message)

    def require_manager(self) -> None:
        if not self.is_manager:
            raise HTTPException(status_code=403, detail="Only the business owner or an admin can do that")

    def require_feature(self, feature: str) -> None:
        if not self.features.get(feature):
            label = FEATURE_LABELS.get(feature, feature.replace("_", " "))
            raise HTTPException(status_code=403, detail=f"Your plan doesn't include {label}. Upgrade to unlock it.")


async def get_actor(user: Dict[str, Any] = Depends(get_current_user)) -> Actor:
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found. Please complete onboarding first.")
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    if not tenant.get("is_active", True):
        raise HTTPException(status_code=403, detail="This business account is deactivated. Please contact support.")
    staff = await db.staff.find_one({"tenant_id": tenant["tenant_id"], "user_id": user["user_id"]}, {"_id": 0})
    role = user.get("role", "owner")
    is_manager = role in ("owner", "admin") or (staff is not None and staff.get("role") == "admin")
    return Actor(user=user, tenant=tenant, staff=staff, is_manager=is_manager, features=plan_features(tenant))


async def get_manager(actor: Actor = Depends(get_actor)) -> Actor:
    actor.require_manager()
    return actor


# ---------- Super admin ----------
async def get_super_admin(request: Request) -> Dict[str, Any]:
    token = bearer_or_cookie(request, "admin_session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated as super admin")
    session = await db.admin_sessions.find_one({"token_hash": sha256(token)}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid admin session")
    expires_at = datetime.fromisoformat(session["expires_at"])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Admin session expired")
    admin = await db.super_admins.find_one({"admin_id": session["admin_id"]}, {"_id": 0, "password_hash": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return admin
