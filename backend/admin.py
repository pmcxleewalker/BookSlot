"""
Super Admin / Franchise Control Center
Management APIs for platform owner to manage all tenants
"""
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase

from models import (
    Tenant, User, UserRole, Subscription, PlanType, 
    Location, StaffMember, StaffSchedule, WorkingHours, generate_id
)
from auth import hash_password, generate_session_token, create_user_session, set_session_cookie

# Router for admin endpoints
admin_router = APIRouter(prefix="/api/admin", tags=["admin"])


# =====================
# Pydantic Models for Admin
# =====================

class SuperAdminCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    admin_secret: str  # Secret key to create super admin


class SuperAdminLogin(BaseModel):
    email: EmailStr
    password: str


class TenantCreateByAdmin(BaseModel):
    name: str
    industry: str
    email: str
    phone: Optional[str] = None
    owner_name: str
    owner_email: EmailStr
    owner_password: Optional[str] = None  # If not provided, generate random
    plan: str = "starter"
    timezone: str = "Europe/London"
    currency: str = "EUR"


class TenantUpdateByAdmin(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None


class TenantStatsResponse(BaseModel):
    total_tenants: int
    active_tenants: int
    trial_tenants: int
    total_appointments: int
    total_revenue: float
    tenants_by_plan: Dict[str, int]
    tenants_by_industry: Dict[str, int]
    recent_signups: List[Dict[str, Any]]


# =====================
# Database reference (set from server.py)
# =====================
_db: AsyncIOMotorDatabase = None


def set_admin_db(database: AsyncIOMotorDatabase):
    """Set the database reference for admin module"""
    global _db
    _db = database


def get_db() -> AsyncIOMotorDatabase:
    """Get database reference"""
    if _db is None:
        raise RuntimeError("Admin database not initialized")
    return _db


# =====================
# Super Admin Auth Helpers
# =====================

import os
SUPER_ADMIN_SECRET = os.environ.get("SUPER_ADMIN_SECRET", "")  # Must be set in production


async def get_super_admin(request: Request) -> Optional[Dict]:
    """Get current super admin from session"""
    # Try cookie first
    session_token = request.cookies.get("admin_session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    # Fallback to X-Admin-Token header
    if not session_token:
        session_token = request.headers.get("X-Admin-Token")
    
    if not session_token:
        return None
    
    db = get_db()
    session = await db.admin_sessions.find_one(
        {"session_token": session_token, "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}},
        {"_id": 0}
    )
    if not session:
        return None
    
    admin = await db.super_admins.find_one(
        {"admin_id": session["admin_id"], "is_active": True},
        {"_id": 0}
    )
    return admin


async def require_super_admin(request: Request) -> Dict:
    """Require super admin authentication"""
    admin = await get_super_admin(request)
    if not admin:
        raise HTTPException(status_code=401, detail="Super admin authentication required")
    return admin


# =====================
# Super Admin Auth Endpoints
# =====================

@admin_router.post("/auth/register")
async def register_super_admin(data: SuperAdminCreate, request: Request):
    """Register a new super admin (requires secret key)"""
    if not SUPER_ADMIN_SECRET:
        raise HTTPException(status_code=500, detail="Admin registration not configured")
    
    if data.admin_secret != SUPER_ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin secret")
    
    db = get_db()
    
    # Check if email exists
    existing = await db.super_admins.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create super admin
    admin = {
        "admin_id": generate_id("sadmin_"),
        "email": data.email,
        "name": data.name,
        "password_hash": hash_password(data.password),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.super_admins.insert_one(admin)
    
    return {"admin_id": admin["admin_id"], "message": "Super admin created"}


@admin_router.post("/auth/login")
async def login_super_admin(data: SuperAdminLogin, request: Request):
    """Login as super admin"""
    from starlette.responses import JSONResponse
    from auth import verify_password
    
    db = get_db()
    admin = await db.super_admins.find_one({"email": data.email}, {"_id": 0})
    
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(data.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not admin.get("is_active"):
        raise HTTPException(status_code=403, detail="Account disabled")
    
    # Create session
    session_token = generate_session_token()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    
    await db.admin_sessions.insert_one({
        "session_id": generate_id("asess_"),
        "admin_id": admin["admin_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create response with cookie
    response = JSONResponse({
        "admin_id": admin["admin_id"],
        "email": admin["email"],
        "name": admin["name"],
        "session_token": session_token
    })
    
    # Set cookie for browser
    response.set_cookie(
        key="admin_session_token",
        value=session_token,
        httponly=False,  # Allow JS access for localStorage backup
        samesite="lax",
        secure=False,  # Set to True in production with HTTPS
        max_age=86400  # 24 hours
    )
    
    return response


@admin_router.get("/auth/me")
async def get_admin_me(request: Request):
    """Get current super admin info"""
    admin = await require_super_admin(request)
    return {
        "admin_id": admin["admin_id"],
        "email": admin["email"],
        "name": admin["name"]
    }


@admin_router.post("/auth/logout")
async def logout_super_admin(request: Request):
    """Logout super admin"""
    session_token = request.cookies.get("admin_session_token")
    if session_token:
        db = get_db()
        await db.admin_sessions.delete_one({"session_token": session_token})
    return {"message": "Logged out"}


# =====================
# Dashboard Stats
# =====================

@admin_router.get("/stats")
async def get_admin_stats(request: Request):
    """Get platform-wide statistics"""
    await require_super_admin(request)
    db = get_db()
    
    # Total tenants
    total_tenants = await db.tenants.count_documents({})
    active_tenants = await db.tenants.count_documents({"is_active": True})
    
    # Trial tenants
    trial_tenants = await db.subscriptions.count_documents({"is_trial": True, "is_active": True})
    
    # Total appointments
    total_appointments = await db.appointments.count_documents({})
    
    # Total revenue (from appointments)
    revenue_pipeline = [
        {"$match": {"status": {"$in": ["completed", "confirmed"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$price"}}}
    ]
    revenue_result = await db.appointments.aggregate(revenue_pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Tenants by plan
    plan_pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$plan", "count": {"$sum": 1}}}
    ]
    plan_results = await db.subscriptions.aggregate(plan_pipeline).to_list(10)
    tenants_by_plan = {r["_id"]: r["count"] for r in plan_results}
    
    # Tenants by industry
    industry_pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$industry", "count": {"$sum": 1}}}
    ]
    industry_results = await db.tenants.aggregate(industry_pipeline).to_list(20)
    tenants_by_industry = {r["_id"]: r["count"] for r in industry_results}
    
    # Recent signups (last 10)
    recent = await db.tenants.find(
        {}, 
        {"_id": 0, "tenant_id": 1, "name": 1, "industry": 1, "created_at": 1, "is_active": 1}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "trial_tenants": trial_tenants,
        "total_appointments": total_appointments,
        "total_revenue": total_revenue,
        "tenants_by_plan": tenants_by_plan,
        "tenants_by_industry": tenants_by_industry,
        "recent_signups": recent
    }


# =====================
# Tenant Management
# =====================

@admin_router.get("/tenants")
async def list_tenants(
    request: Request,
    search: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    plan: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(50, le=100),
    skip: int = Query(0)
):
    """List all tenants with filters"""
    await require_super_admin(request)
    db = get_db()
    
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    if industry:
        query["industry"] = industry
    if is_active is not None:
        query["is_active"] = is_active
    
    tenants = await db.tenants.find(query, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
    total = await db.tenants.count_documents(query)
    
    # Enrich with subscription info
    for tenant in tenants:
        sub = await db.subscriptions.find_one(
            {"tenant_id": tenant["tenant_id"], "is_active": True},
            {"_id": 0, "plan": 1, "is_trial": 1}
        )
        tenant["subscription"] = sub
        
        # Get appointment count
        apt_count = await db.appointments.count_documents({"tenant_id": tenant["tenant_id"]})
        tenant["total_appointments"] = apt_count
        
        # Get staff count
        staff_count = await db.staff.count_documents({"tenant_id": tenant["tenant_id"], "is_active": True})
        tenant["staff_count"] = staff_count
    
    # Filter by plan if specified
    if plan:
        tenants = [t for t in tenants if t.get("subscription", {}).get("plan") == plan]
    
    return {"tenants": tenants, "total": total}


@admin_router.get("/tenants/{tenant_id}")
async def get_tenant_details(tenant_id: str, request: Request):
    """Get detailed tenant information"""
    await require_super_admin(request)
    db = get_db()
    
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get subscription
    subscription = await db.subscriptions.find_one(
        {"tenant_id": tenant_id, "is_active": True},
        {"_id": 0}
    )
    
    # Get owner user
    owner = await db.users.find_one(
        {"tenant_id": tenant_id, "role": "owner"},
        {"_id": 0, "user_id": 1, "email": 1, "name": 1, "created_at": 1}
    )
    
    # Get stats
    staff_count = await db.staff.count_documents({"tenant_id": tenant_id, "is_active": True})
    services_count = await db.services.count_documents({"tenant_id": tenant_id, "is_active": True})
    clients_count = await db.clients.count_documents({"tenant_id": tenant_id})
    appointments_count = await db.appointments.count_documents({"tenant_id": tenant_id})
    
    # Revenue
    revenue_pipeline = [
        {"$match": {"tenant_id": tenant_id, "status": {"$in": ["completed", "confirmed"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$price"}}}
    ]
    revenue_result = await db.appointments.aggregate(revenue_pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    return {
        "tenant": tenant,
        "subscription": subscription,
        "owner": owner,
        "stats": {
            "staff_count": staff_count,
            "services_count": services_count,
            "clients_count": clients_count,
            "appointments_count": appointments_count,
            "total_revenue": total_revenue
        }
    }


@admin_router.post("/tenants")
async def create_tenant_by_admin(data: TenantCreateByAdmin, request: Request):
    """Create a new tenant (by super admin)"""
    import re
    import secrets
    
    await require_super_admin(request)
    db = get_db()
    
    # Generate slug
    def slugify(text: str) -> str:
        text = text.lower().strip()
        text = re.sub(r'[^\w\s-]', '', text)
        text = re.sub(r'[\s_-]+', '-', text)
        return text
    
    base_slug = slugify(data.name)
    slug = base_slug
    counter = 1
    while await db.tenants.find_one({"slug": slug}):
        slug = f"{base_slug}-{counter}"
        counter += 1
    
    # Check if owner email exists
    existing_user = await db.users.find_one({"email": data.owner_email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Owner email already exists")
    
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
    
    # Create subscription
    plan_config = {
        "starter": {"price": 90, "max_locations": 1, "max_staff": 2, "features": ["online_booking", "email_confirmations", "calendar_view", "client_management", "calendar_sync"]},
        "growth": {"price": 145, "max_locations": 1, "max_staff": 8, "features": ["online_booking", "email_confirmations", "calendar_view", "client_management", "calendar_sync", "sms_notifications", "automated_reminders", "waitlist", "deposits", "packages", "ai_receptionist", "reports"]},
        "pro": {"price": 299, "max_locations": 10, "max_staff": 50, "features": ["online_booking", "email_confirmations", "calendar_view", "client_management", "calendar_sync", "sms_notifications", "automated_reminders", "waitlist", "deposits", "packages", "ai_receptionist", "reports", "api_access", "webhooks", "multi_location", "advanced_permissions", "resource_booking", "custom_forms", "white_label"]}
    }
    config = plan_config.get(data.plan, plan_config["starter"])
    
    subscription = Subscription(
        tenant_id=tenant.tenant_id,
        plan=data.plan,
        price_monthly=config["price"],
        max_locations=config["max_locations"],
        max_staff=config["max_staff"],
        features=config["features"],
        is_trial=False
    )
    sub_doc = subscription.model_dump()
    sub_doc["created_at"] = sub_doc["created_at"].isoformat()
    sub_doc["updated_at"] = sub_doc["updated_at"].isoformat()
    sub_doc["start_date"] = sub_doc["start_date"].isoformat()
    await db.subscriptions.insert_one(sub_doc)
    
    # Create owner user
    password = data.owner_password or secrets.token_urlsafe(12)
    
    user = User(
        email=data.owner_email,
        name=data.owner_name,
        tenant_id=tenant.tenant_id,
        role=UserRole.OWNER
    )
    user_doc = user.model_dump()
    user_doc["password_hash"] = hash_password(password)
    user_doc["created_at"] = user_doc["created_at"].isoformat()
    user_doc["updated_at"] = user_doc["updated_at"].isoformat()
    await db.users.insert_one(user_doc)
    
    # Create default location
    location = Location(
        tenant_id=tenant.tenant_id,
        name="Main Location",
        address="To be updated",
        is_primary=True
    )
    loc_doc = location.model_dump()
    loc_doc["created_at"] = loc_doc["created_at"].isoformat()
    loc_doc["updated_at"] = loc_doc["updated_at"].isoformat()
    await db.locations.insert_one(loc_doc)
    
    # Create owner as staff
    staff = StaffMember(
        tenant_id=tenant.tenant_id,
        user_id=user.user_id,
        location_id=location.location_id,
        name=data.owner_name,
        email=data.owner_email
    )
    staff_doc = staff.model_dump()
    staff_doc["created_at"] = staff_doc["created_at"].isoformat()
    staff_doc["updated_at"] = staff_doc["updated_at"].isoformat()
    await db.staff.insert_one(staff_doc)
    
    # Create default schedule
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
    
    return {
        "tenant_id": tenant.tenant_id,
        "slug": tenant.slug,
        "owner_email": data.owner_email,
        "owner_password": password if not data.owner_password else "[provided]",
        "booking_url": f"/book/{tenant.slug}"
    }


@admin_router.put("/tenants/{tenant_id}")
async def update_tenant_by_admin(tenant_id: str, data: TenantUpdateByAdmin, request: Request):
    """Update tenant details"""
    await require_super_admin(request)
    db = get_db()
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.tenants.update_one(
        {"tenant_id": tenant_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return {"message": "Tenant updated"}


@admin_router.post("/tenants/{tenant_id}/suspend")
async def suspend_tenant(tenant_id: str, request: Request):
    """Suspend a tenant"""
    await require_super_admin(request)
    db = get_db()
    
    result = await db.tenants.update_one(
        {"tenant_id": tenant_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return {"message": "Tenant suspended"}


@admin_router.post("/tenants/{tenant_id}/activate")
async def activate_tenant(tenant_id: str, request: Request):
    """Activate a suspended tenant"""
    await require_super_admin(request)
    db = get_db()
    
    result = await db.tenants.update_one(
        {"tenant_id": tenant_id},
        {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return {"message": "Tenant activated"}


@admin_router.put("/tenants/{tenant_id}/subscription")
async def update_tenant_subscription(tenant_id: str, request: Request):
    """Update tenant subscription/plan"""
    await require_super_admin(request)
    db = get_db()
    
    body = await request.json()
    new_plan = body.get("plan")
    
    plan_config = {
        "starter": {"price": 90, "max_locations": 1, "max_staff": 2, "features": ["online_booking", "email_confirmations", "calendar_view", "client_management", "calendar_sync"]},
        "growth": {"price": 145, "max_locations": 1, "max_staff": 8, "features": ["online_booking", "email_confirmations", "calendar_view", "client_management", "calendar_sync", "sms_notifications", "automated_reminders", "waitlist", "deposits", "packages", "ai_receptionist", "reports"]},
        "pro": {"price": 299, "max_locations": 10, "max_staff": 50, "features": ["online_booking", "email_confirmations", "calendar_view", "client_management", "calendar_sync", "sms_notifications", "automated_reminders", "waitlist", "deposits", "packages", "ai_receptionist", "reports", "api_access", "webhooks", "multi_location", "advanced_permissions", "resource_booking", "custom_forms", "white_label"]}
    }
    
    if new_plan not in plan_config:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    config = plan_config[new_plan]
    
    result = await db.subscriptions.update_one(
        {"tenant_id": tenant_id, "is_active": True},
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
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    return {"message": f"Plan updated to {new_plan}"}


@admin_router.delete("/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str, request: Request):
    """Delete a tenant and all associated data (use with caution!)"""
    await require_super_admin(request)
    db = get_db()
    
    # Verify tenant exists
    tenant = await db.tenants.find_one({"tenant_id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Delete all related data
    await db.appointments.delete_many({"tenant_id": tenant_id})
    await db.clients.delete_many({"tenant_id": tenant_id})
    await db.services.delete_many({"tenant_id": tenant_id})
    await db.staff.delete_many({"tenant_id": tenant_id})
    await db.staff_schedules.delete_many({"tenant_id": tenant_id})
    await db.locations.delete_many({"tenant_id": tenant_id})
    await db.resources.delete_many({"tenant_id": tenant_id})
    await db.webhooks.delete_many({"tenant_id": tenant_id})
    await db.api_keys.delete_many({"tenant_id": tenant_id})
    await db.subscriptions.delete_many({"tenant_id": tenant_id})
    await db.users.delete_many({"tenant_id": tenant_id})
    await db.tenants.delete_one({"tenant_id": tenant_id})
    
    return {"message": "Tenant and all data deleted"}


# =====================
# Admin Invoice Management (For Franchise Control Center)
# =====================

class AdminInvoiceCreate(BaseModel):
    tenant_id: str
    bill_to_name: str
    bill_to_email: str
    bill_to_address: Optional[str] = None
    bill_to_city: Optional[str] = None
    bill_to_country: Optional[str] = None
    bill_to_vat: Optional[str] = None
    items: List[Dict[str, Any]]
    tax_rate: float = 0
    notes: Optional[str] = None
    due_days: int = 14


@admin_router.get("/invoices")
async def admin_list_all_invoices(
    request: Request,
    tenant_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    skip: int = Query(0)
):
    """List all invoices across all tenants (super admin only)"""
    await require_super_admin(request)
    db = get_db()
    
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    if status:
        query["status"] = status
    
    invoices = await db.invoices.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with tenant info
    for invoice in invoices:
        tenant = await db.tenants.find_one(
            {"tenant_id": invoice["tenant_id"]},
            {"_id": 0, "name": 1}
        )
        invoice["tenant_name"] = tenant.get("name") if tenant else "Unknown"
    
    total = await db.invoices.count_documents(query)
    
    return {"invoices": invoices, "total": total}


@admin_router.post("/invoices")
async def admin_create_invoice(data: AdminInvoiceCreate, request: Request):
    """Create invoice for a tenant (super admin only)"""
    from invoices import create_invoice
    
    await require_super_admin(request)
    db = get_db()
    
    # Verify tenant exists
    tenant = await db.tenants.find_one({"tenant_id": data.tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    invoice = await create_invoice(
        db=db,
        tenant_id=data.tenant_id,
        bill_to_name=data.bill_to_name,
        bill_to_email=data.bill_to_email,
        items=data.items,
        bill_to_address=data.bill_to_address,
        bill_to_city=data.bill_to_city,
        bill_to_country=data.bill_to_country,
        bill_to_vat=data.bill_to_vat,
        tax_rate=data.tax_rate,
        notes=data.notes,
        due_days=data.due_days
    )
    
    return invoice


@admin_router.get("/invoices/{invoice_id}")
async def admin_get_invoice(invoice_id: str, request: Request):
    """Get invoice details (super admin only)"""
    await require_super_admin(request)
    db = get_db()
    
    invoice = await db.invoices.find_one(
        {"invoice_id": invoice_id},
        {"_id": 0}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get tenant info
    tenant = await db.tenants.find_one(
        {"tenant_id": invoice["tenant_id"]},
        {"_id": 0}
    )
    
    return {"invoice": invoice, "tenant": tenant}


@admin_router.put("/invoices/{invoice_id}/status")
async def admin_update_invoice_status(invoice_id: str, request: Request):
    """Update invoice status (super admin only)"""
    from invoices import InvoiceStatus
    
    await require_super_admin(request)
    db = get_db()
    
    body = await request.json()
    new_status = body.get("status")
    
    valid_statuses = [InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    update_data = {
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if new_status == InvoiceStatus.PAID:
        update_data["paid_date"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.invoices.update_one(
        {"invoice_id": invoice_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return {"message": "Invoice status updated", "status": new_status}


@admin_router.get("/invoices/{invoice_id}/pdf")
async def admin_get_invoice_pdf(invoice_id: str, request: Request):
    """Generate and return invoice PDF (super admin only)"""
    from invoices import generate_invoice_pdf_html
    from starlette.responses import Response
    
    await require_super_admin(request)
    db = get_db()
    
    invoice = await db.invoices.find_one(
        {"invoice_id": invoice_id},
        {"_id": 0}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    tenant = await db.tenants.find_one(
        {"tenant_id": invoice["tenant_id"]},
        {"_id": 0}
    )
    
    html_content = generate_invoice_pdf_html(invoice, tenant)
    
    # Convert to PDF using WeasyPrint
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html_content, base_url=".").write_pdf()
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=invoice-{invoice['invoice_number']}.pdf"
            }
        )
    except Exception as e:
        # Fallback to HTML if PDF generation fails
        return Response(
            content=html_content,
            media_type="text/html",
            headers={
                "Content-Disposition": f"inline; filename=invoice-{invoice['invoice_number']}.html"
            }
        )


@admin_router.delete("/invoices/{invoice_id}")
async def admin_delete_invoice(invoice_id: str, request: Request):
    """Delete an invoice (super admin only)"""
    await require_super_admin(request)
    db = get_db()
    
    result = await db.invoices.delete_one({"invoice_id": invoice_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return {"message": "Invoice deleted"}
