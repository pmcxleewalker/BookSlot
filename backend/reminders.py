"""
Automated Reminder System for TimeSlot Pro
Sends email reminders 24 hours and 1 hour before appointments
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

from email_service import send_email, generate_reminder_email
from models import generate_id

logger = logging.getLogger(__name__)


# Reminder configuration
REMINDER_WINDOWS = [
    {"name": "24h", "hours_before": 24, "sent_field": "reminder_24h_sent"},
    {"name": "1h", "hours_before": 1, "sent_field": "reminder_1h_sent"},
]


async def get_appointments_needing_reminder(
    db: AsyncIOMotorDatabase,
    hours_before: int,
    sent_field: str,
    window_minutes: int = 15
) -> List[Dict[str, Any]]:
    """
    Get appointments that need a reminder sent.
    
    Args:
        hours_before: How many hours before the appointment
        sent_field: Field name to check if reminder was already sent
        window_minutes: Time window to search (default 15 min)
    """
    now = datetime.now(timezone.utc)
    target_time = now + timedelta(hours=hours_before)
    
    # Window: target_time ± window_minutes/2
    window_start = target_time - timedelta(minutes=window_minutes / 2)
    window_end = target_time + timedelta(minutes=window_minutes / 2)
    
    # Find appointments in this window that haven't had this reminder sent
    appointments = await db.appointments.find({
        "status": {"$in": ["pending", "confirmed"]},
        "start_time": {
            "$gte": window_start.isoformat(),
            "$lte": window_end.isoformat()
        },
        "$or": [
            {sent_field: {"$exists": False}},
            {sent_field: False}
        ],
        "client_email": {"$exists": True, "$ne": None, "$ne": ""}
    }, {"_id": 0}).to_list(100)
    
    return appointments


async def send_appointment_reminder(
    db: AsyncIOMotorDatabase,
    appointment: Dict[str, Any],
    reminder_type: str,  # "24h" or "1h"
    sent_field: str
) -> bool:
    """
    Send reminder email for a single appointment.
    """
    try:
        # Get related data
        tenant = await db.tenants.find_one(
            {"tenant_id": appointment["tenant_id"]},
            {"_id": 0, "name": 1, "slug": 1, "email": 1, "phone": 1, "address": 1}
        )
        
        service = await db.services.find_one(
            {"service_id": appointment["service_id"]},
            {"_id": 0, "name": 1}
        )
        
        staff = await db.staff.find_one(
            {"staff_id": appointment["staff_id"]},
            {"_id": 0, "name": 1}
        )
        
        if not tenant or not service:
            logger.warning(f"Missing data for appointment {appointment['appointment_id']}")
            return False
        
        # Parse start time
        start_time = datetime.fromisoformat(appointment["start_time"].replace("Z", "+00:00"))
        
        # Generate email
        subject = f"Reminder: Your appointment at {tenant['name']}"
        if reminder_type == "1h":
            subject = f"Starting Soon: Your appointment at {tenant['name']}"
        
        html = generate_reminder_email(
            client_name=appointment.get("client_name", ""),
            service_name=service.get("name", "Service"),
            staff_name=staff.get("name", "") if staff else "",
            start_time=start_time,
            business_name=tenant.get("name", ""),
            business_address=tenant.get("address", ""),
            manage_url=f"/manage/{appointment['appointment_id']}"
        )
        
        # Send email
        success = await send_email(
            to=appointment["client_email"],
            subject=subject,
            html_content=html
        )
        
        if success:
            # Mark reminder as sent
            await db.appointments.update_one(
                {"appointment_id": appointment["appointment_id"]},
                {"$set": {sent_field: True, f"{sent_field}_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            # Log the reminder
            await db.reminder_logs.insert_one({
                "log_id": generate_id("rlog_"),
                "tenant_id": appointment["tenant_id"],
                "appointment_id": appointment["appointment_id"],
                "reminder_type": reminder_type,
                "recipient": appointment["client_email"],
                "status": "sent",
                "sent_at": datetime.now(timezone.utc).isoformat()
            })
            
            logger.info(f"Sent {reminder_type} reminder for appointment {appointment['appointment_id']}")
            return True
        else:
            # Log failure
            await db.reminder_logs.insert_one({
                "log_id": generate_id("rlog_"),
                "tenant_id": appointment["tenant_id"],
                "appointment_id": appointment["appointment_id"],
                "reminder_type": reminder_type,
                "recipient": appointment["client_email"],
                "status": "failed",
                "sent_at": datetime.now(timezone.utc).isoformat()
            })
            return False
            
    except Exception as e:
        logger.error(f"Error sending reminder for {appointment['appointment_id']}: {e}")
        return False


async def process_reminders(db: AsyncIOMotorDatabase) -> Dict[str, int]:
    """
    Process all pending reminders.
    Call this function periodically (e.g., every 5 minutes via scheduler).
    
    Returns dict with counts of reminders sent.
    """
    results = {
        "24h_sent": 0,
        "24h_failed": 0,
        "1h_sent": 0,
        "1h_failed": 0
    }
    
    for window in REMINDER_WINDOWS:
        appointments = await get_appointments_needing_reminder(
            db,
            hours_before=window["hours_before"],
            sent_field=window["sent_field"]
        )
        
        logger.info(f"Found {len(appointments)} appointments needing {window['name']} reminder")
        
        for appointment in appointments:
            success = await send_appointment_reminder(
                db,
                appointment,
                reminder_type=window["name"],
                sent_field=window["sent_field"]
            )
            
            if success:
                results[f"{window['name']}_sent"] += 1
            else:
                results[f"{window['name']}_failed"] += 1
    
    return results


async def reminder_scheduler_task(db: AsyncIOMotorDatabase):
    """
    Background task that runs every 5 minutes to process reminders.
    Start this task when the server starts.
    """
    logger.info("Starting reminder scheduler...")
    
    while True:
        try:
            results = await process_reminders(db)
            total_sent = results["24h_sent"] + results["1h_sent"]
            if total_sent > 0:
                logger.info(f"Reminder batch complete: {results}")
        except Exception as e:
            logger.error(f"Reminder scheduler error: {e}")
        
        # Wait 5 minutes before next run
        await asyncio.sleep(300)


# Manual trigger for testing
async def send_test_reminder(
    db: AsyncIOMotorDatabase,
    appointment_id: str,
    reminder_type: str = "24h"
) -> bool:
    """
    Manually send a reminder for testing purposes.
    """
    appointment = await db.appointments.find_one(
        {"appointment_id": appointment_id},
        {"_id": 0}
    )
    
    if not appointment:
        return False
    
    sent_field = "reminder_24h_sent" if reminder_type == "24h" else "reminder_1h_sent"
    
    return await send_appointment_reminder(
        db,
        appointment,
        reminder_type=reminder_type,
        sent_field=sent_field
    )


# Get reminder status for an appointment
async def get_reminder_status(
    db: AsyncIOMotorDatabase,
    appointment_id: str
) -> Dict[str, Any]:
    """
    Get reminder status for an appointment.
    """
    appointment = await db.appointments.find_one(
        {"appointment_id": appointment_id},
        {"_id": 0, "reminder_24h_sent": 1, "reminder_24h_sent_at": 1,
         "reminder_1h_sent": 1, "reminder_1h_sent_at": 1}
    )
    
    if not appointment:
        return {}
    
    return {
        "reminder_24h": {
            "sent": appointment.get("reminder_24h_sent", False),
            "sent_at": appointment.get("reminder_24h_sent_at")
        },
        "reminder_1h": {
            "sent": appointment.get("reminder_1h_sent", False),
            "sent_at": appointment.get("reminder_1h_sent_at")
        }
    }
