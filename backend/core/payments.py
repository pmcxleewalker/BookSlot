"""Online deposits with Stripe Connect (Standard accounts).

Each business connects its own Stripe account (existing or new) with Stripe's OAuth screen. Deposits are created
as Checkout Sessions *on the business's account* (Stripe-Account header), so the money goes straight to them and
BookSlot never holds it. Optional platform fee via PLATFORM_FEE_CENTS.
"""
import hashlib
import hmac
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx

from . import config
from .db import db
from .notify import create_notification
from .security import now_iso

logger = logging.getLogger("bookslot.payments")
API = "https://api.stripe.com"
CONNECT = "https://connect.stripe.com"
ZERO_DECIMAL = {"JPY", "KRW", "VND", "CLP", "ISK", "UGX", "XAF", "XOF"}


class StripeError(Exception):
    pass


def platform_ready() -> bool:
    return bool(config.STRIPE_SECRET_KEY and config.STRIPE_CLIENT_ID)


def payment_settings(tenant: Dict[str, Any]) -> Dict[str, Any]:
    s = tenant.get("payment_settings") or {}
    return {"deposits_enabled": bool(s.get("deposits_enabled", False)),
            "refund_hours": int(s.get("refund_hours", 24) if s.get("refund_hours") is not None else 24)}


def takes_online_deposits(tenant: Dict[str, Any]) -> bool:
    return platform_ready() and bool(tenant.get("stripe_account_id")) and payment_settings(tenant)["deposits_enabled"]


def to_minor(amount: float, currency: str) -> int:
    return int(round(float(amount or 0) * (1 if currency.upper() in ZERO_DECIMAL else 100)))


def deposit_cents(tenant: Dict[str, Any], service: Dict[str, Any]) -> int:
    if not takes_online_deposits(tenant) or not service.get("deposit_required"):
        return 0
    cents = to_minor(service.get("deposit_amount") or 0, tenant.get("currency", "EUR"))
    return cents if cents >= 50 else 0  # Stripe's minimum charge is about €0.50


# ---------- low-level Stripe calls (patched in tests) ----------
def _flatten(data: Dict[str, Any], prefix: str = "") -> Dict[str, str]:
    out: Dict[str, str] = {}
    for k, v in data.items():
        key = f"{prefix}[{k}]" if prefix else str(k)
        if isinstance(v, dict):
            out.update(_flatten(v, key))
        elif isinstance(v, list):
            for i, item in enumerate(v):
                if isinstance(item, dict):
                    out.update(_flatten(item, f"{key}[{i}]"))
                else:
                    out[f"{key}[{i}]"] = str(item)
        elif v is not None:
            out[key] = "true" if v is True else "false" if v is False else str(v)
    return out


async def stripe_call(method: str, url: str, data: Optional[Dict[str, Any]] = None,
                      account: Optional[str] = None, idempotency_key: Optional[str] = None) -> Dict[str, Any]:
    headers = {"Authorization": f"Bearer {config.STRIPE_SECRET_KEY}"}
    if account:
        headers["Stripe-Account"] = account
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.request(method, url, data=_flatten(data or {}), headers=headers)
    try:
        body = r.json()
    except ValueError:
        body = {}
    if r.status_code >= 400:
        msg = (body.get("error") or {}).get("message") or body.get("error_description") or f"Stripe error {r.status_code}"
        raise StripeError(msg)
    return body


# ---------- connecting a business's Stripe account ----------
def authorize_url(state: str, email: Optional[str] = None) -> str:
    params = {"response_type": "code", "client_id": config.STRIPE_CLIENT_ID, "scope": "read_write", "state": state,
              "redirect_uri": f"{config.BACKEND_PUBLIC_URL}/api/payments/stripe/callback"}
    if email:
        params["stripe_user[email]"] = email
    return f"{CONNECT}/oauth/authorize?{urlencode(params)}"


async def exchange_code(code: str) -> str:
    body = await stripe_call("POST", f"{CONNECT}/oauth/token", {"grant_type": "authorization_code", "code": code})
    account = body.get("stripe_user_id")
    if not account:
        raise StripeError("Stripe didn't return an account")
    return account


async def deauthorize(account: str) -> None:
    try:
        await stripe_call("POST", f"{CONNECT}/oauth/deauthorize", {"client_id": config.STRIPE_CLIENT_ID,
                                                                   "stripe_user_id": account})
    except StripeError as e:  # already disconnected on Stripe's side is fine
        logger.info("Stripe deauthorize: %s", e)


# ---------- deposits ----------
async def create_deposit_checkout(tenant: Dict[str, Any], service: Dict[str, Any], appt: Dict[str, Any],
                                  cents: int) -> str:
    currency = (tenant.get("currency") or "EUR").lower()
    site = config.FRONTEND_URL
    data: Dict[str, Any] = {
        "mode": "payment",
        "line_items": [{"quantity": 1, "price_data": {
            "currency": currency, "unit_amount": cents,
            "product_data": {"name": f"Deposit: {service['name']}",
                             "description": f"{tenant['name']} · {appt['start_time'][:16].replace('T', ' ')}"}}}],
        "success_url": f"{site}/booking/{appt['appointment_id']}?paid=1",
        "cancel_url": f"{site}/booking/{appt['appointment_id']}?payment=cancelled",
        "expires_at": int(time.time()) + config.PAYMENT_HOLD_MINUTES * 60,
        "client_reference_id": appt["appointment_id"],
        "metadata": {"appointment_id": appt["appointment_id"], "tenant_id": tenant["tenant_id"]},
        "payment_intent_data": {"metadata": {"appointment_id": appt["appointment_id"], "tenant_id": tenant["tenant_id"]},
                                "description": f"Deposit: {service['name']} ({appt.get('client_name')})"},
    }
    if appt.get("client_email"):
        data["customer_email"] = appt["client_email"]
    if config.PLATFORM_FEE_CENTS > 0 and config.PLATFORM_FEE_CENTS < cents:
        data["payment_intent_data"]["application_fee_amount"] = config.PLATFORM_FEE_CENTS
    session = await stripe_call("POST", f"{API}/v1/checkout/sessions", data, account=tenant["stripe_account_id"],
                                idempotency_key=f"deposit-{appt['appointment_id']}")
    await db.appointments.update_one({"appointment_id": appt["appointment_id"]},
                                     {"$set": {"checkout_session_id": session.get("id"),
                                               "payment_url": session.get("url")}})
    return session["url"]


