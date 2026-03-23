"""
Webhook handling for TimeSlot Pro
Sends webhook notifications for booking events
"""
import asyncio
import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# Webhook event types
WEBHOOK_EVENTS = [
    "booking.created",
    "booking.confirmed",
    "booking.cancelled",
    "booking.rescheduled",
    "booking.completed",
    "booking.no_show",
    "client.created",
    "client.updated",
    "staff.created",
    "staff.updated",
    "service.created",
    "service.updated",
]


def generate_webhook_signature(payload: str, secret: str) -> str:
    """Generate HMAC signature for webhook payload"""
    return hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()


async def send_webhook(
    url: str,
    event: str,
    data: Dict[str, Any],
    secret: str,
    timeout: int = 10
) -> bool:
    """Send a webhook notification"""
    payload = {
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data
    }
    
    payload_str = json.dumps(payload, default=str)
    signature = generate_webhook_signature(payload_str, secret)
    
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": event
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                content=payload_str,
                headers=headers,
                timeout=timeout
            )
            return response.status_code < 400
    except Exception as e:
        logger.error(f"Webhook delivery failed to {url}: {e}")
        return False


async def trigger_webhooks(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    event: str,
    data: Dict[str, Any]
):
    """Trigger all registered webhooks for an event"""
    webhooks = await db.webhooks.find(
        {
            "tenant_id": tenant_id,
            "is_active": True,
            "events": event
        },
        {"_id": 0}
    ).to_list(100)
    
    for webhook in webhooks:
        success = await send_webhook(
            url=webhook["url"],
            event=event,
            data=data,
            secret=webhook["secret"]
        )
        
        # Update webhook stats
        update = {
            "last_triggered": datetime.now(timezone.utc).isoformat()
        }
        if not success:
            update["failure_count"] = webhook.get("failure_count", 0) + 1
        
        await db.webhooks.update_one(
            {"webhook_id": webhook["webhook_id"]},
            {"$set": update}
        )


async def trigger_booking_webhook(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    event: str,
    appointment: Dict[str, Any]
):
    """Trigger webhook for booking events with enriched data"""
    # Get related data
    service = await db.services.find_one(
        {"service_id": appointment.get("service_id")},
        {"_id": 0}
    )
    staff = await db.staff.find_one(
        {"staff_id": appointment.get("staff_id")},
        {"_id": 0}
    )
    
    data = {
        "appointment": appointment,
        "service": service,
        "staff": {
            "staff_id": staff.get("staff_id") if staff else None,
            "name": staff.get("name") if staff else None
        } if staff else None
    }
    
    await trigger_webhooks(db, tenant_id, event, data)
