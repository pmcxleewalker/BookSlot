"""Appointment reminder emails.

Sends one reminder email per appointment, `reminder_hours_before` hours ahead
(per-tenant setting, default 24). Runs as a background loop started on app
startup, and can also be triggered on demand (e.g. by an external cron) via
`run_reminder_pass`.

Kept separate from server.py so the scheduling logic can be tested without a
database or email provider.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Dict, Optional
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

ACTIVE_STATUSES = ["pending", "confirmed"]
DEFAULT_HOURS_BEFORE = 24
DEFAULT_SUBJECT = "Reminder: your appointment at {business_name}"
DEFAULT_BODY = (
    "Hi {client_name},\n\n"
    "This is a reminder of your appointment:\n\n"
    "Service: {service_name}\n"
    "Date: {date}\n"
    "Time: {time}\n"
    "Location: {location}\n\n"
    "Need to change it? Visit: /booking/{appointment_id}\n\n"
    "See you soon,\n{business_name}"
)

SendEmail = Callable[[str, str, str, str, str], Awaitable[Any]]


def _tz(name: Optional[str]) -> ZoneInfo:
    try:
        return ZoneInfo(name or "Europe/Dublin")
    except Exception:
        return ZoneInfo("Europe/Dublin")


def parse_start(start: Any, tz_name: Optional[str]) -> Optional[datetime]:
    """Parse a stored start_time into an aware datetime.

    Naive values are treated as local time in the tenant's timezone.
    """
    if isinstance(start, datetime):
        dt = start
    elif isinstance(start, str) and start:
        try:
            dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_tz(tz_name))
    return dt


def is_reminder_due(start: Optional[datetime], hours_before: int, now: datetime) -> bool:
    """True when the appointment is in the future and within the reminder window."""
    if start is None:
        return False
    return now < start <= now + timedelta(hours=hours_before)


class _SafeDict(dict):
    def __missing__(self, key):
        return "{" + key + "}"


def render(template: str, values: Dict[str, str]) -> str:
    return template.format_map(_SafeDict(values))


def build_values(appointment: Dict, tenant: Dict, service_name: str, start: datetime) -> Dict[str, str]:
    local = start.astimezone(_tz(tenant.get("timezone")))
    return {
        "client_name": appointment.get("client_name") or "there",
        "service_name": service_name,
        "date": local.strftime("%A %d %B %Y"),
        "time": local.strftime("%H:%M"),
        "location": tenant.get("address") or "See booking details",
        "business_name": tenant.get("name") or "us",
        "appointment_id": appointment.get("appointment_id", ""),
    }


async def _reminder_template(db, tenant_id: str) -> Optional[Dict]:
    return await db.message_templates.find_one(
        {"tenant_id": tenant_id, "trigger": "reminder", "type": "email", "is_active": True},
        {"_id": 0},
    )


async def run_reminder_pass(db, send_email: SendEmail, now: Optional[datetime] = None) -> int:
    """Send any reminders that are due. Returns the number of emails sent."""
    now = now or datetime.now(timezone.utc)
    sent = 0

    tenants = await db.tenants.find(
        {"is_active": {"$ne": False}, "email_reminders_enabled": {"$ne": False}},
        {"_id": 0},
    ).to_list(None)

    for tenant in tenants:
        hours = int(tenant.get("reminder_hours_before") or DEFAULT_HOURS_BEFORE)
        # Coarse filter on the ISO date prefix; exact window checked after parsing.
        lo = (now - timedelta(days=1)).date().isoformat()
        hi = (now + timedelta(hours=hours) + timedelta(days=1)).date().isoformat() + "~"
        candidates = await db.appointments.find(
            {
                "tenant_id": tenant["tenant_id"],
                "status": {"$in": ACTIVE_STATUSES},
                "client_email": {"$nin": [None, ""]},
                "reminder_sent_at": {"$exists": False},
                "start_time": {"$gte": lo, "$lte": hi},
            },
            {"_id": 0},
        ).to_list(None)
        if not candidates:
            continue

        template = await _reminder_template(db, tenant["tenant_id"])
        subject_t = (template or {}).get("subject") or DEFAULT_SUBJECT
        body_t = (template or {}).get("content") or DEFAULT_BODY

        for appt in candidates:
            start = parse_start(appt.get("start_time"), tenant.get("timezone"))
            if not is_reminder_due(start, hours, now):
                continue

            # Claim the appointment first so a reminder is never sent twice,
            # even if two workers run at once.
            claim = await db.appointments.update_one(
                {"appointment_id": appt["appointment_id"], "reminder_sent_at": {"$exists": False}},
                {"$set": {"reminder_sent_at": now.isoformat()}},
            )
            if getattr(claim, "modified_count", 0) != 1:
                continue

            service = await db.services.find_one({"service_id": appt.get("service_id")}, {"_id": 0})
            service_name = (service or {}).get("name") or "Appointment"
            values = build_values(appt, tenant, service_name, start)
            try:
                await send_email(
                    tenant["tenant_id"],
                    appt["client_email"],
                    render(subject_t, values),
                    render(body_t, values),
                    "reminder",
                )
                sent += 1
            except Exception as e:  # keep going for other appointments
                logger.error(f"Reminder failed for {appt['appointment_id']}: {e}")
    if sent:
        logger.info(f"Reminder pass sent {sent} email(s)")
    return sent


async def reminder_loop(db, send_email: SendEmail, interval_seconds: int = 900):
    """Run reminder passes forever, every `interval_seconds`."""
    while True:
        try:
            await run_reminder_pass(db, send_email)
        except Exception as e:
            logger.error(f"Reminder pass error: {e}")
        await asyncio.sleep(interval_seconds)
