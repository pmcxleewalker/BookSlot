"""
Booking logic for TimeSlot Pro
Handles availability calculation, conflict detection, and booking operations
"""
from datetime import datetime, timezone, timedelta, time
from typing import List, Optional, Dict, Any, Tuple
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorClient

from models import (
    Appointment, AppointmentCreate, Service, StaffMember, 
    StaffSchedule, Resource, BookingStatus, AvailabilitySlot, WorkingHours,
    generate_id
)

# Day name mapping
DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']


def parse_time(time_str: str) -> time:
    """Parse time string HH:MM to time object"""
    parts = time_str.split(":")
    return time(int(parts[0]), int(parts[1]))


def time_to_minutes(t: time) -> int:
    """Convert time to minutes from midnight"""
    return t.hour * 60 + t.minute


def minutes_to_time(minutes: int) -> time:
    """Convert minutes from midnight to time"""
    return time(minutes // 60, minutes % 60)


async def get_business_hours(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    date: datetime
) -> Optional[Dict[str, Any]]:
    """Get business operating hours for a specific day"""
    day_name = DAY_NAMES[date.weekday()]
    
    tenant = await db.tenants.find_one(
        {"tenant_id": tenant_id},
        {"_id": 0, "business_hours": 1}
    )
    
    if not tenant or "business_hours" not in tenant:
        # Default hours
        return {"open": "09:00", "close": "17:00", "is_open": True}
    
    day_hours = tenant["business_hours"].get(day_name)
    if not day_hours:
        return {"open": "09:00", "close": "17:00", "is_open": True}
    
    return day_hours


async def get_staff_working_hours(
    db: AsyncIOMotorDatabase,
    staff_id: str,
    date: datetime,
    business_hours: Optional[Dict[str, Any]] = None
) -> Optional[WorkingHours]:
    """Get staff working hours for a specific day, bounded by business hours"""
    day_of_week = date.weekday()  # 0=Monday
    
    # Get staff schedule
    schedule_doc = await db.staff_schedules.find_one(
        {"staff_id": staff_id},
        {"_id": 0}
    )
    
    # Also check staff document for working_hours
    staff_doc = await db.staff.find_one(
        {"staff_id": staff_id},
        {"_id": 0, "working_hours": 1}
    )
    
    staff_hours = None
    
    # Try schedule first
    if schedule_doc:
        for wh in schedule_doc.get("working_hours", []):
            if wh["day_of_week"] == day_of_week:
                staff_hours = wh
                break
    
    # Try staff document working_hours
    if not staff_hours and staff_doc and staff_doc.get("working_hours"):
        day_name = DAY_NAMES[day_of_week]
        day_hours = staff_doc["working_hours"].get(day_name)
        if day_hours and day_hours.get("enabled", True):
            staff_hours = {
                "day_of_week": day_of_week,
                "start_time": day_hours.get("start", "09:00"),
                "end_time": day_hours.get("end", "17:00"),
                "is_working": day_hours.get("enabled", True)
            }
    
    # Default if no schedule
    if not staff_hours:
        staff_hours = {
            "day_of_week": day_of_week,
            "start_time": "09:00",
            "end_time": "17:00",
            "is_working": True
        }
    
    # If not working, return None
    if not staff_hours.get("is_working", True):
        return None
    
    # Bound by business hours if provided
    if business_hours and business_hours.get("is_open"):
        biz_open = parse_time(business_hours["open"])
        biz_close = parse_time(business_hours["close"])
        staff_start = parse_time(staff_hours["start_time"])
        staff_end = parse_time(staff_hours["end_time"])
        
        # Staff can't work outside business hours
        actual_start = max(biz_open, staff_start, key=time_to_minutes)
        actual_end = min(biz_close, staff_end, key=time_to_minutes)
        
        if time_to_minutes(actual_start) >= time_to_minutes(actual_end):
            return None  # No valid working time
        
        return WorkingHours(
            day_of_week=day_of_week,
            start_time=actual_start.strftime("%H:%M"),
            end_time=actual_end.strftime("%H:%M"),
            is_working=True
        )
    elif business_hours and not business_hours.get("is_open"):
        return None  # Business closed
    
    return WorkingHours(**staff_hours)


async def get_staff_appointments(
    db: AsyncIOMotorDatabase,
    staff_id: str,
    date: datetime
) -> List[Dict[str, Any]]:
    """Get all appointments for a staff member on a specific date"""
    start_of_day = datetime.combine(date.date(), time(0, 0), tzinfo=timezone.utc)
    end_of_day = start_of_day + timedelta(days=1)
    
    appointments = await db.appointments.find(
        {
            "staff_id": staff_id,
            "start_time": {"$gte": start_of_day.isoformat(), "$lt": end_of_day.isoformat()},
            "status": {"$nin": [BookingStatus.CANCELLED.value]}
        },
        {"_id": 0}
    ).to_list(100)
    
    return appointments


async def get_resource_appointments(
    db: AsyncIOMotorDatabase,
    resource_id: str,
    date: datetime
) -> List[Dict[str, Any]]:
    """Get all appointments using a resource on a specific date"""
    start_of_day = datetime.combine(date.date(), time(0, 0), tzinfo=timezone.utc)
    end_of_day = start_of_day + timedelta(days=1)
    
    appointments = await db.appointments.find(
        {
            "resource_id": resource_id,
            "start_time": {"$gte": start_of_day.isoformat(), "$lt": end_of_day.isoformat()},
            "status": {"$nin": [BookingStatus.CANCELLED.value]}
        },
        {"_id": 0}
    ).to_list(100)
    
    return appointments


async def calculate_available_slots(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    service_id: str,
    date: datetime,
    staff_id: Optional[str] = None,
    resource_id: Optional[str] = None,
    slot_interval: int = 15  # minutes
) -> List[AvailabilitySlot]:
    """
    Calculate available time slots for a service on a given date.
    Respects business hours and staff working hours.
    If staff_id is None or "any", returns slots from any available staff.
    """
    available_slots = []
    
    # Get business hours first
    business_hours = await get_business_hours(db, tenant_id, date)
    if not business_hours or not business_hours.get("is_open", True):
        return []  # Business is closed
    
    # Get service details
    service_doc = await db.services.find_one(
        {"service_id": service_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not service_doc:
        return []
    
    total_duration = (
        service_doc.get("buffer_before", 0) +
        service_doc["duration"] +
        service_doc.get("buffer_after", 0)
    )
    
    # Get eligible staff
    any_staff = staff_id is None or staff_id == "any"
    
    if not any_staff:
        staff_list = [await db.staff.find_one(
            {"staff_id": staff_id, "tenant_id": tenant_id, "is_active": True},
            {"_id": 0}
        )]
        staff_list = [s for s in staff_list if s]
    else:
        staff_list = await db.staff.find(
            {
                "tenant_id": tenant_id,
                "is_active": True,
                "$or": [
                    {"services": service_id},
                    {"services": {"$size": 0}}  # Staff with no specific services can do all
                ]
            },
            {"_id": 0}
        ).to_list(50)
    
    # Track slots by time to find "any available" slots
    slots_by_time = {}
    
    for staff in staff_list:
        # Get working hours bounded by business hours
        working_hours = await get_staff_working_hours(db, staff["staff_id"], date, business_hours)
        if not working_hours or not working_hours.is_working:
            continue
        
        # Get existing appointments
        appointments = await get_staff_appointments(db, staff["staff_id"], date)
        
        # Build busy periods
        busy_periods = []
        for apt in appointments:
            start = datetime.fromisoformat(apt["start_time"])
            end = datetime.fromisoformat(apt["end_time"])
            busy_periods.append((start, end))
        
        # Generate slots
        start_time = parse_time(working_hours.start_time)
        end_time = parse_time(working_hours.end_time)
        
        current_minutes = time_to_minutes(start_time)
        end_minutes = time_to_minutes(end_time)
        
        while current_minutes + total_duration <= end_minutes:
            slot_start = datetime.combine(
                date.date(),
                minutes_to_time(current_minutes),
                tzinfo=timezone.utc
            )
            slot_end = slot_start + timedelta(minutes=total_duration)
            
            # Check for conflicts
            is_available = True
            for busy_start, busy_end in busy_periods:
                if not (slot_end <= busy_start or slot_start >= busy_end):
                    is_available = False
                    break
            
            # Check resource availability if specified
            if is_available and resource_id:
                resource_appointments = await get_resource_appointments(
                    db, resource_id, date
                )
                for rapt in resource_appointments:
                    rstart = datetime.fromisoformat(rapt["start_time"])
                    rend = datetime.fromisoformat(rapt["end_time"])
                    if not (slot_end <= rstart or slot_start >= rend):
                        is_available = False
                        break
            
            if is_available:
                available_slots.append(AvailabilitySlot(
                    start_time=slot_start,
                    end_time=slot_end,
                    staff_id=staff["staff_id"],
                    staff_name=staff["name"],
                    resource_id=resource_id
                ))
            
            current_minutes += slot_interval
    
    # Sort by time
    available_slots.sort(key=lambda x: (x.start_time, x.staff_name))
    
    return available_slots


async def check_booking_conflict(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    staff_id: str,
    start_time: datetime,
    end_time: datetime,
    exclude_appointment_id: Optional[str] = None,
    resource_id: Optional[str] = None
) -> bool:
    """
    Check if there's a booking conflict for the given time slot
    Returns True if there IS a conflict
    """
    query = {
        "tenant_id": tenant_id,
        "staff_id": staff_id,
        "status": {"$nin": [BookingStatus.CANCELLED.value]},
        "$or": [
            {
                "start_time": {"$lt": end_time.isoformat()},
                "end_time": {"$gt": start_time.isoformat()}
            }
        ]
    }
    
    if exclude_appointment_id:
        query["appointment_id"] = {"$ne": exclude_appointment_id}
    
    conflict = await db.appointments.find_one(query, {"_id": 0})
    if conflict:
        return True
    
    # Check resource conflict if applicable
    if resource_id:
        resource_query = {
            "tenant_id": tenant_id,
            "resource_id": resource_id,
            "status": {"$nin": [BookingStatus.CANCELLED.value]},
            "$or": [
                {
                    "start_time": {"$lt": end_time.isoformat()},
                    "end_time": {"$gt": start_time.isoformat()}
                }
            ]
        }
        if exclude_appointment_id:
            resource_query["appointment_id"] = {"$ne": exclude_appointment_id}
        
        resource_conflict = await db.appointments.find_one(resource_query, {"_id": 0})
        if resource_conflict:
            return True
    
    return False


async def create_appointment(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    data: AppointmentCreate,
    source: str = "online",
    lock_id: Optional[str] = None,
    locked_by: Optional[str] = None,
    idempotency_key: Optional[str] = None
) -> Tuple[Appointment, bool]:
    """
    Create a new appointment with:
    - Conflict checking
    - Slot locking (race condition prevention)
    - Idempotency support
    
    Returns: (appointment, was_idempotent)
    - was_idempotent=True means this was a duplicate request
    """
    from slot_locking import acquire_slot_lock, convert_lock_to_booking
    from idempotency import check_idempotency, store_idempotency
    
    # Check idempotency first
    if idempotency_key:
        is_duplicate, cached = await check_idempotency(db, idempotency_key, tenant_id)
        if is_duplicate and cached:
            # Return cached appointment
            cached_apt = Appointment(**{
                **cached,
                "start_time": datetime.fromisoformat(cached["start_time"]),
                "end_time": datetime.fromisoformat(cached["end_time"]),
                "created_at": datetime.fromisoformat(cached["created_at"]),
                "updated_at": datetime.fromisoformat(cached["updated_at"])
            })
            return (cached_apt, True)
    
    # Get service details
    service_doc = await db.services.find_one(
        {"service_id": data.service_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not service_doc:
        raise ValueError("Service not found")
    
    # Calculate end time
    total_duration = (
        service_doc.get("buffer_before", 0) +
        service_doc["duration"] +
        service_doc.get("buffer_after", 0)
    )
    end_time = data.start_time + timedelta(minutes=total_duration)
    
    # Check for conflicts (traditional check)
    has_conflict = await check_booking_conflict(
        db, tenant_id, data.staff_id,
        data.start_time, end_time,
        resource_id=data.resource_id
    )
    
    if has_conflict:
        raise ValueError("Time slot is not available")
    
    # Acquire slot lock (prevents race conditions)
    session_id = locked_by or generate_id("sess_")
    if not lock_id:
        lock_id = await acquire_slot_lock(
            db=db,
            tenant_id=tenant_id,
            staff_id=data.staff_id,
            start_time=data.start_time,
            end_time=end_time,
            locked_by=session_id,
            resource_id=data.resource_id
        )
        
        if not lock_id:
            raise ValueError("Someone else is booking this slot. Please try another time.")
    
    # Create appointment
    appointment = Appointment(
        tenant_id=tenant_id,
        staff_id=data.staff_id,
        service_id=data.service_id,
        resource_id=data.resource_id,
        start_time=data.start_time,
        end_time=end_time,
        client_name=data.client_name,
        client_email=data.client_email,
        client_phone=data.client_phone,
        notes=data.notes,
        price=service_doc.get("price", 0),
        source=source
    )
    
    # Store in database
    doc = appointment.model_dump()
    doc["start_time"] = doc["start_time"].isoformat()
    doc["end_time"] = doc["end_time"].isoformat()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    
    await db.appointments.insert_one(doc)
    
    # Convert the lock to a booking (marks it as used)
    if lock_id:
        await convert_lock_to_booking(db, lock_id, session_id, appointment.appointment_id)
    
    # Store idempotency record
    if idempotency_key:
        await store_idempotency(
            db, idempotency_key, tenant_id, "booking.create",
            {
                "appointment_id": appointment.appointment_id,
                "confirmation_code": appointment.confirmation_code,
                "start_time": doc["start_time"],
                "end_time": doc["end_time"],
                "created_at": doc["created_at"],
                "updated_at": doc["updated_at"],
                "tenant_id": tenant_id,
                "staff_id": data.staff_id,
                "service_id": data.service_id,
                "client_name": data.client_name,
                "client_email": data.client_email,
                "status": appointment.status
            }
        )
    
    return (appointment, False)


async def reschedule_appointment(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    appointment_id: str,
    new_start_time: datetime,
    new_staff_id: Optional[str] = None
) -> Appointment:
    """Reschedule an existing appointment"""
    
    # Get existing appointment
    apt_doc = await db.appointments.find_one(
        {"appointment_id": appointment_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not apt_doc:
        raise ValueError("Appointment not found")
    
    staff_id = new_staff_id or apt_doc["staff_id"]
    
    # Get service for duration
    service_doc = await db.services.find_one(
        {"service_id": apt_doc["service_id"]},
        {"_id": 0}
    )
    if not service_doc:
        raise ValueError("Service not found")
    
    total_duration = (
        service_doc.get("buffer_before", 0) +
        service_doc["duration"] +
        service_doc.get("buffer_after", 0)
    )
    new_end_time = new_start_time + timedelta(minutes=total_duration)
    
    # Check for conflicts (excluding current appointment)
    has_conflict = await check_booking_conflict(
        db, tenant_id, staff_id,
        new_start_time, new_end_time,
        exclude_appointment_id=appointment_id,
        resource_id=apt_doc.get("resource_id")
    )
    
    if has_conflict:
        raise ValueError("New time slot is not available")
    
    # Update appointment
    await db.appointments.update_one(
        {"appointment_id": appointment_id},
        {
            "$set": {
                "start_time": new_start_time.isoformat(),
                "end_time": new_end_time.isoformat(),
                "staff_id": staff_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Return updated appointment
    updated_doc = await db.appointments.find_one(
        {"appointment_id": appointment_id},
        {"_id": 0}
    )
    return Appointment(**updated_doc)


async def cancel_appointment(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    appointment_id: str,
    reason: Optional[str] = None
) -> Appointment:
    """Cancel an appointment"""
    
    apt_doc = await db.appointments.find_one(
        {"appointment_id": appointment_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not apt_doc:
        raise ValueError("Appointment not found")
    
    await db.appointments.update_one(
        {"appointment_id": appointment_id},
        {
            "$set": {
                "status": BookingStatus.CANCELLED.value,
                "cancel_reason": reason,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    updated_doc = await db.appointments.find_one(
        {"appointment_id": appointment_id},
        {"_id": 0}
    )
    return Appointment(**updated_doc)


async def get_dashboard_stats(
    db: AsyncIOMotorDatabase,
    tenant_id: str
) -> Dict[str, Any]:
    """Get dashboard statistics for a tenant"""
    now = datetime.now(timezone.utc)
    today_start = datetime.combine(now.date(), time(0, 0), tzinfo=timezone.utc)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)
    
    # Today's appointments
    today_apts = await db.appointments.count_documents({
        "tenant_id": tenant_id,
        "start_time": {"$gte": today_start.isoformat()},
        "status": {"$nin": [BookingStatus.CANCELLED.value]}
    })
    
    # This week's appointments
    week_apts = await db.appointments.count_documents({
        "tenant_id": tenant_id,
        "start_time": {"$gte": week_start.isoformat()},
        "status": {"$nin": [BookingStatus.CANCELLED.value]}
    })
    
    # Month revenue (completed appointments)
    month_revenue_pipeline = [
        {
            "$match": {
                "tenant_id": tenant_id,
                "start_time": {"$gte": month_start.isoformat()},
                "status": BookingStatus.COMPLETED.value
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {"$sum": "$price"}
            }
        }
    ]
    revenue_result = await db.appointments.aggregate(month_revenue_pipeline).to_list(1)
    month_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # New clients this month
    new_clients = await db.clients.count_documents({
        "tenant_id": tenant_id,
        "created_at": {"$gte": month_start.isoformat()}
    })
    
    # Pending confirmations
    pending = await db.appointments.count_documents({
        "tenant_id": tenant_id,
        "status": BookingStatus.PENDING.value
    })
    
    # Cancellation rate (last 30 days)
    thirty_days_ago = now - timedelta(days=30)
    total_last_30 = await db.appointments.count_documents({
        "tenant_id": tenant_id,
        "created_at": {"$gte": thirty_days_ago.isoformat()}
    })
    cancelled_last_30 = await db.appointments.count_documents({
        "tenant_id": tenant_id,
        "created_at": {"$gte": thirty_days_ago.isoformat()},
        "status": BookingStatus.CANCELLED.value
    })
    cancellation_rate = (cancelled_last_30 / total_last_30 * 100) if total_last_30 > 0 else 0
    
    return {
        "today_appointments": today_apts,
        "week_appointments": week_apts,
        "month_revenue": month_revenue,
        "new_clients": new_clients,
        "pending_confirmations": pending,
        "cancellation_rate": round(cancellation_rate, 1),
        "popular_services": [],
        "staff_utilization": []
    }
