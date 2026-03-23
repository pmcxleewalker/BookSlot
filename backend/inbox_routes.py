"""
Inbox API routes for TimeSlot Pro Dashboard
Handles conversation management for staff
"""
from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone
from typing import Optional

inbox_router = APIRouter(prefix="/api", tags=["Inbox"])


def get_db():
    """Get database instance - imported at runtime to avoid circular imports"""
    from server import db
    return db


def get_ws_manager():
    """Get WebSocket manager - imported at runtime"""
    from websocket_manager import ws_manager
    return ws_manager


async def require_auth_helper(request: Request):
    """Helper to require auth - imported at runtime"""
    from auth import require_auth
    from server import db
    return await require_auth(request, db)


@inbox_router.get("/inbox/conversations")
async def list_conversations(
    request: Request,
    status: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """List conversations for the inbox"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    query = {"tenant_id": user.tenant_id}
    
    if status:
        query["status"] = status
    if channel:
        query["channel"] = channel
    if priority:
        query["priority"] = priority
    
    skip = (page - 1) * page_size
    
    conversations = await db.conversations.find(
        query,
        {"_id": 0}
    ).sort("updated_at", -1).skip(skip).limit(page_size).to_list(page_size)
    
    total = await db.conversations.count_documents(query)
    
    return {
        "conversations": conversations,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_more": (page * page_size) < total
    }


@inbox_router.get("/inbox/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, request: Request):
    """Get conversation details with messages"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    conversation = await db.conversations.find_one(
        {"conversation_id": conversation_id, "tenant_id": user.tenant_id},
        {"_id": 0}
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = await db.conversation_messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    
    return {
        **conversation,
        "messages": messages
    }


@inbox_router.post("/inbox/conversations/{conversation_id}/assign")
async def assign_conversation(conversation_id: str, request: Request):
    """Assign conversation to current user (staff takes over)"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    
    # Get staff ID for this user
    staff = await db.staff.find_one(
        {"user_id": user.user_id, "tenant_id": user.tenant_id},
        {"_id": 0}
    )
    staff_id = staff["staff_id"] if staff else user.user_id
    
    await db.conversations.update_one(
        {"conversation_id": conversation_id, "tenant_id": user.tenant_id},
        {
            "$set": {
                "status": "human_handling",
                "assigned_staff_id": staff_id,
                "assigned_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Add system message
    from models_v2 import ConversationMessage, MessageSenderType
    
    system_msg = ConversationMessage(
        conversation_id=conversation_id,
        tenant_id=user.tenant_id,
        sender_type=MessageSenderType.SYSTEM,
        content=f"{user.name} has joined the conversation"
    )
    msg_doc = system_msg.model_dump()
    msg_doc["created_at"] = msg_doc["created_at"].isoformat()
    msg_doc["updated_at"] = msg_doc["updated_at"].isoformat()
    await db.conversation_messages.insert_one(msg_doc)
    
    return {"status": "assigned", "assigned_to": user.name}


@inbox_router.post("/inbox/conversations/{conversation_id}/messages")
async def send_staff_message(conversation_id: str, request: Request):
    """Send a message as staff"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    ws_manager = get_ws_manager()
    body = await request.json()
    content = body.get("content")
    
    if not content:
        raise HTTPException(status_code=400, detail="content required")
    
    from models_v2 import ConversationMessage, MessageSenderType
    
    message = ConversationMessage(
        conversation_id=conversation_id,
        tenant_id=user.tenant_id,
        sender_type=MessageSenderType.STAFF,
        sender_id=user.user_id,
        sender_name=user.name,
        content=content
    )
    
    msg_doc = message.model_dump()
    msg_doc["created_at"] = msg_doc["created_at"].isoformat()
    msg_doc["updated_at"] = msg_doc["updated_at"].isoformat()
    await db.conversation_messages.insert_one(msg_doc)
    
    # Update conversation
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {
            "$inc": {"message_count": 1, "human_message_count": 1},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Notify via WebSocket
    await ws_manager.notify_message_received(user.tenant_id, {
        "conversation_id": conversation_id,
        "message_id": message.message_id,
        "content": content[:100],
        "sender_type": "staff"
    })
    
    return {
        "message_id": message.message_id,
        "created_at": message.created_at.isoformat()
    }


@inbox_router.post("/inbox/conversations/{conversation_id}/resolve")
async def resolve_conversation_dashboard(conversation_id: str, request: Request):
    """Resolve a conversation from dashboard"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    body = await request.json()
    
    conv = await db.conversations.find_one(
        {"conversation_id": conversation_id, "tenant_id": user.tenant_id},
        {"_id": 0}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    created_at = datetime.fromisoformat(conv["created_at"])
    resolution_time_ms = int((datetime.now(timezone.utc) - created_at).total_seconds() * 1000)
    
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {
            "$set": {
                "status": "resolved",
                "resolved_at": datetime.now(timezone.utc).isoformat(),
                "resolution_notes": body.get("notes"),
                "resolution_time_ms": resolution_time_ms,
                "related_appointment_id": body.get("appointment_id"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"status": "resolved", "resolution_time_ms": resolution_time_ms}


@inbox_router.get("/inbox/stats")
async def get_inbox_stats_dashboard(request: Request):
    """Get inbox statistics for dashboard"""
    user = await require_auth_helper(request)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    db = get_db()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    active = await db.conversations.count_documents({
        "tenant_id": user.tenant_id,
        "status": "active"
    })
    
    waiting_human = await db.conversations.count_documents({
        "tenant_id": user.tenant_id,
        "status": "waiting_human"
    })
    
    human_handling = await db.conversations.count_documents({
        "tenant_id": user.tenant_id,
        "status": "human_handling"
    })
    
    resolved_today = await db.conversations.count_documents({
        "tenant_id": user.tenant_id,
        "status": "resolved",
        "resolved_at": {"$gte": today_start.isoformat()}
    })
    
    return {
        "active_conversations": active,
        "waiting_human": waiting_human,
        "human_handling": human_handling,
        "resolved_today": resolved_today
    }
