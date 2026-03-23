"""
Waitlist Management for TimeSlot Pro
Handles waitlist entries and automatic slot filling
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from enum import Enum
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Request, Query

from models import generate_id, BookingStatus
from plan_gating import check_feature_access, PlanFeature
from reminders import ReminderChannel

logger = logging.getLogger(__name__)

waitlist_router = APIRouter(prefix="/api/waitlist", tags=["Waitlist"])


class WaitlistStatus(str, Enum):
    PENDING = "pending"
    NOTIFIED = "notified"  # Slot became available, client notified
    BOOKED = "booked"      # Client took the slot
    EXPIRED = "expired"    # Entry expired
    CANCELLED = "cancelled"


class WaitlistPriority(str, Enum):
    NORMAL = "normal"
    HIGH = "high"         # VIP clients
    FLEXIBLE = "flexible" # Flexible on timing


class WaitlistEntry(BaseModel):
    """Waitlist entry model"""
    waitlist_id: str = Field(default_factory=lambda: generate_id("wl_"))
    tenant_id: str
    
    # Client info
    client_id: Optional[str] = None
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    
    # Request details
    service_id: str
    preferred_staff_id: Optional[str] = None
    
    # Date/time preferences
    preferred_date: Optional[datetime] = None  # Specific date
    preferred_date_range_start: Optional[datetime] = None  # Or a range
    preferred_date_range_end: Optional[datetime] = None
    preferred_time_start: Optional[str] = None  # e.g., "09:00"
    preferred_time_end: Optional[str] = None    # e.g., "12:00"
    any_date: bool = False  # Accept any available date
    
    # Status
    status: WaitlistStatus = WaitlistStatus.PENDING
    priority: WaitlistPriority = WaitlistPriority.NORMAL
    
    # Notification preferences
    notification_channels: List[ReminderChannel] = Field(default_factory=lambda: [ReminderChannel.EMAIL])
    
    # Tracking
    notified_at: Optional[datetime] = None
    notification_expires_at: Optional[datetime] = None  # How long to hold the slot
    booked_appointment_id: Optional[str] = None
    
    notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None  # When the entry expires


class WaitlistCreate(BaseModel):
    """Request model for creating waitlist entry"""
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    service_id: str
    preferred_staff_id: Optional[str] = None
    preferred_date: Optional[str] = None
    preferred_date_range_start: Optional[str] = None
    preferred_date_range_end: Optional[str] = None
    preferred_time_start: Optional[str] = None
    preferred_time_end: Optional[str] = None
    any_date: bool = False
    notification_channels: List[str] = ["email"]
    notes: Optional[str] = None


def get_db():
    from server import db
    return db


async def require_auth_helper(request: Request):
    from auth import require_auth
    from server import db
    return await require_auth(request, db)


@waitlist_router.get("")
async def list_waitlist(
    request: Request,
    status: Optional[str] = Query(None),
    service_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """List waitlist entries"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    await check_feature_access(db, user.tenant_id, PlanFeature.WAITLIST)
    
    query = {"tenant_id": user.tenant_id}
    if status:
        query["status"] = status
    if service_id:
        query["service_id"] = service_id
    
    skip = (page - 1) * page_size
    
    entries = await db.waitlist.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(page_size).to_list(page_size)
    
    total = await db.waitlist.count_documents(query)
    
    # Enrich with service names
    service_ids = list(set(e["service_id"] for e in entries))
    services = await db.services.find(
        {"service_id": {"$in": service_ids}},
        {"_id": 0, "service_id": 1, "name": 1}
    ).to_list(100)
    service_map = {s["service_id"]: s["name"] for s in services}
    
    for entry in entries:
        entry["service_name"] = service_map.get(entry["service_id"], "Unknown")
    
    return {
        "entries": entries,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@waitlist_router.post("")
async def create_waitlist_entry(data: WaitlistCreate, request: Request):
    """Add a client to the waitlist"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    await check_feature_access(db, user.tenant_id, PlanFeature.WAITLIST)
    
    # Parse dates
    preferred_date = None
    if data.preferred_date:
        preferred_date = datetime.fromisoformat(data.preferred_date.replace("Z", "+00:00"))
    
    date_range_start = None
    date_range_end = None
    if data.preferred_date_range_start:
        date_range_start = datetime.fromisoformat(data.preferred_date_range_start.replace("Z", "+00:00"))
    if data.preferred_date_range_end:
        date_range_end = datetime.fromisoformat(data.preferred_date_range_end.replace("Z", "+00:00"))
    
    # Set expiry (30 days from now)
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    
    entry = WaitlistEntry(
        tenant_id=user.tenant_id,
        client_name=data.client_name,
        client_email=data.client_email,
        client_phone=data.client_phone,
        service_id=data.service_id,
        preferred_staff_id=data.preferred_staff_id,
        preferred_date=preferred_date,
        preferred_date_range_start=date_range_start,
        preferred_date_range_end=date_range_end,
        preferred_time_start=data.preferred_time_start,
        preferred_time_end=data.preferred_time_end,
        any_date=data.any_date,
        notification_channels=[ReminderChannel(c) for c in data.notification_channels],
        notes=data.notes,
        expires_at=expires_at
    )
    
    doc = entry.model_dump()
    # Convert datetimes to ISO strings
    for key in ["created_at", "updated_at", "expires_at", "preferred_date", 
                "preferred_date_range_start", "preferred_date_range_end"]:
        if doc.get(key) and isinstance(doc[key], datetime):
            doc[key] = doc[key].isoformat()
    
    await db.waitlist.insert_one(doc)
    
    return {
        "waitlist_id": entry.waitlist_id,
        "status": entry.status.value,
        "message": "Added to waitlist successfully"
    }


@waitlist_router.get("/{waitlist_id}")
async def get_waitlist_entry(waitlist_id: str, request: Request):
    """Get waitlist entry details"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    await check_feature_access(db, user.tenant_id, PlanFeature.WAITLIST)
    
    entry = await db.waitlist.find_one(
        {"waitlist_id": waitlist_id, "tenant_id": user.tenant_id},
        {"_id": 0}
    )
    
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    
    # Get service name
    service = await db.services.find_one(
        {"service_id": entry["service_id"]},
        {"_id": 0, "name": 1}
    )
    entry["service_name"] = service["name"] if service else "Unknown"
    
    return entry


@waitlist_router.delete("/{waitlist_id}")
async def cancel_waitlist_entry(waitlist_id: str, request: Request):
    """Cancel/remove a waitlist entry"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    
    result = await db.waitlist.update_one(
        {"waitlist_id": waitlist_id, "tenant_id": user.tenant_id},
        {
            "$set": {
                "status": WaitlistStatus.CANCELLED.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    
    return {"status": "cancelled", "waitlist_id": waitlist_id}


@waitlist_router.post("/{waitlist_id}/notify")
async def notify_waitlist_client(waitlist_id: str, request: Request):
    """Manually notify a waitlist client about availability"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    await check_feature_access(db, user.tenant_id, PlanFeature.WAITLIST)
    
    entry = await db.waitlist.find_one(
        {"waitlist_id": waitlist_id, "tenant_id": user.tenant_id},
        {"_id": 0}
    )
    
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    
    if entry["status"] != WaitlistStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Entry is not in pending status")
    
    # Update status to notified
    notification_expires = datetime.now(timezone.utc) + timedelta(hours=24)
    
    await db.waitlist.update_one(
        {"waitlist_id": waitlist_id},
        {
            "$set": {
                "status": WaitlistStatus.NOTIFIED.value,
                "notified_at": datetime.now(timezone.utc).isoformat(),
                "notification_expires_at": notification_expires.isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Create reminder/notification
    from reminders import Reminder, ReminderType, ReminderStatus, render_template
    
    tenant = await db.tenants.find_one(
        {"tenant_id": user.tenant_id},
        {"_id": 0, "name": 1, "slug": 1}
    )
    
    service = await db.services.find_one(
        {"service_id": entry["service_id"]},
        {"_id": 0, "name": 1}
    )
    
    for channel in entry.get("notification_channels", ["email"]):
        if channel == "email" and entry.get("client_email"):
            recipient = entry["client_email"]
        elif channel in ["whatsapp", "sms"] and entry.get("client_phone"):
            recipient = entry["client_phone"]
        else:
            continue
        
        message = f"""Great news, {entry['client_name']}!

A slot has opened up for {service['name'] if service else 'your requested service'} at {tenant['name'] if tenant else 'our business'}.

Please book within 24 hours to secure your spot!

Book now: /book/{tenant['slug'] if tenant else user.tenant_id}

This offer expires in 24 hours."""
        
        reminder = Reminder(
            tenant_id=user.tenant_id,
            reminder_type=ReminderType.WAITLIST_AVAILABLE,
            channel=ReminderChannel(channel),
            recipient_name=entry["client_name"],
            recipient_contact=recipient,
            scheduled_for=datetime.now(timezone.utc),
            subject=f"Spot Available - {service['name'] if service else 'Your Request'}",
            message=message
        )
        
        rem_doc = reminder.model_dump()
        rem_doc["scheduled_for"] = rem_doc["scheduled_for"].isoformat()
        rem_doc["created_at"] = rem_doc["created_at"].isoformat()
        rem_doc["updated_at"] = rem_doc["updated_at"].isoformat()
        
        await db.reminders.insert_one(rem_doc)
    
    return {
        "status": "notified",
        "waitlist_id": waitlist_id,
        "expires_at": notification_expires.isoformat()
    }


@waitlist_router.post("/{waitlist_id}/convert")
async def convert_waitlist_to_booking(waitlist_id: str, request: Request):
    """Convert a waitlist entry to an actual booking"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    body = await request.json()
    
    entry = await db.waitlist.find_one(
        {"waitlist_id": waitlist_id, "tenant_id": user.tenant_id},
        {"_id": 0}
    )
    
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    
    # Create the appointment
    from models import Appointment, AppointmentCreate
    from booking import create_appointment
    
    start_time = datetime.fromisoformat(body["start_time"].replace("Z", "+00:00"))
    
    apt_data = AppointmentCreate(
        staff_id=body.get("staff_id", entry.get("preferred_staff_id")),
        service_id=entry["service_id"],
        start_time=start_time,
        client_name=entry["client_name"],
        client_email=entry.get("client_email"),
        client_phone=entry.get("client_phone"),
        notes=f"From waitlist: {entry.get('notes', '')}"
    )
    
    try:
        appointment = await create_appointment(db, user.tenant_id, apt_data, source="waitlist")
        
        # Update waitlist entry
        await db.waitlist.update_one(
            {"waitlist_id": waitlist_id},
            {
                "$set": {
                    "status": WaitlistStatus.BOOKED.value,
                    "booked_appointment_id": appointment.appointment_id,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "status": "booked",
            "waitlist_id": waitlist_id,
            "appointment_id": appointment.appointment_id
        }
    
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@waitlist_router.get("/stats/summary")
async def get_waitlist_stats(request: Request):
    """Get waitlist statistics"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    await check_feature_access(db, user.tenant_id, PlanFeature.WAITLIST)
    
    pending = await db.waitlist.count_documents({
        "tenant_id": user.tenant_id,
        "status": WaitlistStatus.PENDING.value
    })
    
    notified = await db.waitlist.count_documents({
        "tenant_id": user.tenant_id,
        "status": WaitlistStatus.NOTIFIED.value
    })
    
    booked_this_month = await db.waitlist.count_documents({
        "tenant_id": user.tenant_id,
        "status": WaitlistStatus.BOOKED.value,
        "updated_at": {"$gte": datetime.now(timezone.utc).replace(day=1).isoformat()}
    })
    
    return {
        "pending": pending,
        "notified": notified,
        "booked_this_month": booked_this_month
    }


async def check_waitlist_matches(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    cancelled_appointment: Dict[str, Any]
):
    """
    Check if any waitlist entries match a cancelled appointment slot.
    Called when an appointment is cancelled to potentially fill the slot.
    """
    service_id = cancelled_appointment.get("service_id")
    staff_id = cancelled_appointment.get("staff_id")
    start_time = cancelled_appointment.get("start_time")
    
    if isinstance(start_time, str):
        start_time = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
    
    # Find matching waitlist entries
    query = {
        "tenant_id": tenant_id,
        "service_id": service_id,
        "status": WaitlistStatus.PENDING.value,
        "$or": [
            {"any_date": True},
            {"preferred_date": start_time.date().isoformat()},
            {
                "preferred_date_range_start": {"$lte": start_time.isoformat()},
                "preferred_date_range_end": {"$gte": start_time.isoformat()}
            }
        ]
    }
    
    # Prioritize entries that prefer this staff member
    matches = await db.waitlist.find(
        query,
        {"_id": 0}
    ).sort([
        ("preferred_staff_id", 1 if staff_id else -1),
        ("priority", -1),
        ("created_at", 1)
    ]).limit(5).to_list(5)
    
    return matches
