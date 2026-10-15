import re
from typing import Any, Dict, Optional
from zoneinfo import available_timezones

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel, EmailStr

from core import config, storage
from core.booking import DEFAULT_SETTINGS, tenant_settings
from core.db import db
from core.deps import Actor, get_actor, get_current_user, get_manager
from core.notify import email_configured, ensure_default_templates, sms_configured
from core.plans import PLAN_FEATURES, plan_features
from core.scheduling import DEFAULT_WORKING_HOURS
from core.security import new_id, now_iso, pick, random_token, sha256

router = APIRouter()

INDUSTRIES = {"salon", "clinic", "dentist", "doctor", "vet", "consultant", "other"}
CURRENCIES = {"EUR", "GBP", "USD", "AUD", "CAD", "NZD", "CHF", "SEK", "NOK", "DKK", "PLN", "ZAR", "INR", "SGD"}
THEMES = {"default", "elite", "modern", "nature", "ocean", "rose"}
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")

DEFAULT_BRANDING = {"primary_color": "#E34A33", "secondary_color": "#0A0A0A", "accent_color": "#4F46E5",
                    "show_powered_by": True, "theme": "default"}


class TenantCreate(BaseModel):
    name: str
    industry: str = "other"
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    timezone: str = "Europe/Dublin"
    currency: str = "EUR"


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40].strip("-")
    return slug or "business"


async def unique_slug(name: str, exclude_tenant_id: Optional[str] = None) -> str:
    base = slugify(name)
    slug, n = base, 1
    while True:
        existing = await db.tenants.find_one({"booking_url_slug": slug}, {"_id": 0, "tenant_id": 1})
        if not existing or existing.get("tenant_id") == exclude_tenant_id:
            return slug
        n += 1
        slug = f"{base}-{n}"


def validate_tenant_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    if "name" in data:
        data["name"] = (data["name"] or "").strip()[:120]
        if not data["name"]:
            raise HTTPException(status_code=400, detail="Business name is required")
    if "industry" in data and data["industry"] not in INDUSTRIES:
        data["industry"] = "other"
    if "timezone" in data and data["timezone"] not in available_timezones():
        raise HTTPException(status_code=400, detail="Unknown timezone")
    if "currency" in data and data["currency"] not in CURRENCIES:
        raise HTTPException(status_code=400, detail="Unsupported currency")
    if "booking_url_slug" in data:
        slug = slugify(data["booking_url_slug"] or "")
        if len(slug) < 3:
            raise HTTPException(status_code=400, detail="Booking link must be at least 3 characters")
        data["booking_url_slug"] = slug
    for key in ("phone", "address", "logo_url", "description", "website"):
        if key in data and data[key] is not None:
            data[key] = str(data[key]).strip()[:500] or None
    return data


def public_tenant(tenant: Dict[str, Any]) -> Dict[str, Any]:
    t = {k: v for k, v in tenant.items() if k not in ("api_key_hash", "_id")}
    t["settings"] = tenant_settings(tenant)
    t["branding"] = {**DEFAULT_BRANDING, **(tenant.get("branding") or {})}
    t["has_api_key"] = bool(tenant.get("api_key_hash"))
    t["features"] = plan_features(tenant)
    return t


async def create_tenant_record(data: Dict[str, Any], plan: str = "starter", onboarding_completed: bool = False) -> Dict[str, Any]:
    tenant_id = new_id("tenant")
    tenant = {
        "tenant_id": tenant_id,
        "name": data["name"],
        "industry": data.get("industry", "other"),
        "email": str(data["email"]).lower(),
        "phone": data.get("phone"),
        "address": data.get("address"),
        "timezone": data.get("timezone") or "Europe/Dublin",
        "currency": data.get("currency") or "EUR",
        "plan": plan if plan in PLAN_FEATURES else "starter",
        "logo_url": None,
        "booking_url_slug": await unique_slug(data["name"]),
        "is_active": True,
        "onboarding_completed": onboarding_completed,
        "settings": dict(DEFAULT_SETTINGS),
        "branding": dict(DEFAULT_BRANDING),
        "sms_addon_enabled": False,
        "email_reminders_enabled": True,
        "sms_reminders_enabled": False,
        "reminder_hours_before": 24,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.tenants.insert_one({**tenant})
    await ensure_default_templates(tenant_id)
    return tenant


@router.post("/tenants")
async def create_tenant(body: TenantCreate, user: Dict = Depends(get_current_user)):
    if user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="You already have a business set up")
    data = validate_tenant_fields(body.model_dump())
    tenant = await create_tenant_record(data)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"tenant_id": tenant["tenant_id"], "role": "owner"}})
    return {"tenant": public_tenant(tenant), "message": "Business created"}