async def refund_deposit(tenant: Dict[str, Any], appt: Dict[str, Any], why: str) -> bool:
    if not (appt.get("payment_intent_id") and tenant.get("stripe_account_id")):
        return False
    try:
        r = await stripe_call("POST", f"{API}/v1/refunds", {"payment_intent": appt["payment_intent_id"],
                                                            "metadata": {"appointment_id": appt["appointment_id"]}},
                              account=tenant["stripe_account_id"], idempotency_key=f"refund-{appt['appointment_id']}")
    except StripeError as e:
        logger.error("Refund failed for %s: %s", appt["appointment_id"], e)
        await create_notification(tenant["tenant_id"], "payment_issue", "Deposit refund failed",
                                  f"Couldn't refund {appt.get('client_name')}'s deposit automatically ({e}). "
                                  "Please refund it in your Stripe dashboard.", {"appointment_id": appt["appointment_id"]})
        return False
    await db.appointments.update_one({"appointment_id": appt["appointment_id"]}, {"$set": {
        "deposit_refunded": True, "refund_id": r.get("id"), "refunded_at": now_iso(), "refund_reason": why}})
    return True


def refund_due(tenant: Dict[str, Any], appt: Dict[str, Any], by: str) -> bool:
    """The business cancelling always refunds. A client cancelling gets it back if they cancel at least
    `refund_hours` before the appointment."""
    if by != "client":
        return True
    from .scheduling import local_now
    hours = payment_settings(tenant)["refund_hours"]
    start = datetime.fromisoformat(appt["start_time"][:19])
    return start - local_now(tenant.get("timezone")) >= timedelta(hours=hours)


async def maybe_refund_on_cancel(tenant: Dict[str, Any], appt: Dict[str, Any], by: str) -> None:
    if not appt.get("deposit_paid") or appt.get("deposit_refunded"):
        return
    if refund_due(tenant, appt, by):
        await refund_deposit(tenant, appt, "Cancelled by business" if by != "client" else "Cancelled in time")
    else:
        await db.appointments.update_one({"appointment_id": appt["appointment_id"]},
                                         {"$set": {"deposit_kept": True}})


async def release_expired_holds() -> int:
    """Run by the background job: free slots whose deposit never arrived."""
    from .booking import release_unpaid
    now = datetime.now(timezone.utc).isoformat()
    n = 0
    async for appt in db.appointments.find({"status": "pending_payment", "payment_expires_at": {"$lt": now}}, {"_id": 0}):
        await release_unpaid(appt, "Deposit not paid in time")
        n += 1
    return n


# ---------- webhooks ----------
def verify_signature(payload: bytes, header: str, secret: str, tolerance: int = 300) -> bool:
    try:
        parts = dict(p.split("=", 1) for p in header.split(",") if "=" in p)
        ts = int(parts["t"])
    except (KeyError, ValueError):
        return False
    if abs(time.time() - ts) > tolerance:
        return False
    expected = hmac.new(secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()
    sigs = [v for k, v in (p.split("=", 1) for p in header.split(",") if "=" in p) if k == "v1"]
    return any(hmac.compare_digest(expected, s) for s in sigs)


async def handle_event(event: Dict[str, Any]) -> str:
    from .booking import finalize_paid_booking, release_unpaid
    etype = event.get("type", "")
    obj = (event.get("data") or {}).get("object") or {}
    appt_id = (obj.get("metadata") or {}).get("appointment_id") or obj.get("client_reference_id")
    if not appt_id or not etype.startswith("checkout.session."):
        return "ignored"
    appt = await db.appointments.find_one({"appointment_id": appt_id}, {"_id": 0})
    if not appt:
        return "unknown appointment"
    tenant = await db.tenants.find_one({"tenant_id": appt["tenant_id"]}, {"_id": 0}) or {}
    # isolation: the event must come from the Stripe account this business connected
    if not event.get("account") or event.get("account") != tenant.get("stripe_account_id"):
        logger.warning("Stripe event %s for %s from unexpected account", event.get("id"), appt_id)
        return "wrong account"
    if etype in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        if obj.get("payment_status") != "paid":
            return "awaiting payment"
        await finalize_paid_booking(appt_id, amount_cents=int(obj.get("amount_total") or 0),
                                    payment_intent=obj.get("payment_intent"), session_id=obj.get("id"))
        return "confirmed"
    if etype in ("checkout.session.expired", "checkout.session.async_payment_failed"):
        if appt.get("status") == "pending_payment":
            await release_unpaid(appt, "Deposit not paid")
        return "released"
    return "ignored"
