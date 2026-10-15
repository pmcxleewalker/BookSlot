from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from core import booking
from core.db import db
from core.deps import Actor, get_actor
from core.scheduling import fmt, parse_date, to_local_naive
from core.security import now_iso

router = APIRouter()

VALID_STATUSES = {"pending", "pending_approval", "confirmed", "completed", "cancelled", "no_show"}


def scope_query(actor: Actor, query: Dict[str, Any]) -> Dict[str, Any]:
    """Staff without 'view all bookings' only see their own appointments."""
    if not actor.can("can_view_all_bookings"):
        query["staff_id"] = actor.staff["staff_id"] if actor.staff else "__none__"
    return query


async def get_appt(actor: Actor, appointment_id: str) -> Dict[str, Any]:
    appt = await db.appointments.find_one(scope_query(actor, {"tenant_id": actor.tenant_id,
                                                              "appointment_id": appointment_id}), {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


async def enrich(tenant_id: str, appts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not appts:
        return appts
    services = {s["service_id"]: s for s in await db.services.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(1000)}
    staff = {s["staff_id"]: s for s in await db.staff.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(1000)}
    for a in appts:
        a["service_name"] = services.get(a.get("service_id"), {}).get("name", "Unknown service")
        a["staff_name"] = staff.get(a.get("staff_id"), {}).get("name", "Unknown")
        a["staff_color"] = staff.get(a.get("staff_id"), {}).get("color")
        a.pop("blocked_until", None)
    return appts


@router.get("/appointments")
async def list_appointments(
    actor: Actor = Depends(get_actor),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    staff_id: Optional[str] = None,
    status: Optional[str] = None,
    client_id: Optional[str] = None,
    limit: int = 2000,
):
    query: Dict[str, Any] = {"tenant_id": actor.tenant_id}
    rng: Dict[str, str] = {}
    if start_date:
        rng["$gte"] = start_date[:19]
    if end_date:
        # a bare date means "up to the end of that day"
        rng["$lte"] = end_date if "T" in end_date else f"{end_date}T23:59:59"
    if rng:
        query["start_time"] = rng
    if staff_id:
        query["staff_id"] = staff_id
    if status:
        query["status"] = status
    if client_id:
        query["client_id"] = client_id
    scope_query(actor, query)
    appts = await db.appointments.find(query, {"_id": 0}).sort("start_time", 1).to_list(min(max(limit, 1), 5000))
    return {"appointments": await enrich(actor.tenant_id, appts)}


@router.get("/appointments/pending-approval")
async def pending_approvals(actor: Actor = Depends(get_actor)):
    query = scope_query(actor, {"tenant_id": actor.tenant_id, "status": "pending_approval"})
    appts = await db.appointments.find(query, {"_id": 0}).sort("start_time", 1).to_list(200)
    return {"appointments": await enrich(actor.tenant_id, appts),
            "approval_threshold": booking.tenant_settings(actor.tenant)["approval_threshold_minutes"]}


@router.get("/appointments/availability")
async def staff_availability(service_id: str, staff_id: str, date: str, actor: Actor = Depends(get_actor)):
    """Free slots for the dashboard's 'new appointment' form (ignores online-booking notice rules)."""
    service = await booking.get_service(actor.tenant_id, service_id)
    staff = await booking.get_staff_member(actor.tenant_id, staff_id)
    try:
        day = parse_date(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date")
    slots = await booking.available_slots(actor.tenant, service, staff, day, public=False)
    return {"slots": [{"start_time": fmt(s), "end_time": fmt(e)} for s, e in slots]}


@router.get("/appointments/{appointment_id}")
async def get_appointment(appointment_id: str, actor: Actor = Depends(get_actor)):
    appt = await get_appt(actor, appointment_id)
    return {"appointment": (await enrich(actor.tenant_id, [appt]))[0]}


@router.post("/appointments")
async def create_appointment(body: Dict[str, Any] = Body(...), actor: Actor = Depends(get_actor)):
    for key in ("service_id", "staff_id", "start_time"):
        if not body.get(key):
            raise HTTPException(status_code=400, detail=f"{key.replace('_', ' ').capitalize()} is required")
    if not actor.can("can_view_all_bookings") and (not actor.staff or body["staff_id"] != actor.staff["staff_id"]):
        raise HTTPException(status_code=403, detail="You can only create appointments for yourself")
    service = await booking.get_service(actor.tenant_id, body["service_id"])
    staff = await booking.get_staff_member(actor.tenant_id, body["staff_id"])
    try:
        start = to_local_naive(body["start_time"], actor.tenant.get("timezone"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start time")
    existing = None
    if body.get("client_id"):
        existing = await db.clients.find_one({"tenant_id": actor.tenant_id, "client_id": body["client_id"]}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Client not found")
    name, email, phone = booking.validate_client_details(
        body.get("client_name") or (existing or {}).get("name") or "Walk-in",
        body.get("client_email") or (existing or {}).get("email"),
        body.get("client_phone") or (existing or {}).get("phone"))
    appt = await booking.create_booking(
        actor.tenant, service, staff, start, client_name=name, client_email=email, client_phone=phone,
        notes=body.get("notes"), source="admin", enforce_availability=False, client_id=body.get("client_id"),
        created_by=actor.user_id)
    return {"appointment": (await enrich(actor.tenant_id, [appt]))[0]}


@router.put("/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, updates: Dict[str, Any] = Body(...), actor: Actor = Depends(get_actor)):
    appt = await get_appt(actor, appointment_id)

    # Move / reassign
    if updates.get("start_time") or (updates.get("staff_id") and updates["staff_id"] != appt["staff_id"]):
        new_staff = None
        if updates.get("staff_id") and updates["staff_id"] != appt["staff_id"]:
            if not actor.can("can_view_all_bookings"):
                raise HTTPException(status_code=403, detail="You can't reassign appointments")
            new_staff = await booking.get_staff_member(actor.tenant_id, updates["staff_id"])
        try:
            new_start = to_local_naive(updates.get("start_time") or appt["start_time"], actor.tenant.get("timezone"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start time")
        if fmt(new_start) != appt["start_time"] or new_staff:
            appt = await booking.reschedule(actor.tenant, appt, new_start, new_staff=new_staff,
                                            notify_client=bool(updates.get("notify_client", True)))

    # Status
    if updates.get("status") and updates["status"] != appt.get("status"):
        if updates["status"] not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        appt = await booking.change_status(actor.tenant, appt, updates["status"], reason=updates.get("reason"),
                                           user_id=actor.user_id)

    # Simple details
    details: Dict[str, Any] = {}
    if "notes" in updates:
        details["notes"] = (str(updates["notes"] or "").strip()[:2000]) or None
    if any(k in updates for k in ("client_name", "client_email", "client_phone")):
        name, email, phone = booking.validate_client_details(
            updates.get("client_name", appt.get("client_name")), updates.get("client_email", appt.get("client_email")),
            updates.get("client_phone", appt.get("client_phone")))
        details.update({"client_name": name, "client_email": email, "client_phone": phone})
    if "total_price" in updates:
        actor.require_manager()
        try:
            details["total_price"] = round(max(0.0, float(updates["total_price"])), 2)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Invalid price")
    if "deposit_paid" in updates:
        details["deposit_paid"] = bool(updates["deposit_paid"])
    if details:
        details["updated_at"] = now_iso()
        await db.appointments.update_one({"appointment_id": appointment_id}, {"$set": details})
        appt.update(details)
    return {"appointment": (await enrich(actor.tenant_id, [appt]))[0]}


@router.post("/appointments/{appointment_id}/cancel")
async def cancel_appointment(appointment_id: str, reason: Optional[str] = Query(None),
                             body: Optional[Dict[str, Any]] = Body(None), actor: Actor = Depends(get_actor)):
    appt = await get_appt(actor, appointment_id)
    reason = reason or (body or {}).get("reason")
    appt = await booking.change_status(actor.tenant, appt, "cancelled", reason=reason, by="business",
                                       user_id=actor.user_id)
    return {"appointment": appt}


@router.post("/appointments/{appointment_id}/approve")
async def approve_appointment(appointment_id: str, actor: Actor = Depends(get_actor)):
    appt = await get_appt(actor, appointment_id)
    if appt.get("status") != "pending_approval":
        raise HTTPException(status_code=400, detail="This appointment isn't waiting for approval")
    appt = await booking.change_status(actor.tenant, appt, "confirmed", user_id=actor.user_id)
    return {"message": "Appointment approved", "status": "confirmed", "appointment": appt}


@router.post("/appointments/{appointment_id}/reject")
async def reject_appointment(appointment_id: str, body: Optional[Dict[str, Any]] = Body(None),
                             actor: Actor = Depends(get_actor)):
    appt = await get_appt(actor, appointment_id)
    if appt.get("status") != "pending_approval":
        raise HTTPException(status_code=400, detail="This appointment isn't waiting for approval")
    reason = (body or {}).get("reason") or "We're unable to accept this booking request"
    appt = await booking.change_status(actor.tenant, appt, "cancelled", reason=reason, user_id=actor.user_id)
    return {"message": "Appointment declined", "status": "cancelled", "appointment": appt}
