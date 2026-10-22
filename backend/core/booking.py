"""Booking engine: availability, creating bookings, status changes and rescheduling.

Every way of creating or moving a booking (dashboard, public booking page, AI receptionist,
external API) goes through these functions so the rules are applied consistently.
"""
import asyncio
import re
from datetime import date as date_cls, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException

from .db import db
from .notify import create_notification, send_booking_message
from .scheduling import (busy_intervals, compute_slots, fmt, local_now, overlaps)
from . import config
from .security import new_id, now_iso, now_utc
from .webhooks import spawn, trigger_webhook

ACTIVE_STATUSES = ["pending", "pending_approval", "pending_payment", "confirmed", "completed", "no_show"]
INACTIVE_STATUSES = ["cancelled"]

DEFAULT_SETTINGS: Dict[str, Any] = {
    "online_booking_enabled": True,
    "require_email": True,
    "require_phone": False,
    "allow_client_cancellation": True,
    "cancellation_notice_hours": 0,     # clients can't cancel online within this many hours
    "approval_threshold_minutes": 0,    # online bookings this long or longer need approval (0 = off)
    "min_notice_minutes": 60,           # earliest online booking from now
    "max_advance_days": 90,             # how far ahead clients can book
    "slot_interval_minutes": 30,        # spacing between offered start times
}

ALLOWED_TRANSITIONS = {
    "pending": {"confirmed", "cancelled", "completed", "no_show"},
    "pending_approval": {"confirmed", "cancelled"},
    "pending_payment": {"confirmed", "pending_approval", "cancelled"},  # waiting for the online deposit
    "confirmed": {"completed", "no_show", "cancelled", "pending"},
    "completed": {"confirmed", "no_show"},
    "no_show": {"confirmed", "completed"},
    "cancelled": set(),
}

_staff_locks: Dict[str, asyncio.Lock] = {}


def staff_lock(staff_id: str) -> asyncio.Lock:
    lock = _staff_locks.get(staff_id)
    if lock is None:
        lock = _staff_locks[staff_id] = asyncio.Lock()
    return lock


