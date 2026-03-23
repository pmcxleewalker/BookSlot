from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import httpx
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'bookslot-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 168  # 7 days

# Create the main app
app = FastAPI(title="BookSlot API", version="1.0.0")

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ================== ENUMS ==================

class PlanType(str, Enum):
    STARTER = "starter"
    GROWTH = "growth"
    PRO = "pro"

class AppointmentStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"

class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    STAFF = "staff"

class IndustryType(str, Enum):
    SALON = "salon"
    CLINIC = "clinic"
    DENTIST = "dentist"
    DOCTOR = "doctor"
    VET = "vet"
    CONSULTANT = "consultant"
    OTHER = "other"

# ================== MODELS ==================

# Base Models
class TenantBase(BaseModel):
    name: str
    industry: IndustryType
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    timezone: str = "Europe/Dublin"
    currency: str = "EUR"
    plan: PlanType = PlanType.STARTER
    logo_url: Optional[str] = None
    booking_url_slug: Optional[str] = None

class TenantCreate(TenantBase):
    pass

class Tenant(TenantBase):
    model_config = ConfigDict(extra="ignore")
    tenant_id: str = Field(default_factory=lambda: f"tenant_{uuid.uuid4().hex[:12]}")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    onboarding_completed: bool = False
    settings: Dict[str, Any] = Field(default_factory=dict)

# User Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = None

class UserCreate(UserBase):
    password: Optional[str] = None
    tenant_id: Optional[str] = None
    role: UserRole = UserRole.OWNER

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    user_id: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:12]}")
    tenant_id: Optional[str] = None
    role: UserRole = UserRole.OWNER
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    tenant_id: Optional[str] = None
    role: UserRole
    is_active: bool

# Staff Models
class StaffBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    title: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    color: str = "#4F46E5"
    services: List[str] = Field(default_factory=list)
    working_hours: Dict[str, Any] = Field(default_factory=dict)

class StaffCreate(StaffBase):
    pass

class Staff(StaffBase):
    model_config = ConfigDict(extra="ignore")
    staff_id: str = Field(default_factory=lambda: f"staff_{uuid.uuid4().hex[:12]}")
    tenant_id: str
    user_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Service Models
class ServiceBase(BaseModel):
    name: str
    description: Optional[str] = None
    duration: int = 30  # minutes
    buffer_time: int = 0  # minutes before/after
    price: float = 0.0
    deposit_required: bool = False
    deposit_amount: float = 0.0
    color: str = "#E34A33"
    category: Optional[str] = None
    is_active: bool = True

class ServiceCreate(ServiceBase):
    pass

class Service(ServiceBase):
    model_config = ConfigDict(extra="ignore")
    service_id: str = Field(default_factory=lambda: f"service_{uuid.uuid4().hex[:12]}")
    tenant_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Resource Models
class ResourceBase(BaseModel):
    name: str
    description: Optional[str] = None
    resource_type: str = "room"
    capacity: int = 1
    is_active: bool = True

class ResourceCreate(ResourceBase):
    pass

class Resource(ResourceBase):
    model_config = ConfigDict(extra="ignore")
    resource_id: str = Field(default_factory=lambda: f"resource_{uuid.uuid4().hex[:12]}")
    tenant_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Client Models
class ClientBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

class ClientCreate(ClientBase):
    pass

class Client(ClientBase):
    model_config = ConfigDict(extra="ignore")
    client_id: str = Field(default_factory=lambda: f"client_{uuid.uuid4().hex[:12]}")
    tenant_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    total_appointments: int = 0
    total_spent: float = 0.0
    last_visit: Optional[datetime] = None

# Appointment Models
class AppointmentBase(BaseModel):
    service_id: str
    staff_id: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None
    resource_id: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    pass

class Appointment(AppointmentBase):
    model_config = ConfigDict(extra="ignore")
    appointment_id: str = Field(default_factory=lambda: f"appt_{uuid.uuid4().hex[:12]}")
    tenant_id: str
    status: AppointmentStatus = AppointmentStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    deposit_paid: bool = False
    total_price: float = 0.0
    source: str = "admin"  # admin, online, ai_receptionist

# Form Models
class FormFieldType(str, Enum):
    TEXT = "text"
    EMAIL = "email"
    PHONE = "phone"
    TEXTAREA = "textarea"
    SELECT = "select"
    CHECKBOX = "checkbox"
    DATE = "date"

class FormField(BaseModel):
    field_id: str = Field(default_factory=lambda: f"field_{uuid.uuid4().hex[:8]}")
    label: str
    field_type: FormFieldType
    required: bool = False
    options: List[str] = Field(default_factory=list)
    placeholder: Optional[str] = None

class FormBase(BaseModel):
    name: str
    description: Optional[str] = None
    fields: List[FormField] = Field(default_factory=list)
    is_active: bool = True

class FormCreate(FormBase):
    pass

class Form(FormBase):
    model_config = ConfigDict(extra="ignore")
    form_id: str = Field(default_factory=lambda: f"form_{uuid.uuid4().hex[:12]}")
    tenant_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Message Templates
class MessageTemplate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    template_id: str = Field(default_factory=lambda: f"template_{uuid.uuid4().hex[:12]}")
    tenant_id: str
    name: str
    type: str = "email"  # email, sms
    trigger: str = "booking_confirmation"  # booking_confirmation, reminder, cancellation
    subject: Optional[str] = None
    content: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Webhook Models
class WebhookEvent(str, Enum):
    BOOKING_CREATED = "booking.created"
    BOOKING_UPDATED = "booking.updated"
    BOOKING_CANCELLED = "booking.cancelled"
    BOOKING_COMPLETED = "booking.completed"

class Webhook(BaseModel):
    model_config = ConfigDict(extra="ignore")
    webhook_id: str = Field(default_factory=lambda: f"webhook_{uuid.uuid4().hex[:12]}")
    tenant_id: str
    url: str
    events: List[WebhookEvent]
    secret: str = Field(default_factory=lambda: uuid.uuid4().hex)
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ================== HELPER FUNCTIONS ==================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, tenant_id: Optional[str] = None) -> str:
    payload = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(request: Request) -> Dict[str, Any]:
    # Check cookie first
    session_token = request.cookies.get("session_token")
    
    # Then check Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if it's a Google OAuth session
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if session:
        # Validate expiry
        expires_at = session.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
        
        user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
        if user:
            return user
    
    # Try JWT token
    try:
        payload = decode_jwt_token(session_token)
        user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
        if user:
            return user
    except:
        pass
    
    raise HTTPException(status_code=401, detail="Invalid session")

async def verify_tenant_access(user: Dict[str, Any], tenant_id: str) -> bool:
    if user.get("tenant_id") != tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")
    return True

# ================== AUTH ENDPOINTS ==================

