"""
TimeSlot Pro - Multi-tenant SaaS Booking Platform
Main FastAPI Application
"""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import re

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Local imports
from models import (
    Tenant, TenantCreate, User, UserCreate, UserLogin, UserRole,
    Subscription, PlanType, Location, LocationCreate,
    StaffMember, StaffCreate, StaffSchedule, WorkingHours,
    Service, ServiceCreate, ServiceCategory, ServiceCategoryCreate,
    Resource, ResourceCreate, Client, ClientCreate,
    Appointment, AppointmentCreate, AppointmentUpdate, BookingStatus,
    CustomForm, FormField, FormSubmission, WaitlistEntry,
    Webhook, WebhookCreate, APIKey, AuditLog, Notification,
    AvailabilitySlot, AvailabilityResponse, BookingConfirmation,
    MoltbotBookingIntent, MoltbotAvailabilityQuery, MoltbotBookingAction,
    DashboardStats, IndustryType, generate_id
)
from auth import (
    hash_password, verify_password, create_jwt_token, decode_jwt_token,
    generate_session_token, get_current_user, require_auth,
    exchange_emergent_session, create_user_session, invalidate_session,
    set_session_cookie, clear_session_cookie,
    generate_api_key, hash_api_key, validate_api_key
)
from booking import (
    calculate_available_slots, check_booking_conflict,
    create_appointment, reschedule_appointment, cancel_appointment,
    get_dashboard_stats
)
from webhooks import trigger_booking_webhook, WEBHOOK_EVENTS
from email_service import (
    send_email, generate_booking_confirmation_email,
    generate_reminder_email, generate_cancellation_email
)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(
    title="TimeSlot Pro API",
    description="Multi-tenant SaaS Booking Platform API",
    version="1.0.0"
)

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# =====================
# Helper Functions
# =====================

