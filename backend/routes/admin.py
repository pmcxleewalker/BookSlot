"""Super admin (platform owner) endpoints."""
import re
from datetime import timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from core import config
from core.db import db
from core.deps import get_super_admin
from core.plans import PLAN_FEATURES, plan_features
from core.security import (clear_auth_cookie, create_jwt_token, hash_password, now_iso, now_utc, new_id,
                           random_token, rate_limit, set_auth_cookie, sha256, validate_password, verify_password)
from routes.tenants import INDUSTRIES, create_tenant_record, public_tenant, validate_tenant_fields

router = APIRouter()


class AdminLogin(BaseModel):
    email: str
    password: str


async def bootstrap_super_admin() -> None:
    """Create the first super admin from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD if it doesn't exist."""
    if not config.SUPER_ADMIN_EMAIL or not config.SUPER_ADMIN_PASSWORD:
        return
    if await db.super_admins.find_one({"email": config.SUPER_ADMIN_EMAIL}, {"_id": 1}):
        return
    if len(config.SUPER_ADMIN_PASSWORD) < 10:
        raise RuntimeError("SUPER_ADMIN_PASSWORD must be at least 10 characters")
    await db.super_admins.insert_one({
        "admin_id": new_id("admin"), "email": config.SUPER_ADMIN_EMAIL, "name": config.SUPER_ADMIN_NAME,
        "password_hash": hash_password(config.SUPER_ADMIN_PASSWORD), "created_at": now_iso(),
    })


@router.post("/admin/login")
async def admin_login(body: AdminLogin, request: Request, response: Response):
    rate_limit(request, "admin_login", 5, 300)
    admin = await db.super_admins.find_one({"email": body.email.strip().lower()}, {"_id": 0})
    if not admin or not verify_password(body.password, admin.get("password_hash")):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = f"adm_{random_token(32)}"
    await db.admin_sessions.delete_many({"admin_id": admin["admin_id"], "expires_at": {"$lt": now_iso()}})
    await db.admin_sessions.insert_one({
        "admin_id": admin["admin_id"], "token_hash": sha256(token),
        "expires_at": (now_utc() + timedelta(hours=12)).isoformat(), "created_at": now_iso(),
    })
    set_auth_cookie(response, "admin_session_token", token, 12 * 3600)
    return {"admin": {"admin_id": admin["admin_id"], "email": admin["email"], "name": admin.get("name")}, "token": token}


@router.get("/admin/me")
async def admin_me(admin: Dict = Depends(get_super_admin)):
    return {"admin_id": admin["admin_id"], "email": admin["email"], "name": admin.get("name")}


@router.post("/admin/logout")
async def admin_logout(request: Request, response: Response):
    from core.security import bearer_or_cookie
    token = bearer_or_cookie(request, "admin_session_token")
    if token:
        await db.admin_sessions.delete_many({"token_hash": sha256(token)})
    clear_auth_cookie(response, "admin_session_token")
    return {"message": "Logged out"}


