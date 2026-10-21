"""A public demo salon, created on start-up, so prospects can try a real booking at /book/demo."""
import logging
import os
import secrets

from .db import db
from .scheduling import DEFAULT_WORKING_HOURS
from .security import hash_password, new_id, now_iso

logger = logging.getLogger("bookslot.demo")
DEMO_SLUG = "demo"


def _hours(days, start="09:00", end="18:00", late=None):
    wh = {k: {**v, "enabled": False} for k, v in DEFAULT_WORKING_HOURS.items()}
    for d in days:
        wh[d] = {"enabled": True, "start": start, "end": late if (late and d == "thursday") else end,
                 "breaks": [{"start": "13:00", "end": "13:30"}]}
    return wh


SERVICES = [
    ("Cut & finish", 45, 48, "Consultation, wash, precision cut and blow-dry finish.", "#3730A3"),
    ("Gents cut", 30, 25, "Scissor or clipper cut, styled to finish.", "#0F766E"),
    ("Blow dry", 30, 32, "Wash and a smooth or bouncy blow-dry.", "#7C3AED"),
    ("Root touch-up", 75, 60, "Permanent colour on regrowth, including blow-dry.", "#D97706"),
    ("Full head colour", 120, 95, "All-over permanent colour, toner and finish.", "#BE185D"),
    ("Balayage", 150, 145, "Hand-painted highlights with toner and finish.", "#E34A33"),
]


async def ensure_demo_tenant() -> None:
    if os.environ.get("DEMO_TENANT", "true").lower() in ("0", "false", "no"):
        return
    if await db.tenants.find_one({"booking_url_slug": DEMO_SLUG}, {"_id": 1}):
        return
    from routes.tenants import create_tenant_record  # local import avoids a cycle
    tenant = await create_tenant_record({
        "name": "Lumière Hair Studio", "industry": "salon", "email": "hello@lumiere-demo.ie",
        "address": "Main Street (demo business)", "timezone": "Europe/Dublin", "currency": "EUR",
    }, plan="growth", onboarding_completed=True)
    tid = tenant["tenant_id"]
    await db.tenants.update_one({"tenant_id": tid}, {"$set": {
        "booking_url_slug": DEMO_SLUG, "is_demo": True,
        "description": "This is a BookSlot demo salon. Book anything you like: it's not a real business.",
    }})
    owner_id = new_id("user")
    await db.users.insert_one({  # owner exists so the platform admin can "View as Owner"; nobody knows this password
        "user_id": owner_id, "email": "owner@lumiere-demo.ie", "name": "Sophie (demo)", "picture": None,
        "tenant_id": tid, "role": "owner", "is_active": True, "token_version": 0,
        "password_hash": hash_password(secrets.token_urlsafe(24)), "created_at": now_iso(),
    })
    service_ids = []
    for name, dur, price, desc, color in SERVICES:
        sid = new_id("service"); service_ids.append(sid)
        await db.services.insert_one({"service_id": sid, "tenant_id": tid, "name": name, "description": desc,
                                      "duration": dur, "buffer_time": 0, "price": price, "deposit_required": False,
                                      "deposit_amount": 0.0, "color": color, "category": None, "is_active": True,
                                      "created_at": now_iso()})
    week = ["tuesday", "wednesday", "thursday", "friday", "saturday"]
    for name, title, color, services, user_id in [
        ("Sophie", "Senior stylist", "#3730A3", [], owner_id),
        ("Jack", "Stylist & barber", "#0F766E", service_ids[:3], None),
    ]:
        await db.staff.insert_one({
            "staff_id": new_id("staff"), "tenant_id": tid, "user_id": user_id, "name": name, "email": None,
            "phone": None, "title": title, "bio": None, "avatar_url": None, "color": color, "services": services,
            "working_hours": _hours(week, late="20:00"), "role": "admin" if user_id else "staff",
            "can_view_all_bookings": True, "can_edit_services": bool(user_id), "can_manage_staff": bool(user_id),
            "can_view_reports": bool(user_id), "can_manage_customers": True, "is_active": True, "created_at": now_iso(),
        })
    logger.info("Created demo salon at /book/%s", DEMO_SLUG)
