"""
V1 Receptionist API for TimeSlot Pro
Secure, versioned, rate-limited endpoints for AI Receptionist (MoltBot) integration
"""
import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from models import (
    Appointment, AppointmentCreate, Service, BookingStatus, generate_id
)
from models_v2 import (
    Conversation, ConversationCreate, ConversationMessage, MessageCreate,
    ConversationStatus, ConversationChannel, MessageSenderType,
    HandoffRequest, HandoffReason, ConversationPriority,
    SlotLock, SlotLockRequest, SlotLockStatus,
    IdempotencyRecord, RateLimitWindow,
    InboxStats
)
from booking import calculate_available_slots, check_booking_conflict, create_appointment
from websocket_manager import ws_manager

logger = logging.getLogger(__name__)

# Create versioned router
receptionist_router = APIRouter(prefix="/api/v1/receptionist", tags=["Receptionist API v1"])


# =====================
# Rate Limiting Middleware
# =====================

RATE_LIMITS = {
    "starter": {"requests_per_minute": 30, "requests_per_hour": 500},
    "growth": {"requests_per_minute": 100, "requests_per_hour": 2000},
    "pro": {"requests_per_minute": 300, "requests_per_hour": 10000},
}


async def check_rate_limit(api_key_doc: Dict[str, Any], db: AsyncIOMotorDatabase) -> bool:
    """Check if API key is within rate limits"""
    api_key_id = api_key_doc["api_key_id"]
    tenant_id = api_key_doc["tenant_id"]
    
    # Get tenant's plan
    subscription = await db.subscriptions.find_one(
        {"tenant_id": tenant_id, "is_active": True},
        {"_id": 0}
    )
    plan = subscription.get("plan", "starter") if subscription else "starter"
    limits = RATE_LIMITS.get(plan, RATE_LIMITS["starter"])
    
    now = datetime.now(timezone.utc)
    minute_start = now.replace(second=0, microsecond=0)
    
    # Check/update rate limit window
    window = await db.rate_limits.find_one(
        {
            "api_key_id": api_key_id,
            "window_start": {"$gte": minute_start.isoformat()}
        },
        {"_id": 0}
    )
    
    if window:
        if window["request_count"] >= limits["requests_per_minute"]:
            return False
        
        # Increment counter
        await db.rate_limits.update_one(
            {"window_id": window["window_id"]},
            {"$inc": {"request_count": 1}}
        )
    else:
        # Create new window
        new_window = RateLimitWindow(
            api_key_id=api_key_id,
            tenant_id=tenant_id,
            window_start=minute_start,
            request_count=1,
            max_requests=limits["requests_per_minute"]
        )
        doc = new_window.model_dump()
        doc["window_start"] = doc["window_start"].isoformat()
        doc["created_at"] = doc["created_at"].isoformat()
        doc["updated_at"] = doc["updated_at"].isoformat()
        await db.rate_limits.insert_one(doc)
    
    return True


async def validate_api_key_with_rate_limit(
    request: Request, db: AsyncIOMotorDatabase
) -> Dict[str, Any]:
    """Validate API key and check rate limits"""
    from auth import hash_api_key
    
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        raise HTTPException(status_code=401, detail="API key required")
    
    key_hash = hash_api_key(api_key)
    api_key_doc = await db.api_keys.find_one(
        {"key_hash": key_hash, "is_active": True},
        {"_id": 0}
    )
    
    if not api_key_doc:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    # Check rate limit
    if not await check_rate_limit(api_key_doc, db):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded",
            headers={"Retry-After": "60"}
        )
    
    # Update last used
    await db.api_keys.update_one(
        {"api_key_id": api_key_doc["api_key_id"]},
        {"$set": {"last_used": datetime.now(timezone.utc).isoformat()}}
    )
    
    return api_key_doc


# =====================
# Idempotency Handling
# =====================

async def get_idempotency_record(
    idempotency_key: str,
    tenant_id: str,
    db: AsyncIOMotorDatabase
) -> Optional[Dict[str, Any]]:
    """Check for existing idempotency record"""
    if not idempotency_key:
        return None
    
    record = await db.idempotency_records.find_one(
        {
            "idempotency_key": idempotency_key,
            "tenant_id": tenant_id,
            "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
        },
        {"_id": 0}
    )
    return record


