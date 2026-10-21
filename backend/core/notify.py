"""Email (Resend), SMS (Twilio) and in-app notifications."""
import asyncio
import html
import logging
import re
from datetime import datetime
from typing import Any, Dict, Optional

from . import config
from .db import db
from .security import new_id, now_iso

logger = logging.getLogger("bookslot.notify")

try:
    import resend

    RESEND_AVAILABLE = True
    if config.RESEND_API_KEY:
        resend.api_key = config.RESEND_API_KEY
except ImportError:  # pragma: no cover
    RESEND_AVAILABLE = False

try:
    from twilio.rest import Client as TwilioClient

    TWILIO_AVAILABLE = True
except ImportError:  # pragma: no cover
    TWILIO_AVAILABLE = False

twilio_client = None
if TWILIO_AVAILABLE and config.TWILIO_ACCOUNT_SID and config.TWILIO_AUTH_TOKEN:
    twilio_client = TwilioClient(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)


def email_configured() -> bool:
    return bool(RESEND_AVAILABLE and config.RESEND_API_KEY)


def sms_configured() -> bool:
    return bool(twilio_client)


# ---------- In-app notifications (bell icon) ----------
async def create_notification(tenant_id: str, notif_type: str, title: str, message: str, data: Optional[Dict] = None):
    notification = {
        "notification_id": new_id("notif"),
        "tenant_id": tenant_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "data": data or {},
        "read": False,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one({**notification})
    return notification


# ---------- Templates ----------
DEFAULT_TEMPLATES = [
    {
        "name": "Booking Confirmation", "type": "email", "trigger": "booking_confirmation",
        "subject": "Your appointment at {business_name} is confirmed",
        "content": "Hi {client_name},\n\nYour appointment is confirmed.\n\nService: {service_name}\nWith: {staff_name}\n"
                   "Date: {date}\nTime: {time}\nLocation: {address}\n\nConfirmation code: {confirmation_code}\n"
                   "Manage or cancel your booking: {manage_link}\n\nSee you soon,\n{business_name}",
    },
    {
        "name": "Booking Request Received", "type": "email", "trigger": "booking_pending",
        "subject": "We've received your booking request - {business_name}",
        "content": "Hi {client_name},\n\nThanks for your request for {service_name} on {date} at {time}. "
                   "The team will review it shortly and you'll get another email once it's confirmed.\n\n"
                   "Reference: {confirmation_code}\nView your request: {manage_link}\n\n{business_name}",
    },
    {
        "name": "Appointment Reminder", "type": "email", "trigger": "reminder",
        "subject": "Reminder: {service_name} on {date} at {time}",
        "content": "Hi {client_name},\n\nThis is a reminder of your appointment for {service_name} with {staff_name} "
                   "on {date} at {time}.\nLocation: {address}\n\nNeed to change plans? {manage_link}\n\n{business_name}",
    },
    {
        "name": "Cancellation", "type": "email", "trigger": "cancellation",
        "subject": "Your appointment at {business_name} has been cancelled",
        "content": "Hi {client_name},\n\nYour appointment for {service_name} on {date} at {time} has been cancelled.\n"
                   "{reason}\n\nTo book again visit: {booking_link}\n\n{business_name}",
    },
    {
        "name": "Rescheduled", "type": "email", "trigger": "rescheduled",
        "subject": "Your appointment at {business_name} has moved",
        "content": "Hi {client_name},\n\nYour appointment for {service_name} has been moved to {date} at {time} "
                   "with {staff_name}.\n\nManage your booking: {manage_link}\n\n{business_name}",
    },
    {
        "name": "SMS Confirmation", "type": "sms", "trigger": "booking_confirmation",
        "subject": None,
        "content": "Booked: {service_name} at {business_name} on {date} at {time}. Manage: {manage_link}",
    },
    {
        "name": "SMS Reminder", "type": "sms", "trigger": "reminder",
        "subject": None,
        "content": "Reminder: {service_name} at {business_name} on {date} at {time}. Manage: {manage_link}",
    },
]


async def ensure_default_templates(tenant_id: str) -> None:
    existing = await db.message_templates.find({"tenant_id": tenant_id}, {"_id": 0, "type": 1, "trigger": 1}).to_list(200)
    have = {(t.get("type"), t.get("trigger")) for t in existing}
    to_add = []
    for tpl in DEFAULT_TEMPLATES:
        if (tpl["type"], tpl["trigger"]) not in have:
            to_add.append({**tpl, "template_id": new_id("template"), "tenant_id": tenant_id,
                           "is_active": True, "created_at": now_iso()})
    if to_add:
        await db.message_templates.insert_many(to_add)


class _SafeDict(dict):
    def __missing__(self, key):
        return ""


def render(text: Optional[str], context: Dict[str, Any]) -> str:
    try:
        return (text or "").format_map(_SafeDict(context))
    except (ValueError, IndexError):
        return text or ""


async def booking_context(appointment: Dict[str, Any], tenant: Dict[str, Any], reason: str = "") -> Dict[str, Any]:
    service = await db.services.find_one({"service_id": appointment.get("service_id")}, {"_id": 0, "name": 1})
    staff = await db.staff.find_one({"staff_id": appointment.get("staff_id")}, {"_id": 0, "name": 1})
    try:
        dt = datetime.fromisoformat(str(appointment.get("start_time"))[:19])
        date_str = dt.strftime("%A %d %B %Y")
        time_str = dt.strftime("%H:%M")
    except ValueError:
        date_str, time_str = str(appointment.get("start_time")), ""
    code = appointment.get("appointment_id", "")
    return {
        "client_name": appointment.get("client_name") or "there",
        "service_name": (service or {}).get("name", "your appointment"),
        "staff_name": (staff or {}).get("name", "our team"),
        "date": date_str,
        "time": time_str,
        "business_name": tenant.get("name", ""),
        "address": tenant.get("address") or "See booking details",
        "phone": tenant.get("phone") or "",
        "confirmation_code": code,
        "manage_link": f"{config.FRONTEND_URL}/booking/{code}",
        "booking_link": f"{config.FRONTEND_URL}/book/{tenant.get('booking_url_slug', '')}",
        "reason": f"Reason: {reason}" if reason else "",
    }


async def _template(tenant_id: str, msg_type: str, trigger: str) -> Optional[Dict[str, Any]]:
    tpl = await db.message_templates.find_one(
        {"tenant_id": tenant_id, "type": msg_type, "trigger": trigger}, {"_id": 0})
    if tpl is None:
        tpl = next((t for t in DEFAULT_TEMPLATES if t["type"] == msg_type and t["trigger"] == trigger), None)
        return dict(tpl, is_active=True) if tpl else None
    return tpl


# ---------- Sending ----------
def _email_html(body_text: str, tenant: Optional[Dict[str, Any]]) -> str:
    business = html.escape((tenant or {}).get("name") or config.PLATFORM_NAME)
    color = ((tenant or {}).get("branding") or {}).get("primary_color") or "#E34A33"
    if not isinstance(color, str) or not color.startswith("#") or len(color) > 9:
        color = "#E34A33"
    safe = html.escape(body_text).replace("\n", "<br>")
    # turn bare links into clickable links
    safe = re.sub(r"(https?://[^\s<]+)", r'<a href="\1" style="color:%s">\1</a>' % color, safe)
    return f"""<!DOCTYPE html><html><body style="margin:0;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#222;">
<div style="max-width:560px;margin:0 auto;padding:24px;">
<div style="background:#fff;border-top:4px solid {color};padding:28px;">
<h2 style="margin:0 0 20px;font-size:20px;color:#0A0A0A;">{business}</h2>
<div style="font-size:15px;line-height:1.6;">{safe}</div>
</div>
<p style="font-size:12px;color:#888;text-align:center;margin-top:16px;">Sent by {html.escape(config.PLATFORM_NAME)} on behalf of {business}</p>
</div></body></html>"""


async def send_email(tenant_id: Optional[str], to_email: str, subject: str, body: str, template_type: str = "generic",
                     tenant: Optional[Dict[str, Any]] = None) -> str:
    log = {
        "log_id": new_id("nlog"), "tenant_id": tenant_id, "type": "email", "to": to_email,
        "subject": subject, "body": body[:1000], "template_type": template_type,
        "status": "pending", "created_at": now_iso(),
    }
    await db.notification_logs.insert_one({**log})
    if not email_configured():
        logger.info("Email not sent (RESEND_API_KEY not set): %s -> %s", subject, to_email)
        await db.notification_logs.update_one({"log_id": log["log_id"]},
                                              {"$set": {"status": "skipped", "error": "Email provider not configured"}})
        return log["log_id"]
    params = {"from": config.SENDER_EMAIL, "to": [to_email], "subject": subject, "html": _email_html(body, tenant),
              "text": body}
    if tenant and tenant.get("email"):
        params["reply_to"] = tenant["email"]
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        external_id = result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
        await db.notification_logs.update_one({"log_id": log["log_id"]}, {"$set": {
            "status": "sent", "sent_at": now_iso(), "external_id": external_id}})
    except Exception as e:  # noqa: BLE001
        logger.error("Email send failed: %s", e)
        await db.notification_logs.update_one({"log_id": log["log_id"]},
                                              {"$set": {"status": "failed", "error": str(e)[:300]}})
    return log["log_id"]


TZ_DIAL_CODES = {"Europe/Dublin": "353", "Europe/London": "44", "Europe/Belfast": "44", "Europe/Paris": "33",
                 "Europe/Madrid": "34", "Europe/Berlin": "49", "Europe/Amsterdam": "31", "Europe/Lisbon": "351",
                 "Europe/Rome": "39", "America/New_York": "1", "America/Chicago": "1", "America/Los_Angeles": "1",
                 "Australia/Sydney": "61", "Australia/Melbourne": "61"}


def to_e164(phone: Optional[str], tenant: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """'087 123 4567' -> '+353871234567' (country from the business's timezone). None if it can't be a number."""
    if not phone:
        return None
    raw = str(phone).strip().replace("whatsapp:", "")
    digits = re.sub(r"\D", "", raw)
    if raw.startswith("+"):
        out = "+" + digits
    elif digits.startswith("00"):
        out = "+" + digits[2:]
    else:
        code = TZ_DIAL_CODES.get((tenant or {}).get("timezone") or "", "353")
        out = "+" + code + (digits[1:] if digits.startswith("0") else digits)
    return out if 8 <= len(out) - 1 <= 15 else None


def same_phone(a: Optional[str], b: Optional[str], tenant: Optional[Dict[str, Any]] = None) -> bool:
    x, y = to_e164(a, tenant), to_e164(b, tenant)
    return bool(x and y and x == y)


def sender_number(tenant: Dict[str, Any]) -> Optional[str]:
    """The business's own Twilio number if it has one (clients can then text back to the AI), else the platform's."""
    return tenant.get("sms_number") or config.TWILIO_PHONE_NUMBER or None


async def _twilio_send(tenant: Dict[str, Any], kind: str, to: str, from_: Optional[str], message: str) -> str:
    log = {
        "log_id": new_id("nlog"), "tenant_id": tenant["tenant_id"], "type": kind, "to": to,
        "message": message[:1600], "status": "pending", "created_at": now_iso(),
    }
    await db.notification_logs.insert_one({**log})
    if not (twilio_client and from_):
        await db.notification_logs.update_one({"log_id": log["log_id"]},
                                              {"$set": {"status": "skipped", "error": "SMS provider not configured"}})
        return log["log_id"]
    try:
        msg = await asyncio.to_thread(twilio_client.messages.create, body=message[:1600], from_=from_, to=to)
        await db.notification_logs.update_one({"log_id": log["log_id"]}, {"$set": {
            "status": "sent", "sent_at": now_iso(), "external_id": msg.sid}})
    except Exception as e:  # noqa: BLE001
        logger.error("%s send failed: %s", kind, e)
        await db.notification_logs.update_one({"log_id": log["log_id"]},
                                              {"$set": {"status": "failed", "error": str(e)[:300]}})
    return log["log_id"]


async def send_sms(tenant: Dict[str, Any], to_phone: str, message: str) -> Optional[str]:
    if not tenant.get("sms_addon_enabled"):
        return None
    to = to_e164(to_phone, tenant)
    if not to:
        logger.info("SMS not sent: invalid phone %r", to_phone)
        return None
    return await _twilio_send(tenant, "sms", to, sender_number(tenant), message[:480])


async def send_chat_reply(tenant: Dict[str, Any], channel: str, to: str, message: str,
                          via: Optional[str] = None) -> Optional[str]:
    """Reply from the AI receptionist on the channel and number the client wrote to (sms or whatsapp).
    `via` is the number the client messaged (the business's own number or the shared BookSlot number)."""
    if channel == "whatsapp":
        sender = via or tenant.get("whatsapp_number") or config.TWILIO_WHATSAPP_NUMBER
        if not sender:
            return None
        return await _twilio_send(tenant, "whatsapp", f"whatsapp:{to_e164(to, tenant)}", f"whatsapp:{sender}", message)
    sender = via or tenant.get("sms_number") or config.TWILIO_PHONE_NUMBER
    if not sender:
        return None
    return await _twilio_send(tenant, "sms", to_e164(to, tenant) or to, sender, message)


async def send_plain_text(channel: str, to: str, sender: str, message: str) -> None:
    """A message not tied to any business (e.g. 'which salon?' on the shared number)."""
    if not twilio_client:
        return
    pre = "whatsapp:" if channel == "whatsapp" else ""
    try:
        await asyncio.to_thread(twilio_client.messages.create, body=message[:1600], from_=pre + sender, to=pre + to)
    except Exception as e:  # noqa: BLE001
        logger.error("%s send failed: %s", channel, e)


async def send_booking_message(trigger: str, appointment: Dict[str, Any], tenant: Dict[str, Any],
                               reason: str = "", include_sms: bool = False) -> None:
    """Send the client the email (and optionally SMS) for a booking event using tenant templates."""
    try:
        ctx = await booking_context(appointment, tenant, reason)
        if appointment.get("client_email") and tenant.get("email_reminders_enabled", True):
            tpl = await _template(tenant["tenant_id"], "email", trigger)
            if tpl and tpl.get("is_active", True):
                await send_email(tenant["tenant_id"], appointment["client_email"], render(tpl.get("subject"), ctx),
                                 render(tpl.get("content"), ctx), trigger, tenant)
        if include_sms and appointment.get("client_phone") and tenant.get("sms_addon_enabled") \
                and tenant.get("sms_reminders_enabled"):
            tpl = await _template(tenant["tenant_id"], "sms", trigger)
            if tpl and tpl.get("is_active", True):
                await send_sms(tenant, appointment["client_phone"], render(tpl.get("content"), ctx))
    except Exception as e:  # noqa: BLE001 - notifications must never break a booking
        logger.exception("Failed to send %s message: %s", trigger, e)


def messaging_links(tenant: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """Links clients tap to message this business's AI receptionist. On the shared BookSlot numbers the
    pre-filled text carries the business code (#booking-link) so the message reaches the right business."""
    from urllib.parse import quote
    from .plans import plan_features
    if not (config.AI_ENABLED and plan_features(tenant).get("ai_assistant") and tenant.get("ai_chat_enabled", True)):
        return {"whatsapp": None, "sms": None}
    slug, name = tenant.get("booking_url_slug", ""), tenant.get("name", "")
    out: Dict[str, Optional[str]] = {"whatsapp": None, "sms": None}
    own_wa, shared_wa = tenant.get("whatsapp_number"), to_e164(config.TWILIO_WHATSAPP_NUMBER)
    if own_wa or shared_wa:
        msg = f"Hi {name}" if own_wa else f"Hi {name} #{slug}"
        out["whatsapp"] = f"https://wa.me/{(own_wa or shared_wa).lstrip('+')}?text={quote(msg)}"
    own_sms, shared_sms = tenant.get("sms_number"), to_e164(config.TWILIO_PHONE_NUMBER)
    if own_sms or shared_sms:
        msg = f"Hi {name}" if own_sms else f"Hi {name} #{slug}"
        out["sms"] = f"sms:{own_sms or shared_sms}?&body={quote(msg)}"
    return out
