"""Outgoing webhooks: signed JSON deliveries with retries, run in the background."""
import asyncio
import hashlib
import hmac
import ipaddress
import json
import logging
import socket
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from . import config
from .db import db
from .security import new_id, now_iso

logger = logging.getLogger("bookslot.webhooks")

EVENTS = ["booking.created", "booking.updated", "booking.cancelled", "booking.completed"]
RETRY_DELAYS = [30, 300]  # seconds before attempt 2 and 3

_background: set = set()


def spawn(coro) -> None:
    """Run a coroutine in the background and keep a reference so it isn't garbage collected."""
    task = asyncio.create_task(coro)
    _background.add(task)
    task.add_done_callback(_background.discard)


def validate_webhook_url(url: str) -> str:
    url = (url or "").strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Webhook URL must start with http:// or https://")
    if config.IS_PRODUCTION and parsed.scheme != "https":
        raise HTTPException(status_code=400, detail="Webhook URL must use https://")
    if not config.ALLOW_PRIVATE_WEBHOOKS:
        try:
            infos = socket.getaddrinfo(parsed.hostname, parsed.port or 443)
        except socket.gaierror:
            raise HTTPException(status_code=400, detail="Webhook host could not be resolved")
        for info in infos:
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                raise HTTPException(status_code=400, detail="Webhook URL must point to a public address")
    return url


def sign(body: str, secret: str) -> str:
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def _clean(data: Dict[str, Any]) -> Dict[str, Any]:
    hidden = {"_id", "blocked_until", "reminder_sent_at"}
    return {k: v for k, v in (data or {}).items() if k not in hidden}


async def trigger_webhook(tenant_id: str, event: str, data: Dict[str, Any], webhook_id: Optional[str] = None) -> None:
    """Queue deliveries for every active webhook subscribed to `event`. Never blocks the request."""
    query: Dict[str, Any] = {"tenant_id": tenant_id, "is_active": True, "events": event}
    if webhook_id:
        query["webhook_id"] = webhook_id
    try:
        webhooks = await db.webhooks.find(query, {"_id": 0}).to_list(50)
    except Exception as e:  # noqa: BLE001
        logger.error("Webhook lookup failed: %s", e)
        return
    for webhook in webhooks:
        delivery_id = new_id("delivery")
        payload = {"id": delivery_id, "event": event, "tenant_id": tenant_id, "data": _clean(data),
                   "timestamp": now_iso(), "api_version": "1.0"}
        body = json.dumps(payload, default=str, separators=(",", ":"))
        await db.webhook_deliveries.insert_one({
            "delivery_id": delivery_id, "webhook_id": webhook["webhook_id"], "tenant_id": tenant_id,
            "event": event, "url": webhook["url"], "payload": payload, "status": "pending", "attempts": 0,
            "max_attempts": 1 + len(RETRY_DELAYS), "created_at": payload["timestamp"],
        })
        spawn(_deliver(webhook, body, delivery_id, event))


async def _deliver(webhook: Dict[str, Any], body: str, delivery_id: str, event: str) -> None:
    signature = sign(body, webhook.get("secret", ""))
    headers = {
        "Content-Type": "application/json",
        "X-BookSlot-Signature": f"sha256={signature}",
        "X-Webhook-Signature": f"sha256={signature}",
        "X-BookSlot-Event": event,
        "X-Webhook-Delivery-ID": delivery_id,
        "User-Agent": "BookSlot-Webhook/1.0",
    }
    for attempt in range(1, 2 + len(RETRY_DELAYS)):
        update: Dict[str, Any] = {"attempts": attempt, "last_attempt_at": now_iso()}
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
                resp = await client.post(webhook["url"], content=body, headers=headers)
            update.update({"response_status": resp.status_code, "response_body": (resp.text or "")[:500]})
            if resp.status_code < 400:
                update["status"] = "delivered"
                await db.webhook_deliveries.update_one({"delivery_id": delivery_id}, {"$set": update})
                return
            update["error_message"] = f"HTTP {resp.status_code}"
        except Exception as e:  # noqa: BLE001
            update["error_message"] = str(e)[:500]
        last = attempt > len(RETRY_DELAYS)
        update["status"] = "failed" if last else "retrying"
        await db.webhook_deliveries.update_one({"delivery_id": delivery_id}, {"$set": update})
        if last:
            return
        await asyncio.sleep(RETRY_DELAYS[attempt - 1])
