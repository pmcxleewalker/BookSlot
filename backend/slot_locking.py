"""
Slot Locking System for TimeSlot Pro
Prevents double-booking race conditions by temporarily locking slots during checkout
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
import asyncio

from models import generate_id


# Lock duration in seconds (5 minutes)
LOCK_DURATION_SECONDS = 300


async def acquire_slot_lock(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    staff_id: str,
    start_time: datetime,
    end_time: datetime,
    locked_by: str,  # session_id or user_id
    resource_id: Optional[str] = None
) -> Optional[str]:
    """
    Attempt to acquire a lock on a time slot.
    Returns lock_id if successful, None if slot is already locked or booked.
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=LOCK_DURATION_SECONDS)
    
    # First, clean up expired locks
    await db.slot_locks.delete_many({
        "expires_at": {"$lt": now.isoformat()}
    })
    
    # Check for existing active lock on this slot
    existing_lock = await db.slot_locks.find_one({
        "tenant_id": tenant_id,
        "staff_id": staff_id,
        "is_active": True,
        "expires_at": {"$gt": now.isoformat()},
        "$or": [
            {
                "start_time": {"$lt": end_time.isoformat()},
                "end_time": {"$gt": start_time.isoformat()}
            }
        ]
    })
    
    if existing_lock:
        # Slot is already locked by someone else
        if existing_lock.get("locked_by") == locked_by:
            # Same user, extend the lock
            await db.slot_locks.update_one(
                {"lock_id": existing_lock["lock_id"]},
                {"$set": {"expires_at": expires_at.isoformat()}}
            )
            return existing_lock["lock_id"]
        return None
    
    # Check for resource lock if applicable
    if resource_id:
        resource_lock = await db.slot_locks.find_one({
            "tenant_id": tenant_id,
            "resource_id": resource_id,
            "is_active": True,
            "expires_at": {"$gt": now.isoformat()},
            "$or": [
                {
                    "start_time": {"$lt": end_time.isoformat()},
                    "end_time": {"$gt": start_time.isoformat()}
                }
            ]
        })
        if resource_lock and resource_lock.get("locked_by") != locked_by:
            return None
    
    # Create new lock
    lock_id = generate_id("lock_")
    lock_doc = {
        "lock_id": lock_id,
        "tenant_id": tenant_id,
        "staff_id": staff_id,
        "resource_id": resource_id,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "locked_by": locked_by,
        "locked_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "is_active": True,
        "converted_to_booking": False,
        "appointment_id": None
    }
    
    try:
        await db.slot_locks.insert_one(lock_doc)
        return lock_id
    except Exception:
        # Race condition - someone else got the lock first
        return None


async def release_slot_lock(
    db: AsyncIOMotorDatabase,
    lock_id: str,
    locked_by: str
) -> bool:
    """
    Release a slot lock. Returns True if successful.
    """
    result = await db.slot_locks.update_one(
        {"lock_id": lock_id, "locked_by": locked_by, "is_active": True},
        {"$set": {"is_active": False}}
    )
    return result.modified_count > 0


async def convert_lock_to_booking(
    db: AsyncIOMotorDatabase,
    lock_id: str,
    locked_by: str,
    appointment_id: str
) -> bool:
    """
    Mark a lock as converted to a booking.
    """
    result = await db.slot_locks.update_one(
        {"lock_id": lock_id, "locked_by": locked_by, "is_active": True},
        {
            "$set": {
                "is_active": False,
                "converted_to_booking": True,
                "appointment_id": appointment_id
            }
        }
    )
    return result.modified_count > 0


async def check_slot_available(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    staff_id: str,
    start_time: datetime,
    end_time: datetime,
    exclude_lock_id: Optional[str] = None,
    resource_id: Optional[str] = None
) -> bool:
    """
    Check if a slot is available (not locked and not booked).
    Returns True if available.
    """
    now = datetime.now(timezone.utc)
    
    # Check for active locks
    lock_query = {
        "tenant_id": tenant_id,
        "staff_id": staff_id,
        "is_active": True,
        "expires_at": {"$gt": now.isoformat()},
        "$or": [
            {
                "start_time": {"$lt": end_time.isoformat()},
                "end_time": {"$gt": start_time.isoformat()}
            }
        ]
    }
    
    if exclude_lock_id:
        lock_query["lock_id"] = {"$ne": exclude_lock_id}
    
    existing_lock = await db.slot_locks.find_one(lock_query)
    if existing_lock:
        return False
    
    # Check for resource locks
    if resource_id:
        resource_lock_query = {
            "tenant_id": tenant_id,
            "resource_id": resource_id,
            "is_active": True,
            "expires_at": {"$gt": now.isoformat()},
            "$or": [
                {
                    "start_time": {"$lt": end_time.isoformat()},
                    "end_time": {"$gt": start_time.isoformat()}
                }
            ]
        }
        if exclude_lock_id:
            resource_lock_query["lock_id"] = {"$ne": exclude_lock_id}
        
        resource_lock = await db.slot_locks.find_one(resource_lock_query)
        if resource_lock:
            return False
    
    return True


async def cleanup_expired_locks(db: AsyncIOMotorDatabase):
    """
    Remove all expired locks. Call periodically.
    """
    now = datetime.now(timezone.utc)
    result = await db.slot_locks.delete_many({
        "expires_at": {"$lt": now.isoformat()}
    })
    return result.deleted_count


async def get_active_locks_for_slot(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    staff_id: str,
    date: datetime
) -> list:
    """
    Get all active locks for a staff member on a given date.
    Used to show "being booked" status in UI.
    """
    now = datetime.now(timezone.utc)
    start_of_day = datetime.combine(date.date(), datetime.min.time(), tzinfo=timezone.utc)
    end_of_day = start_of_day + timedelta(days=1)
    
    locks = await db.slot_locks.find({
        "tenant_id": tenant_id,
        "staff_id": staff_id,
        "is_active": True,
        "expires_at": {"$gt": now.isoformat()},
        "start_time": {"$gte": start_of_day.isoformat(), "$lt": end_of_day.isoformat()}
    }, {"_id": 0, "lock_id": 1, "start_time": 1, "end_time": 1}).to_list(100)
    
    return locks
