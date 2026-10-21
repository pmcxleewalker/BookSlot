"""BookSlot API - entry point.

Run locally:   uvicorn server:app --reload --port 8001
Production:    uvicorn server:app --host 0.0.0.0 --port 8001 --proxy-headers
(Use a single worker process: the background reminder job and booking locks live in-process.)
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from core import config
from core.db import client, db, ensure_indexes
from core.jobs import reminder_loop, run_migrations
from routes import admin, appointments, auth, catalog, clients, public, receptionist, reports, staff, tenants, webhooks

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("bookslot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await ensure_indexes()
    except Exception as e:  # noqa: BLE001
        logger.warning("Index creation issue (continuing): %s", e)
    try:
        await run_migrations()
    except Exception as e:  # noqa: BLE001
        logger.exception("Migration failed (continuing): %s", e)
    await admin.bootstrap_super_admin()
    try:
        from core.demo import ensure_demo_tenant
        await ensure_demo_tenant()
    except Exception as e:  # noqa: BLE001
        logger.warning("Demo salon not created: %s", e)
    task = asyncio.create_task(reminder_loop()) if config.ENABLE_REMINDERS else None
    logger.info("BookSlot API started (env=%s, email=%s, sms=%s, ai=%s)", config.ENVIRONMENT,
                bool(config.RESEND_API_KEY), bool(config.TWILIO_ACCOUNT_SID), config.AI_ENABLED)
    yield
    if task:
        task.cancel()
    client.close()


app = FastAPI(title="BookSlot API", version="2.0.0", lifespan=lifespan,
              docs_url=None if config.IS_PRODUCTION else "/api/docs",
              redoc_url=None, openapi_url=None if config.IS_PRODUCTION else "/api/openapi.json")

api = APIRouter(prefix="/api")
for module in (auth, tenants, staff, catalog, clients, appointments, public, reports, webhooks, receptionist, admin):
    api.include_router(module.router)


@api.get("/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "ok"}
    except Exception:  # noqa: BLE001
        return JSONResponse(status_code=503, content={"status": "database unavailable"})


app.include_router(api)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    """Turn pydantic errors into one readable message for the UI."""
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(x) for x in first.get("loc", [])[1:]) or "request"
    msg = first.get("msg", "Invalid input")
    return JSONResponse(status_code=422, content={"detail": f"{field.replace('_', ' ')}: {msg}", "errors": exc.errors()})


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
