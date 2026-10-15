from motor.motor_asyncio import AsyncIOMotorClient

from . import config

client = AsyncIOMotorClient(config.MONGO_URL)
db = client[config.DB_NAME]


async def ensure_indexes() -> None:
    """Create indexes once at startup (idempotent)."""
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("tenant_id")
    await db.tenants.create_index("tenant_id", unique=True)
    await db.tenants.create_index("booking_url_slug", unique=True)
    await db.tenants.create_index("api_key_hash")
    await db.staff.create_index([("tenant_id", 1), ("staff_id", 1)])
    await db.services.create_index([("tenant_id", 1), ("service_id", 1)])
    await db.clients.create_index([("tenant_id", 1), ("email", 1)])
    await db.appointments.create_index("appointment_id", unique=True)
    await db.appointments.create_index([("tenant_id", 1), ("start_time", 1)])
    await db.appointments.create_index([("tenant_id", 1), ("staff_id", 1), ("start_time", 1)])
    await db.appointments.create_index([("status", 1), ("start_time", 1)])
    await db.time_blocks.create_index([("tenant_id", 1), ("staff_id", 1)])
    await db.notifications.create_index([("tenant_id", 1), ("created_at", -1)])
    await db.notification_logs.create_index([("tenant_id", 1), ("created_at", -1)])
    await db.webhook_deliveries.create_index([("webhook_id", 1), ("created_at", -1)])
    await db.moltbot_conversations.create_index([("tenant_id", 1), ("updated_at", -1)])
    await db.super_admins.create_index("email", unique=True)
    await db.admin_sessions.create_index("token_hash")
    await db.password_resets.create_index("token_hash")
