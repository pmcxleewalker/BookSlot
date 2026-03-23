"""
Idempotency System for TimeSlot Pro
Prevents duplicate operations when clients retry requests
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
from motor.motor_asyncio import AsyncIOMotorDatabase
import hashlib
import json

from models import generate_id


# Idempotency key expiration (24 hours)
IDEMPOTENCY_TTL_HOURS = 24


async def check_idempotency(
    db: AsyncIOMotorDatabase,
    idempotency_key: str,
    tenant_id: str
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Check if an idempotency key has been used.
    
    Returns:
        (is_duplicate, cached_response)
        - (False, None) if key is new
        - (True, response) if key was already used
    """
    record = await db.idempotency_keys.find_one({
        "key": idempotency_key,
        "tenant_id": tenant_id,
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
    }, {"_id": 0})
    
    if record:
        return (True, record.get("response"))
    
    return (False, None)


async def store_idempotency(
    db: AsyncIOMotorDatabase,
    idempotency_key: str,
    tenant_id: str,
    operation: str,
    response: Dict[str, Any],
    status_code: int = 200
) -> None:
    """
    Store an idempotency record after successful operation.
    """
    expires_at = datetime.now(timezone.utc) + timedelta(hours=IDEMPOTENCY_TTL_HOURS)
    
    await db.idempotency_keys.update_one(
        {"key": idempotency_key, "tenant_id": tenant_id},
        {"$set": {
            "key": idempotency_key,
            "tenant_id": tenant_id,
            "operation": operation,
            "response": response,
            "status_code": status_code,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at.isoformat()
        }},
        upsert=True
    )


async def cleanup_expired_idempotency_keys(db: AsyncIOMotorDatabase) -> int:
    """Remove expired idempotency keys. Call periodically."""
    result = await db.idempotency_keys.delete_many({
        "expires_at": {"$lt": datetime.now(timezone.utc).isoformat()}
    })
    return result.deleted_count


def generate_idempotency_key(
    tenant_id: str,
    operation: str,
    data: Dict[str, Any]
) -> str:
    """
    Generate a deterministic idempotency key from request data.
    Used when client doesn't provide their own key.
    """
    # Sort keys for consistent hashing
    sorted_data = json.dumps(data, sort_keys=True, default=str)
    content = f"{tenant_id}:{operation}:{sorted_data}"
    return hashlib.sha256(content.encode()).hexdigest()[:32]
