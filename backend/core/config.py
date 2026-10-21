"""Central configuration, read once from environment variables (.env supported)."""
import logging
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("bookslot.config")


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _list(name: str, default: str = "") -> list:
    return [x.strip() for x in os.environ.get(name, default).split(",") if x.strip()]


ENVIRONMENT = os.environ.get("ENVIRONMENT", "development").lower()
IS_PRODUCTION = ENVIRONMENT == "production"

# ---------- Database ----------
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "bookslot")

# ---------- URLs ----------
# Public URL of the React frontend (used in emails, CORS default, links)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
# Public URL of this API (used to build absolute file URLs). Optional.
BACKEND_PUBLIC_URL = os.environ.get("BACKEND_PUBLIC_URL", "").rstrip("/")

CORS_ORIGINS = _list("CORS_ORIGINS") or [FRONTEND_URL]

# ---------- Auth ----------
_INSECURE_SECRETS = {"", "bookslot-secret-key-change-in-production", "change-me", "changeme"}
JWT_SECRET = os.environ.get("JWT_SECRET", "")
if JWT_SECRET in _INSECURE_SECRETS or len(JWT_SECRET) < 32:
    if IS_PRODUCTION:
        raise RuntimeError(
            "JWT_SECRET must be set to a random string of at least 32 characters in production. "
            "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )
    JWT_SECRET = secrets.token_urlsafe(48)
    logger.warning("JWT_SECRET not set - using a random secret for this process (sessions reset on restart).")

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(os.environ.get("JWT_EXPIRATION_HOURS", "168"))  # 7 days

# Cookies: secure cookies require HTTPS. For local http development set COOKIE_SECURE=false.
COOKIE_SECURE = _bool("COOKIE_SECURE", not FRONTEND_URL.startswith("http://localhost"))
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "none" if COOKIE_SECURE else "lax").lower()

# Google Sign-In (optional). Create an OAuth client ID at console.cloud.google.com
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

# Super admin bootstrap: created on startup if no super admin with this email exists
SUPER_ADMIN_EMAIL = os.environ.get("SUPER_ADMIN_EMAIL", "").strip().lower()
SUPER_ADMIN_PASSWORD = os.environ.get("SUPER_ADMIN_PASSWORD", "")
SUPER_ADMIN_NAME = os.environ.get("SUPER_ADMIN_NAME", "Platform Admin")

# ---------- Email (Resend) ----------
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "BookSlot <onboarding@resend.dev>")
PLATFORM_NAME = os.environ.get("PLATFORM_NAME", "BookSlot")

# ---------- SMS (Twilio) ----------
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.environ.get("TWILIO_PHONE_NUMBER", "")
# Shared BookSlot WhatsApp sender for every business (e.g. +3531234567). Clients reach the right business via
# its link, which pre-fills "#<booking-link>". A business can still have its own number (set in /admin).
TWILIO_WHATSAPP_NUMBER = os.environ.get("TWILIO_WHATSAPP_NUMBER", "")
SMS_ADDON_PRICE = int(os.environ.get("SMS_ADDON_PRICE", "10"))

# ---------- AI receptionist ----------
# AI_PROVIDER: "openai" or "anthropic". Leave keys empty to disable the AI receptionist.
AI_PROVIDER = os.environ.get("AI_PROVIDER", "").lower()
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
if not AI_PROVIDER:
    AI_PROVIDER = "openai" if OPENAI_API_KEY else ("anthropic" if ANTHROPIC_API_KEY else "")
AI_MODEL = os.environ.get("AI_MODEL", "") or (
    "gpt-4o-mini" if AI_PROVIDER == "openai" else "claude-haiku-4-5" if AI_PROVIDER == "anthropic" else ""
)
AI_ENABLED = _bool("AI_ENABLED", True) and bool(
    (AI_PROVIDER == "openai" and OPENAI_API_KEY) or (AI_PROVIDER == "anthropic" and ANTHROPIC_API_KEY)
)

# ---------- File storage ----------
# Local disk by default. Set S3_BUCKET (plus AWS credentials) to use S3 / S3-compatible storage
# such as Cloudflare R2, DigitalOcean Spaces, Backblaze B2.
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", str(ROOT_DIR / "uploads")))
S3_BUCKET = os.environ.get("S3_BUCKET", "")
S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT_URL", "") or None
S3_REGION = os.environ.get("S3_REGION", "") or None
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_MB", "5")) * 1024 * 1024

# ---------- Background jobs ----------
ENABLE_REMINDERS = _bool("ENABLE_REMINDERS", True)
REMINDER_INTERVAL_SECONDS = int(os.environ.get("REMINDER_INTERVAL_SECONDS", "300"))

# Multiply all rate limits (e.g. 10 for automated tests). 0 disables rate limiting.
RATE_LIMIT_SCALE = float(os.environ.get("RATE_LIMIT_SCALE", "1"))

# Allow webhooks to private/internal addresses (only for local testing)
ALLOW_PRIVATE_WEBHOOKS = _bool("ALLOW_PRIVATE_WEBHOOKS", not IS_PRODUCTION)