@router.get("/tenants/me")
async def get_my_tenant(user: Dict = Depends(get_current_user)):
    if not user.get("tenant_id"):
        return {"tenant": None}
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    return {"tenant": public_tenant(tenant) if tenant else None}


TENANT_EDITABLE = ["name", "industry", "email", "phone", "address", "timezone", "currency", "logo_url",
                   "description", "website", "booking_url_slug"]


@router.put("/tenants/me")
async def update_my_tenant(updates: Dict[str, Any], actor: Actor = Depends(get_manager)):
    data = validate_tenant_fields(pick(updates, TENANT_EDITABLE))
    if "booking_url_slug" in data and data["booking_url_slug"] != actor.tenant.get("booking_url_slug"):
        taken = await db.tenants.find_one({"booking_url_slug": data["booking_url_slug"],
                                           "tenant_id": {"$ne": actor.tenant_id}}, {"_id": 1})
        if taken:
            raise HTTPException(status_code=400, detail="That booking link is already taken")
    if "email" in data and data["email"]:
        data["email"] = str(data["email"]).strip().lower()
    data["updated_at"] = now_iso()
    await db.tenants.update_one({"tenant_id": actor.tenant_id}, {"$set": data})
    tenant = await db.tenants.find_one({"tenant_id": actor.tenant_id}, {"_id": 0})
    return {"tenant": public_tenant(tenant)}


@router.post("/tenants/me/complete-onboarding")
async def complete_onboarding(actor: Actor = Depends(get_actor)):
    await db.tenants.update_one({"tenant_id": actor.tenant_id},
                                {"$set": {"onboarding_completed": True, "updated_at": now_iso()}})
    return {"message": "Onboarding completed"}


# ---------- Booking settings ----------
@router.get("/tenants/me/settings")
async def get_booking_settings(actor: Actor = Depends(get_actor)):
    return {"settings": tenant_settings(actor.tenant)}


@router.put("/tenants/me/settings")
async def update_booking_settings(body: Dict[str, Any], actor: Actor = Depends(get_manager)):
    clean: Dict[str, Any] = {}
    for key, default in DEFAULT_SETTINGS.items():
        if key not in body:
            continue
        value = body[key]
        if isinstance(default, bool):
            clean[key] = bool(value)
        else:
            try:
                clean[key] = max(0, int(value))
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail=f"Invalid value for {key}")
    if "slot_interval_minutes" in clean and clean["slot_interval_minutes"] not in (5, 10, 15, 20, 30, 45, 60):
        raise HTTPException(status_code=400, detail="Time slot spacing must be 5, 10, 15, 20, 30, 45 or 60 minutes")
    if "max_advance_days" in clean:
        clean["max_advance_days"] = min(max(clean["max_advance_days"], 1), 730)
    settings = {**(actor.tenant.get("settings") or {}), **clean}
    await db.tenants.update_one({"tenant_id": actor.tenant_id}, {"$set": {"settings": settings, "updated_at": now_iso()}})
    return {"settings": tenant_settings({"settings": settings})}


# Backwards compatible endpoint
@router.put("/tenants/me/settings/approval")
async def update_approval_settings(body: Dict[str, Any], actor: Actor = Depends(get_manager)):
    return await update_booking_settings({"approval_threshold_minutes": body.get("approval_threshold_minutes", 0)}, actor)


# ---------- Branding ----------
@router.get("/tenants/me/branding")
async def get_branding(actor: Actor = Depends(get_actor)):
    return {"branding": {**DEFAULT_BRANDING, **(actor.tenant.get("branding") or {})},
            "logo_url": actor.tenant.get("logo_url")}


@router.put("/tenants/me/branding")
async def update_branding(body: Dict[str, Any], actor: Actor = Depends(get_manager)):
    clean = {}
    for key in ("primary_color", "secondary_color", "accent_color"):
        if key in body:
            if not HEX.match(str(body[key] or "")):
                raise HTTPException(status_code=400, detail="Colours must be hex values like #E34A33")
            clean[key] = body[key]
    if "theme" in body:
        clean["theme"] = body["theme"] if body["theme"] in THEMES else "default"
    if "show_powered_by" in body:
        show = bool(body["show_powered_by"])
        if not show and not actor.features.get("white_label"):
            actor.require_feature("white_label")
        clean["show_powered_by"] = show
    branding = {**DEFAULT_BRANDING, **(actor.tenant.get("branding") or {}), **clean}
    await db.tenants.update_one({"tenant_id": actor.tenant_id}, {"$set": {"branding": branding, "updated_at": now_iso()}})
    return {"branding": branding}