@router.post("/admin/change-password")
async def admin_change_password(body: Dict[str, Any], admin: Dict = Depends(get_super_admin)):
    full = await db.super_admins.find_one({"admin_id": admin["admin_id"]}, {"_id": 0})
    if not verify_password(body.get("current_password") or "", full.get("password_hash")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    new = validate_password(body.get("new_password"))
    await db.super_admins.update_one({"admin_id": admin["admin_id"]}, {"$set": {"password_hash": hash_password(new)}})
    await db.admin_sessions.delete_many({"admin_id": admin["admin_id"]})
    return {"message": "Password changed. Please log in again."}


@router.get("/admin/tenants")
async def admin_tenants(admin: Dict = Depends(get_super_admin), search: Optional[str] = None, plan: Optional[str] = None,
                        is_active: Optional[bool] = None):
    query: Dict[str, Any] = {}
    if search:
        pattern = re.escape(search.strip()[:100])
        query["$or"] = [{"name": {"$regex": pattern, "$options": "i"}}, {"email": {"$regex": pattern, "$options": "i"}}]
    if plan:
        query["plan"] = plan
    if is_active is not None:
        query["is_active"] = is_active
    tenants = await db.tenants.find(query, {"_id": 0, "api_key_hash": 0}).sort("created_at", -1).to_list(1000)
    for t in tenants:
        t["staff_count"] = await db.staff.count_documents({"tenant_id": t["tenant_id"], "is_active": True})
        t["client_count"] = await db.clients.count_documents({"tenant_id": t["tenant_id"]})
        t["appointment_count"] = await db.appointments.count_documents({"tenant_id": t["tenant_id"]})
    return {"tenants": tenants}


@router.get("/admin/tenants/{tenant_id}")
async def admin_tenant(tenant_id: str, admin: Dict = Depends(get_super_admin)):
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    owner = await db.users.find_one({"tenant_id": tenant_id, "role": "owner"}, {"_id": 0, "password_hash": 0})
    staff = await db.staff.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(200)
    services = await db.services.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(200)
    month_start = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    stats = {
        "staff_count": len([s for s in staff if s.get("is_active", True)]),
        "services_count": len([s for s in services if s.get("is_active", True)]),
        "client_count": await db.clients.count_documents({"tenant_id": tenant_id}),
        "total_appointments": await db.appointments.count_documents({"tenant_id": tenant_id}),
        "month_appointments": await db.appointments.count_documents({"tenant_id": tenant_id, "created_at": {"$gte": month_start}}),
    }
    return {"tenant": public_tenant(tenant), "owner": owner, "staff": staff, "services": services, "stats": stats,
            "features": plan_features(tenant)}


@router.post("/admin/tenants")
async def admin_create_tenant(body: Dict[str, Any], admin: Dict = Depends(get_super_admin)):
    for field in ("business_name", "owner_name", "owner_email", "owner_password"):
        if not str(body.get(field) or "").strip():
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    owner_email = str(body["owner_email"]).strip().lower()
    validate_password(body["owner_password"])
    if await db.users.find_one({"email": owner_email}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="That owner email is already registered")
    data = validate_tenant_fields({
        "name": body["business_name"], "industry": body.get("industry") if body.get("industry") in INDUSTRIES else "other",
        "email": body.get("business_email") or owner_email, "phone": body.get("phone"), "address": body.get("address"),
        "timezone": body.get("timezone") or "Europe/Dublin", "currency": body.get("currency") or "EUR",
    })
    tenant = await create_tenant_record(data, plan=body.get("plan", "starter"), onboarding_completed=False)
    user = {
        "user_id": new_id("user"), "email": owner_email, "name": str(body["owner_name"]).strip()[:120], "picture": None,
        "tenant_id": tenant["tenant_id"], "role": "owner", "is_active": True, "token_version": 0,
        "password_hash": hash_password(body["owner_password"]), "created_at": now_iso(),
    }
    await db.users.insert_one({**user})
    return {"tenant": public_tenant(tenant), "owner": {"user_id": user["user_id"], "email": user["email"], "name": user["name"]},
            "features": plan_features(tenant)}


ADMIN_TENANT_FIELDS = ["name", "email", "phone", "address", "timezone", "currency", "industry", "plan", "is_active",
                       "sms_number", "sms_addon_enabled", "feature_overrides", "booking_url_slug", "notes"]


@router.put("/admin/tenants/{tenant_id}")
async def admin_update_tenant(tenant_id: str, updates: Dict[str, Any], admin: Dict = Depends(get_super_admin)):
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    data = {k: v for k, v in updates.items() if k in ADMIN_TENANT_FIELDS}
    if "plan" in data and data["plan"] not in PLAN_FEATURES:
        raise HTTPException(status_code=400, detail="Unknown plan")
    if "feature_overrides" in data:
        valid = set(PLAN_FEATURES["pro"].keys()) - {"name", "price"}
        data["feature_overrides"] = {k: v for k, v in (data["feature_overrides"] or {}).items() if k in valid}
    if "is_active" in data:
        data["is_active"] = bool(data["is_active"])
    data = validate_tenant_fields(data)
    if "booking_url_slug" in data and await db.tenants.find_one(
            {"booking_url_slug": data["booking_url_slug"], "tenant_id": {"$ne": tenant_id}}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="That booking link is taken")
    data["updated_at"] = now_iso()
    await db.tenants.update_one({"tenant_id": tenant_id}, {"$set": data})
    if "is_active" in data:
        await db.users.update_many({"tenant_id": tenant_id}, {"$set": {"is_active": data["is_active"]}})
    updated = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0})
    return {"tenant": public_tenant(updated), "features": plan_features(updated),
            "plan_changed": tenant.get("plan") != updated.get("plan")}


@router.delete("/admin/tenants/{tenant_id}")
async def admin_deactivate_tenant(tenant_id: str, admin: Dict = Depends(get_super_admin)):
    result = await db.tenants.update_one({"tenant_id": tenant_id}, {"$set": {"is_active": False, "updated_at": now_iso()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
    await db.users.update_many({"tenant_id": tenant_id}, {"$set": {"is_active": False}})
    return {"message": "Tenant deactivated"}


@router.post("/admin/tenants/{tenant_id}/activate")
async def admin_activate_tenant(tenant_id: str, admin: Dict = Depends(get_super_admin)):
    result = await db.tenants.update_one({"tenant_id": tenant_id}, {"$set": {"is_active": True, "updated_at": now_iso()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
    await db.users.update_many({"tenant_id": tenant_id}, {"$set": {"is_active": True}})
    return {"message": "Tenant activated"}


@router.get("/admin/stats")
async def admin_stats(admin: Dict = Depends(get_super_admin)):
    month_start = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    total = await db.tenants.count_documents({})
    active = await db.tenants.count_documents({"is_active": True})
    plans = {p: await db.tenants.count_documents({"plan": p, "is_active": True}) for p in PLAN_FEATURES}
    sms = await db.tenants.count_documents({"is_active": True, "sms_addon_enabled": True})
    mrr = sum(plans[p] * PLAN_FEATURES[p]["price"] for p in plans) + sms * config.SMS_ADDON_PRICE
    return {
        "tenants": {"total": total, "active": active, "inactive": total - active,
                    "new_this_month": await db.tenants.count_documents({"created_at": {"$gte": month_start}})},
        "plans": plans,
        "revenue": {"mrr": mrr, "currency": "EUR"},
        "users": {"total": await db.users.count_documents({})},
        "appointments": {"total": await db.appointments.count_documents({}),
                         "this_month": await db.appointments.count_documents({"created_at": {"$gte": month_start}})},
    }


@router.post("/admin/impersonate/{user_id}")
async def admin_impersonate(user_id: str, admin: Dict = Depends(get_super_admin)):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    token = create_jwt_token(user["user_id"], user.get("tenant_id"), int(user.get("token_version", 0)))
    await db.impersonation_logs.insert_one({"admin_id": admin["admin_id"], "user_id": user_id,
                                            "tenant_id": user.get("tenant_id"), "created_at": now_iso()})
    # Token is returned (not set as a cookie) so the admin's own browser session isn't replaced
    return {"user": user, "token": token, "message": "Impersonation token created"}
