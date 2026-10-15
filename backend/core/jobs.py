"""Background jobs: appointment reminders and one-off data migrations."""
import asyncio
import logging
from datetime import timedelta

from . import config
from .db import db
from .notify import send_booking_message
from .scheduling import fmt, local_now, to_local_naive
from .security import now_iso

logger = logging.getLogger("bookslot.jobs")


async def send_due_reminders() -> int:
    sent = 0
    tenants = await db.tenants.find({"is_active": True, "$or": [{"email_reminders_enabled": {"$ne": False}},
                                                                {"sms_reminders_enabled": True}]},
                                    {"_id": 0}).to_list(10000)
    for tenant in tenants:
        tz = tenant.get("timezone")
        hours = int(tenant.get("reminder_hours_before") or 24)
        now = local_now(tz)
        due = await db.appointments.find({
            "tenant_id": tenant["tenant_id"], "status": "confirmed",
            "start_time": {"$gt": fmt(now), "$lte": fmt(now + timedelta(hours=hours))},
            "reminder_sent_at": None,
        }, {"_id": 0}).to_list(1000)
        for appt in due:
            # claim the reminder first so two workers can never send it twice
            claim = await db.appointments.update_one(
                {"appointment_id": appt["appointment_id"], "reminder_sent_at": None},
                {"$set": {"reminder_sent_at": now_iso()}})
            if claim.modified_count != 1:
                continue
            try:
                created = to_local_naive(appt.get("created_at") or now_iso(), tz)
                start = to_local_naive(appt["start_time"], tz)
                if start - created < timedelta(hours=hours):
                    continue  # booked inside the reminder window - the confirmation is enough
            except ValueError:
                pass
            await send_booking_message("reminder", appt, tenant, include_sms=True)
            sent += 1
    return sent


async def reminder_loop() -> None:
    await asyncio.sleep(10)
    while True:
        try:
            n = await send_due_reminders()
            if n:
                logger.info("Sent %s appointment reminders", n)
        except Exception as e:  # noqa: BLE001
            logger.exception("Reminder job failed: %s", e)
        await asyncio.sleep(config.REMINDER_INTERVAL_SECONDS)


async def run_migrations() -> None:
    """Make data created by older versions consistent with the current rules. Safe to run every start."""
    # 1. Appointment times must be naive local strings (older online bookings saved UTC end times)
    tz_cache = {}
    cursor = db.appointments.find({"$or": [{"start_time": {"$regex": "(Z|[+-]\\d\\d:\\d\\d)$"}},
                                           {"end_time": {"$regex": "(Z|[+-]\\d\\d:\\d\\d)$"}},
                                           {"start_time": {"$regex": "\\."}}, {"end_time": {"$regex": "\\."}}]},
                                  {"_id": 0, "appointment_id": 1, "tenant_id": 1, "start_time": 1, "end_time": 1})
    fixed = 0
    async for a in cursor:
        tid = a["tenant_id"]
        if tid not in tz_cache:
            t = await db.tenants.find_one({"tenant_id": tid}, {"_id": 0, "timezone": 1}) or {}
            tz_cache[tid] = t.get("timezone")
        try:
            start = to_local_naive(a["start_time"], tz_cache[tid])
            end = to_local_naive(a["end_time"], tz_cache[tid])
            if end <= start:  # the old UTC bug could put the end before the start
                end = start + timedelta(minutes=30)
            await db.appointments.update_one({"appointment_id": a["appointment_id"]},
                                             {"$set": {"start_time": fmt(start), "end_time": fmt(end)}})
            fixed += 1
        except (ValueError, KeyError):
            continue
    if fixed:
        logger.info("Normalised times on %s appointments", fixed)

    # 2. Reminder flag so old appointments aren't all reminded at once
    today = now_iso()[:10]
    await db.appointments.update_many({"reminder_sent_at": {"$exists": False}, "start_time": {"$lt": today}},
                                      {"$set": {"reminder_sent_at": "legacy"}})
    await db.appointments.update_many({"reminder_sent_at": {"$exists": False}}, {"$set": {"reminder_sent_at": None}})

    # 3. Lower-case emails so logins are case-insensitive
    async for u in db.users.find({"email": {"$regex": "[A-Z]"}}, {"_id": 0, "user_id": 1, "email": 1}):
        lower = u["email"].lower()
        if not await db.users.find_one({"email": lower}, {"_id": 1}):
            await db.users.update_one({"user_id": u["user_id"]}, {"$set": {"email": lower}})

    # 4. Old Emergent-era sessions are no longer used
    await db.user_sessions.delete_many({})
