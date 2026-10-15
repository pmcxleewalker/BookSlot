import secrets
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.deps import Actor, get_manager
from core.security import new_id, now_iso
from core.webhooks import EVENTS, trigger_webhook, validate_webhook_url

router = APIRouter()


def clean_events(events) -> list:
    events = [e for e in dict.fromkeys(events or []) if e in EVENTS]
    if not events:
        raise HTTPException(status_code=400, detail="Choose at least one event")
    return events


@router.get("/webhooks")
async def list_webhooks(actor: Actor = Depends(get_manager)):
    return {"webhooks": await db.webhooks.find({"tenant_id": actor.tenant_id}, {"_id": 0}).to_list(100),
            "events": EVENTS}


@router.post("/webhooks")
async def create_webhook(body: Dict[str, Any], actor: Actor = Depends(get_manager)):
    actor.require_feature("api_webhooks")
    if await db.webhooks.count_documents({"tenant_id": actor.tenant_id}) >= 10:
        raise HTTPException(status_code=400, detail="You can have up to 10 webhooks")
    webhook = {
        "webhook_id": new_id("webhook"), "tenant_id": actor.tenant_id, "url": validate_webhook_url(body.get("url")),
        "events": clean_events(body.get("events")), "secret": f"whsec_{secrets.token_hex(24)}",
        "is_active": True, "created_at": now_iso(),
    }
    await db.webhooks.insert_one({**webhook})
    return {"webhook": webhook}


@router.put("/webhooks/{webhook_id}")
async def update_webhook(webhook_id: str, body: Dict[str, Any], actor: Actor = Depends(get_manager)):
    data: Dict[str, Any] = {}
    if "url" in body:
        data["url"] = validate_webhook_url(body["url"])
    if "events" in body:
        data["events"] = clean_events(body["events"])
    if "is_active" in body:
        data["is_active"] = bool(body["is_active"])
    result = await db.webhooks.update_one({"webhook_id": webhook_id, "tenant_id": actor.tenant_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"webhook": await db.webhooks.find_one({"webhook_id": webhook_id}, {"_id": 0})}


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, actor: Actor = Depends(get_manager)):
    result = await db.webhooks.delete_one({"webhook_id": webhook_id, "tenant_id": actor.tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"message": "Webhook deleted"}


@router.get("/webhooks/{webhook_id}/deliveries")
async def deliveries(webhook_id: str, actor: Actor = Depends(get_manager), limit: int = 50):
    if not await db.webhooks.find_one({"webhook_id": webhook_id, "tenant_id": actor.tenant_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Webhook not found")
    items = await db.webhook_deliveries.find({"webhook_id": webhook_id}, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 200))
    return {"deliveries": items}


@router.post("/webhooks/{webhook_id}/test")
async def test_webhook(webhook_id: str, actor: Actor = Depends(get_manager)):
    webhook = await db.webhooks.find_one({"webhook_id": webhook_id, "tenant_id": actor.tenant_id}, {"_id": 0})
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    data = {"appointment_id": "appt_test", "client_name": "Test Client", "start_time": now_iso(), "test": True}
    await trigger_webhook(actor.tenant_id, webhook["events"][0], data, webhook_id=webhook_id)
    return {"message": "Test event sent", "data": data}


@router.post("/webhooks/{webhook_id}/regenerate-secret")
async def regenerate_secret(webhook_id: str, actor: Actor = Depends(get_manager)):
    result = await db.webhooks.update_one({"webhook_id": webhook_id, "tenant_id": actor.tenant_id},
                                          {"$set": {"secret": f"whsec_{secrets.token_hex(24)}"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"webhook": await db.webhooks.find_one({"webhook_id": webhook_id}, {"_id": 0}), "message": "Secret regenerated"}
