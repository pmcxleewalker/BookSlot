"""One-off setups that dress an existing demo business for a sales demo. Each runs once per business
(marked on the tenant), so anything changed afterwards in the app is never overwritten."""
import logging

from . import config
from .db import db
from .scheduling import DEFAULT_WORKING_HOURS
from .security import new_id, now_iso

logger = logging.getLogger("bookslot.prospects")
CONSULT_NOTE = "Grey blending and colour correction are priced at consultation."
INCLUDES = "Includes a cut and blow-dry unless a full re-style is needed."

SETUPS = {
    "demo-test": {
        "key": "sharonf-v1",
        "tenant": {
            "name": "Sharon F Hair", "industry": "salon", "phone": "085 230 0708",
            "address": "Knocklyon, Dublin 16", "website": "https://instagram.com/sharonfhair",
            "description": "Modern blonding and traditional highlights in Knocklyon. All colour prices include a cut "
                           "and blow-dry unless a full re-style is needed. Not sure what you need? Book a free consultation.",
            "branding": {"primary_color": "#9A7B66", "secondary_color": "#5E4636", "accent_color": "#9A7B66",
                         "show_powered_by": True, "theme": "champagne"},
        },
        "logo": "/brands/sharonf/sharonf-icon.png",
        "services": [  # name, minutes, price, description
            ("Wash, cut and blow-dry", 60, 50, None),
            ("Tint (roots), cut and blow-dry", 120, 75, None),
            ("Tint (roots), cut and blow-dry + ends glossed", 135, 80, None),
            ("Face frame highlights", 120, 75, INCLUDES),
            ("Half head bespoke lightness", 180, 125, "e.g. lived-in blonde, teasy lights, balayage. " + INCLUDES),
            ("Full head", 210, 150, "Full head highlights or blonding, modern or traditional. " + INCLUDES),
            ("Toner and blow-dry", 60, 50, None),
            ("Toner, cut and blow-dry", 75, 70, None),
            ("Consultation", 20, 0, CONSULT_NOTE + " Free, no obligation."),
        ],
        "staff": {"name": "Sharon", "title": "Owner & colourist", "color": "#9A7B66",
                  "days": ["tuesday", "wednesday", "thursday", "friday", "saturday"], "start": "09:30", "end": "17:30"},
    },
}


async def apply_prospect_setups() -> None:
    for slug, setup in SETUPS.items():
        tenant = await db.tenants.find_one({"booking_url_slug": slug}, {"_id": 0})
        if not tenant or tenant.get("prospect_setup") == setup["key"]:
            continue
        tid = tenant["tenant_id"]
        updates = dict(setup["tenant"])
        if setup.get("logo") and config.FRONTEND_URL:
            updates["logo_url"] = config.FRONTEND_URL.rstrip("/") + setup["logo"]
        updates.update({"prospect_setup": setup["key"], "updated_at": now_iso(), "onboarding_completed": True})
        await db.tenants.update_one({"tenant_id": tid}, {"$set": updates})
        # replace any placeholder services with the real price list
        await db.services.update_many({"tenant_id": tid}, {"$set": {"is_active": False}})
        for i, (name, mins, price, desc) in enumerate(setup["services"]):
            await db.services.insert_one({
                "service_id": new_id("service"), "tenant_id": tid, "name": name, "description": desc, "duration": mins,
                "buffer_time": 0, "price": price, "deposit_required": False, "deposit_amount": 0.0,
                "color": setup["tenant"]["branding"]["primary_color"], "category": None, "sort_order": i,
                "is_active": True, "created_at": now_iso()})
        st = setup["staff"]
        hours = {d: {**v, "enabled": False} for d, v in DEFAULT_WORKING_HOURS.items()}
        for d in st["days"]:
            hours[d] = {"enabled": True, "start": st["start"], "end": st["end"], "breaks": [{"start": "13:00", "end": "13:30"}]}
        owner = await db.users.find_one({"tenant_id": tid, "role": "owner"}, {"_id": 0})
        existing = await db.staff.find_one({"tenant_id": tid, "is_active": True}, {"_id": 0})
        fields = {"name": st["name"], "title": st["title"], "color": st["color"], "working_hours": hours, "services": []}
        if existing:
            await db.staff.update_one({"staff_id": existing["staff_id"]}, {"$set": fields})
        else:
            await db.staff.insert_one({
                "staff_id": new_id("staff"), "tenant_id": tid, "user_id": (owner or {}).get("user_id"),
                "email": (owner or {}).get("email"), "phone": None, "bio": None, "avatar_url": None,
                "role": "admin", "can_view_all_bookings": True, "can_edit_services": True, "can_manage_staff": True,
                "can_view_reports": True, "can_manage_customers": True, "is_active": True, "created_at": now_iso(), **fields})
        logger.info("Applied demo setup %s to /book/%s", setup["key"], slug)
