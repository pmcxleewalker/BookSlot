import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from core.db import db
from core.deps import STAFF_PERMISSIONS, Actor, get_actor
from core.plans import plan_features
from core.scheduling import DAYS, DEFAULT_WORKING_HOURS
from core.security import hash_password, new_id, now_iso, pick, validate_password

router = APIRouter()

HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$|^24:00$")
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


class StaffCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    title: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    color: str = "#4F46E5"
    services: List[str] = Field(default_factory=list)
    working_hours: Optional[Dict[str, Any]] = None
    role: str = "staff"
    can_view_all_bookings: bool = False
    can_edit_services: bool = False
    can_manage_staff: bool = False
    can_view_reports: bool = False
    can_manage_customers: bool = True
    password: Optional[str] = None


def validate_working_hours(wh: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(wh, dict):
        raise HTTPException(status_code=400, detail="Invalid working hours")
    clean = {}
    for day in DAYS:
        d = wh.get(day) or DEFAULT_WORKING_HOURS[day]
        start, end = str(d.get("start", "09:00")), str(d.get("end", "17:00"))
        if not HHMM.match(start) or not HHMM.match(end):
            raise HTTPException(status_code=400, detail=f"Invalid time on {day.title()}")
        if bool(d.get("enabled")) and end <= start:
            raise HTTPException(status_code=400, detail=f"{day.title()}: finish time must be after start time")
        breaks = []
        for b in d.get("breaks") or []:
            bs, be = str(b.get("start", "")), str(b.get("end", ""))
            if not HHMM.match(bs) or not HHMM.match(be) or be <= bs:
                raise HTTPException(status_code=400, detail=f"{day.title()}: invalid break time")
            breaks.append({"start": bs, "end": be})
        clean[day] = {"enabled": bool(d.get("enabled")), "start": start, "end": end, "breaks": breaks}
    return clean


async def validate_service_ids(tenant_id: str, ids: List[str]) -> List[str]:
    ids = [i for i in dict.fromkeys(ids or []) if isinstance(i, str)]
    if not ids:
        return []
    found = await db.services.find({"tenant_id": tenant_id, "service_id": {"$in": ids}}, {"_id": 0, "service_id": 1}).to_list(500)
    return [s["service_id"] for s in found]


def require_staff_manager(actor: Actor) -> None:
    actor.require("can_manage_staff", "You don't have permission to manage staff")


async def get_tenant_staff(actor: Actor, staff_id: str) -> Dict[str, Any]:
    staff = await db.staff.find_one({"staff_id": staff_id, "tenant_id": actor.tenant_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return staff


def staff_out(s: Dict[str, Any]) -> Dict[str, Any]:
    s = dict(s)
    s["has_account"] = bool(s.get("user_id"))
    return s


@router.get("/staff")
async def list_staff(actor: Actor = Depends(get_actor), include_inactive: bool = False):
    query: Dict[str, Any] = {"tenant_id": actor.tenant_id}
    if not include_inactive:
        query["is_active"] = True
    staff = await db.staff.find(query, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"staff": [staff_out(s) for s in staff]}


@router.post("/staff")
async def create_staff(body: StaffCreate, actor: Actor = Depends(get_actor)):
    require_staff_manager(actor)
    max_staff = int(plan_features(actor.tenant).get("max_staff", 2))
    count = await db.staff.count_documents({"tenant_id": actor.tenant_id, "is_active": True})
    if count >= max_staff:
        raise HTTPException(status_code=403, detail=f"Your plan allows up to {max_staff} staff members. Upgrade to add more.")
    email = body.email.lower()
    if await db.staff.find_one({"tenant_id": actor.tenant_id, "email": email, "is_active": True}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="A team member with this email already exists")
    if body.color and not HEX.match(body.color):
        body.color = "#4F46E5"
    staff = {
        "staff_id": new_id("staff"), "tenant_id": actor.tenant_id, "user_id": None,
        "name": body.name.strip()[:120], "email": email, "phone": (body.phone or "").strip() or None,
        "title": (body.title or "").strip()[:120] or None, "bio": (body.bio or "").strip()[:1000] or None,
        "avatar_url": body.avatar_url, "color": body.color,
        "services": await validate_service_ids(actor.tenant_id, body.services),
        "working_hours": validate_working_hours(body.working_hours) if body.working_hours else DEFAULT_WORKING_HOURS,
        "role": "admin" if (body.role == "admin" and actor.is_manager) else "staff",
        "is_active": True, "created_at": now_iso(),
    }
    for perm in STAFF_PERMISSIONS:
        staff[perm] = bool(getattr(body, perm)) if actor.is_manager else perm == "can_manage_customers"
    if not staff["name"]:
        raise HTTPException(status_code=400, detail="Name is required")
    await db.staff.insert_one({**staff})
    if body.password:
        await _create_account(actor, staff, body.password)
        staff = await get_tenant_staff(actor, staff["staff_id"])
    return {"staff": staff_out(staff)}


STAFF_EDITABLE = ["name", "email", "phone", "title", "bio", "avatar_url", "color", "services", "working_hours"]


@router.put("/staff/{staff_id}")
async def update_staff(staff_id: str, updates: Dict[str, Any], actor: Actor = Depends(get_actor)):
    staff = await get_tenant_staff(actor, staff_id)
    is_self = actor.staff and actor.staff["staff_id"] == staff_id
    if not is_self:
        require_staff_manager(actor)
    data = pick(updates, STAFF_EDITABLE)
    if actor.is_manager:
        data.update(pick(updates, STAFF_PERMISSIONS + ["role"]))
        if "role" in data:
            data["role"] = "admin" if data["role"] == "admin" else "staff"
    if "name" in data:
        data["name"] = str(data["name"] or "").strip()[:120]
        if not data["name"]:
            raise HTTPException(status_code=400, detail="Name is required")
    if "email" in data:
        data["email"] = str(data["email"] or "").strip().lower()
    if "color" in data and not HEX.match(str(data["color"] or "")):
        data.pop("color")
    if "services" in data:
        data["services"] = await validate_service_ids(actor.tenant_id, data["services"])
    if "working_hours" in data:
        data["working_hours"] = validate_working_hours(data["working_hours"])
    for perm in STAFF_PERMISSIONS:
        if perm in data:
            data[perm] = bool(data[perm])
    login_email_change = "email" in data and staff.get("user_id") and data["email"] != staff.get("email")
    if login_email_change:
        if not data["email"] or "@" not in data["email"]:
            raise HTTPException(status_code=400, detail="Please enter a valid email")
        if await db.users.find_one({"email": data["email"], "user_id": {"$ne": staff["user_id"]}}, {"_id": 1}):
            raise HTTPException(status_code=400, detail="That email is already used by another login")
    if data:
        await db.staff.update_one({"staff_id": staff_id, "tenant_id": actor.tenant_id}, {"$set": data})
        if login_email_change:
            await db.users.update_one({"user_id": staff["user_id"]}, {"$set": {"email": data["email"]}})
    return {"staff": staff_out(await get_tenant_staff(actor, staff_id))}


@router.delete("/staff/{staff_id}")
async def delete_staff(staff_id: str, actor: Actor = Depends(get_actor)):
    require_staff_manager(actor)
    staff = await get_tenant_staff(actor, staff_id)
    if staff.get("user_id") == actor.user_id:
        raise HTTPException(status_code=400, detail="You can't remove yourself")
    await db.staff.update_one({"staff_id": staff_id}, {"$set": {"is_active": False}})
    if staff.get("user_id"):
        owner = await db.users.find_one({"user_id": staff["user_id"]}, {"_id": 0, "role": 1})
        if owner and owner.get("role") != "owner":
            await db.users.update_one({"user_id": staff["user_id"]}, {"$set": {"is_active": False}})
    return {"message": "Staff member removed"}


# ---------- Logins for staff ----------
async def _create_account(actor: Actor, staff: Dict[str, Any], password: str) -> Dict[str, Any]:
    validate_password(password)
    if staff.get("user_id"):
        raise HTTPException(status_code=400, detail="This team member already has a login")
    email = staff["email"].lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="That email already has a BookSlot login. Use a different email.")
    user = {
        "user_id": new_id("user"), "email": email, "name": staff["name"], "picture": None,
        "tenant_id": actor.tenant_id, "role": "staff", "is_active": True, "token_version": 0,
        "password_hash": hash_password(password), "created_at": now_iso(),
    }
    await db.users.insert_one({**user})
    await db.staff.update_one({"staff_id": staff["staff_id"]}, {"$set": {"user_id": user["user_id"]}})
    return user


@router.post("/staff/{staff_id}/create-account")
async def create_staff_account(staff_id: str, body: Dict[str, Any], actor: Actor = Depends(get_actor)):
    actor.require_manager()
    staff = await get_tenant_staff(actor, staff_id)
    user = await _create_account(actor, staff, body.get("password") or "")
    return {"message": "Login created", "user_id": user["user_id"], "email": user["email"]}


@router.put("/staff/{staff_id}/permissions")
async def update_staff_permissions(staff_id: str, permissions: Dict[str, Any], actor: Actor = Depends(get_actor)):
    actor.require_manager()
    await get_tenant_staff(actor, staff_id)
    data = {k: bool(v) for k, v in pick(permissions, STAFF_PERMISSIONS).items()}
    if "role" in permissions:
        data["role"] = "admin" if permissions["role"] == "admin" else "staff"
    if data:
        await db.staff.update_one({"staff_id": staff_id, "tenant_id": actor.tenant_id}, {"$set": data})
    return {"staff": staff_out(await get_tenant_staff(actor, staff_id))}


@router.put("/staff/{staff_id}/change-password")
async def change_staff_password(staff_id: str, body: Dict[str, Any], actor: Actor = Depends(get_actor)):
    staff = await get_tenant_staff(actor, staff_id)
    is_self = staff.get("user_id") == actor.user_id
    if not (actor.is_manager or is_self):
        raise HTTPException(status_code=403, detail="Not allowed")
    if not staff.get("user_id"):
        raise HTTPException(status_code=400, detail="This team member doesn't have a login yet")
    password = validate_password(body.get("new_password"))
    target = await db.users.find_one({"user_id": staff["user_id"]}, {"_id": 0})
    await db.users.update_one({"user_id": staff["user_id"]}, {"$set": {
        "password_hash": hash_password(password), "token_version": int((target or {}).get("token_version", 0)) + 1}})
    return {"message": "Password changed"}


# ---------- Working hours ----------
@router.get("/staff/{staff_id}/working-hours")
async def get_working_hours(staff_id: str, actor: Actor = Depends(get_actor)):
    staff = await get_tenant_staff(actor, staff_id)
    return {"staff_id": staff_id, "working_hours": staff.get("working_hours") or DEFAULT_WORKING_HOURS}


@router.put("/staff/{staff_id}/working-hours")
async def update_working_hours(staff_id: str, working_hours: Dict[str, Any], actor: Actor = Depends(get_actor)):
    staff = await get_tenant_staff(actor, staff_id)
    if not (actor.staff and actor.staff["staff_id"] == staff_id):
        require_staff_manager(actor)
    clean = validate_working_hours(working_hours)
    await db.staff.update_one({"staff_id": staff["staff_id"]}, {"$set": {"working_hours": clean}})
    return {"message": "Working hours updated", "working_hours": clean}


# ---------- Time off / blocks ----------
BLOCK_TYPES = {"annual_leave", "lunch", "unavailable", "break", "sick"}
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _block_query(actor: Actor, start_date: Optional[str], end_date: Optional[str]) -> Dict[str, Any]:
    q: Dict[str, Any] = {"tenant_id": actor.tenant_id}
    if start_date and end_date:
        # any block that overlaps the requested range (or recurring blocks that started before it ends)
        q["start_date"] = {"$lte": end_date}
        q["$or"] = [{"end_date": {"$gte": start_date}}, {"end_date": None}, {"end_date": ""},
                    {"end_date": {"$exists": False}}]
    return q


@router.get("/staff/{staff_id}/time-blocks")
async def list_staff_blocks(staff_id: str, actor: Actor = Depends(get_actor), start_date: Optional[str] = None,
                            end_date: Optional[str] = None):
    await get_tenant_staff(actor, staff_id)
    q = _block_query(actor, start_date, end_date)
    q["staff_id"] = staff_id
    blocks = await db.time_blocks.find(q, {"_id": 0}).sort("start_date", 1).to_list(500)
    return {"time_blocks": blocks}


@router.post("/staff/{staff_id}/time-blocks")
async def create_time_block(staff_id: str, body: Dict[str, Any], actor: Actor = Depends(get_actor)):
    await get_tenant_staff(actor, staff_id)
    if not (actor.staff and actor.staff["staff_id"] == staff_id):
        require_staff_manager(actor)
    start_date = str(body.get("start_date") or "")
    end_date = str(body.get("end_date") or start_date)
    if not DATE.match(start_date) or not DATE.match(end_date) or end_date < start_date:
        raise HTTPException(status_code=400, detail="Please choose valid start and end dates")
    all_day = bool(body.get("all_day", not body.get("start_time")))
    start_time, end_time = body.get("start_time"), body.get("end_time")
    if not all_day:
        if not (start_time and end_time and HHMM.match(start_time) and HHMM.match(end_time) and end_time > start_time):
            raise HTTPException(status_code=400, detail="Please choose valid start and end times")
    block = {
        "block_id": new_id("block", 10), "staff_id": staff_id, "tenant_id": actor.tenant_id,
        "block_type": body.get("block_type") if body.get("block_type") in BLOCK_TYPES else "unavailable",
        "title": (body.get("title") or "Time off").strip()[:120], "start_date": start_date, "end_date": end_date,
        "start_time": None if all_day else start_time, "end_time": None if all_day else end_time,
        "all_day": all_day, "recurring": bool(body.get("recurring", False)),
        "notes": (body.get("notes") or "").strip()[:500] or None, "created_at": now_iso(),
    }
    await db.time_blocks.insert_one({**block})
    return {"time_block": block}


@router.delete("/time-blocks/{block_id}")
async def delete_time_block(block_id: str, actor: Actor = Depends(get_actor)):
    block = await db.time_blocks.find_one({"block_id": block_id, "tenant_id": actor.tenant_id}, {"_id": 0})
    if not block:
        raise HTTPException(status_code=404, detail="Time off not found")
    if not (actor.staff and actor.staff["staff_id"] == block["staff_id"]):
        require_staff_manager(actor)
    await db.time_blocks.delete_one({"block_id": block_id})
    return {"message": "Time off removed"}


@router.get("/time-blocks")
async def list_all_blocks(actor: Actor = Depends(get_actor), start_date: Optional[str] = None,
                          end_date: Optional[str] = None):
    blocks = await db.time_blocks.find(_block_query(actor, start_date, end_date), {"_id": 0}).to_list(2000)
    return {"time_blocks": blocks}