# ---------- API key (for the external receptionist API) ----------
@router.post("/tenants/me/api-key")
async def regenerate_api_key(actor: Actor = Depends(get_manager)):
    actor.require_feature("api_webhooks")
    key = f"bks_{random_token(24)}"
    await db.tenants.update_one({"tenant_id": actor.tenant_id}, {"$set": {
        "api_key_hash": sha256(key), "api_key_hint": key[-4:], "api_key_created_at": now_iso()}})
    return {"api_key": key, "message": "Copy this key now - it won't be shown again."}


@router.delete("/tenants/me/api-key")
async def revoke_api_key(actor: Actor = Depends(get_manager)):
    await db.tenants.update_one({"tenant_id": actor.tenant_id},
                                {"$unset": {"api_key_hash": "", "api_key_hint": "", "api_key_created_at": ""}})
    return {"message": "API key revoked"}


# ---------- Plans ----------
@router.get("/plans/features")
async def get_plan_features():
    return {"plans": PLAN_FEATURES}


@router.get("/tenants/me/features")
async def get_my_features(user: Dict = Depends(get_current_user)):
    if not user.get("tenant_id"):
        return {"features": PLAN_FEATURES["starter"], "plan": "starter"}
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0}) or {}
    return {"features": plan_features(tenant), "plan": tenant.get("plan", "starter")}