@api_router.post("/auth/register")
async def register(user_data: UserCreate, response: Response):
    """Register new user with email/password"""
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        picture=user_data.picture,
        role=user_data.role
    )
    
    user_dict = user.model_dump()
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    
    if user_data.password:
        user_dict["password_hash"] = hash_password(user_data.password)
    
    await db.users.insert_one({**user_dict})
    
    token = create_jwt_token(user.user_id)
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=JWT_EXPIRATION_HOURS * 3600
    )
    
    # Remove password_hash from response
    user_response = {k: v for k, v in user_dict.items() if k != "password_hash"}
    
    return {
        "user": UserResponse(**user_response).model_dump(),
        "token": token
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin, response: Response):
    """Login with email/password"""
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Please use Google login")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user["user_id"], user.get("tenant_id"))
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=JWT_EXPIRATION_HOURS * 3600
    )
    
    return {
        "user": UserResponse(**user).model_dump(),
        "token": token
    }

@api_router.post("/auth/session")
async def google_auth_session(request: Request, response: Response):
    """Exchange Google OAuth session_id for user session"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Fetch user data from Emergent Auth
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            auth_data = resp.json()
        except Exception as e:
            logger.error(f"Auth error: {e}")
            raise HTTPException(status_code=401, detail="Authentication failed")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": auth_data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": auth_data.get("name", existing_user.get("name")),
                "picture": auth_data.get("picture", existing_user.get("picture"))
            }}
        )
        tenant_id = existing_user.get("tenant_id")
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": auth_data["email"],
            "name": auth_data.get("name", ""),
            "picture": auth_data.get("picture"),
            "role": UserRole.OWNER.value,
            "tenant_id": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
        tenant_id = None
    
    # Store session
    session_token = auth_data.get("session_token", f"session_{uuid.uuid4().hex}")
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 3600
    )
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "user": UserResponse(**user).model_dump(),
        "token": session_token
    }

@api_router.get("/auth/me")
async def get_me(user: Dict = Depends(get_current_user)):
    """Get current authenticated user"""
    return UserResponse(**user).model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ================== TENANT ENDPOINTS ==================

@api_router.post("/tenants", response_model=Dict[str, Any])
async def create_tenant(tenant_data: TenantCreate, user: Dict = Depends(get_current_user)):
    """Create a new tenant (business)"""
    # Check if user already has a tenant
    if user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="User already has a business")
    
    tenant = Tenant(**tenant_data.model_dump())
    tenant.booking_url_slug = tenant.name.lower().replace(" ", "-").replace("'", "")[:30] + "-" + tenant.tenant_id[-6:]
    
    tenant_dict = tenant.model_dump()
    tenant_dict["created_at"] = tenant_dict["created_at"].isoformat()
    tenant_dict["updated_at"] = tenant_dict["updated_at"].isoformat()
    
    # Use a copy for insert to avoid _id being added to tenant_dict
    await db.tenants.insert_one({**tenant_dict})
    
    # Update user with tenant_id
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"tenant_id": tenant.tenant_id}}
    )
    
    # Create default message templates
    default_templates = [
        {
            "template_id": f"template_{uuid.uuid4().hex[:12]}",
            "tenant_id": tenant.tenant_id,
            "name": "Booking Confirmation",
            "type": "email",
            "trigger": "booking_confirmation",
            "subject": "Your appointment is confirmed",
            "content": "Hi {client_name}, your appointment for {service_name} on {date} at {time} has been confirmed.",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "template_id": f"template_{uuid.uuid4().hex[:12]}",
            "tenant_id": tenant.tenant_id,
            "name": "Appointment Reminder",
            "type": "email",
            "trigger": "reminder",
            "subject": "Reminder: Your appointment is tomorrow",
            "content": "Hi {client_name}, this is a reminder for your appointment tomorrow at {time}.",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.message_templates.insert_many(default_templates)
    
    return {"tenant": tenant_dict, "message": "Business created successfully"}

@api_router.get("/tenants/me")
async def get_my_tenant(user: Dict = Depends(get_current_user)):
    """Get current user's tenant"""
    if not user.get("tenant_id"):
        return {"tenant": None}
    
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    return {"tenant": tenant}

