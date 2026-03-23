"""
Booking logic for TimeSlot Pro
Handles availability calculation, conflict detection, and booking operations
"""
from datetime import datetime, timezone, timedelta, time
from typing import List, Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

from models import (
    Appointment, AppointmentCreate, Service, StaffMember, 
    StaffSchedule, Resource, BookingStatus, AvailabilitySlot, WorkingHours
)


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


async def get_staff_working_hours(
    db: AsyncIOMotorDatabase,
    staff_id: str,
    date: datetime
) -> Optional[WorkingHours]:
    """Get staff working hours for a specific day"""
    day_of_week = date.weekday()  # 0=Monday
    
    schedule_doc = await db.staff_schedules.find_one(
        {"staff_id": staff_id},
        {"_id": 0}
    )
    
    if not schedule_doc:
        # Default working hours if no schedule set
        return WorkingHours(
            day_of_week=day_of_week,
            start_time="09:00",
            end_time="17:00",
            is_working=True
        )
    
    for wh in schedule_doc.get("working_hours", []):
        if wh["day_of_week"] == day_of_week:
            return WorkingHours(**wh)
    
    return None


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
    Calculate available time slots for a service on a given date
    """
    available_slots = []
    
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
    if staff_id:
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
    
    for staff in staff_list:
        # Get working hours
        working_hours = await get_staff_working_hours(db, staff["staff_id"], date)
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
    source: str = "online"
) -> Appointment:
    """Create a new appointment with conflict checking"""
    
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
    
    # Check for conflicts
    has_conflict = await check_booking_conflict(
        db, tenant_id, data.staff_id,
        data.start_time, end_time,
        resource_id=data.resource_id
    )
    
    if has_conflict:
        raise ValueError("Time slot is not available")
    
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
    
    return appointment


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