def tenant_settings(tenant: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(DEFAULT_SETTINGS)
    merged.update({k: v for k, v in (tenant.get("settings") or {}).items() if k in DEFAULT_SETTINGS})
    return merged


def staff_can_do(staff: Dict[str, Any], service_id: str) -> bool:
    services = staff.get("services") or []
    return not services or service_id in services


def normalize_email(email: Optional[str]) -> Optional[str]:
    email = (email or "").strip().lower()
    return email or None


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_client_details(name: Optional[str], email: Optional[str], phone: Optional[str],
                            settings: Optional[Dict[str, Any]] = None) -> Tuple[str, Optional[str], Optional[str]]:
    name = (name or "").strip()
    email = normalize_email(email)
    phone = (phone or "").strip() or None
    if not name:
        raise HTTPException(status_code=400, detail="Please enter your name")
    if len(name) > 120:
        raise HTTPException(status_code=400, detail="Name is too long")
    if email and not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address")
    if settings:
        if settings.get("require_email") and not email:
            raise HTTPException(status_code=400, detail="An email address is required to book")
        if settings.get("require_phone") and not phone:
            raise HTTPException(status_code=400, detail="A phone number is required to book")
    if phone and not re.match(r"^[0-9+()\-\s]{6,20}$", phone):
        raise HTTPException(status_code=400, detail="Please enter a valid phone number")
    return name, email, phone


# ---------- Lookups ----------
async def get_service(tenant_id: str, service_id: str, active_only: bool = True) -> Dict[str, Any]:
    query = {"tenant_id": tenant_id, "service_id": service_id}
    if active_only:
        query["is_active"] = True
    service = await db.services.find_one(query, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


async def get_staff_member(tenant_id: str, staff_id: str, active_only: bool = True) -> Dict[str, Any]:
    query = {"tenant_id": tenant_id, "staff_id": staff_id}
    if active_only:
        query["is_active"] = True
    staff = await db.staff.find_one(query, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return staff


async def staff_time_blocks(tenant_id: str, staff_id: str) -> List[Dict[str, Any]]:
    return await db.time_blocks.find({"tenant_id": tenant_id, "staff_id": staff_id}, {"_id": 0}).to_list(1000)


async def staff_appointments_between(tenant_id: str, staff_id: str, start: datetime, end: datetime,
                                     exclude_id: Optional[str] = None) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {
        "tenant_id": tenant_id,
        "staff_id": staff_id,
        "status": {"$nin": INACTIVE_STATUSES},
        "start_time": {"$gte": fmt(start - timedelta(days=1)), "$lt": fmt(end)},
    }
    if exclude_id:
        query["appointment_id"] = {"$ne": exclude_id}
    return await db.appointments.find(query, {"_id": 0}).to_list(1000)


async def find_conflict(tenant_id: str, staff_id: str, start: datetime, occupied_end: datetime,
                        exclude_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    appts = await staff_appointments_between(tenant_id, staff_id, start, occupied_end, exclude_id)
    for appt, (b_start, b_end) in zip(appts, busy_intervals(appts)):
        if overlaps(start, occupied_end, b_start, b_end):
            return appt
    return None


def public_window(tenant: Dict[str, Any]) -> Tuple[datetime, datetime]:
    settings = tenant_settings(tenant)
    now = local_now(tenant.get("timezone"))
    earliest = now + timedelta(minutes=int(settings["min_notice_minutes"] or 0))
    latest = now + timedelta(days=int(settings["max_advance_days"] or 365))
    return earliest, latest


async def available_slots(tenant: Dict[str, Any], service: Dict[str, Any], staff: Dict[str, Any], day: date_cls,
                          public: bool = True, exclude_id: Optional[str] = None) -> List[Tuple[datetime, datetime]]:
    settings = tenant_settings(tenant)
    earliest: Optional[datetime] = None
    if public:
        earliest, latest = public_window(tenant)
        if day > latest.date():
            return []
    else:
        earliest = local_now(tenant.get("timezone"))
    day_start = datetime(day.year, day.month, day.day)
    appts = await staff_appointments_between(tenant["tenant_id"], staff["staff_id"], day_start,
                                             day_start + timedelta(days=1), exclude_id)
    blocks = await staff_time_blocks(tenant["tenant_id"], staff["staff_id"])
    return compute_slots(day, service.get("duration", 30), service.get("buffer_time", 0),
                         staff.get("working_hours"), blocks, busy_intervals(appts), earliest,
                         settings["slot_interval_minutes"])


# ---------- Clients ----------
async def find_or_create_client(tenant_id: str, name: str, email: Optional[str], phone: Optional[str]) -> Optional[Dict[str, Any]]:
    email = normalize_email(email)
    client = None
    if email:
        client = await db.clients.find_one({"tenant_id": tenant_id, "email": email}, {"_id": 0})
    if not client and phone:
        client = await db.clients.find_one({"tenant_id": tenant_id, "phone": phone}, {"_id": 0})
    if client:
        updates = {}
        if phone and not client.get("phone"):
            updates["phone"] = phone
        if email and not client.get("email"):
            updates["email"] = email
        if updates:
            await db.clients.update_one({"client_id": client["client_id"]}, {"$set": updates})
            client.update(updates)
        return client
    if not (email or phone):
        return None  # no contact details = no way to recognise them next time, so don't create duplicates
    client = {
        "client_id": new_id("client"), "tenant_id": tenant_id, "name": name, "email": email, "phone": phone,
        "notes": None, "tags": [], "is_vip": False, "preferred_staff_id": None, "service_notes": None,
        "important_info": None, "birthday": None, "marketing_consent": False, "created_at": now_iso(),
    }
    await db.clients.insert_one({**client})
    return client


# ---------- Create ----------
async def create_booking(
    tenant: Dict[str, Any],
    service: Dict[str, Any],
    staff: Dict[str, Any],
    start: datetime,
    *,
    client_name: str,
    client_email: Optional[str],
    client_phone: Optional[str],
    notes: Optional[str] = None,
    source: str = "admin",
    enforce_availability: bool = True,
    client_id: Optional[str] = None,
    form_responses: Optional[List[Dict[str, Any]]] = None,
    created_by: Optional[str] = None,
    deposit_cents: int = 0,
) -> Dict[str, Any]:
    """deposit_cents > 0: the slot is held as 'pending_payment' and nothing is announced until the deposit is paid
    (see finalize_paid_booking)."""
    if not staff_can_do(staff, service["service_id"]):
        raise HTTPException(status_code=400, detail=f"{staff['name']} doesn't offer {service['name']}")
    duration = int(service.get("duration") or 30)
    buffer = int(service.get("buffer_time") or 0)
    end = start + timedelta(minutes=duration)
    blocked_until = end + timedelta(minutes=buffer)
    settings = tenant_settings(tenant)

    async with staff_lock(staff["staff_id"]):
        if enforce_availability:
            slots = await available_slots(tenant, service, staff, start.date(), public=True)
            if not any(s == start for s, _ in slots):
                raise HTTPException(status_code=409, detail="Sorry, that time is no longer available. Please pick another time.")
        else:
            conflict = await find_conflict(tenant["tenant_id"], staff["staff_id"], start, blocked_until)
            if conflict:
                raise HTTPException(status_code=409, detail=(
                    f"{staff['name']} already has an appointment at "
                    f"{conflict['start_time'][11:16]}-{conflict['end_time'][11:16]} that overlaps this time"))

        client = None
        if client_id:
            client = await db.clients.find_one({"tenant_id": tenant["tenant_id"], "client_id": client_id}, {"_id": 0})
            if client:
                client_name = client_name or client.get("name")
                client_email = client_email or client.get("email")
                client_phone = client_phone or client.get("phone")
        if not client:
            client = await find_or_create_client(tenant["tenant_id"], client_name, client_email, client_phone)

        needs_approval = (source != "admin" and int(settings["approval_threshold_minutes"] or 0) > 0
                          and duration >= int(settings["approval_threshold_minutes"]))
        appt = {
            "appointment_id": new_id("appt"),
            "tenant_id": tenant["tenant_id"],
            "service_id": service["service_id"],
            "staff_id": staff["staff_id"],
            "client_id": client["client_id"] if client else None,
            "client_name": client_name,
            "client_email": normalize_email(client_email),
            "client_phone": client_phone,
            "start_time": fmt(start),
            "end_time": fmt(end),
            "blocked_until": fmt(blocked_until),
            "duration": duration,
            "notes": (notes or "").strip()[:2000] or None,
            "status": "pending_payment" if deposit_cents else ("pending_approval" if needs_approval else "confirmed"),
            "source": source,
            "total_price": float(service.get("price") or 0),
            "deposit_paid": False,
            "deposit_due": round(deposit_cents / 100, 2) if deposit_cents else 0,
            "status_after_payment": ("pending_approval" if needs_approval else "confirmed") if deposit_cents else None,
            "payment_expires_at": (now_utc() + timedelta(minutes=config.PAYMENT_HOLD_MINUTES + 4)).isoformat()
            if deposit_cents else None,
            "form_responses": form_responses or [],
            "created_by": created_by,
            "reminder_sent_at": None,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        await db.appointments.insert_one({**appt})

    if deposit_cents:
        return appt
    await announce_booking(tenant, appt, service, staff)
    return appt


async def announce_booking(tenant: Dict[str, Any], appt: Dict[str, Any], service: Dict[str, Any],
                           staff: Dict[str, Any]) -> None:
    """Webhook + owner notification + client confirmation for a booking that is now real."""
    needs_approval = appt["status"] == "pending_approval"
    client_name = appt.get("client_name") or "A client"
    await trigger_webhook(tenant["tenant_id"], "booking.created", appt)
    if appt.get("source") != "admin":
        if needs_approval:
            await create_notification(tenant["tenant_id"], "approval_needed", "Booking needs approval",
                                      f"{client_name} requested {service['name']} on {appt['start_time'][:10]} at "
                                      f"{appt['start_time'][11:16]}", {"appointment_id": appt["appointment_id"]})
        else:
            paid = f" (deposit paid)" if appt.get("deposit_paid") else ""
            await create_notification(tenant["tenant_id"], "new_booking", "New booking",
                                      f"{client_name} booked {service['name']} with {staff['name']} on "
                                      f"{appt['start_time'][:10]} at {appt['start_time'][11:16]}{paid}",
                                      {"appointment_id": appt["appointment_id"], "start_time": appt["start_time"]})
    trigger = "booking_pending" if needs_approval else "booking_confirmation"
    spawn(send_booking_message(trigger, appt, tenant, include_sms=not needs_approval))


async def finalize_paid_booking(appointment_id: str, *, amount_cents: int, payment_intent: Optional[str],
                                session_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Deposit paid: confirm the held booking (once - safe to call again for repeated webhooks)."""
    appt = await db.appointments.find_one({"appointment_id": appointment_id}, {"_id": 0})
    if not appt:
        return None
    paid = {"deposit_paid": True, "deposit_amount": round(amount_cents / 100, 2), "payment_intent_id": payment_intent,
            "checkout_session_id": session_id, "deposit_paid_at": now_iso(), "updated_at": now_iso()}
    if appt.get("status") != "pending_payment":
        if not appt.get("deposit_paid"):
            # paid after the hold was released: keep the money on record so the business can refund or rebook
            await db.appointments.update_one({"appointment_id": appointment_id}, {"$set": {**paid, "paid_after_release": True}})
            await create_notification(appt["tenant_id"], "payment_issue", "Deposit paid after the slot was released",
                                      f"{appt.get('client_name')} paid a deposit for {appt['start_time'][:16].replace('T', ' ')} "
                                      "after the hold expired. Please rebook them or refund in Stripe.",
                                      {"appointment_id": appointment_id})
        return appt
    new_status = appt.get("status_after_payment") or "confirmed"
    res = await db.appointments.update_one({"appointment_id": appointment_id, "status": "pending_payment"},
                                           {"$set": {**paid, "status": new_status}})
    if not res.modified_count:
        return appt  # another delivery got there first
    appt = {**appt, **paid, "status": new_status}
    tenant = await db.tenants.find_one({"tenant_id": appt["tenant_id"]}, {"_id": 0})
    service = await db.services.find_one({"service_id": appt["service_id"]}, {"_id": 0}) or {"name": "appointment"}
    staff = await db.staff.find_one({"staff_id": appt["staff_id"]}, {"_id": 0}) or {"name": ""}
    await announce_booking(tenant, appt, service, staff)
    return appt


async def release_unpaid(appt: Dict[str, Any], reason: str = "Deposit not paid") -> None:
    """Free a slot held for a deposit that never arrived. No client message: they never finished booking."""
    await db.appointments.update_one({"appointment_id": appt["appointment_id"], "status": "pending_payment"},
                                     {"$set": {"status": "cancelled", "cancelled_at": now_iso(), "cancelled_by": "system",
                                               "cancellation_reason": reason, "updated_at": now_iso()}})


# ---------- Status changes ----------
async def change_status(tenant: Dict[str, Any], appt: Dict[str, Any], new_status: str, *, reason: Optional[str] = None,
                        by: str = "business", user_id: Optional[str] = None) -> Dict[str, Any]:
    current = appt.get("status", "pending")
    if new_status == current:
        return appt
    if new_status not in ALLOWED_TRANSITIONS.get(current, set()):
        raise HTTPException(status_code=400, detail=f"Can't change a {current.replace('_', ' ')} appointment to "
                                                    f"{new_status.replace('_', ' ')}")
    updates: Dict[str, Any] = {"status": new_status, "updated_at": now_iso()}
    if new_status == "cancelled":
        updates.update({"cancelled_at": now_iso(), "cancellation_reason": (reason or "").strip()[:500] or None,
                        "cancelled_by": by})
    if current == "pending_approval" and new_status == "confirmed":
        updates.update({"approved_at": now_iso(), "approved_by": user_id})
    if new_status == "completed":
        updates["completed_at"] = now_iso()
    await db.appointments.update_one({"appointment_id": appt["appointment_id"]}, {"$set": updates})
    appt = {**appt, **updates}

    if new_status == "cancelled":
        if appt.get("deposit_paid") and not appt.get("deposit_refunded"):
            from .payments import maybe_refund_on_cancel  # local import: payments depends on booking
            spawn(maybe_refund_on_cancel(tenant, appt, by))
        await trigger_webhook(tenant["tenant_id"], "booking.cancelled", appt)
        if by == "client":
            await create_notification(tenant["tenant_id"], "booking_cancelled", "Booking cancelled",
                                      f"{appt.get('client_name') or 'A client'} cancelled their appointment on "
                                      f"{appt['start_time'][:10]} at {appt['start_time'][11:16]}",
                                      {"appointment_id": appt["appointment_id"], "reason": reason})
        # let the client know when the business cancels (or rejects) - only for future appointments
        if appt["start_time"] > fmt(local_now(tenant.get("timezone"))):
            spawn(send_booking_message("cancellation", appt, tenant, reason=reason or ""))
    elif new_status == "completed":
        await trigger_webhook(tenant["tenant_id"], "booking.completed", appt)
    else:
        await trigger_webhook(tenant["tenant_id"], "booking.updated", appt)
        if current == "pending_approval" and new_status == "confirmed":
            spawn(send_booking_message("booking_confirmation", appt, tenant, include_sms=True))
    return appt


async def reschedule(tenant: Dict[str, Any], appt: Dict[str, Any], new_start: datetime, *,
                     new_staff: Optional[Dict[str, Any]] = None, enforce_availability: bool = False,
                     notify_client: bool = True) -> Dict[str, Any]:
    if appt.get("status") in INACTIVE_STATUSES:
        raise HTTPException(status_code=400, detail="Cancelled appointments can't be moved")
    service = await db.services.find_one({"tenant_id": tenant["tenant_id"], "service_id": appt["service_id"]}, {"_id": 0}) or {}
    duration = int(appt.get("duration") or service.get("duration") or 30)
    if not appt.get("duration"):
        try:
            duration = int((datetime.fromisoformat(appt["end_time"][:19]) -
                            datetime.fromisoformat(appt["start_time"][:19])).total_seconds() // 60) or duration
        except (KeyError, ValueError):
            pass
    buffer = int(service.get("buffer_time") or 0)
    staff = new_staff or await get_staff_member(tenant["tenant_id"], appt["staff_id"], active_only=False)
    if new_staff and service and not staff_can_do(new_staff, appt["service_id"]):
        raise HTTPException(status_code=400, detail=f"{new_staff['name']} doesn't offer this service")
    end = new_start + timedelta(minutes=duration)
    blocked_until = end + timedelta(minutes=buffer)
    async with staff_lock(staff["staff_id"]):
        if enforce_availability:
            svc = dict(service or {}, duration=duration, buffer_time=buffer)
            slots = await available_slots(tenant, svc, staff, new_start.date(), public=True,
                                          exclude_id=appt["appointment_id"])
            if not any(s == new_start for s, _ in slots):
                raise HTTPException(status_code=409, detail="That time isn't available")
        else:
            conflict = await find_conflict(tenant["tenant_id"], staff["staff_id"], new_start, blocked_until,
                                           exclude_id=appt["appointment_id"])
            if conflict:
                raise HTTPException(status_code=409, detail=(
                    f"{staff['name']} already has an appointment at {conflict['start_time'][11:16]}"
                    f"-{conflict['end_time'][11:16]} that overlaps this time"))
        updates = {"start_time": fmt(new_start), "end_time": fmt(end), "blocked_until": fmt(blocked_until),
                   "duration": duration, "staff_id": staff["staff_id"], "reminder_sent_at": None,
                   "updated_at": now_iso()}
        await db.appointments.update_one({"appointment_id": appt["appointment_id"]}, {"$set": updates})
    appt = {**appt, **updates}
    await trigger_webhook(tenant["tenant_id"], "booking.updated", appt)
    if notify_client and appt["start_time"] > fmt(local_now(tenant.get("timezone"))):
        spawn(send_booking_message("rescheduled", appt, tenant))
    return appt