def slugify(text: str) -> str:
    """Convert text to URL-friendly slug"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text


async def get_tenant_by_user(user: User) -> Optional[Dict[str, Any]]:
    """Get tenant associated with user"""
    if not user.tenant_id:
        return None
    return await db.tenants.find_one(
        {"tenant_id": user.tenant_id},
        {"_id": 0}
    )


async def check_plan_limits(tenant_id: str, resource_type: str) -> bool:
    """Check if tenant has reached plan limits"""
    subscription = await db.subscriptions.find_one(
        {"tenant_id": tenant_id, "is_active": True},
        {"_id": 0}
    )
    if not subscription:
        return False
    
    if resource_type == "staff":
        count = await db.staff.count_documents({"tenant_id": tenant_id, "is_active": True})
        return count < subscription.get("max_staff", 2)
    elif resource_type == "location":
        count = await db.locations.count_documents({"tenant_id": tenant_id, "is_active": True})
        return count < subscription.get("max_locations", 1)
    
    return True


async def log_audit(
    tenant_id: str,
    user_id: Optional[str],
    action: str,
    entity_type: str,
    entity_id: str,
    changes: Dict[str, Any] = None,
    ip_address: Optional[str] = None
):
    """Log an audit entry"""
    log = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        changes=changes or {},
        ip_address=ip_address
    )
    doc = log.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    await db.audit_logs.insert_one(doc)


# =====================
# Health Check
# =====================

@api_router.get("/")
async def root():
    return {"message": "TimeSlot Pro API", "version": "1.0.0"}


@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


# =====================
# Authentication
# =====================

@api_router.post("/auth/register")
async def register(data: UserCreate, request: Request, response: Response):
    """Register a new user with email/password"""
    # Check if email exists
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=data.email,
        name=data.name,
        password_hash=hash_password(data.password) if data.password else None
    )
    
    doc = user.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    
    await db.users.insert_one(doc)
    
    # Create session
    session_token = generate_session_token()
    await create_user_session(
        db, user.user_id, session_token,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )
    
    set_session_cookie(response, session_token)
    
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "session_token": session_token
    }


@api_router.post("/auth/login")
async def login(data: UserLogin, request: Request, response: Response):
    """Login with email/password"""
    user_doc = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user_doc.get("password_hash"):
        raise HTTPException(status_code=401, detail="Please use Google login")
    
    if not verify_password(data.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create session
    session_token = generate_session_token()
    await create_user_session(
        db, user_doc["user_id"], session_token,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )
    
    set_session_cookie(response, session_token)
    
    return {
        "user_id": user_doc["user_id"],
        "email": user_doc["email"],
        "name": user_doc["name"],
        "tenant_id": user_doc.get("tenant_id"),
        "session_token": session_token
    }


@api_router.post("/auth/session")
async def process_emergent_session(request: Request, response: Response):
    """Process Emergent OAuth session_id"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Exchange session_id for user data
    user_data = await exchange_emergent_session(session_id)
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    email = user_data.get("email")
    name = user_data.get("name")
    picture = user_data.get("picture")
    emergent_session_token = user_data.get("session_token")
    
    # Check if user exists
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    
    if user_doc:
        # Update existing user
        await db.users.update_one(
            {"email": email},
            {"$set": {
                "name": name,
                "picture": picture,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        user_id = user_doc["user_id"]
        tenant_id = user_doc.get("tenant_id")
    else:
        # Create new user
        user = User(
            email=email,
            name=name,
            picture=picture,
            google_id=user_data.get("id")
        )
        doc = user.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        doc["updated_at"] = doc["updated_at"].isoformat()
        await db.users.insert_one(doc)
        user_id = user.user_id
        tenant_id = None
    
    # Create session with Emergent token
    await create_user_session(
        db, user_id, emergent_session_token,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )
    
    set_session_cookie(response, emergent_session_token)
    
    return {
        "user_id": user_id,
        "email": email,
        "name": name,
        "picture": picture,
        "tenant_id": tenant_id,
        "session_token": emergent_session_token
    }


@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    tenant = await get_tenant_by_user(user) if user.tenant_id else None
    
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "role": user.role,
        "tenant_id": user.tenant_id,
        "tenant": tenant
    }


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout current user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await invalidate_session(db, session_token)
    
    clear_session_cookie(response)
    return {"message": "Logged out"}


# =====================
# Onboarding / Tenant Setup
# =====================

@api_router.post("/onboarding/create-business")
async def create_business(data: TenantCreate, request: Request):
    """Create a new business (tenant) during onboarding"""
    user = await require_auth(request, db)
    
    if user.tenant_id:
        raise HTTPException(status_code=400, detail="User already has a business")
    
    # Create slug from name
    base_slug = slugify(data.name)
    slug = base_slug
    counter = 1
    while await db.tenants.find_one({"slug": slug}):
        slug = f"{base_slug}-{counter}"
        counter += 1
    
    # Create tenant
    tenant = Tenant(
        name=data.name,
        slug=slug,
        industry=data.industry,
        email=data.email,
        phone=data.phone,
        timezone=data.timezone,
        currency=data.currency
    )
    
    doc = tenant.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.tenants.insert_one(doc)
    
    # Create default subscription (Starter plan - trial)
    subscription = Subscription(
        tenant_id=tenant.tenant_id,
        plan=PlanType.STARTER,
        price_monthly=29.0,
        max_locations=1,
        max_staff=2,
        features=["online_booking", "reminders", "deposits", "calendar_sync"],
        is_trial=True,
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=14)
    )
    sub_doc = subscription.model_dump()
    sub_doc["created_at"] = sub_doc["created_at"].isoformat()
    sub_doc["updated_at"] = sub_doc["updated_at"].isoformat()
    sub_doc["start_date"] = sub_doc["start_date"].isoformat()
    if sub_doc.get("trial_ends_at"):
        sub_doc["trial_ends_at"] = sub_doc["trial_ends_at"].isoformat()
    await db.subscriptions.insert_one(sub_doc)
    
    # Create default location
    location = Location(
        tenant_id=tenant.tenant_id,
        name="Main Location",
        address=tenant.address or "To be updated",
        is_primary=True
    )
    loc_doc = location.model_dump()
    loc_doc["created_at"] = loc_doc["created_at"].isoformat()
    loc_doc["updated_at"] = loc_doc["updated_at"].isoformat()
    await db.locations.insert_one(loc_doc)
    
    # Update user with tenant
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "tenant_id": tenant.tenant_id,
            "role": UserRole.OWNER.value,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create owner as first staff member
    staff = StaffMember(
        tenant_id=tenant.tenant_id,
        user_id=user.user_id,
        location_id=location.location_id,
        name=user.name,
        email=user.email
    )
    staff_doc = staff.model_dump()
    staff_doc["created_at"] = staff_doc["created_at"].isoformat()
    staff_doc["updated_at"] = staff_doc["updated_at"].isoformat()
    await db.staff.insert_one(staff_doc)
    
    # Create default schedule for staff
    default_hours = [
        WorkingHours(day_of_week=i, start_time="09:00", end_time="17:00", is_working=(i < 5))
        for i in range(7)
    ]
    schedule = StaffSchedule(
        staff_id=staff.staff_id,
        tenant_id=tenant.tenant_id,
        working_hours=default_hours
    )
    sched_doc = schedule.model_dump()
    sched_doc["created_at"] = sched_doc["created_at"].isoformat()
    sched_doc["updated_at"] = sched_doc["updated_at"].isoformat()
    sched_doc["working_hours"] = [wh.model_dump() for wh in default_hours]
    await db.staff_schedules.insert_one(sched_doc)
    
    await log_audit(tenant.tenant_id, user.user_id, "create", "tenant", tenant.tenant_id)
    
    return {
        "tenant_id": tenant.tenant_id,
        "slug": tenant.slug,
        "subscription": {
            "plan": subscription.plan,
            "is_trial": subscription.is_trial,
            "trial_ends_at": subscription.trial_ends_at
        }
    }


@api_router.get("/onboarding/industry-templates/{industry}")
async def get_industry_template(industry: str):
    """Get pre-configured services for an industry"""
    templates = {
        "salon": [
            {"name": "Haircut", "duration": 30, "price": 35},
            {"name": "Hair Color", "duration": 90, "price": 85},
            {"name": "Blowout", "duration": 45, "price": 45},
            {"name": "Manicure", "duration": 30, "price": 25},
            {"name": "Pedicure", "duration": 45, "price": 35},
            {"name": "Facial", "duration": 60, "price": 65},
        ],
        "clinic": [
            {"name": "General Consultation", "duration": 30, "price": 80},
            {"name": "Follow-up Visit", "duration": 15, "price": 50},
            {"name": "Health Screening", "duration": 45, "price": 120},
            {"name": "Vaccination", "duration": 15, "price": 40},
        ],
        "dentist": [
            {"name": "Dental Check-up", "duration": 30, "price": 75},
            {"name": "Teeth Cleaning", "duration": 45, "price": 95},
            {"name": "Filling", "duration": 45, "price": 120},
            {"name": "Tooth Extraction", "duration": 30, "price": 150},
            {"name": "Whitening", "duration": 60, "price": 250},
        ],
        "doctor": [
            {"name": "Initial Consultation", "duration": 45, "price": 150},
            {"name": "Follow-up", "duration": 20, "price": 80},
            {"name": "Annual Physical", "duration": 60, "price": 200},
        ],
        "vet": [
            {"name": "Wellness Exam", "duration": 30, "price": 65},
            {"name": "Vaccination", "duration": 20, "price": 35},
            {"name": "Dental Cleaning", "duration": 60, "price": 150},
            {"name": "Surgery Consultation", "duration": 30, "price": 100},
        ],
        "consultant": [
            {"name": "Discovery Call", "duration": 30, "price": 0},
            {"name": "Strategy Session", "duration": 60, "price": 200},
            {"name": "Follow-up", "duration": 30, "price": 100},
        ],
        "other": [
            {"name": "Standard Appointment", "duration": 30, "price": 50},
            {"name": "Extended Session", "duration": 60, "price": 90},
        ]
    }
    
    return {
        "industry": industry,
        "services": templates.get(industry, templates["other"])
    }


@api_router.post("/onboarding/apply-template")
async def apply_industry_template(request: Request):
    """Apply industry template services to tenant"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    body = await request.json()
    services = body.get("services", [])
    
    for svc in services:
        service = Service(
            tenant_id=user.tenant_id,
            name=svc["name"],
            duration=svc.get("duration", 30),
            price=svc.get("price", 0)
        )
        doc = service.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        doc["updated_at"] = doc["updated_at"].isoformat()
        await db.services.insert_one(doc)
    
    return {"message": f"Created {len(services)} services"}


# =====================
# Staff Management
# =====================

@api_router.get("/staff")
async def list_staff(request: Request):
    """List all staff members"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    staff_list = await db.staff.find(
        {"tenant_id": user.tenant_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    return staff_list


@api_router.post("/staff")
async def create_staff(data: StaffCreate, request: Request):
    """Create a new staff member"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    if not await check_plan_limits(user.tenant_id, "staff"):
        raise HTTPException(status_code=403, detail="Staff limit reached for your plan")
    
    staff = StaffMember(
        tenant_id=user.tenant_id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        title=data.title,
        color=data.color,
        services=data.services
    )
    
    doc = staff.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.staff.insert_one(doc)
    
    # Create default schedule
    default_hours = [
        WorkingHours(day_of_week=i, start_time="09:00", end_time="17:00", is_working=(i < 5))
        for i in range(7)
    ]
    schedule = StaffSchedule(
        staff_id=staff.staff_id,
        tenant_id=user.tenant_id,
        working_hours=default_hours
    )
    sched_doc = schedule.model_dump()
    sched_doc["created_at"] = sched_doc["created_at"].isoformat()
    sched_doc["updated_at"] = sched_doc["updated_at"].isoformat()
    sched_doc["working_hours"] = [wh.model_dump() for wh in default_hours]
    await db.staff_schedules.insert_one(sched_doc)
    
    await log_audit(user.tenant_id, user.user_id, "create", "staff", staff.staff_id)
    
    return {"staff_id": staff.staff_id, "name": staff.name}


@api_router.get("/staff/{staff_id}")
async def get_staff(staff_id: str, request: Request):
    """Get staff member details"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    staff = await db.staff.find_one(
        {"staff_id": staff_id, "tenant_id": user.tenant_id},
        {"_id": 0}
    )
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    schedule = await db.staff_schedules.find_one(
        {"staff_id": staff_id},
        {"_id": 0}
    )
    
    return {**staff, "schedule": schedule}


@api_router.put("/staff/{staff_id}")
async def update_staff(staff_id: str, request: Request):
    """Update staff member"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    body = await request.json()
    
    update_data = {k: v for k, v in body.items() if k not in ["staff_id", "tenant_id", "created_at"]}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.staff.update_one(
        {"staff_id": staff_id, "tenant_id": user.tenant_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    await log_audit(user.tenant_id, user.user_id, "update", "staff", staff_id, update_data)
    
    return {"message": "Staff updated"}


@api_router.put("/staff/{staff_id}/schedule")
async def update_staff_schedule(staff_id: str, request: Request):
    """Update staff working hours"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    body = await request.json()
    working_hours = body.get("working_hours", [])
    
    await db.staff_schedules.update_one(
        {"staff_id": staff_id, "tenant_id": user.tenant_id},
        {"$set": {
            "working_hours": working_hours,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": "Schedule updated"}


@api_router.delete("/staff/{staff_id}")
async def delete_staff(staff_id: str, request: Request):
    """Soft delete staff member"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    await db.staff.update_one(
        {"staff_id": staff_id, "tenant_id": user.tenant_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await log_audit(user.tenant_id, user.user_id, "delete", "staff", staff_id)
    
    return {"message": "Staff deleted"}


# =====================
# Services Management
# =====================

@api_router.get("/services")
async def list_services(request: Request):
    """List all services"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    services = await db.services.find(
        {"tenant_id": user.tenant_id, "is_active": True},
        {"_id": 0}
    ).to_list(200)
    
    return services


@api_router.post("/services")
async def create_service(data: ServiceCreate, request: Request):
    """Create a new service"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    service = Service(
        tenant_id=user.tenant_id,
        name=data.name,
        category_id=data.category_id,
        description=data.description,
        duration=data.duration,
        buffer_before=data.buffer_before,
        buffer_after=data.buffer_after,
        price=data.price,
        deposit_required=data.deposit_required,
        deposit_amount=data.deposit_amount,
        color=data.color
    )
    
    doc = service.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.services.insert_one(doc)
    
    await log_audit(user.tenant_id, user.user_id, "create", "service", service.service_id)
    
    return {"service_id": service.service_id, "name": service.name}


@api_router.get("/services/{service_id}")
async def get_service(service_id: str, request: Request):
    """Get service details"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    service = await db.services.find_one(
        {"service_id": service_id, "tenant_id": user.tenant_id},
        {"_id": 0}
    )
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    return service


@api_router.put("/services/{service_id}")
async def update_service(service_id: str, request: Request):
    """Update service"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    body = await request.json()
    update_data = {k: v for k, v in body.items() if k not in ["service_id", "tenant_id", "created_at"]}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.services.update_one(
        {"service_id": service_id, "tenant_id": user.tenant_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    
    await log_audit(user.tenant_id, user.user_id, "update", "service", service_id, update_data)
    
    return {"message": "Service updated"}


@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, request: Request):
    """Soft delete service"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    await db.services.update_one(
        {"service_id": service_id, "tenant_id": user.tenant_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await log_audit(user.tenant_id, user.user_id, "delete", "service", service_id)
    
    return {"message": "Service deleted"}


# =====================
# Resources Management
# =====================

@api_router.get("/resources")
async def list_resources(request: Request):
    """List all resources"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    resources = await db.resources.find(
        {"tenant_id": user.tenant_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    return resources


@api_router.post("/resources")
async def create_resource(data: ResourceCreate, request: Request):
    """Create a new resource"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    resource = Resource(
        tenant_id=user.tenant_id,
        name=data.name,
        description=data.description,
        resource_type=data.resource_type,
        capacity=data.capacity,
        services=data.services
    )
    
    doc = resource.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.resources.insert_one(doc)
    
    return {"resource_id": resource.resource_id, "name": resource.name}


@api_router.put("/resources/{resource_id}")
async def update_resource(resource_id: str, request: Request):
    """Update resource"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    body = await request.json()
    update_data = {k: v for k, v in body.items() if k not in ["resource_id", "tenant_id", "created_at"]}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.resources.update_one(
        {"resource_id": resource_id, "tenant_id": user.tenant_id},
        {"$set": update_data}
    )
    
    return {"message": "Resource updated"}


@api_router.delete("/resources/{resource_id}")
async def delete_resource(resource_id: str, request: Request):
    """Soft delete resource"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    await db.resources.update_one(
        {"resource_id": resource_id, "tenant_id": user.tenant_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Resource deleted"}


# =====================
# Clients Management
# =====================

@api_router.get("/clients")
async def list_clients(
    request: Request,
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    skip: int = Query(0)
):
    """List clients with optional search"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    query = {"tenant_id": user.tenant_id, "is_active": True}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    clients = await db.clients.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.clients.count_documents(query)
    
    return {"clients": clients, "total": total}


@api_router.post("/clients")
async def create_client(data: ClientCreate, request: Request):
    """Create a new client"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    client = Client(
        tenant_id=user.tenant_id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        notes=data.notes,
        marketing_consent=data.marketing_consent
    )
    
    doc = client.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.clients.insert_one(doc)
    
    return {"client_id": client.client_id, "name": client.name}


@api_router.get("/clients/{client_id}")
async def get_client(client_id: str, request: Request):
    """Get client details with booking history"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    client = await db.clients.find_one(
        {"client_id": client_id, "tenant_id": user.tenant_id},
        {"_id": 0}
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get booking history
    appointments = await db.appointments.find(
        {"client_id": client_id},
        {"_id": 0}
    ).sort("start_time", -1).limit(20).to_list(20)
    
    return {**client, "appointments": appointments}


@api_router.put("/clients/{client_id}")
async def update_client(client_id: str, request: Request):
    """Update client"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    body = await request.json()
    update_data = {k: v for k, v in body.items() if k not in ["client_id", "tenant_id", "created_at"]}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.clients.update_one(
        {"client_id": client_id, "tenant_id": user.tenant_id},
        {"$set": update_data}
    )
    
    return {"message": "Client updated"}


# =====================
# Appointments / Bookings
# =====================

@api_router.get("/appointments")
async def list_appointments(
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    staff_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """List appointments with filters"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    query = {"tenant_id": user.tenant_id}
    
    if start_date:
        query["start_time"] = {"$gte": start_date}
    if end_date:
        if "start_time" in query:
            query["start_time"]["$lte"] = end_date
        else:
            query["start_time"] = {"$lte": end_date}
    if staff_id:
        query["staff_id"] = staff_id
    if status:
        query["status"] = status
    
    appointments = await db.appointments.find(query, {"_id": 0}).sort("start_time", 1).to_list(500)
    
    # Enrich with service and staff names
    for apt in appointments:
        service = await db.services.find_one({"service_id": apt.get("service_id")}, {"_id": 0, "name": 1})
        staff = await db.staff.find_one({"staff_id": apt.get("staff_id")}, {"_id": 0, "name": 1, "color": 1})
        apt["service_name"] = service.get("name") if service else None
        apt["staff_name"] = staff.get("name") if staff else None
        apt["staff_color"] = staff.get("color") if staff else "#2E473B"
    
    return appointments


@api_router.post("/appointments")
async def create_appointment_api(data: AppointmentCreate, request: Request):
    """Create a new appointment"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    try:
        appointment = await create_appointment(db, user.tenant_id, data, source="admin")
        
        # Send confirmation email if email provided
        if data.client_email:
            service = await db.services.find_one({"service_id": data.service_id}, {"_id": 0})
            staff = await db.staff.find_one({"staff_id": data.staff_id}, {"_id": 0})
            tenant = await db.tenants.find_one({"tenant_id": user.tenant_id}, {"_id": 0})
            
            html = generate_booking_confirmation_email(
                client_name=data.client_name,
                service_name=service.get("name", "Service"),
                staff_name=staff.get("name", "Staff"),
                start_time=appointment.start_time,
                business_name=tenant.get("name", "Business"),
                confirmation_code=appointment.appointment_id[-8:].upper(),
                manage_url=f"https://{request.headers.get('host')}/manage/{appointment.appointment_id}"
            )
            await send_email(data.client_email, f"Booking Confirmed - {tenant.get('name')}", html)
        
        # Trigger webhook
        apt_doc = appointment.model_dump()
        apt_doc["start_time"] = apt_doc["start_time"].isoformat()
        apt_doc["end_time"] = apt_doc["end_time"].isoformat()
        await trigger_booking_webhook(db, user.tenant_id, "booking.created", apt_doc)
        
        await log_audit(user.tenant_id, user.user_id, "create", "appointment", appointment.appointment_id)
        
        return {
            "appointment_id": appointment.appointment_id,
            "start_time": appointment.start_time.isoformat(),
            "end_time": appointment.end_time.isoformat()
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/appointments/{appointment_id}")
async def get_appointment(appointment_id: str, request: Request):
    """Get appointment details"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    appointment = await db.appointments.find_one(
        {"appointment_id": appointment_id, "tenant_id": user.tenant_id},
        {"_id": 0}
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    service = await db.services.find_one({"service_id": appointment.get("service_id")}, {"_id": 0})
    staff = await db.staff.find_one({"staff_id": appointment.get("staff_id")}, {"_id": 0})
    
    return {
        **appointment,
        "service": service,
        "staff": staff
    }


@api_router.put("/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, data: AppointmentUpdate, request: Request):
    """Update appointment"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    if data.start_time:
        try:
            appointment = await reschedule_appointment(
                db, user.tenant_id, appointment_id,
                data.start_time, data.staff_id
            )
            await trigger_booking_webhook(db, user.tenant_id, "booking.rescheduled", appointment.model_dump())
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        update_data = data.model_dump(exclude_none=True)
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.appointments.update_one(
            {"appointment_id": appointment_id, "tenant_id": user.tenant_id},
            {"$set": update_data}
        )
    
    await log_audit(user.tenant_id, user.user_id, "update", "appointment", appointment_id)
    
    return {"message": "Appointment updated"}


@api_router.post("/appointments/{appointment_id}/cancel")
async def cancel_appointment_api(appointment_id: str, request: Request):
    """Cancel an appointment"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    body = await request.json()
    reason = body.get("reason")
    
    try:
        appointment = await cancel_appointment(db, user.tenant_id, appointment_id, reason)
        
        # Send cancellation email
        if appointment.client_email:
            service = await db.services.find_one({"service_id": appointment.service_id}, {"_id": 0})
            tenant = await db.tenants.find_one({"tenant_id": user.tenant_id}, {"_id": 0})
            
            html = generate_cancellation_email(
                client_name=appointment.client_name,
                service_name=service.get("name", "Service"),
                start_time=appointment.start_time,
                business_name=tenant.get("name", "Business"),
                booking_url=f"https://{request.headers.get('host')}/book/{tenant.get('slug')}"
            )
            await send_email(appointment.client_email, f"Booking Cancelled - {tenant.get('name')}", html)
        
        await trigger_booking_webhook(db, user.tenant_id, "booking.cancelled", appointment.model_dump())
        await log_audit(user.tenant_id, user.user_id, "cancel", "appointment", appointment_id)
        
        return {"message": "Appointment cancelled"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/appointments/{appointment_id}/complete")
async def complete_appointment(appointment_id: str, request: Request):
    """Mark appointment as completed"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    await db.appointments.update_one(
        {"appointment_id": appointment_id, "tenant_id": user.tenant_id},
        {"$set": {
            "status": BookingStatus.COMPLETED.value,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    apt = await db.appointments.find_one({"appointment_id": appointment_id}, {"_id": 0})
    await trigger_booking_webhook(db, user.tenant_id, "booking.completed", apt)
    
    return {"message": "Appointment completed"}


@api_router.post("/appointments/{appointment_id}/no-show")
async def mark_no_show(appointment_id: str, request: Request):
    """Mark appointment as no-show"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    await db.appointments.update_one(
        {"appointment_id": appointment_id, "tenant_id": user.tenant_id},
        {"$set": {
            "status": BookingStatus.NO_SHOW.value,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    apt = await db.appointments.find_one({"appointment_id": appointment_id}, {"_id": 0})
    await trigger_booking_webhook(db, user.tenant_id, "booking.no_show", apt)
    
    return {"message": "Marked as no-show"}


# =====================
# Availability (Public)
# =====================

@api_router.get("/public/{tenant_slug}/services")
async def get_public_services(tenant_slug: str):
    """Get services for public booking page"""
    tenant = await db.tenants.find_one({"slug": tenant_slug, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    services = await db.services.find(
        {"tenant_id": tenant["tenant_id"], "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    return {
        "tenant": {
            "name": tenant["name"],
            "slug": tenant["slug"],
            "industry": tenant.get("industry")
        },
        "services": services
    }


@api_router.get("/public/{tenant_slug}/staff")
async def get_public_staff(tenant_slug: str, service_id: Optional[str] = Query(None)):
    """Get staff for public booking page"""
    tenant = await db.tenants.find_one({"slug": tenant_slug, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    query = {"tenant_id": tenant["tenant_id"], "is_active": True}
    if service_id:
        query["$or"] = [{"services": service_id}, {"services": {"$size": 0}}]
    
    staff = await db.staff.find(
        query,
        {"_id": 0, "staff_id": 1, "name": 1, "title": 1, "avatar_url": 1}
    ).to_list(50)
    
    return staff


@api_router.get("/public/{tenant_slug}/availability")
async def get_public_availability(
    tenant_slug: str,
    service_id: str,
    date: str,
    staff_id: Optional[str] = Query(None)
):
    """Get available time slots for public booking"""
    tenant = await db.tenants.find_one({"slug": tenant_slug, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    slots = await calculate_available_slots(
        db, tenant["tenant_id"], service_id, date_obj, staff_id
    )
    
    return {
        "date": date,
        "slots": [s.model_dump() for s in slots]
    }


@api_router.post("/public/{tenant_slug}/book")
async def create_public_booking(tenant_slug: str, data: AppointmentCreate):
    """Create a booking from public booking page"""
    tenant = await db.tenants.find_one({"slug": tenant_slug, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    try:
        appointment = await create_appointment(db, tenant["tenant_id"], data, source="online")
        
        # Send confirmation email
        if data.client_email:
            service = await db.services.find_one({"service_id": data.service_id}, {"_id": 0})
            staff = await db.staff.find_one({"staff_id": data.staff_id}, {"_id": 0})
            
            html = generate_booking_confirmation_email(
                client_name=data.client_name,
                service_name=service.get("name", "Service"),
                staff_name=staff.get("name", "Staff"),
                start_time=appointment.start_time,
                business_name=tenant.get("name", "Business"),
                confirmation_code=appointment.appointment_id[-8:].upper(),
                manage_url=f"/manage/{appointment.appointment_id}"
            )
            await send_email(data.client_email, f"Booking Confirmed - {tenant.get('name')}", html)
        
        await trigger_booking_webhook(db, tenant["tenant_id"], "booking.created", appointment.model_dump())
        
        return BookingConfirmation(
            appointment_id=appointment.appointment_id,
            service_name=service.get("name") if service else "Service",
            staff_name=staff.get("name") if staff else "Staff",
            start_time=appointment.start_time,
            end_time=appointment.end_time,
            confirmation_code=appointment.appointment_id[-8:].upper()
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/public/manage/{appointment_id}")
async def get_public_appointment(appointment_id: str):
    """Get appointment for customer self-service"""
    appointment = await db.appointments.find_one(
        {"appointment_id": appointment_id},
        {"_id": 0}
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    service = await db.services.find_one({"service_id": appointment.get("service_id")}, {"_id": 0})
    staff = await db.staff.find_one({"staff_id": appointment.get("staff_id")}, {"_id": 0})
    tenant = await db.tenants.find_one({"tenant_id": appointment.get("tenant_id")}, {"_id": 0})
    
    return {
        **appointment,
        "service_name": service.get("name") if service else None,
        "staff_name": staff.get("name") if staff else None,
        "business_name": tenant.get("name") if tenant else None
    }


@api_router.post("/public/manage/{appointment_id}/cancel")
async def cancel_public_appointment(appointment_id: str, request: Request):
    """Cancel appointment from customer self-service"""
    body = await request.json()
    email = body.get("email")
    
    appointment = await db.appointments.find_one(
        {"appointment_id": appointment_id},
        {"_id": 0}
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Verify email matches
    if appointment.get("client_email") != email:
        raise HTTPException(status_code=403, detail="Email does not match booking")
    
    await db.appointments.update_one(
        {"appointment_id": appointment_id},
        {"$set": {
            "status": BookingStatus.CANCELLED.value,
            "cancel_reason": "Cancelled by customer",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await trigger_booking_webhook(db, appointment["tenant_id"], "booking.cancelled", appointment)
    
    return {"message": "Appointment cancelled"}


# =====================
# Dashboard & Reports
# =====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats_api(request: Request):
    """Get dashboard statistics"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    stats = await get_dashboard_stats(db, user.tenant_id)
    return stats


@api_router.get("/dashboard/upcoming")
async def get_upcoming_appointments(request: Request, limit: int = Query(10)):
    """Get upcoming appointments for dashboard"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    appointments = await db.appointments.find(
        {
            "tenant_id": user.tenant_id,
            "start_time": {"$gte": now},
            "status": {"$nin": [BookingStatus.CANCELLED.value]}
        },
        {"_id": 0}
    ).sort("start_time", 1).limit(limit).to_list(limit)
    
    # Enrich with names
    for apt in appointments:
        service = await db.services.find_one({"service_id": apt.get("service_id")}, {"_id": 0, "name": 1})
        staff = await db.staff.find_one({"staff_id": apt.get("staff_id")}, {"_id": 0, "name": 1})
        apt["service_name"] = service.get("name") if service else None
        apt["staff_name"] = staff.get("name") if staff else None
    
    return appointments


# =====================
# Webhooks Management
# =====================

@api_router.get("/webhooks")
async def list_webhooks(request: Request):
    """List registered webhooks"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    webhooks = await db.webhooks.find(
        {"tenant_id": user.tenant_id},
        {"_id": 0, "secret": 0}  # Don't return secret
    ).to_list(50)
    
    return webhooks


@api_router.post("/webhooks")
async def create_webhook(data: WebhookCreate, request: Request):
    """Create a new webhook"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    webhook = Webhook(
        tenant_id=user.tenant_id,
        url=data.url,
        events=data.events
    )
    
    doc = webhook.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.webhooks.insert_one(doc)
    
    return {
        "webhook_id": webhook.webhook_id,
        "secret": webhook.secret  # Return secret only on creation
    }


@api_router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, request: Request):
    """Delete a webhook"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    await db.webhooks.delete_one(
        {"webhook_id": webhook_id, "tenant_id": user.tenant_id}
    )
    
    return {"message": "Webhook deleted"}


@api_router.get("/webhooks/events")
async def list_webhook_events():
    """List available webhook events"""
    return {"events": WEBHOOK_EVENTS}


# =====================
# API Keys Management
# =====================

@api_router.get("/api-keys")
async def list_api_keys(request: Request):
    """List API keys"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    keys = await db.api_keys.find(
        {"tenant_id": user.tenant_id},
        {"_id": 0, "key_hash": 0}  # Don't return hash
    ).to_list(20)
    
    return keys


@api_router.post("/api-keys")
async def create_api_key_endpoint(request: Request):
    """Create a new API key"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    body = await request.json()
    name = body.get("name", "API Key")
    permissions = body.get("permissions", ["read", "write"])
    
    key, key_hash, key_prefix = generate_api_key()
    
    api_key = APIKey(
        tenant_id=user.tenant_id,
        name=name,
        key_hash=key_hash,
        key_prefix=key_prefix,
        permissions=permissions
    )
    
    doc = api_key.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.api_keys.insert_one(doc)
    
    return {
        "api_key_id": api_key.api_key_id,
        "key": key,  # Return full key only on creation
        "key_prefix": key_prefix
    }


@api_router.delete("/api-keys/{api_key_id}")
async def delete_api_key(api_key_id: str, request: Request):
    """Delete an API key"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    await db.api_keys.delete_one(
        {"api_key_id": api_key_id, "tenant_id": user.tenant_id}
    )
    
    return {"message": "API key deleted"}


# =====================
# Moltbot API (AI Receptionist)
# =====================

@api_router.get("/moltbot/services")
async def moltbot_get_services(request: Request):
    """Get services list for Moltbot"""
    api_key = await validate_api_key(request, db)
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    services = await db.services.find(
        {"tenant_id": api_key["tenant_id"], "is_active": True},
        {"_id": 0, "service_id": 1, "name": 1, "duration": 1, "price": 1, "description": 1}
    ).to_list(100)
    
    return {"services": services}


@api_router.get("/moltbot/staff")
async def moltbot_get_staff(request: Request):
    """Get staff list for Moltbot"""
    api_key = await validate_api_key(request, db)
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    staff = await db.staff.find(
        {"tenant_id": api_key["tenant_id"], "is_active": True},
        {"_id": 0, "staff_id": 1, "name": 1, "title": 1, "services": 1}
    ).to_list(50)
    
    return {"staff": staff}


@api_router.post("/moltbot/availability")
async def moltbot_check_availability(data: MoltbotAvailabilityQuery, request: Request):
    """Check availability for Moltbot"""
    api_key = await validate_api_key(request, db)
    if not api_key:
        # Also try public access by tenant slug
        tenant = await db.tenants.find_one({"slug": data.tenant_slug, "is_active": True}, {"_id": 0})
        if not tenant:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        tenant_id = tenant["tenant_id"]
    else:
        tenant_id = api_key["tenant_id"]
    
    try:
        date_obj = datetime.strptime(data.date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    slots = await calculate_available_slots(
        db, tenant_id, data.service_id, date_obj, data.staff_id
    )
    
    return {
        "date": data.date,
        "available_slots": [
            {
                "start_time": s.start_time.isoformat(),
                "end_time": s.end_time.isoformat(),
                "staff_id": s.staff_id,
                "staff_name": s.staff_name
            }
            for s in slots
        ]
    }


@api_router.post("/moltbot/book")
async def moltbot_create_booking(data: MoltbotBookingAction, request: Request):
    """Create, reschedule, or cancel booking for Moltbot"""
    api_key = await validate_api_key(request, db)
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    tenant_id = api_key["tenant_id"]
    
    if data.action == "create":
        if not data.booking_intent:
            raise HTTPException(status_code=400, detail="booking_intent required for create action")
        
        intent = data.booking_intent
        
        # Find service by name if ID not provided
        service_id = intent.service_id
        if not service_id and intent.service_name:
            service = await db.services.find_one(
                {
                    "tenant_id": tenant_id,
                    "name": {"$regex": intent.service_name, "$options": "i"},
                    "is_active": True
                },
                {"_id": 0}
            )
            if service:
                service_id = service["service_id"]
        
        if not service_id:
            raise HTTPException(status_code=400, detail="Service not found")
        
        # Parse preferred time
        if intent.preferred_date and intent.preferred_time:
            try:
                start_time = datetime.strptime(
                    f"{intent.preferred_date} {intent.preferred_time}",
                    "%Y-%m-%d %H:%M"
                ).replace(tzinfo=timezone.utc)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date/time format")
        else:
            raise HTTPException(status_code=400, detail="preferred_date and preferred_time required")
        
        # Find staff
        staff_id = None
        if intent.staff_preference:
            staff = await db.staff.find_one(
                {
                    "tenant_id": tenant_id,
                    "$or": [
                        {"staff_id": intent.staff_preference},
                        {"name": {"$regex": intent.staff_preference, "$options": "i"}}
                    ],
                    "is_active": True
                },
                {"_id": 0}
            )
            if staff:
                staff_id = staff["staff_id"]
        
        if not staff_id:
            # Get first available staff
            staff = await db.staff.find_one(
                {"tenant_id": tenant_id, "is_active": True},
                {"_id": 0}
            )
            if staff:
                staff_id = staff["staff_id"]
        
        if not staff_id:
            raise HTTPException(status_code=400, detail="No staff available")
        
        appointment_data = AppointmentCreate(
            staff_id=staff_id,
            service_id=service_id,
            start_time=start_time,
            client_name=intent.client_name,
            client_email=intent.client_email,
            client_phone=intent.client_phone,
            notes=intent.notes
        )
        
        try:
            appointment = await create_appointment(db, tenant_id, appointment_data, source="api")
            await trigger_booking_webhook(db, tenant_id, "booking.created", appointment.model_dump())
            
            return {
                "status": "success",
                "appointment_id": appointment.appointment_id,
                "confirmation_code": appointment.appointment_id[-8:].upper(),
                "start_time": appointment.start_time.isoformat(),
                "end_time": appointment.end_time.isoformat()
            }
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    elif data.action == "reschedule":
        if not data.appointment_id or not data.new_start_time:
            raise HTTPException(status_code=400, detail="appointment_id and new_start_time required")
        
        try:
            appointment = await reschedule_appointment(
                db, tenant_id, data.appointment_id, data.new_start_time
            )
            await trigger_booking_webhook(db, tenant_id, "booking.rescheduled", appointment.model_dump())
            
            return {
                "status": "success",
                "appointment_id": appointment.appointment_id,
                "new_start_time": appointment.start_time.isoformat(),
                "new_end_time": appointment.end_time.isoformat()
            }
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    elif data.action == "cancel":
        if not data.appointment_id:
            raise HTTPException(status_code=400, detail="appointment_id required")
        
        try:
            appointment = await cancel_appointment(db, tenant_id, data.appointment_id)
            await trigger_booking_webhook(db, tenant_id, "booking.cancelled", appointment.model_dump())
            
            return {
                "status": "success",
                "appointment_id": appointment.appointment_id,
                "message": "Appointment cancelled"
            }
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use: create, reschedule, cancel")


# =====================
# Settings
# =====================

@api_router.get("/settings/business")
async def get_business_settings(request: Request):
    """Get business settings"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    tenant = await db.tenants.find_one(
        {"tenant_id": user.tenant_id},
        {"_id": 0}
    )
    
    subscription = await db.subscriptions.find_one(
        {"tenant_id": user.tenant_id, "is_active": True},
        {"_id": 0}
    )
    
    return {
        "business": tenant,
        "subscription": subscription
    }


@api_router.put("/settings/business")
async def update_business_settings(request: Request):
    """Update business settings"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    body = await request.json()
    update_data = {k: v for k, v in body.items() if k not in ["tenant_id", "slug", "created_at"]}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.tenants.update_one(
        {"tenant_id": user.tenant_id},
        {"$set": update_data}
    )
    
    await log_audit(user.tenant_id, user.user_id, "update", "tenant", user.tenant_id, update_data)
    
    return {"message": "Settings updated"}


# =====================
# Subscription (Mock)
# =====================

@api_router.get("/subscription")
async def get_subscription(request: Request):
    """Get current subscription"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    subscription = await db.subscriptions.find_one(
        {"tenant_id": user.tenant_id, "is_active": True},
        {"_id": 0}
    )
    
    return subscription


@api_router.post("/subscription/upgrade")
async def upgrade_subscription(request: Request):
    """Upgrade subscription (mock)"""
    user = await require_auth(request, db)
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="No business found")
    
    body = await request.json()
    new_plan = body.get("plan")
    
    plan_config = {
        "starter": {"price": 29, "max_locations": 1, "max_staff": 2, "features": ["online_booking", "reminders", "deposits", "calendar_sync"]},
        "growth": {"price": 79, "max_locations": 1, "max_staff": 8, "features": ["online_booking", "reminders", "deposits", "calendar_sync", "waitlist", "packages", "ai_assistant", "sms_automations", "reports"]},
        "pro": {"price": 149, "max_locations": 10, "max_staff": 50, "features": ["online_booking", "reminders", "deposits", "calendar_sync", "waitlist", "packages", "ai_assistant", "sms_automations", "reports", "multi_location", "advanced_permissions", "resource_booking", "custom_forms", "white_label", "api_webhooks"]}
    }
    
    if new_plan not in plan_config:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    config = plan_config[new_plan]
    
    await db.subscriptions.update_one(
        {"tenant_id": user.tenant_id, "is_active": True},
        {"$set": {
            "plan": new_plan,
            "price_monthly": config["price"],
            "max_locations": config["max_locations"],
            "max_staff": config["max_staff"],
            "features": config["features"],
            "is_trial": False,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"Upgraded to {new_plan} plan", "plan": new_plan}


# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
