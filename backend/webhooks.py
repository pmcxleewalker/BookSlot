"""
Webhook handling for TimeSlot Pro
Sends webhook notifications for booking events with retry queue support
"""
import asyncio
import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone, timedelta
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

# Retry configuration
MAX_RETRY_ATTEMPTS = 5
RETRY_DELAYS = [30, 60, 300, 900, 3600]  # 30s, 1m, 5m, 15m, 1h (exponential backoff)


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


async def queue_webhook_for_retry(
    db: AsyncIOMotorDatabase,
    webhook_id: str,
    tenant_id: str,
    event: str,
    data: Dict[str, Any],
    attempt: int = 1
):
    """Queue a failed webhook for retry with exponential backoff"""
    if attempt > MAX_RETRY_ATTEMPTS:
        logger.warning(f"Webhook {webhook_id} exhausted all retry attempts for event {event}")
        return
    
    delay_seconds = RETRY_DELAYS[min(attempt - 1, len(RETRY_DELAYS) - 1)]
    next_attempt_at = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
    
    retry_doc = {
        "webhook_id": webhook_id,
        "tenant_id": tenant_id,
        "event": event,
        "data": data,
        "attempt": attempt,
        "next_attempt_at": next_attempt_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending"
    }
    
    await db.webhook_retries.insert_one(retry_doc)
    logger.info(f"Queued webhook {webhook_id} for retry #{attempt} at {next_attempt_at.isoformat()}")


async def process_webhook_retries(db: AsyncIOMotorDatabase):
    """Process pending webhook retries - called by background worker"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Find pending retries that are due
    pending_retries = await db.webhook_retries.find({
        "status": "pending",
        "next_attempt_at": {"$lte": now}
    }, {"_id": 0}).limit(50).to_list(50)
    
    for retry in pending_retries:
        webhook_id = retry["webhook_id"]
        
        # Mark as processing
        await db.webhook_retries.update_one(
            {"webhook_id": webhook_id, "attempt": retry["attempt"], "status": "pending"},
            {"$set": {"status": "processing"}}
        )
        
        # Get webhook details
        webhook = await db.webhooks.find_one(
            {"webhook_id": webhook_id, "is_active": True},
            {"_id": 0}
        )
        
        if not webhook:
            # Webhook deleted or disabled, mark as cancelled
            await db.webhook_retries.update_one(
                {"webhook_id": webhook_id, "attempt": retry["attempt"]},
                {"$set": {"status": "cancelled"}}
            )
            continue
        
        # Attempt to send
        success = await send_webhook(
            url=webhook["url"],
            event=retry["event"],
            data=retry["data"],
            secret=webhook["secret"]
        )
        
        if success:
            # Mark as completed
            await db.webhook_retries.update_one(
                {"webhook_id": webhook_id, "attempt": retry["attempt"]},
                {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            # Reset failure count on success
            await db.webhooks.update_one(
                {"webhook_id": webhook_id},
                {"$set": {
                    "failure_count": 0,
                    "last_triggered": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info(f"Webhook {webhook_id} retry #{retry['attempt']} succeeded")
        else:
            # Mark current attempt as failed and queue next retry
            await db.webhook_retries.update_one(
                {"webhook_id": webhook_id, "attempt": retry["attempt"]},
                {"$set": {"status": "failed"}}
            )
            
            # Queue for next retry
            await queue_webhook_for_retry(
                db,
                webhook_id,
                retry["tenant_id"],
                retry["event"],
                retry["data"],
                retry["attempt"] + 1
            )
            
            # Update failure count
            await db.webhooks.update_one(
                {"webhook_id": webhook_id},
                {"$set": {
                    "failure_count": retry["attempt"],
                    "last_triggered": datetime.now(timezone.utc).isoformat()
                }}
            )


async def trigger_webhooks(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    event: str,
    data: Dict[str, Any]
):
    """Trigger all registered webhooks for an event with retry support"""
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
        
        if success:
            # Reset failure count on success
            update["failure_count"] = 0
        else:
            # Increment failure count and queue for retry
            update["failure_count"] = webhook.get("failure_count", 0) + 1
            
            # Queue for retry (first retry)
            await queue_webhook_for_retry(
                db,
                webhook["webhook_id"],
                tenant_id,
                event,
                data,
                attempt=1
            )
        
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


async def webhook_retry_worker(db: AsyncIOMotorDatabase, interval: int = 30):
    """
    Background worker that processes webhook retries.
    Should be started as an asyncio task on application startup.
    """
    logger.info("Starting webhook retry worker")
    while True:
        try:
            await process_webhook_retries(db)
        except Exception as e:
            logger.error(f"Webhook retry worker error: {e}")
        
        await asyncio.sleep(interval)


async def cleanup_old_retries(db: AsyncIOMotorDatabase, days: int = 7):
    """Clean up old retry records"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    result = await db.webhook_retries.delete_many({
        "created_at": {"$lt": cutoff},
        "status": {"$in": ["completed", "cancelled", "failed"]}
    })
    
    if result.deleted_count > 0:
        logger.info(f"Cleaned up {result.deleted_count} old webhook retry records")