@api_router.put("/tenants/me")
async def update_my_tenant(updates: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Update current user's tenant"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=404, detail="No business found")
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.tenants.update_one(
        {"tenant_id": user["tenant_id"]},
        {"$set": updates}
    )
    
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    return {"tenant": tenant}

@api_router.post("/tenants/me/complete-onboarding")
async def complete_onboarding(user: Dict = Depends(get_current_user)):
    """Mark onboarding as complete"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=404, detail="No business found")
    
    await db.tenants.update_one(
        {"tenant_id": user["tenant_id"]},
        {"$set": {"onboarding_completed": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Onboarding completed"}

# ================== STAFF ENDPOINTS ==================

@api_router.get("/staff")
async def get_staff(user: Dict = Depends(get_current_user)):
    """Get all staff for tenant"""
    if not user.get("tenant_id"):
        return {"staff": []}
    
    staff = await db.staff.find({"tenant_id": user["tenant_id"], "is_active": True}, {"_id": 0}).to_list(100)
    return {"staff": staff}

@api_router.post("/staff")
async def create_staff(staff_data: StaffCreate, user: Dict = Depends(get_current_user)):
    """Create new staff member"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    # Check plan limits
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    staff_count = await db.staff.count_documents({"tenant_id": user["tenant_id"], "is_active": True})
    
    limits = {"starter": 2, "growth": 8, "pro": 999}
    if staff_count >= limits.get(tenant.get("plan", "starter"), 2):
        raise HTTPException(status_code=403, detail=f"Staff limit reached for your plan")
    
    staff = Staff(**staff_data.model_dump(), tenant_id=user["tenant_id"])
    staff_dict = staff.model_dump()
    staff_dict["created_at"] = staff_dict["created_at"].isoformat()
    
    await db.staff.insert_one({**staff_dict})
    return {"staff": staff_dict}

@api_router.put("/staff/{staff_id}")
async def update_staff(staff_id: str, updates: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Update staff member"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    result = await db.staff.update_one(
        {"staff_id": staff_id, "tenant_id": user["tenant_id"]},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    staff = await db.staff.find_one({"staff_id": staff_id}, {"_id": 0})
    return {"staff": staff}

@api_router.delete("/staff/{staff_id}")
async def delete_staff(staff_id: str, user: Dict = Depends(get_current_user)):
    """Soft delete staff member"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    result = await db.staff.update_one(
        {"staff_id": staff_id, "tenant_id": user["tenant_id"]},
        {"$set": {"is_active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    return {"message": "Staff deleted"}

# ================== SERVICE ENDPOINTS ==================

@api_router.get("/services")
async def get_services(user: Dict = Depends(get_current_user)):
    """Get all services for tenant"""
    if not user.get("tenant_id"):
        return {"services": []}
    
    services = await db.services.find({"tenant_id": user["tenant_id"], "is_active": True}, {"_id": 0}).to_list(100)
    return {"services": services}

@api_router.post("/services")
async def create_service(service_data: ServiceCreate, user: Dict = Depends(get_current_user)):
    """Create new service"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    service = Service(**service_data.model_dump(), tenant_id=user["tenant_id"])
    service_dict = service.model_dump()
    service_dict["created_at"] = service_dict["created_at"].isoformat()
    
    await db.services.insert_one({**service_dict})
    return {"service": service_dict}

@api_router.put("/services/{service_id}")
async def update_service(service_id: str, updates: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Update service"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    result = await db.services.update_one(
        {"service_id": service_id, "tenant_id": user["tenant_id"]},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    
    service = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    return {"service": service}

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, user: Dict = Depends(get_current_user)):
    """Soft delete service"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    result = await db.services.update_one(
        {"service_id": service_id, "tenant_id": user["tenant_id"]},
        {"$set": {"is_active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    
    return {"message": "Service deleted"}

# ================== RESOURCE ENDPOINTS ==================

@api_router.get("/resources")
async def get_resources(user: Dict = Depends(get_current_user)):
    """Get all resources for tenant"""
    if not user.get("tenant_id"):
        return {"resources": []}
    
    resources = await db.resources.find({"tenant_id": user["tenant_id"], "is_active": True}, {"_id": 0}).to_list(100)
    return {"resources": resources}

@api_router.post("/resources")
async def create_resource(resource_data: ResourceCreate, user: Dict = Depends(get_current_user)):
    """Create new resource"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    resource = Resource(**resource_data.model_dump(), tenant_id=user["tenant_id"])
    resource_dict = resource.model_dump()
    resource_dict["created_at"] = resource_dict["created_at"].isoformat()
    
    await db.resources.insert_one({**resource_dict})
    return {"resource": resource_dict}

@api_router.put("/resources/{resource_id}")
async def update_resource(resource_id: str, updates: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Update resource"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    result = await db.resources.update_one(
        {"resource_id": resource_id, "tenant_id": user["tenant_id"]},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    resource = await db.resources.find_one({"resource_id": resource_id}, {"_id": 0})
    return {"resource": resource}

@api_router.delete("/resources/{resource_id}")
async def delete_resource(resource_id: str, user: Dict = Depends(get_current_user)):
    """Soft delete resource"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    result = await db.resources.update_one(
        {"resource_id": resource_id, "tenant_id": user["tenant_id"]},
        {"$set": {"is_active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    return {"message": "Resource deleted"}

# ================== CLIENT ENDPOINTS ==================

@api_router.get("/clients")
async def get_clients(user: Dict = Depends(get_current_user), search: Optional[str] = None):
    """Get all clients for tenant"""
    if not user.get("tenant_id"):
        return {"clients": []}
    
    query = {"tenant_id": user["tenant_id"]}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    clients = await db.clients.find(query, {"_id": 0}).to_list(500)
    return {"clients": clients}

@api_router.post("/clients")
async def create_client(client_data: ClientCreate, user: Dict = Depends(get_current_user)):
    """Create new client"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    client = Client(**client_data.model_dump(), tenant_id=user["tenant_id"])
    client_dict = client.model_dump()
    client_dict["created_at"] = client_dict["created_at"].isoformat()
    if client_dict.get("last_visit"):
        client_dict["last_visit"] = client_dict["last_visit"].isoformat()
    
    await db.clients.insert_one({**client_dict})
    return {"client": client_dict}

@api_router.get("/clients/{client_id}")
async def get_client(client_id: str, user: Dict = Depends(get_current_user)):
    """Get single client"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    client = await db.clients.find_one({"client_id": client_id, "tenant_id": user["tenant_id"]}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    return {"client": client}

@api_router.put("/clients/{client_id}")
async def update_client(client_id: str, updates: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Update client"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    result = await db.clients.update_one(
        {"client_id": client_id, "tenant_id": user["tenant_id"]},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    
    client = await db.clients.find_one({"client_id": client_id}, {"_id": 0})
    return {"client": client}

# ================== APPOINTMENT ENDPOINTS ==================

@api_router.get("/appointments")
async def get_appointments(
    user: Dict = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    staff_id: Optional[str] = None,
    status: Optional[str] = None
):
    """Get appointments with filters"""
    if not user.get("tenant_id"):
        return {"appointments": []}
    
    query = {"tenant_id": user["tenant_id"]}
    
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
    
    appointments = await db.appointments.find(query, {"_id": 0}).sort("start_time", 1).to_list(1000)
    return {"appointments": appointments}

@api_router.post("/appointments")
async def create_appointment(appt_data: AppointmentCreate, user: Dict = Depends(get_current_user)):
    """Create new appointment"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    # Check for conflicts
    conflict = await db.appointments.find_one({
        "tenant_id": user["tenant_id"],
        "staff_id": appt_data.staff_id,
        "status": {"$nin": ["cancelled"]},
        "$or": [
            {"start_time": {"$lt": appt_data.end_time.isoformat(), "$gte": appt_data.start_time.isoformat()}},
            {"end_time": {"$gt": appt_data.start_time.isoformat(), "$lte": appt_data.end_time.isoformat()}},
            {"$and": [
                {"start_time": {"$lte": appt_data.start_time.isoformat()}},
                {"end_time": {"$gte": appt_data.end_time.isoformat()}}
            ]}
        ]
    }, {"_id": 0})
    
    if conflict:
        raise HTTPException(status_code=409, detail="Time slot conflict with existing appointment")
    
    # Get service price
    service = await db.services.find_one({"service_id": appt_data.service_id}, {"_id": 0})
    
    appointment = Appointment(**appt_data.model_dump(), tenant_id=user["tenant_id"])
    appointment.total_price = service.get("price", 0) if service else 0
    
    appt_dict = appointment.model_dump()
    appt_dict["start_time"] = appt_dict["start_time"].isoformat()
    appt_dict["end_time"] = appt_dict["end_time"].isoformat()
    appt_dict["created_at"] = appt_dict["created_at"].isoformat()
    appt_dict["updated_at"] = appt_dict["updated_at"].isoformat()
    
    await db.appointments.insert_one({**appt_dict})
    
    # Trigger webhook
    await trigger_webhook(user["tenant_id"], WebhookEvent.BOOKING_CREATED, appt_dict)
    
    return {"appointment": appt_dict}

@api_router.put("/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, updates: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Update appointment"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.appointments.update_one(
        {"appointment_id": appointment_id, "tenant_id": user["tenant_id"]},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    appointment = await db.appointments.find_one({"appointment_id": appointment_id}, {"_id": 0})
    
    await trigger_webhook(user["tenant_id"], WebhookEvent.BOOKING_UPDATED, appointment)
    
    return {"appointment": appointment}

@api_router.post("/appointments/{appointment_id}/cancel")
async def cancel_appointment(appointment_id: str, reason: Optional[str] = None, user: Dict = Depends(get_current_user)):
    """Cancel appointment"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    result = await db.appointments.update_one(
        {"appointment_id": appointment_id, "tenant_id": user["tenant_id"]},
        {"$set": {
            "status": AppointmentStatus.CANCELLED.value,
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancellation_reason": reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    appointment = await db.appointments.find_one({"appointment_id": appointment_id}, {"_id": 0})
    
    await trigger_webhook(user["tenant_id"], WebhookEvent.BOOKING_CANCELLED, appointment)
    
    return {"appointment": appointment}

# ================== PUBLIC BOOKING ENDPOINTS ==================

@api_router.get("/public/booking/{slug}")
async def get_public_booking_page(slug: str):
    """Get public booking page data"""
    tenant = await db.tenants.find_one({"booking_url_slug": slug, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    services = await db.services.find({"tenant_id": tenant["tenant_id"], "is_active": True}, {"_id": 0}).to_list(100)
    staff = await db.staff.find({"tenant_id": tenant["tenant_id"], "is_active": True}, {"_id": 0}).to_list(100)
    
    # Remove sensitive data
    tenant_public = {
        "name": tenant["name"],
        "industry": tenant["industry"],
        "logo_url": tenant.get("logo_url"),
        "address": tenant.get("address"),
        "phone": tenant.get("phone"),
        "timezone": tenant.get("timezone")
    }
    
    return {
        "tenant": tenant_public,
        "services": services,
        "staff": staff
    }

@api_router.get("/public/booking/{slug}/availability")
async def get_availability(
    slug: str,
    service_id: str,
    staff_id: str,
    date: str
):
    """Get available time slots for a date"""
    tenant = await db.tenants.find_one({"booking_url_slug": slug, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    service = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Get existing appointments for the day
    start_of_day = f"{date}T00:00:00"
    end_of_day = f"{date}T23:59:59"
    
    existing = await db.appointments.find({
        "tenant_id": tenant["tenant_id"],
        "staff_id": staff_id,
        "status": {"$nin": ["cancelled"]},
        "start_time": {"$gte": start_of_day, "$lte": end_of_day}
    }, {"_id": 0}).to_list(100)
    
    # Generate available slots (9 AM to 6 PM, simplified)
    duration = service.get("duration", 30)
    buffer = service.get("buffer_time", 0)
    slots = []
    
    for hour in range(9, 18):
        for minute in [0, 30]:
            slot_start = f"{date}T{hour:02d}:{minute:02d}:00"
            slot_end_dt = datetime.fromisoformat(slot_start) + timedelta(minutes=duration + buffer)
            slot_end = slot_end_dt.isoformat()
            
            # Check if slot conflicts
            conflict = False
            for appt in existing:
                if appt["start_time"] < slot_end and appt["end_time"] > slot_start:
                    conflict = True
                    break
            
            if not conflict:
                slots.append({
                    "start_time": slot_start,
                    "end_time": slot_end,
                    "available": True
                })
    
    return {"slots": slots, "date": date}

@api_router.post("/public/booking/{slug}/book")
async def create_public_booking(slug: str, booking_data: Dict[str, Any]):
    """Create a booking from public page"""
    tenant = await db.tenants.find_one({"booking_url_slug": slug, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    service = await db.services.find_one({"service_id": booking_data["service_id"]}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Check for conflicts
    conflict = await db.appointments.find_one({
        "tenant_id": tenant["tenant_id"],
        "staff_id": booking_data["staff_id"],
        "status": {"$nin": ["cancelled"]},
        "$or": [
            {"start_time": {"$lt": booking_data["end_time"], "$gte": booking_data["start_time"]}},
            {"end_time": {"$gt": booking_data["start_time"], "$lte": booking_data["end_time"]}}
        ]
    }, {"_id": 0})
    
    if conflict:
        raise HTTPException(status_code=409, detail="Time slot no longer available")
    
    # Create or find client
    client = None
    if booking_data.get("client_email"):
        client = await db.clients.find_one({
            "tenant_id": tenant["tenant_id"],
            "email": booking_data["client_email"]
        }, {"_id": 0})
        
        if not client:
            client = Client(
                name=booking_data.get("client_name", ""),
                email=booking_data.get("client_email"),
                phone=booking_data.get("client_phone"),
                tenant_id=tenant["tenant_id"]
            )
            client_dict = client.model_dump()
            client_dict["created_at"] = client_dict["created_at"].isoformat()
            await db.clients.insert_one(client_dict)
            client = client_dict
    
    # Create appointment
    appointment = Appointment(
        service_id=booking_data["service_id"],
        staff_id=booking_data["staff_id"],
        client_id=client["client_id"] if client else None,
        client_name=booking_data.get("client_name"),
        client_email=booking_data.get("client_email"),
        client_phone=booking_data.get("client_phone"),
        start_time=datetime.fromisoformat(booking_data["start_time"]),
        end_time=datetime.fromisoformat(booking_data["end_time"]),
        notes=booking_data.get("notes"),
        tenant_id=tenant["tenant_id"],
        source="online"
    )
    appointment.total_price = service.get("price", 0)
    
    appt_dict = appointment.model_dump()
    appt_dict["start_time"] = appt_dict["start_time"].isoformat()
    appt_dict["end_time"] = appt_dict["end_time"].isoformat()
    appt_dict["created_at"] = appt_dict["created_at"].isoformat()
    appt_dict["updated_at"] = appt_dict["updated_at"].isoformat()
    
    await db.appointments.insert_one({**appt_dict})
    
    await trigger_webhook(tenant["tenant_id"], WebhookEvent.BOOKING_CREATED, appt_dict)
    
    return {
        "appointment": appt_dict,
        "confirmation_code": appointment.appointment_id,
        "message": "Booking confirmed!"
    }

@api_router.get("/public/booking/manage/{confirmation_code}")
async def get_booking_by_code(confirmation_code: str):
    """Get booking by confirmation code"""
    appointment = await db.appointments.find_one({"appointment_id": confirmation_code}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    tenant = await db.tenants.find_one({"tenant_id": appointment["tenant_id"]}, {"_id": 0})
    service = await db.services.find_one({"service_id": appointment["service_id"]}, {"_id": 0})
    staff = await db.staff.find_one({"staff_id": appointment["staff_id"]}, {"_id": 0})
    
    return {
        "appointment": appointment,
        "business_name": tenant.get("name") if tenant else None,
        "service_name": service.get("name") if service else None,
        "staff_name": staff.get("name") if staff else None
    }

@api_router.post("/public/booking/manage/{confirmation_code}/cancel")
async def cancel_booking_by_code(confirmation_code: str, body: Dict[str, Any] = None):
    """Cancel booking by confirmation code"""
    appointment = await db.appointments.find_one({"appointment_id": confirmation_code}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if appointment["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="Booking already cancelled")
    
    reason = body.get("reason") if body else None
    
    await db.appointments.update_one(
        {"appointment_id": confirmation_code},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancellation_reason": reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated = await db.appointments.find_one({"appointment_id": confirmation_code}, {"_id": 0})
    
    await trigger_webhook(appointment["tenant_id"], WebhookEvent.BOOKING_CANCELLED, updated)
    
    return {"message": "Booking cancelled", "appointment": updated}

# ================== FORMS ENDPOINTS ==================

@api_router.get("/forms")
async def get_forms(user: Dict = Depends(get_current_user)):
    """Get all forms for tenant"""
    if not user.get("tenant_id"):
        return {"forms": []}
    
    forms = await db.forms.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).to_list(100)
    return {"forms": forms}

@api_router.post("/forms")
async def create_form(form_data: FormCreate, user: Dict = Depends(get_current_user)):
    """Create new form"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    form = Form(**form_data.model_dump(), tenant_id=user["tenant_id"])
    form_dict = form.model_dump()
    form_dict["created_at"] = form_dict["created_at"].isoformat()
    
    await db.forms.insert_one({**form_dict})
    return {"form": form_dict}

# ================== MESSAGE TEMPLATES ==================

@api_router.get("/messages/templates")
async def get_message_templates(user: Dict = Depends(get_current_user)):
    """Get all message templates"""
    if not user.get("tenant_id"):
        return {"templates": []}
    
    templates = await db.message_templates.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).to_list(100)
    return {"templates": templates}

@api_router.put("/messages/templates/{template_id}")
async def update_message_template(template_id: str, updates: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Update message template"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    result = await db.message_templates.update_one(
        {"template_id": template_id, "tenant_id": user["tenant_id"]},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template = await db.message_templates.find_one({"template_id": template_id}, {"_id": 0})
    return {"template": template}

# ================== REPORTS/ANALYTICS ==================

@api_router.get("/reports/dashboard")
async def get_dashboard_stats(user: Dict = Depends(get_current_user)):
    """Get dashboard statistics"""
    if not user.get("tenant_id"):
        return {"stats": {}}
    
    tenant_id = user["tenant_id"]
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Today's appointments
    today_count = await db.appointments.count_documents({
        "tenant_id": tenant_id,
        "start_time": {"$regex": f"^{today}"}
    })
    
    # Total appointments this month
    month_start = datetime.now(timezone.utc).replace(day=1).date().isoformat()
    month_count = await db.appointments.count_documents({
        "tenant_id": tenant_id,
        "start_time": {"$gte": month_start}
    })
    
    # Revenue this month
    month_appointments = await db.appointments.find({
        "tenant_id": tenant_id,
        "start_time": {"$gte": month_start},
        "status": {"$in": ["completed", "confirmed"]}
    }, {"_id": 0, "total_price": 1}).to_list(1000)
    
    revenue = sum(a.get("total_price", 0) for a in month_appointments)
    
    # Client count
    client_count = await db.clients.count_documents({"tenant_id": tenant_id})
    
    # Upcoming appointments (next 7 days)
    week_end = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    upcoming = await db.appointments.find({
        "tenant_id": tenant_id,
        "start_time": {"$gte": datetime.now(timezone.utc).isoformat(), "$lte": week_end},
        "status": {"$nin": ["cancelled"]}
    }, {"_id": 0}).sort("start_time", 1).to_list(10)
    
    return {
        "stats": {
            "today_appointments": today_count,
            "month_appointments": month_count,
            "month_revenue": revenue,
            "total_clients": client_count
        },
        "upcoming_appointments": upcoming
    }

# ================== WEBHOOKS ==================

@api_router.get("/webhooks")
async def get_webhooks(user: Dict = Depends(get_current_user)):
    """Get all webhooks"""
    if not user.get("tenant_id"):
        return {"webhooks": []}
    
    webhooks = await db.webhooks.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).to_list(100)
    return {"webhooks": webhooks}

@api_router.post("/webhooks")
async def create_webhook(webhook_data: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Create webhook"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    webhook = Webhook(
        tenant_id=user["tenant_id"],
        url=webhook_data["url"],
        events=[WebhookEvent(e) for e in webhook_data.get("events", [])]
    )
    
    webhook_dict = webhook.model_dump()
    webhook_dict["created_at"] = webhook_dict["created_at"].isoformat()
    
    await db.webhooks.insert_one({**webhook_dict})
    return {"webhook": webhook_dict}

@api_router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, user: Dict = Depends(get_current_user)):
    """Delete webhook"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    result = await db.webhooks.delete_one({
        "webhook_id": webhook_id,
        "tenant_id": user["tenant_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    return {"message": "Webhook deleted"}

async def trigger_webhook(tenant_id: str, event: WebhookEvent, data: Dict[str, Any]):
    """Trigger webhooks for an event"""
    webhooks = await db.webhooks.find({
        "tenant_id": tenant_id,
        "is_active": True,
        "events": event.value
    }, {"_id": 0}).to_list(100)
    
    for webhook in webhooks:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    webhook["url"],
                    json={
                        "event": event.value,
                        "data": data,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    },
                    headers={"X-Webhook-Secret": webhook.get("secret", "")},
                    timeout=10
                )
        except Exception as e:
            logger.error(f"Webhook failed: {e}")

# ================== AI RECEPTIONIST API (MOLTBOT) ==================

@api_router.get("/receptionist/{tenant_id}/info")
async def receptionist_get_business_info(tenant_id: str, api_key: str = Query(...)):
    """Get business info for AI receptionist"""
    # Validate API key (simplified - in production use proper API key management)
    tenant = await db.tenants.find_one({"tenant_id": tenant_id, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    services = await db.services.find({"tenant_id": tenant_id, "is_active": True}, {"_id": 0}).to_list(100)
    staff = await db.staff.find({"tenant_id": tenant_id, "is_active": True}, {"_id": 0}).to_list(100)
    
    return {
        "business": {
            "name": tenant["name"],
            "industry": tenant["industry"],
            "address": tenant.get("address"),
            "phone": tenant.get("phone"),
            "timezone": tenant.get("timezone")
        },
        "services": [{"id": s["service_id"], "name": s["name"], "duration": s["duration"], "price": s["price"]} for s in services],
        "staff": [{"id": st["staff_id"], "name": st["name"], "services": st.get("services", [])} for st in staff]
    }

@api_router.get("/receptionist/{tenant_id}/availability")
async def receptionist_check_availability(
    tenant_id: str,
    service_id: str,
    staff_id: str,
    date: str,
    api_key: str = Query(...)
):
    """Check availability for AI receptionist"""
    tenant = await db.tenants.find_one({"tenant_id": tenant_id, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    service = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Get existing appointments
    start_of_day = f"{date}T00:00:00"
    end_of_day = f"{date}T23:59:59"
    
    existing = await db.appointments.find({
        "tenant_id": tenant_id,
        "staff_id": staff_id,
        "status": {"$nin": ["cancelled"]},
        "start_time": {"$gte": start_of_day, "$lte": end_of_day}
    }, {"_id": 0}).to_list(100)
    
    # Generate slots
    duration = service.get("duration", 30)
    slots = []
    
    for hour in range(9, 18):
        for minute in [0, 30]:
            slot_start = f"{date}T{hour:02d}:{minute:02d}:00"
            slot_end_dt = datetime.fromisoformat(slot_start) + timedelta(minutes=duration)
            slot_end = slot_end_dt.isoformat()
            
            conflict = any(appt["start_time"] < slot_end and appt["end_time"] > slot_start for appt in existing)
            
            if not conflict:
                slots.append({"start": slot_start, "end": slot_end})
    
    return {"available_slots": slots, "date": date, "service": service["name"], "duration_minutes": duration}

@api_router.post("/receptionist/{tenant_id}/book")
async def receptionist_create_booking(tenant_id: str, booking: Dict[str, Any], api_key: str = Query(...)):
    """Create booking via AI receptionist"""
    tenant = await db.tenants.find_one({"tenant_id": tenant_id, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    service = await db.services.find_one({"service_id": booking["service_id"]}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Check conflicts
    conflict = await db.appointments.find_one({
        "tenant_id": tenant_id,
        "staff_id": booking["staff_id"],
        "status": {"$nin": ["cancelled"]},
        "$or": [
            {"start_time": {"$lt": booking["end_time"], "$gte": booking["start_time"]}},
            {"end_time": {"$gt": booking["start_time"], "$lte": booking["end_time"]}}
        ]
    }, {"_id": 0})
    
    if conflict:
        raise HTTPException(status_code=409, detail="Time slot not available")
    
    # Create client if needed
    client = None
    if booking.get("client_email"):
        client = await db.clients.find_one({
            "tenant_id": tenant_id,
            "email": booking["client_email"]
        }, {"_id": 0})
        
        if not client:
            client = {
                "client_id": f"client_{uuid.uuid4().hex[:12]}",
                "tenant_id": tenant_id,
                "name": booking.get("client_name", ""),
                "email": booking.get("client_email"),
                "phone": booking.get("client_phone"),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "total_appointments": 0,
                "total_spent": 0.0
            }
            await db.clients.insert_one(client)
    
    # Create appointment
    appointment = {
        "appointment_id": f"appt_{uuid.uuid4().hex[:12]}",
        "tenant_id": tenant_id,
        "service_id": booking["service_id"],
        "staff_id": booking["staff_id"],
        "client_id": client["client_id"] if client else None,
        "client_name": booking.get("client_name"),
        "client_email": booking.get("client_email"),
        "client_phone": booking.get("client_phone"),
        "start_time": booking["start_time"],
        "end_time": booking["end_time"],
        "notes": booking.get("notes"),
        "status": "confirmed",
        "source": "ai_receptionist",
        "total_price": service.get("price", 0),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.appointments.insert_one({**appointment})
    
    await trigger_webhook(tenant_id, WebhookEvent.BOOKING_CREATED, appointment)
    
    return {
        "success": True,
        "confirmation_code": appointment["appointment_id"],
        "appointment": {
            "service": service["name"],
            "start_time": booking["start_time"],
            "end_time": booking["end_time"]
        }
    }

@api_router.post("/receptionist/{tenant_id}/cancel")
async def receptionist_cancel_booking(tenant_id: str, body: Dict[str, Any], api_key: str = Query(...)):
    """Cancel booking via AI receptionist"""
    confirmation_code = body.get("confirmation_code")
    
    appointment = await db.appointments.find_one({
        "appointment_id": confirmation_code,
        "tenant_id": tenant_id
    }, {"_id": 0})
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    await db.appointments.update_one(
        {"appointment_id": confirmation_code},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancellation_reason": body.get("reason", "Cancelled via AI receptionist"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await trigger_webhook(tenant_id, WebhookEvent.BOOKING_CANCELLED, appointment)
    
    return {"success": True, "message": "Booking cancelled"}

@api_router.post("/receptionist/{tenant_id}/reschedule")
async def receptionist_reschedule_booking(tenant_id: str, body: Dict[str, Any], api_key: str = Query(...)):
    """Reschedule booking via AI receptionist"""
    confirmation_code = body.get("confirmation_code")
    new_start = body.get("new_start_time")
    new_end = body.get("new_end_time")
    
    appointment = await db.appointments.find_one({
        "appointment_id": confirmation_code,
        "tenant_id": tenant_id
    }, {"_id": 0})
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check conflicts for new time
    conflict = await db.appointments.find_one({
        "tenant_id": tenant_id,
        "staff_id": appointment["staff_id"],
        "appointment_id": {"$ne": confirmation_code},
        "status": {"$nin": ["cancelled"]},
        "$or": [
            {"start_time": {"$lt": new_end, "$gte": new_start}},
            {"end_time": {"$gt": new_start, "$lte": new_end}}
        ]
    }, {"_id": 0})
    
    if conflict:
        raise HTTPException(status_code=409, detail="New time slot not available")
    
    await db.appointments.update_one(
        {"appointment_id": confirmation_code},
        {"$set": {
            "start_time": new_start,
            "end_time": new_end,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated = await db.appointments.find_one({"appointment_id": confirmation_code}, {"_id": 0})
    
    await trigger_webhook(tenant_id, WebhookEvent.BOOKING_UPDATED, updated)
    
    return {"success": True, "appointment": updated}

# ================== DEMO DATA ==================

@api_router.post("/demo/seed")
async def seed_demo_data(user: Dict = Depends(get_current_user)):
    """Seed demo data for tenant"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    tenant_id = user["tenant_id"]
    
    # Sample staff
    sample_staff = [
        {"name": "Sarah Johnson", "email": "sarah@demo.com", "title": "Senior Stylist", "color": "#E34A33"},
        {"name": "Michael Chen", "email": "michael@demo.com", "title": "Therapist", "color": "#4F46E5"},
    ]
    
    for s in sample_staff:
        staff = Staff(**s, tenant_id=tenant_id)
        staff_dict = staff.model_dump()
        staff_dict["created_at"] = staff_dict["created_at"].isoformat()
        await db.staff.insert_one(staff_dict)
    
    # Sample services
    sample_services = [
        {"name": "Consultation", "duration": 30, "price": 50, "color": "#121212"},
        {"name": "Standard Session", "duration": 60, "price": 100, "color": "#E34A33"},
        {"name": "Premium Package", "duration": 90, "price": 150, "color": "#4F46E5"},
    ]
    
    for s in sample_services:
        service = Service(**s, tenant_id=tenant_id)
        service_dict = service.model_dump()
        service_dict["created_at"] = service_dict["created_at"].isoformat()
        await db.services.insert_one(service_dict)
    
    # Sample clients
    sample_clients = [
        {"name": "Emma Wilson", "email": "emma@example.com", "phone": "+1234567890"},
        {"name": "James Brown", "email": "james@example.com", "phone": "+1234567891"},
        {"name": "Olivia Davis", "email": "olivia@example.com", "phone": "+1234567892"},
    ]
    
    for c in sample_clients:
        client = Client(**c, tenant_id=tenant_id)
        client_dict = client.model_dump()
        client_dict["created_at"] = client_dict["created_at"].isoformat()
        await db.clients.insert_one(client_dict)
    
    return {"message": "Demo data seeded successfully"}

# ================== PLAN FEATURES CONFIG ==================

PLAN_FEATURES = {
    "starter": {
        "name": "Starter",
        "price": 29,
        "max_locations": 1,
        "max_staff": 2,
        "online_booking": True,
        "reminders": True,
        "deposits": True,
        "calendar_sync": True,
        "basic_reports": True,
        "waitlist": False,
        "packages": False,
        "ai_assistant": False,
        "sms_automations": False,
        "advanced_reports": False,
        "multi_location": False,
        "advanced_permissions": False,
        "resource_booking": False,
        "custom_forms": False,
        "white_label": False,
        "api_webhooks": False,
    },
    "growth": {
        "name": "Growth",
        "price": 79,
        "max_locations": 1,
        "max_staff": 8,
        "online_booking": True,
        "reminders": True,
        "deposits": True,
        "calendar_sync": True,
        "basic_reports": True,
        "waitlist": True,
        "packages": True,
        "ai_assistant": True,
        "sms_automations": True,
        "advanced_reports": True,
        "multi_location": False,
        "advanced_permissions": False,
        "resource_booking": False,
        "custom_forms": False,
        "white_label": False,
        "api_webhooks": False,
    },
    "pro": {
        "name": "Pro",
        "price": 149,
        "max_locations": 999,
        "max_staff": 999,
        "online_booking": True,
        "reminders": True,
        "deposits": True,
        "calendar_sync": True,
        "basic_reports": True,
        "waitlist": True,
        "packages": True,
        "ai_assistant": True,
        "sms_automations": True,
        "advanced_reports": True,
        "multi_location": True,
        "advanced_permissions": True,
        "resource_booking": True,
        "custom_forms": True,
        "white_label": True,
        "api_webhooks": True,
    }
}

@api_router.get("/plans/features")
async def get_plan_features():
    """Get all plan features for reference"""
    return {"plans": PLAN_FEATURES}

@api_router.get("/tenants/me/features")
async def get_my_features(user: Dict = Depends(get_current_user)):
    """Get current tenant's enabled features based on plan"""
    if not user.get("tenant_id"):
        return {"features": PLAN_FEATURES["starter"]}
    
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    plan = tenant.get("plan", "starter") if tenant else "starter"
    
    return {"features": PLAN_FEATURES.get(plan, PLAN_FEATURES["starter"]), "plan": plan}

# ================== SUPER ADMIN ENDPOINTS ==================

SUPER_ADMIN_SECRET = os.environ.get('SUPER_ADMIN_SECRET', 'superadmin-secret-key')

async def get_super_admin(request: Request) -> Dict[str, Any]:
    """Verify super admin authentication"""
    session_token = request.cookies.get("admin_session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated as super admin")
    
    # Check admin session
    session = await db.admin_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid admin session")
    
    # Check expiry
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Admin session expired")
    
    admin = await db.super_admins.find_one({"admin_id": session["admin_id"]}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    
    return admin

@api_router.post("/admin/login")
async def admin_login(credentials: UserLogin, response: Response):
    """Super admin login"""
    admin = await db.super_admins.find_one({"email": credentials.email}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not admin.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create session
    session_token = f"admin_session_{uuid.uuid4().hex}"
    session = {
        "admin_id": admin["admin_id"],
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.admin_sessions.delete_many({"admin_id": admin["admin_id"]})
    await db.admin_sessions.insert_one({**session})
    
    response.set_cookie(
        key="admin_session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 3600
    )
    
    return {
        "admin": {
            "admin_id": admin["admin_id"],
            "email": admin["email"],
            "name": admin["name"]
        },
        "token": session_token
    }

@api_router.get("/admin/me")
async def get_admin_me(admin: Dict = Depends(get_super_admin)):
    """Get current super admin"""
    return {
        "admin_id": admin["admin_id"],
        "email": admin["email"],
        "name": admin["name"]
    }

@api_router.post("/admin/logout")
async def admin_logout(request: Request, response: Response):
    """Super admin logout"""
    session_token = request.cookies.get("admin_session_token")
    if session_token:
        await db.admin_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="admin_session_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/admin/tenants")
async def admin_get_tenants(
    admin: Dict = Depends(get_super_admin),
    search: Optional[str] = None,
    plan: Optional[str] = None,
    is_active: Optional[bool] = None
):
    """Get all tenants (super admin only)"""
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    if plan:
        query["plan"] = plan
    if is_active is not None:
        query["is_active"] = is_active
    
    tenants = await db.tenants.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Get stats for each tenant
    for tenant in tenants:
        tenant["staff_count"] = await db.staff.count_documents({"tenant_id": tenant["tenant_id"], "is_active": True})
        tenant["client_count"] = await db.clients.count_documents({"tenant_id": tenant["tenant_id"]})
        tenant["appointment_count"] = await db.appointments.count_documents({"tenant_id": tenant["tenant_id"]})
    
    return {"tenants": tenants}

@api_router.get("/admin/tenants/{tenant_id}")
async def admin_get_tenant(tenant_id: str, admin: Dict = Depends(get_super_admin)):
    """Get specific tenant details (super admin only)"""
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get related data
    owner = await db.users.find_one({"tenant_id": tenant_id, "role": "owner"}, {"_id": 0, "password_hash": 0})
    staff = await db.staff.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    services = await db.services.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    
    # Get stats
    stats = {
        "staff_count": len(staff),
        "services_count": len(services),
        "client_count": await db.clients.count_documents({"tenant_id": tenant_id}),
        "total_appointments": await db.appointments.count_documents({"tenant_id": tenant_id}),
        "month_appointments": await db.appointments.count_documents({
            "tenant_id": tenant_id,
            "created_at": {"$gte": datetime.now(timezone.utc).replace(day=1).isoformat()}
        })
    }
    
    return {
        "tenant": tenant,
        "owner": owner,
        "staff": staff,
        "services": services,
        "stats": stats,
        "features": PLAN_FEATURES.get(tenant.get("plan", "starter"), PLAN_FEATURES["starter"])
    }

@api_router.post("/admin/tenants")
async def admin_create_tenant(body: Dict[str, Any], admin: Dict = Depends(get_super_admin)):
    """Create a new tenant with owner (super admin only)"""
    # Validate required fields
    required = ["business_name", "industry", "owner_name", "owner_email", "owner_password", "plan"]
    for field in required:
        if field not in body:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
    
    # Check if owner email exists
    existing = await db.users.find_one({"email": body["owner_email"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create tenant
    tenant_id = f"tenant_{uuid.uuid4().hex[:12]}"
    slug = body["business_name"].lower().replace(" ", "-").replace("'", "")[:30] + "-" + tenant_id[-6:]
    
    tenant = {
        "tenant_id": tenant_id,
        "name": body["business_name"],
        "industry": body["industry"],
        "email": body.get("business_email", body["owner_email"]),
        "phone": body.get("phone"),
        "address": body.get("address"),
        "timezone": body.get("timezone", "Europe/Dublin"),
        "currency": body.get("currency", "EUR"),
        "plan": body["plan"],
        "logo_url": body.get("logo_url"),
        "booking_url_slug": slug,
        "is_active": body.get("is_active", True),
        "onboarding_completed": True,
        "settings": body.get("settings", {}),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tenants.insert_one({**tenant})
    
    # Create owner user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user = {
        "user_id": user_id,
        "email": body["owner_email"],
        "name": body["owner_name"],
        "picture": None,
        "tenant_id": tenant_id,
        "role": "owner",
        "is_active": True,
        "password_hash": hash_password(body["owner_password"]),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one({**user})
    
    # Create default message templates
    templates = [
        {
            "template_id": f"template_{uuid.uuid4().hex[:12]}",
            "tenant_id": tenant_id,
            "name": "Booking Confirmation",
            "type": "email",
            "trigger": "booking_confirmation",
            "subject": "Your appointment is confirmed",
            "content": "Hi {client_name}, your appointment for {service_name} on {date} at {time} has been confirmed.",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "template_id": f"template_{uuid.uuid4().hex[:12]}",
            "tenant_id": tenant_id,
            "name": "Appointment Reminder",
            "type": "email",
            "trigger": "reminder",
            "subject": "Reminder: Your appointment is tomorrow",
            "content": "Hi {client_name}, this is a reminder for your appointment tomorrow at {time}.",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.message_templates.insert_many(templates)
    
    return {
        "tenant": tenant,
        "owner": {"user_id": user_id, "email": user["email"], "name": user["name"]},
        "features": PLAN_FEATURES.get(body["plan"], PLAN_FEATURES["starter"])
    }

@api_router.put("/admin/tenants/{tenant_id}")
async def admin_update_tenant(tenant_id: str, updates: Dict[str, Any], admin: Dict = Depends(get_super_admin)):
    """Update tenant (super admin only)"""
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Handle plan change
    old_plan = tenant.get("plan", "starter")
    new_plan = updates.get("plan", old_plan)
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Remove fields that shouldn't be updated directly
    updates.pop("tenant_id", None)
    updates.pop("created_at", None)
    
    await db.tenants.update_one(
        {"tenant_id": tenant_id},
        {"$set": updates}
    )
    
    updated = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0})
    
    return {
        "tenant": updated,
        "features": PLAN_FEATURES.get(new_plan, PLAN_FEATURES["starter"]),
        "plan_changed": old_plan != new_plan
    }

@api_router.delete("/admin/tenants/{tenant_id}")
async def admin_delete_tenant(tenant_id: str, admin: Dict = Depends(get_super_admin)):
    """Deactivate tenant (super admin only) - soft delete"""
    result = await db.tenants.update_one(
        {"tenant_id": tenant_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Also deactivate all users for this tenant
    await db.users.update_many(
        {"tenant_id": tenant_id},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "Tenant deactivated"}

@api_router.post("/admin/tenants/{tenant_id}/activate")
async def admin_activate_tenant(tenant_id: str, admin: Dict = Depends(get_super_admin)):
    """Reactivate tenant (super admin only)"""
    result = await db.tenants.update_one(
        {"tenant_id": tenant_id},
        {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Also reactivate owner
    await db.users.update_one(
        {"tenant_id": tenant_id, "role": "owner"},
        {"$set": {"is_active": True}}
    )
    
    return {"message": "Tenant activated"}

@api_router.get("/admin/stats")
async def admin_get_stats(admin: Dict = Depends(get_super_admin)):
    """Get platform-wide statistics (super admin only)"""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Tenant stats
    total_tenants = await db.tenants.count_documents({})
    active_tenants = await db.tenants.count_documents({"is_active": True})
    
    # Plan distribution
    starter_count = await db.tenants.count_documents({"plan": "starter", "is_active": True})
    growth_count = await db.tenants.count_documents({"plan": "growth", "is_active": True})
    pro_count = await db.tenants.count_documents({"plan": "pro", "is_active": True})
    
    # Calculate MRR
    mrr = (starter_count * 29) + (growth_count * 79) + (pro_count * 149)
    
    # User stats
    total_users = await db.users.count_documents({})
    
    # Appointment stats
    total_appointments = await db.appointments.count_documents({})
    month_appointments = await db.appointments.count_documents({"created_at": {"$gte": month_start}})
    
    # New tenants this month
    new_tenants = await db.tenants.count_documents({"created_at": {"$gte": month_start}})
    
    return {
        "tenants": {
            "total": total_tenants,
            "active": active_tenants,
            "inactive": total_tenants - active_tenants,
            "new_this_month": new_tenants
        },
        "plans": {
            "starter": starter_count,
            "growth": growth_count,
            "pro": pro_count
        },
        "revenue": {
            "mrr": mrr,
            "currency": "EUR"
        },
        "users": {
            "total": total_users
        },
        "appointments": {
            "total": total_appointments,
            "this_month": month_appointments
        }
    }

@api_router.post("/admin/impersonate/{user_id}")
async def admin_impersonate_user(user_id: str, response: Response, admin: Dict = Depends(get_super_admin)):
    """Impersonate a user (super admin only) - for support purposes"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create a session for the user
    token = create_jwt_token(user["user_id"], user.get("tenant_id"))
    
    # Store impersonation record for audit
    await db.impersonation_logs.insert_one({
        "admin_id": admin["admin_id"],
        "user_id": user_id,
        "tenant_id": user.get("tenant_id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=JWT_EXPIRATION_HOURS * 3600
    )
    
    return {
        "user": {k: v for k, v in user.items() if k != "password_hash"},
        "token": token,
        "message": "Now impersonating user"
    }

# Include router
app.include_router(api_router)

# CORS
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