async def store_idempotency_record(
    idempotency_key: str,
    tenant_id: str,
    api_key_id: str,
    endpoint: str,
    method: str,
    request_body: Dict[str, Any],
    status_code: int,
    response_body: Dict[str, Any],
    db: AsyncIOMotorDatabase
):
    """Store idempotency record for future lookups"""
    request_hash = hashlib.sha256(
        json.dumps(request_body, sort_keys=True, default=str).encode()
    ).hexdigest()
    
    record = IdempotencyRecord(
        idempotency_key=idempotency_key,
        tenant_id=tenant_id,
        api_key_id=api_key_id,
        endpoint=endpoint,
        method=method,
        request_hash=request_hash,
        status_code=status_code,
        response_body=response_body,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
    )
    
    doc = record.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    doc["expires_at"] = doc["expires_at"].isoformat()
    
    await db.idempotency_records.insert_one(doc)


# =====================
# Slot Locking
# =====================

async def acquire_slot_lock(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    data: SlotLockRequest,
    api_key_id: Optional[str] = None,
    conversation_id: Optional[str] = None
) -> SlotLock:
    """Acquire a temporary lock on a time slot"""
    
    # Check idempotency
    if data.idempotency_key:
        existing_lock = await db.slot_locks.find_one(
            {
                "idempotency_key": data.idempotency_key,
                "tenant_id": tenant_id,
                "status": SlotLockStatus.ACTIVE.value
            },
            {"_id": 0}
        )
        if existing_lock:
            return SlotLock(**existing_lock)
    
    # Get service for duration calculation
    service_doc = await db.services.find_one(
        {"service_id": data.service_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not service_doc:
        raise ValueError("Service not found")
    
    total_duration = (
        service_doc.get("buffer_before", 0) +
        service_doc["duration"] +
        service_doc.get("buffer_after", 0)
    )
    end_time = data.start_time + timedelta(minutes=total_duration)
    
    # Check for existing bookings
    has_conflict = await check_booking_conflict(
        db, tenant_id, data.staff_id,
        data.start_time, end_time,
        resource_id=data.resource_id
    )
    if has_conflict:
        raise ValueError("Slot is not available")
    
    # Check for existing locks
    existing_lock = await db.slot_locks.find_one(
        {
            "tenant_id": tenant_id,
            "staff_id": data.staff_id,
            "status": SlotLockStatus.ACTIVE.value,
            "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()},
            "$or": [
                {
                    "start_time": {"$lt": end_time.isoformat()},
                    "end_time": {"$gt": data.start_time.isoformat()}
                }
            ]
        },
        {"_id": 0}
    )
    if existing_lock:
        raise ValueError("Slot is temporarily locked by another booking in progress")
    
    # Create lock
    lock = SlotLock(
        tenant_id=tenant_id,
        staff_id=data.staff_id,
        service_id=data.service_id,
        resource_id=data.resource_id,
        start_time=data.start_time,
        end_time=end_time,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=data.lock_duration_seconds),
        idempotency_key=data.idempotency_key,
        conversation_id=conversation_id,
        api_key_id=api_key_id
    )
    
    doc = lock.model_dump()
    doc["start_time"] = doc["start_time"].isoformat()
    doc["end_time"] = doc["end_time"].isoformat()
    doc["expires_at"] = doc["expires_at"].isoformat()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    
    await db.slot_locks.insert_one(doc)
    
    return lock


async def release_slot_lock(
    db: AsyncIOMotorDatabase,
    lock_id: str,
    tenant_id: str,
    status: SlotLockStatus = SlotLockStatus.RELEASED
):
    """Release a slot lock"""
    await db.slot_locks.update_one(
        {"lock_id": lock_id, "tenant_id": tenant_id},
        {"$set": {
            "status": status.value,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )


# =====================
# API Endpoints
# =====================

@receptionist_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "v1",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@receptionist_router.get("/services")
async def get_services(request: Request):
    """Get available services for booking"""
    from server import db
    
    api_key_doc = await validate_api_key_with_rate_limit(request, db)
    tenant_id = api_key_doc["tenant_id"]
    
    services = await db.services.find(
        {"tenant_id": tenant_id, "is_active": True},
        {"_id": 0, "service_id": 1, "name": 1, "duration": 1, "price": 1, "description": 1, "category_id": 1}
    ).to_list(100)
    
    return {
        "services": services,
        "count": len(services)
    }


@receptionist_router.get("/staff")
async def get_staff(request: Request, service_id: Optional[str] = None):
    """Get available staff members"""
    from server import db
    
    api_key_doc = await validate_api_key_with_rate_limit(request, db)
    tenant_id = api_key_doc["tenant_id"]
    
    query = {"tenant_id": tenant_id, "is_active": True}
    if service_id:
        query["$or"] = [{"services": service_id}, {"services": {"$size": 0}}]
    
    staff = await db.staff.find(
        query,
        {"_id": 0, "staff_id": 1, "name": 1, "title": 1, "services": 1}
    ).to_list(50)
    
    return {
        "staff": staff,
        "count": len(staff)
    }


@receptionist_router.post("/availability")
async def check_availability(request: Request):
    """Check available time slots for a service/date"""
    from server import db
    
    api_key_doc = await validate_api_key_with_rate_limit(request, db)
    tenant_id = api_key_doc["tenant_id"]
    
    body = await request.json()
    service_id = body.get("service_id")
    date_str = body.get("date")
    staff_id = body.get("staff_id")
    
    if not service_id or not date_str:
        raise HTTPException(status_code=400, detail="service_id and date required")
    
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    slots = await calculate_available_slots(db, tenant_id, service_id, date_obj, staff_id)
    
    return {
        "date": date_str,
        "available_slots": [
            {
                "start_time": s.start_time.isoformat(),
                "end_time": s.end_time.isoformat(),
                "staff_id": s.staff_id,
                "staff_name": s.staff_name
            }
            for s in slots
        ],
        "count": len(slots)
    }


@receptionist_router.post("/slots/lock")
async def lock_slot(request: Request):
    """Temporarily lock a time slot during booking process"""
    from server import db
    
    api_key_doc = await validate_api_key_with_rate_limit(request, db)
    tenant_id = api_key_doc["tenant_id"]
    
    body = await request.json()
    
    # Check idempotency
    idempotency_key = request.headers.get("Idempotency-Key")
    if idempotency_key:
        existing = await get_idempotency_record(idempotency_key, tenant_id, db)
        if existing:
            return existing["response_body"]
    
    try:
        start_time = datetime.fromisoformat(body["start_time"].replace("Z", "+00:00"))
    except (KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid start_time format")
    
    lock_request = SlotLockRequest(
        staff_id=body.get("staff_id"),
        service_id=body.get("service_id"),
        start_time=start_time,
        resource_id=body.get("resource_id"),
        idempotency_key=idempotency_key,
        lock_duration_seconds=body.get("lock_duration_seconds", 300)
    )
    
    try:
        lock = await acquire_slot_lock(
            db, tenant_id, lock_request,
            api_key_id=api_key_doc["api_key_id"]
        )
        
        response = {
            "lock_id": lock.lock_id,
            "expires_at": lock.expires_at.isoformat(),
            "start_time": lock.start_time.isoformat(),
            "end_time": lock.end_time.isoformat(),
            "status": "locked"
        }
        
        if idempotency_key:
            await store_idempotency_record(
                idempotency_key, tenant_id, api_key_doc["api_key_id"],
                "/api/v1/receptionist/slots/lock", "POST",
                body, 200, response, db
            )
        
        return response
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@receptionist_router.delete("/slots/lock/{lock_id}")
async def release_lock(lock_id: str, request: Request):
    """Release a slot lock"""
    from server import db
    
    api_key_doc = await validate_api_key_with_rate_limit(request, db)
    tenant_id = api_key_doc["tenant_id"]
    
    await release_slot_lock(db, lock_id, tenant_id)
    
    return {"status": "released", "lock_id": lock_id}


@receptionist_router.post("/bookings")
async def create_booking(request: Request):
    """Create a new booking (atomic operation with conflict protection)"""
    from server import db
    
    api_key_doc = await validate_api_key_with_rate_limit(request, db)
    tenant_id = api_key_doc["tenant_id"]
    
    body = await request.json()
    
    # Check idempotency
    idempotency_key = request.headers.get("Idempotency-Key")
    if idempotency_key:
        existing = await get_idempotency_record(idempotency_key, tenant_id, db)
        if existing:
            return existing["response_body"]
    
    # Parse start time
    try:
        start_time = datetime.fromisoformat(body["start_time"].replace("Z", "+00:00"))
    except (KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid start_time format")
    
    # Check if there's an active lock for this slot
    lock_id = body.get("lock_id")
    if lock_id:
        lock = await db.slot_locks.find_one(
            {
                "lock_id": lock_id,
                "tenant_id": tenant_id,
                "status": SlotLockStatus.ACTIVE.value,
                "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
            },
            {"_id": 0}
        )
        if not lock:
            raise HTTPException(status_code=410, detail="Lock expired or not found")
    
    # Create appointment data
    appointment_data = AppointmentCreate(
        staff_id=body["staff_id"],
        service_id=body["service_id"],
        start_time=start_time,
        client_name=body["client_name"],
        client_email=body.get("client_email"),
        client_phone=body.get("client_phone"),
        notes=body.get("notes"),
        resource_id=body.get("resource_id")
    )
    
    try:
        appointment = await create_appointment(db, tenant_id, appointment_data, source="api")
        
        # Mark lock as converted if present
        if lock_id:
            await release_slot_lock(db, lock_id, tenant_id, SlotLockStatus.CONVERTED)
        
        # Trigger real-time notification
        apt_dict = {
            "appointment_id": appointment.appointment_id,
            "client_name": appointment.client_name,
            "service_id": appointment.service_id,
            "staff_id": appointment.staff_id,
            "start_time": appointment.start_time.isoformat(),
            "source": "api"
        }
        await ws_manager.notify_booking_created(tenant_id, apt_dict)
        
        response = {
            "status": "success",
            "appointment_id": appointment.appointment_id,
            "confirmation_code": appointment.appointment_id[-8:].upper(),
            "start_time": appointment.start_time.isoformat(),
            "end_time": appointment.end_time.isoformat()
        }
        
        if idempotency_key:
            await store_idempotency_record(
                idempotency_key, tenant_id, api_key_doc["api_key_id"],
                "/api/v1/receptionist/bookings", "POST",
                body, 200, response, db
            )
        
        return response
    
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@receptionist_router.post("/bookings/{appointment_id}/reschedule")
async def reschedule_booking(appointment_id: str, request: Request):
    """Reschedule an existing booking"""
    from server import db
    from booking import reschedule_appointment
    
    api_key_doc = await validate_api_key_with_rate_limit(request, db)
    tenant_id = api_key_doc["tenant_id"]
    
    body = await request.json()
    
    # Check idempotency
    idempotency_key = request.headers.get("Idempotency-Key")
    if idempotency_key:
        existing = await get_idempotency_record(idempotency_key, tenant_id, db)
        if existing:
            return existing["response_body"]
    
    try:
        new_start_time = datetime.fromisoformat(body["new_start_time"].replace("Z", "+00:00"))
    except (KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid new_start_time format")
    
    try:
        appointment = await reschedule_appointment(
            db, tenant_id, appointment_id,
            new_start_time, body.get("new_staff_id")
        )
        
        # Notify via WebSocket
        await ws_manager.notify_booking_updated(tenant_id, {
            "appointment_id": appointment.appointment_id,
            "start_time": appointment.start_time.isoformat(),
            "status": appointment.status.value
        }, "rescheduled")
        
        response = {
            "status": "success",
            "appointment_id": appointment.appointment_id,
            "new_start_time": appointment.start_time.isoformat(),
            "new_end_time": appointment.end_time.isoformat()
        }
        
        if idempotency_key:
            await store_idempotency_record(
                idempotency_key, tenant_id, api_key_doc["api_key_id"],
                f"/api/v1/receptionist/bookings/{appointment_id}/reschedule", "POST",
                body, 200, response, db
            )
        
        return response
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@receptionist_router.post("/bookings/{appointment_id}/cancel")
async def cancel_booking(appointment_id: str, request: Request):
    """Cancel an existing booking"""
    from server import db
    from booking import cancel_appointment
    
    api_key_doc = await validate_api_key_with_rate_limit(request, db)
    tenant_id = api_key_doc["tenant_id"]
    
    body = await request.json()
    reason = body.get("reason")
    
    try:
        appointment = await cancel_appointment(db, tenant_id, appointment_id, reason)
        
        # Notify via WebSocket
        await ws_manager.notify_booking_updated(tenant_id, {
            "appointment_id": appointment.appointment_id,
            "status": "cancelled"
        }, "cancelled")
        
        return {
            "status": "success",
            "appointment_id": appointment.appointment_id,
            "message": "Booking cancelled"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================
# Conversation Endpoints
# =====================

@receptionist_router.post("/conversations")
async def create_conversation(request: Request):
    """Create a new conversation"""
    from server import db
    
    api_key_doc = await validate_api_key_with_rate_limit(request, db)
    tenant_id = api_key_doc["tenant_id"]
    
    body = await request.json()
    
    conversation = Conversation(
        tenant_id=tenant_id,
        client_name=body.get("client_name"),
        client_email=body.get("client_email"),
        client_phone=body.get("client_phone"),
        channel=body.get("channel", ConversationChannel.API.value),
        ai_session_id=body.get("ai_session_id")
    )
    
    doc = conversation.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    
    await db.conversations.insert_one(doc)
    
    # Add initial message if provided
    if body.get("initial_message"):
        message = ConversationMessage(
            conversation_id=conversation.conversation_id,
            tenant_id=tenant_id,
            sender_type=MessageSenderType.CLIENT,
            sender_name=body.get("client_name"),
            content=body["initial_message"]
        )
        msg_doc = message.model_dump()
        msg_doc["created_at"] = msg_doc["created_at"].isoformat()
        msg_doc["updated_at"] = msg_doc["updated_at"].isoformat()
        await db.conversation_messages.insert_one(msg_doc)
        
        # Update message count
        await db.conversations.update_one(
            {"conversation_id": conversation.conversation_id},
            {"$inc": {"message_count": 1}}
        )
    
    # Notify via WebSocket
    await ws_manager.notify_new_conversation(tenant_id, {
        "conversation_id": conversation.conversation_id,
        "client_name": conversation.client_name,
        "channel": conversation.channel.value,
        "status": conversation.status.value
    })
    
    return {
        "conversation_id": conversation.conversation_id,
        "status": conversation.status.value,
        "created_at": conversation.created_at.isoformat()
    }


@receptionist_router.post("/conversations/{conversation_id}/messages")
async def add_message(conversation_id: str, request: Request):
    """Add a message to a conversation"""
    from server import db
    
    api_key_doc = await validate_api_key_with_rate_limit(request, db)
    tenant_id = api_key_doc["tenant_id"]
    
    # Verify conversation exists
    conv = await db.conversations.find_one(
        {"conversation_id": conversation_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    body = await request.json()
    
    message = ConversationMessage(
        conversation_id=conversation_id,
        tenant_id=tenant_id,
        sender_type=body.get("sender_type", MessageSenderType.CLIENT.value),
        sender_id=body.get("sender_id"),
        sender_name=body.get("sender_name"),
        content=body["content"],
        content_type=body.get("content_type", "text"),
        metadata=body.get("metadata", {}),
        ai_confidence=body.get("ai_confidence"),
        ai_intent_detected=body.get("ai_intent_detected")
    )
    
    doc = message.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    
    await db.conversation_messages.insert_one(doc)
    
    # Update conversation counts
    update_fields = {"message_count": 1}
    if message.sender_type == MessageSenderType.AI:
        update_fields["ai_message_count"] = 1
    elif message.sender_type == MessageSenderType.STAFF:
        update_fields["human_message_count"] = 1
    
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {
            "$inc": update_fields,
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Check for booking intent
    if body.get("ai_intent_detected") == "booking":
        await db.conversations.update_one(
            {"conversation_id": conversation_id},
            {"$set": {"booking_intent_detected": True}}
        )
    
    # Notify via WebSocket
    await ws_manager.notify_message_received(tenant_id, {
        "conversation_id": conversation_id,
        "message_id": message.message_id,
        "content": message.content[:100],  # Truncated for notification
        "sender_type": message.sender_type.value
    })
    
    return {
        "message_id": message.message_id,
        "created_at": message.created_at.isoformat()
    }


@receptionist_router.post("/conversations/{conversation_id}/handoff")
async def request_handoff(conversation_id: str, request: Request):
    """Request human handoff for a conversation"""
    from server import db
    
    api_key_doc = await validate_api_key_with_rate_limit(request, db)
    tenant_id = api_key_doc["tenant_id"]
    
    body = await request.json()
    
    # Update conversation status
    await db.conversations.update_one(
        {"conversation_id": conversation_id, "tenant_id": tenant_id},
        {
            "$set": {
                "status": ConversationStatus.WAITING_HUMAN.value,
                "handoff_reason": body.get("reason", HandoffReason.CLIENT_REQUEST.value),
                "handoff_requested_at": datetime.now(timezone.utc).isoformat(),
                "priority": body.get("priority", ConversationPriority.NORMAL.value),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Add system message
    system_msg = ConversationMessage(
        conversation_id=conversation_id,
        tenant_id=tenant_id,
        sender_type=MessageSenderType.SYSTEM,
        content=f"Human handoff requested. Reason: {body.get('reason', 'Client request')}",
        metadata={"handoff_notes": body.get("notes")}
    )
    msg_doc = system_msg.model_dump()
    msg_doc["created_at"] = msg_doc["created_at"].isoformat()
    msg_doc["updated_at"] = msg_doc["updated_at"].isoformat()
    await db.conversation_messages.insert_one(msg_doc)
    
    # Notify via WebSocket with priority
    await ws_manager.notify_handoff_requested(tenant_id, {
        "conversation_id": conversation_id,
        "client_name": body.get("client_name"),
        "handoff_reason": body.get("reason"),
        "priority": body.get("priority", "normal")
    })
    
    return {
        "status": "handoff_requested",
        "conversation_id": conversation_id,
        "waiting_for_human": True
    }


@receptionist_router.post("/conversations/{conversation_id}/resolve")
async def resolve_conversation(conversation_id: str, request: Request):
    """Mark a conversation as resolved"""
    from server import db
    
    api_key_doc = await validate_api_key_with_rate_limit(request, db)
    tenant_id = api_key_doc["tenant_id"]
    
    body = await request.json()
    
    conv = await db.conversations.find_one(
        {"conversation_id": conversation_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Calculate resolution time
    created_at = datetime.fromisoformat(conv["created_at"])
    resolution_time_ms = int((datetime.now(timezone.utc) - created_at).total_seconds() * 1000)
    
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {
            "$set": {
                "status": ConversationStatus.RESOLVED.value,
                "resolved_at": datetime.now(timezone.utc).isoformat(),
                "resolution_notes": body.get("notes"),
                "resolution_time_ms": resolution_time_ms,
                "related_appointment_id": body.get("appointment_id"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "status": "resolved",
        "conversation_id": conversation_id,
        "resolution_time_ms": resolution_time_ms
    }


@receptionist_router.get("/inbox/stats")
async def get_inbox_stats(request: Request):
    """Get inbox statistics"""
    from server import db
    
    api_key_doc = await validate_api_key_with_rate_limit(request, db)
    tenant_id = api_key_doc["tenant_id"]
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Count by status
    active = await db.conversations.count_documents({
        "tenant_id": tenant_id,
        "status": ConversationStatus.ACTIVE.value
    })
    
    waiting_human = await db.conversations.count_documents({
        "tenant_id": tenant_id,
        "status": ConversationStatus.WAITING_HUMAN.value
    })
    
    human_handling = await db.conversations.count_documents({
        "tenant_id": tenant_id,
        "status": ConversationStatus.HUMAN_HANDLING.value
    })
    
    resolved_today = await db.conversations.count_documents({
        "tenant_id": tenant_id,
        "status": ConversationStatus.RESOLVED.value,
        "resolved_at": {"$gte": today_start.isoformat()}
    })
    
    return InboxStats(
        active_conversations=active,
        waiting_human=waiting_human,
        human_handling=human_handling,
        resolved_today=resolved_today
    ).model_dump()
