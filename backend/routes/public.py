"""Public (no login) endpoints used by the customer-facing booking page."""
import calendar
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Body, HTTPException, Request

from core import config, booking, payments
from core.db import db
from core.notify import messaging_links
from core.plans import plan_features
from core.scheduling import fmt, local_now, parse_date, to_local_naive
from core.security import rate_limit
from routes.tenants import DEFAULT_BRANDING

router = APIRouter()
logger = logging.getLogger("bookslot.public")


async def get_public_tenant(slug: str) -> Dict[str, Any]:
    tenant = await db.tenants.find_one({"booking_url_slug": slug, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    return tenant


def require_online_booking(tenant: Dict[str, Any]) -> None:
    if not booking.tenant_settings(tenant)["online_booking_enabled"]:
        raise HTTPException(status_code=403, detail="Online booking is currently turned off for this business")


async def eligible_staff(tenant_id: str, service_id: str) -> List[Dict[str, Any]]:
    staff = await db.staff.find({"tenant_id": tenant_id, "is_active": True}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return [s for s in staff if booking.staff_can_do(s, service_id)]


def public_staff(s: Dict[str, Any]) -> Dict[str, Any]:
    return {"staff_id": s["staff_id"], "name": s["name"], "title": s.get("title"), "avatar_url": s.get("avatar_url"),
            "bio": s.get("bio"), "services": s.get("services", [])}


def public_service(s: Dict[str, Any]) -> Dict[str, Any]:
    return pick_keys(s, ["service_id", "name", "description", "duration", "price", "deposit_required",
                         "deposit_amount", "color", "category"])


def pick_keys(d: Dict[str, Any], keys: List[str]) -> Dict[str, Any]:
    return {k: d.get(k) for k in keys}


@router.get("/public/booking/{slug}")
async def public_booking_page(slug: str):
    tenant = await get_public_tenant(slug)
    services = await db.services.find({"tenant_id": tenant["tenant_id"], "is_active": True}, {"_id": 0}).sort("created_at", 1).to_list(200)
    staff = await db.staff.find({"tenant_id": tenant["tenant_id"], "is_active": True}, {"_id": 0}).sort("created_at", 1).to_list(200)
    settings = booking.tenant_settings(tenant)
    features = plan_features(tenant)
    forms = []
    if features.get("custom_forms"):
        forms = await db.forms.find({"tenant_id": tenant["tenant_id"], "is_active": True}, {"_id": 0, "tenant_id": 0}).to_list(20)
    branding = {**DEFAULT_BRANDING, **(tenant.get("branding") or {})}
    if not features.get("white_label"):
        branding["show_powered_by"] = True
    return {
        "tenant": {
            "name": tenant["name"], "industry": tenant.get("industry"), "logo_url": tenant.get("logo_url"),
            "address": tenant.get("address"), "phone": tenant.get("phone"), "email": tenant.get("email"),
            "description": tenant.get("description"), "website": tenant.get("website"),
            "timezone": tenant.get("timezone"), "currency": tenant.get("currency", "EUR"),
            "slug": tenant["booking_url_slug"], "branding": branding,
            "messaging": messaging_links(tenant),
            "deposits_online": payments.takes_online_deposits(tenant),
            "ai_chat_enabled": bool(config.AI_ENABLED) and bool(features.get("ai_assistant")) and bool(tenant.get("ai_chat_enabled", True)),
        },
        "settings": {k: settings[k] for k in ("online_booking_enabled", "require_email", "require_phone",
                                               "allow_client_cancellation", "min_notice_minutes", "max_advance_days")},
        "services": [public_service(s) for s in services],
        "staff": [public_staff(s) for s in staff],
        "forms": forms,
        "today": fmt(local_now(tenant.get("timezone")))[:10],
    }


@router.get("/public/booking/{slug}/staff-for-service")
async def staff_for_service(slug: str, service_id: str):
    tenant = await get_public_tenant(slug)
    await booking.get_service(tenant["tenant_id"], service_id)
    return {"staff": [public_staff(s) for s in await eligible_staff(tenant["tenant_id"], service_id)]}


async def slots_for(tenant: Dict[str, Any], service: Dict[str, Any], staff_id: str, day) -> List[Tuple[datetime, datetime, Dict]]:
    """Slots for one staff member, or for 'any' eligible staff member (first free one wins)."""
    if staff_id and staff_id != "any":
        staff = await booking.get_staff_member(tenant["tenant_id"], staff_id)
        if not booking.staff_can_do(staff, service["service_id"]):
            return []
        return [(s, e, staff) for s, e in await booking.available_slots(tenant, service, staff, day)]
    merged: Dict[datetime, Tuple[datetime, datetime, Dict]] = {}
    for staff in await eligible_staff(tenant["tenant_id"], service["service_id"]):
        for s, e in await booking.available_slots(tenant, service, staff, day):
            merged.setdefault(s, (s, e, staff))
    return [merged[k] for k in sorted(merged)]


@router.get("/public/booking/{slug}/availability")
async def availability(slug: str, service_id: str, date: str, staff_id: str = "any"):
    tenant = await get_public_tenant(slug)
    require_online_booking(tenant)
    service = await booking.get_service(tenant["tenant_id"], service_id)
    try:
        day = parse_date(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date")
    slots = await slots_for(tenant, service, staff_id, day)
    return {
        "date": date,
        "slots": [{"start_time": fmt(s), "end_time": fmt(e), "staff_id": st["staff_id"], "staff_name": st["name"],
                   "available": True} for s, e, st in slots],
    }


@router.get("/public/booking/{slug}/available-dates")
async def available_dates(slug: str, service_id: str, month: str, staff_id: str = "any"):
    """Which days in a month (YYYY-MM) have at least one free slot - used to grey out the calendar."""
    tenant = await get_public_tenant(slug)
    require_online_booking(tenant)
    service = await booking.get_service(tenant["tenant_id"], service_id)
    try:
        year, mon = (int(x) for x in month.split("-"))
        days_in_month = calendar.monthrange(year, mon)[1]
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Month must look like 2026-10")
    earliest, latest = booking.public_window(tenant)
    dates = []
    for d in range(1, days_in_month + 1):
        day = datetime(year, mon, d).date()
        if day < earliest.date() or day > latest.date():
            continue
        if await slots_for(tenant, service, staff_id, day):
            dates.append(day.isoformat())
    return {"month": month, "available_dates": dates}


@router.get("/public/booking/{slug}/smart-availability")
async def smart_availability(slug: str, service_id: str, date: Optional[str] = None,
                             preferred_staff_id: Optional[str] = None):
    """If the preferred person is fully booked, suggest other staff that day or the next free days."""
    tenant = await get_public_tenant(slug)
    require_online_booking(tenant)
    service = await booking.get_service(tenant["tenant_id"], service_id)
    day = parse_date(date) if date else local_now(tenant.get("timezone")).date()
    preferred_slots = []
    if preferred_staff_id:
        preferred_slots = [(s, e) for s, e, _ in await slots_for(tenant, service, preferred_staff_id, day)]
    alternatives = []
    for staff in await eligible_staff(tenant["tenant_id"], service_id):
        if staff["staff_id"] == preferred_staff_id:
            continue
        slots = await booking.available_slots(tenant, service, staff, day)
        if slots:
            alternatives.append({"staff_id": staff["staff_id"], "staff_name": staff["name"],
                                 "staff_title": staff.get("title", ""),
                                 "available_slots": [{"start": fmt(s), "end": fmt(e)} for s, e in slots[:5]]})
    alternative_days = []
    if not preferred_slots:
        for i in range(1, 15):
            d = day + timedelta(days=i)
            if await slots_for(tenant, service, preferred_staff_id or "any", d):
                alternative_days.append(d.isoformat())
            if len(alternative_days) >= 5:
                break
    return {
        "date": day.isoformat(), "service": service["name"],
        "preferred_staff_available": bool(preferred_slots),
        "preferred_slots": [{"start": fmt(s), "end": fmt(e)} for s, e in preferred_slots[:10]],
        "alternative_staff": alternatives[:3], "alternative_days": alternative_days,
    }


def validate_form_responses(forms: List[Dict[str, Any]], service_id: str, answers: Dict[str, Any]) -> List[Dict[str, Any]]:
    responses = []
    for form in forms:
        if form.get("service_ids") and service_id not in form["service_ids"]:
            continue
        for field in form.get("fields", []):
            value = answers.get(field["field_id"])
            if isinstance(value, str):
                value = value.strip()[:2000]
            if field.get("required") and (value is None or value == "" or value is False):
                raise HTTPException(status_code=400, detail=f"Please answer: {field['label']}")
            if field.get("field_type") == "select" and value and value not in field.get("options", []):
                raise HTTPException(status_code=400, detail=f"Invalid answer for: {field['label']}")
            if value not in (None, ""):
                responses.append({"form_id": form["form_id"], "form_name": form["name"], "field_id": field["field_id"],
                                  "label": field["label"], "value": value})
    return responses


@router.post("/public/booking/{slug}/book")
async def public_book(slug: str, request: Request, body: Dict[str, Any] = Body(...)):
    rate_limit(request, "public_book", 20, 600)
    tenant = await get_public_tenant(slug)
    require_online_booking(tenant)
    settings = booking.tenant_settings(tenant)
    if not body.get("service_id") or not body.get("start_time"):
        raise HTTPException(status_code=400, detail="Please choose a service and a time")
    service = await booking.get_service(tenant["tenant_id"], body["service_id"])
    try:
        start = to_local_naive(body["start_time"], tenant.get("timezone"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time")
    name, email, phone = booking.validate_client_details(body.get("client_name"), body.get("client_email"),
                                                         body.get("client_phone"), settings)
    form_responses: List[Dict[str, Any]] = []
    if plan_features(tenant).get("custom_forms"):
        forms = await db.forms.find({"tenant_id": tenant["tenant_id"], "is_active": True}, {"_id": 0}).to_list(20)
        form_responses = validate_form_responses(forms, service["service_id"], body.get("form_responses") or {})

    staff_id = body.get("staff_id") or "any"
    if staff_id == "any":
        options = [st for s, _, st in await slots_for(tenant, service, "any", start.date()) if s == start]
        staff_candidates = options or []
        if not staff_candidates:
            raise HTTPException(status_code=409, detail="Sorry, that time is no longer available. Please pick another time.")
    else:
        staff_candidates = [await booking.get_staff_member(tenant["tenant_id"], staff_id)]

    cents = payments.deposit_cents(tenant, service)
    last_error: Optional[HTTPException] = None
    for staff in staff_candidates:
        try:
            appt = await booking.create_booking(
                tenant, service, staff, start, client_name=name, client_email=email, client_phone=phone,
                notes=body.get("notes"), source="online", enforce_availability=True, form_responses=form_responses,
                deposit_cents=cents)
            if cents:
                try:
                    url = await payments.create_deposit_checkout(tenant, service, appt, cents)
                except payments.StripeError as e:
                    logger.error("Deposit checkout failed: %s", e)
                    await booking.release_unpaid(appt, "Payment page could not be created")
                    raise HTTPException(status_code=502, detail="Online payment isn't available right now. Please try "
                                                                "again in a minute or contact the business to book.")
                return {
                    "appointment": {k: appt[k] for k in ("appointment_id", "start_time", "end_time", "status",
                                                          "client_name", "client_email", "total_price", "deposit_due")},
                    "staff_name": staff["name"], "service_name": service["name"],
                    "confirmation_code": appt["appointment_id"], "status": appt["status"],
                    "payment_url": url, "deposit_due": appt["deposit_due"],
                    "message": "Pay the deposit to confirm your booking",
                }
            return {
                "appointment": {k: appt[k] for k in ("appointment_id", "start_time", "end_time", "status",
                                                      "client_name", "client_email", "total_price")},
                "staff_name": staff["name"],
                "service_name": service["name"],
                "confirmation_code": appt["appointment_id"],
                "status": appt["status"],
                "message": "Booking request received" if appt["status"] == "pending_approval" else "Booking confirmed!",
            }
        except HTTPException as e:
            last_error = e
            if e.status_code != 409:
                raise
    raise last_error or HTTPException(status_code=409, detail="That time is no longer available")


# ---------- Manage booking (link in confirmation email) ----------
def can_client_cancel(tenant: Dict[str, Any], appt: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    settings = booking.tenant_settings(tenant)
    if appt.get("status") not in ("confirmed", "pending", "pending_approval"):
        return False, None
    if not settings["allow_client_cancellation"]:
        return False, "Please contact the business to cancel this appointment."
    now = local_now(tenant.get("timezone"))
    start = datetime.fromisoformat(appt["start_time"][:19])
    if start <= now:
        return False, "This appointment has already started."
    notice = int(settings["cancellation_notice_hours"] or 0)
    if notice and start - now < timedelta(hours=notice):
        return False, f"Online cancellation closes {notice} hours before the appointment. Please contact the business."
    return True, None


@router.get("/public/booking/manage/{confirmation_code}")
async def get_booking(confirmation_code: str, request: Request):
    rate_limit(request, "manage", 60, 600)
    appt = await db.appointments.find_one({"appointment_id": confirmation_code}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Booking not found")
    tenant = await db.tenants.find_one({"tenant_id": appt["tenant_id"]}, {"_id": 0}) or {}
    service = await db.services.find_one({"service_id": appt["service_id"]}, {"_id": 0}) or {}
    staff = await db.staff.find_one({"staff_id": appt["staff_id"]}, {"_id": 0}) or {}
    can_cancel, reason = can_client_cancel(tenant, appt)
    refund_note = None
    if appt.get("deposit_paid") and not appt.get("deposit_refunded") and can_cancel:
        hours = payments.payment_settings(tenant)["refund_hours"]
        refund_note = ("Your deposit will be refunded if you cancel now." if payments.refund_due(tenant, appt, "client")
                       else f"Cancelling less than {hours} hours before means the deposit isn't refunded.")
    safe = {k: appt.get(k) for k in ("appointment_id", "start_time", "end_time", "status", "client_name",
                                     "total_price", "cancellation_reason", "notes", "deposit_paid", "deposit_amount",
                                     "deposit_due", "deposit_refunded", "deposit_kept")}
    if appt.get("status") == "pending_payment" and appt.get("payment_url"):
        safe["payment_url"] = appt["payment_url"]
    return {
        "appointment": safe,
        "business_name": tenant.get("name"), "business_phone": tenant.get("phone"),
        "business_email": tenant.get("email"), "business_address": tenant.get("address"),
        "business_slug": tenant.get("booking_url_slug"), "currency": tenant.get("currency", "EUR"),
        "logo_url": tenant.get("logo_url"),
        "service_name": service.get("name"), "staff_name": staff.get("name"),
        "can_cancel": can_cancel, "cancel_blocked_reason": reason, "refund_note": refund_note,
    }


@router.post("/public/booking/manage/{confirmation_code}/cancel")
async def cancel_booking(confirmation_code: str, request: Request, body: Optional[Dict[str, Any]] = Body(None)):
    rate_limit(request, "manage_cancel", 10, 600)
    appt = await db.appointments.find_one({"appointment_id": confirmation_code}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Booking not found")
    if appt.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="This booking is already cancelled")
    tenant = await db.tenants.find_one({"tenant_id": appt["tenant_id"]}, {"_id": 0})
    ok, why = can_client_cancel(tenant, appt)
    if not ok:
        raise HTTPException(status_code=400, detail=why or "This booking can't be cancelled online")
    reason = ((body or {}).get("reason") or "").strip()[:500] or "Cancelled by client"
    updated = await booking.change_status(tenant, appt, "cancelled", reason=reason, by="client")
    return {"message": "Booking cancelled", "appointment": {k: updated.get(k) for k in ("appointment_id", "status", "start_time")}}