# ---------- File uploads ----------
@router.post("/upload/image")
async def upload_image(request: Request, file: UploadFile = File(...), actor: Actor = Depends(get_actor)):
    data = await file.read(config.MAX_UPLOAD_BYTES + 1)
    if len(data) > config.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum {config.MAX_UPLOAD_BYTES // (1024 * 1024)}MB.")
    if not data:
        raise HTTPException(status_code=400, detail="The file is empty")
    try:
        ext, content_type = storage.sniff_image(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    file_id = new_id("file", 24)
    key = f"uploads/{actor.tenant_id}/{file_id}.{ext}"
    await storage.put_object(key, data, content_type)
    await db.files.insert_one({
        "file_id": file_id, "tenant_id": actor.tenant_id, "storage_path": key,
        "original_filename": (file.filename or "")[:200], "content_type": content_type, "size": len(data),
        "is_deleted": False, "created_at": now_iso(),
    })
    base = config.BACKEND_PUBLIC_URL or str(request.base_url).rstrip("/")
    return {"file_id": file_id, "url": f"{base}/api/files/{file_id}", "path": f"/api/files/{file_id}"}


@router.get("/files/{file_id}")
async def get_file(file_id: str):
    record = await db.files.find_one({"file_id": file_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        data = await storage.get_object(record["storage_path"])
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=404, detail="File not found")
    return Response(content=data, media_type=record.get("content_type", "application/octet-stream"),
                    headers={"Cache-Control": "public, max-age=31536000, immutable",
                             "X-Content-Type-Options": "nosniff"})


# ---------- In-app notifications ----------
@router.get("/notifications")
async def get_notifications(user: Dict = Depends(get_current_user), limit: int = 20, unread_only: bool = False):
    if not user.get("tenant_id"):
        return {"notifications": [], "unread_count": 0}
    query: Dict[str, Any] = {"tenant_id": user["tenant_id"]}
    if unread_only:
        query["read"] = False
    notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(min(max(limit, 1), 100))
    unread = await db.notifications.count_documents({"tenant_id": user["tenant_id"], "read": False})
    return {"notifications": notifications, "unread_count": unread}


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: Dict = Depends(get_current_user)):
    await db.notifications.update_one({"notification_id": notification_id, "tenant_id": user.get("tenant_id")},
                                      {"$set": {"read": True, "read_at": now_iso()}})
    return {"message": "Marked as read"}


@router.post("/notifications/read-all")
async def mark_all_read(user: Dict = Depends(get_current_user)):
    if user.get("tenant_id"):
        await db.notifications.update_many({"tenant_id": user["tenant_id"], "read": False},
                                           {"$set": {"read": True, "read_at": now_iso()}})
    return {"message": "All marked as read"}


# ---------- Client notification settings ----------
@router.get("/notifications/settings")
async def get_notification_settings(actor: Actor = Depends(get_actor)):
    t = actor.tenant
    return {
        "email_reminders_enabled": t.get("email_reminders_enabled", True),
        "sms_reminders_enabled": t.get("sms_reminders_enabled", False),
        "sms_addon_enabled": t.get("sms_addon_enabled", False),
        "reminder_hours_before": t.get("reminder_hours_before", 24),
        "sms_addon_price": config.SMS_ADDON_PRICE,
        "email_configured": email_configured(),
        "sms_configured": sms_configured(),
    }


@router.put("/notifications/settings")
async def update_notification_settings(body: Dict[str, Any], actor: Actor = Depends(get_manager)):
    updates: Dict[str, Any] = {}
    if "email_reminders_enabled" in body:
        updates["email_reminders_enabled"] = bool(body["email_reminders_enabled"])
    if "reminder_hours_before" in body:
        try:
            hours = int(body["reminder_hours_before"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Invalid reminder timing")
        if not 1 <= hours <= 168:
            raise HTTPException(status_code=400, detail="Reminder timing must be between 1 and 168 hours")
        updates["reminder_hours_before"] = hours
    if "sms_reminders_enabled" in body:
        if body["sms_reminders_enabled"] and not actor.tenant.get("sms_addon_enabled"):
            raise HTTPException(status_code=403, detail="Enable the SMS add-on first")
        updates["sms_reminders_enabled"] = bool(body["sms_reminders_enabled"])
    updates["updated_at"] = now_iso()
    await db.tenants.update_one({"tenant_id": actor.tenant_id}, {"$set": updates})
    return {"message": "Settings updated", "settings": updates}


@router.post("/notifications/sms-addon/enable")
async def enable_sms_addon(actor: Actor = Depends(get_manager)):
    await db.tenants.update_one({"tenant_id": actor.tenant_id}, {"$set": {
        "sms_addon_enabled": True, "sms_addon_activated_at": now_iso(), "updated_at": now_iso()}})
    await db.addon_logs.insert_one({"log_id": new_id("addon"), "tenant_id": actor.tenant_id, "addon_type": "sms",
                                    "action": "enabled", "price": config.SMS_ADDON_PRICE, "created_at": now_iso()})
    return {"message": "SMS add-on enabled", "monthly_cost": config.SMS_ADDON_PRICE, "currency": "EUR"}


@router.post("/notifications/sms-addon/disable")
async def disable_sms_addon(actor: Actor = Depends(get_manager)):
    await db.tenants.update_one({"tenant_id": actor.tenant_id}, {"$set": {
        "sms_addon_enabled": False, "sms_reminders_enabled": False, "updated_at": now_iso()}})
    await db.addon_logs.insert_one({"log_id": new_id("addon"), "tenant_id": actor.tenant_id, "addon_type": "sms",
                                    "action": "disabled", "created_at": now_iso()})
    return {"message": "SMS add-on disabled"}


@router.get("/notifications/logs")
async def get_notification_logs(actor: Actor = Depends(get_manager), limit: int = 50, type: Optional[str] = None):
    query: Dict[str, Any] = {"tenant_id": actor.tenant_id}
    if type:
        query["type"] = type
    logs = await db.notification_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(min(max(limit, 1), 200))
    return {"logs": logs}


@router.get("/notifications/integration-status")
async def integration_status(actor: Actor = Depends(get_actor)):
    return {
        "email": {"provider": "Resend", "configured": email_configured(),
                  "sender": config.SENDER_EMAIL if email_configured() else None},
        "sms": {"provider": "Twilio", "configured": sms_configured(),
                "phone": config.TWILIO_PHONE_NUMBER[-4:] if config.TWILIO_PHONE_NUMBER else None},
        "ai": {"provider": config.AI_PROVIDER or None, "configured": config.AI_ENABLED},
        "storage": storage.backend_name() if actor.is_manager else None,
    }


# ---------- Getting started data ----------
@router.post("/demo/seed")
async def seed_starter_data(actor: Actor = Depends(get_manager)):
    """Give a brand-new business something to work with: the owner as a bookable team member
    and three example services (all editable). Safe to call more than once."""
    tenant_id = actor.tenant_id
    created = {"staff": 0, "services": 0}
    if await db.staff.count_documents({"tenant_id": tenant_id}) == 0:
        await db.staff.insert_one({
            "staff_id": new_id("staff"), "tenant_id": tenant_id, "user_id": actor.user_id,
            "name": actor.user.get("name") or "Owner", "email": actor.user["email"], "phone": None,
            "title": "Owner", "bio": None, "avatar_url": None, "color": "#E34A33", "services": [],
            "working_hours": DEFAULT_WORKING_HOURS, "role": "admin", "can_view_all_bookings": True,
            "can_edit_services": True, "can_manage_staff": True, "can_view_reports": True,
            "can_manage_customers": True, "is_active": True, "created_at": now_iso(),
        })
        created["staff"] = 1
    if await db.services.count_documents({"tenant_id": tenant_id}) == 0:
        for name, duration, price, color in [("Consultation", 30, 40, "#121212"),
                                             ("Standard Appointment", 60, 75, "#E34A33"),
                                             ("Extended Appointment", 90, 110, "#4F46E5")]:
            await db.services.insert_one({
                "service_id": new_id("service"), "tenant_id": tenant_id, "name": name, "description": None,
                "duration": duration, "buffer_time": 0, "price": price, "deposit_required": False,
                "deposit_amount": 0.0, "color": color, "category": None, "is_active": True, "created_at": now_iso(),
            })
            created["services"] += 1
    return {"message": "Starter data ready", "created": created}
