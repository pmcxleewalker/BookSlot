"""Settings > Payments: connect a Stripe account, deposit rules, and the Stripe webhook."""
import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse

from core import config, payments
from core.db import db
from core.deps import Actor, get_actor, get_manager
from core.security import now_iso

router = APIRouter()
logger = logging.getLogger("bookslot.payments.routes")


def _status(tenant: Dict[str, Any]) -> Dict[str, Any]:
    acct = tenant.get("stripe_account_id")
    return {
        "platform_ready": payments.platform_ready(),
        "connected": bool(acct),
        "account": f"…{acct[-6:]}" if acct else None,
        "connected_at": tenant.get("stripe_connected_at"),
        "settings": payments.payment_settings(tenant),
        "taking_deposits": payments.takes_online_deposits(tenant),
        "platform_fee_cents": config.PLATFORM_FEE_CENTS,
    }


@router.get("/payments/status")
async def payment_status(actor: Actor = Depends(get_actor)):
    return _status(actor.tenant)


@router.post("/payments/stripe/connect")
async def start_connect(actor: Actor = Depends(get_manager)):
    if not payments.platform_ready():
        raise HTTPException(status_code=400, detail="Online payments aren't switched on for BookSlot yet. "
                                                    "Ask your BookSlot provider to enable Stripe.")
    state = secrets.token_urlsafe(24)
    await db.oauth_states.insert_one({"_id": state, "tenant_id": actor.tenant_id, "user_id": actor.user_id,
                                      "created_at": datetime.now(timezone.utc).isoformat()})
    return {"url": payments.authorize_url(state, actor.tenant.get("email"))}


@router.get("/payments/stripe/callback")
async def connect_callback(state: str = "", code: Optional[str] = None, error: Optional[str] = None):
    back = f"{config.FRONTEND_URL}/settings?tab=payments"
    record = await db.oauth_states.find_one_and_delete({"_id": state}) if state else None
    if not record:
        return RedirectResponse(f"{back}&stripe=expired", status_code=302)
    try:
        created = datetime.fromisoformat(record["created_at"])
    except (KeyError, ValueError):
        created = datetime.now(timezone.utc) - timedelta(days=1)
    if datetime.now(timezone.utc) - created > timedelta(minutes=30):
        return RedirectResponse(f"{back}&stripe=expired", status_code=302)
    if error or not code:
        return RedirectResponse(f"{back}&stripe=cancelled", status_code=302)
    try:
        account = await payments.exchange_code(code)
    except payments.StripeError as e:
        logger.error("Stripe connect failed: %s", e)
        return RedirectResponse(f"{back}&stripe=failed", status_code=302)
    other = await db.tenants.find_one({"stripe_account_id": account, "tenant_id": {"$ne": record["tenant_id"]}}, {"_id": 1})
    if other:
        return RedirectResponse(f"{back}&stripe=in_use", status_code=302)
    await db.tenants.update_one({"tenant_id": record["tenant_id"]}, {"$set": {
        "stripe_account_id": account, "stripe_connected_at": now_iso(), "updated_at": now_iso()}})
    return RedirectResponse(f"{back}&stripe=connected", status_code=302)


@router.post("/payments/stripe/disconnect")
async def disconnect(actor: Actor = Depends(get_manager)):
    acct = actor.tenant.get("stripe_account_id")
    if acct:
        await payments.deauthorize(acct)
    await db.tenants.update_one({"tenant_id": actor.tenant_id}, {"$unset": {"stripe_account_id": "", "stripe_connected_at": ""},
                                                                 "$set": {"payment_settings.deposits_enabled": False,
                                                                          "updated_at": now_iso()}})
    tenant = await db.tenants.find_one({"tenant_id": actor.tenant_id}, {"_id": 0})
    return _status(tenant)


@router.put("/payments/settings")
async def update_settings(body: Dict[str, Any] = Body(...), actor: Actor = Depends(get_manager)):
    current = payments.payment_settings(actor.tenant)
    if "deposits_enabled" in body:
        want = bool(body["deposits_enabled"])
        if want and not actor.tenant.get("stripe_account_id"):
            raise HTTPException(status_code=400, detail="Connect your Stripe account first")
        current["deposits_enabled"] = want
    if "refund_hours" in body:
        try:
            hours = int(body["refund_hours"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Refund window must be a number of hours")
        if not 0 <= hours <= 24 * 14:
            raise HTTPException(status_code=400, detail="Refund window must be between 0 and 336 hours")
        current["refund_hours"] = hours
    await db.tenants.update_one({"tenant_id": actor.tenant_id}, {"$set": {"payment_settings": current, "updated_at": now_iso()}})
    tenant = await db.tenants.find_one({"tenant_id": actor.tenant_id}, {"_id": 0})
    return _status(tenant)


@router.post("/payments/stripe/webhook")
async def stripe_webhook(request: Request):
    """Stripe Connect webhook (events from connected accounts): checkout.session.completed / expired."""
    if not config.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Stripe webhook not configured")
    payload = await request.body()
    if not payments.verify_signature(payload, request.headers.get("Stripe-Signature", ""), config.STRIPE_WEBHOOK_SECRET):
        raise HTTPException(status_code=400, detail="Invalid signature")
    try:
        event = json.loads(payload)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    if event.get("id"):
        try:
            await db.stripe_events.insert_one({"_id": event["id"], "type": event.get("type"), "received_at": now_iso()})
        except Exception:  # already processed (Stripe retries)
            return {"received": True, "duplicate": True}
    result = await payments.handle_event(event)
    return {"received": True, "result": result}
