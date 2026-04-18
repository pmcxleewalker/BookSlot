from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query, File, UploadFile
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
import hashlib
import hmac
import asyncio
import json
import re
import requests

# Resend and Twilio imports (optional - graceful fallback if not configured)
try:
    import resend
    RESEND_AVAILABLE = True
except ImportError:
    RESEND_AVAILABLE = False

try:
    from twilio.rest import Client as TwilioClient
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False

# Emergent LLM integration for Moltbot AI
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    MOLTBOT_LLM_AVAILABLE = True
except ImportError:
    MOLTBOT_LLM_AVAILABLE = False

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'bookslot-secret-key-change-in-production')

# Email Configuration (Resend)
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_AVAILABLE and RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER', '')
twilio_client = None
if TWILIO_AVAILABLE and TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# Moltbot AI Configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
MOLTBOT_ENABLED = os.environ.get('MOLTBOT_ENABLED', 'true').lower() == 'true'

# Object Storage Configuration
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "bookslot"
storage_key = None

def init_storage():
    """Initialize object storage - call once at startup"""
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_LLM_KEY:
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logging.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload file to object storage"""
    key = init_storage()
    if not key:
        raise Exception("Storage not initialized")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple:
    """Download file from object storage"""
    key = init_storage()
    if not key:
        raise Exception("Storage not initialized")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

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

# Working Hours Schema
DEFAULT_WORKING_HOURS = {
    "monday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
    "tuesday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
    "wednesday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
    "thursday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
    "friday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
    "saturday": {"enabled": False, "start": "10:00", "end": "16:00", "breaks": []},
    "sunday": {"enabled": False, "start": "10:00", "end": "16:00", "breaks": []}
}

# SMS Add-on Configuration
SMS_ADDON_PRICE = 10  # €10/month

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
    # Add-ons
    sms_addon_enabled: bool = False
    sms_addon_activated_at: Optional[datetime] = None
    # Notification settings
    email_reminders_enabled: bool = True
    sms_reminders_enabled: bool = False
    reminder_hours_before: int = 24
    # Custom Branding (Salon Package)
    branding: Dict[str, Any] = Field(default_factory=lambda: {
        "primary_color": "#E34A33",
        "secondary_color": "#0A0A0A", 
        "accent_color": "#4F46E5",
        "show_powered_by": True  # "Powered by BookSlot"
    })

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
    working_hours: Dict[str, Any] = Field(default_factory=lambda: DEFAULT_WORKING_HOURS.copy())
    # Permissions
    role: str = "staff"  # "admin" or "staff"
    can_view_all_bookings: bool = False
    can_edit_services: bool = False
    can_manage_staff: bool = False
    can_view_reports: bool = False
    can_manage_customers: bool = True

class StaffCreate(StaffBase):
    password: Optional[str] = None  # For creating staff login

class Staff(StaffBase):
    model_config = ConfigDict(extra="ignore")
    staff_id: str = Field(default_factory=lambda: f"staff_{uuid.uuid4().hex[:12]}")
    tenant_id: str
    user_id: Optional[str] = None  # Linked user account for login
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Time blocks (annual leave, lunch, unavailable)
    time_blocks: List[Dict[str, Any]] = Field(default_factory=list)

# Time Block Types
class TimeBlockType(str, Enum):
    ANNUAL_LEAVE = "annual_leave"
    LUNCH = "lunch"
    UNAVAILABLE = "unavailable"
    BREAK = "break"

class TimeBlock(BaseModel):
    block_id: str = Field(default_factory=lambda: f"block_{uuid.uuid4().hex[:8]}")
    staff_id: str
    tenant_id: str
    block_type: TimeBlockType
    title: str
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    start_time: Optional[str] = None  # HH:MM (for lunch/breaks)
    end_time: Optional[str] = None
    all_day: bool = False
    recurring: bool = False  # For daily lunch breaks
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

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
    # Salon Package enhancements
    is_vip: bool = False
    preferred_staff_id: Optional[str] = None
    service_notes: Optional[str] = None  # Notes about services they prefer
    important_info: Optional[str] = None  # Allergies, preferences, etc.
    birthday: Optional[str] = None  # YYYY-MM-DD
    marketing_consent: bool = True

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
    # Service history
    service_history: List[Dict[str, Any]] = Field(default_factory=list)  # [{service_name, date, staff, notes}]

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

# ================== NO-SHOW SHIELD MODELS ==================

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class WaitlistStatus(str, Enum):
    ACTIVE = "active"
    PROMOTED = "promoted"
    EXPIRED = "expired"
    CANCELLED = "cancelled"

class WaitlistEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    waitlist_id: str = Field(default_factory=lambda: f"wl_{uuid.uuid4().hex[:12]}")
    tenant_id: str
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    service_id: Optional[str] = None
    preferred_staff_id: Optional[str] = None
    preferred_dates: List[str] = Field(default_factory=list)  # YYYY-MM-DD
    preferred_times: List[str] = Field(default_factory=list)  # HH:MM
    flexible_dates: bool = True
    flexible_times: bool = True
    notes: Optional[str] = None
    status: WaitlistStatus = WaitlistStatus.ACTIVE
    promoted_to_appointment_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    notified_at: Optional[datetime] = None

class PushSubscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    subscription_id: str = Field(default_factory=lambda: f"push_{uuid.uuid4().hex[:12]}")
    tenant_id: str
    client_id: Optional[str] = None
    appointment_id: Optional[str] = None
    endpoint: str
    keys: Dict[str, str]  # p256dh, auth
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_used: Optional[datetime] = None

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

# ================== NO-SHOW SHIELD - RISK SCORING ENGINE ==================

async def calculate_risk_score(tenant_id: str, appointment_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    AI-powered risk scoring for no-shows.
    Analyzes multiple factors to predict probability of no-show.
    Returns: {score: 0-100, level: low/medium/high, factors: [...]}
    """
    risk_factors = []
    base_score = 0
    
    client_email = appointment_data.get("client_email")
    client_phone = appointment_data.get("client_phone")
    client_name = appointment_data.get("client_name", "")
    start_time = appointment_data.get("start_time")
    service_id = appointment_data.get("service_id")
    staff_id = appointment_data.get("staff_id")
    
    # Convert start_time to datetime if string
    if isinstance(start_time, str):
        start_time = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
    
    # 1. Client History Analysis (most important factor)
    if client_email or client_phone:
        query = {"tenant_id": tenant_id}
        if client_email:
            query["client_email"] = client_email
        elif client_phone:
            query["client_phone"] = client_phone
        
        # Get client's appointment history
        past_appointments = await db.appointments.find(query, {"_id": 0}).to_list(100)
        
        if len(past_appointments) > 0:
            # Calculate no-show rate
            total = len(past_appointments)
            no_shows = sum(1 for a in past_appointments if a.get("status") == "no_show")
            cancelled_late = sum(1 for a in past_appointments if a.get("status") == "cancelled" and a.get("cancelled_late", False))
            
            no_show_rate = (no_shows + cancelled_late * 0.5) / total
            
            if no_show_rate > 0.3:
                base_score += 40
                risk_factors.append({"factor": "high_no_show_history", "impact": 40, "detail": f"{int(no_show_rate*100)}% no-show rate"})
            elif no_show_rate > 0.15:
                base_score += 25
                risk_factors.append({"factor": "moderate_no_show_history", "impact": 25, "detail": f"{int(no_show_rate*100)}% no-show rate"})
            elif no_show_rate > 0:
                base_score += 10
                risk_factors.append({"factor": "some_no_show_history", "impact": 10, "detail": f"{int(no_show_rate*100)}% no-show rate"})
            
            # Check if loyal client (reduces risk)
            if total >= 5 and no_show_rate < 0.1:
                base_score -= 15
                risk_factors.append({"factor": "loyal_client", "impact": -15, "detail": f"{total} visits, excellent history"})
        else:
            # First-time client - moderate risk
            base_score += 15
            risk_factors.append({"factor": "first_time_client", "impact": 15, "detail": "No booking history"})
    else:
        # No contact info - high risk
        base_score += 20
        risk_factors.append({"factor": "no_contact_info", "impact": 20, "detail": "Cannot send reminders"})
    
    # 2. Day of Week Analysis
    if start_time:
        day_of_week = start_time.weekday()
        
        # Monday mornings and Friday evenings have higher no-show rates
        if day_of_week == 0 and start_time.hour < 11:  # Monday morning
            base_score += 10
            risk_factors.append({"factor": "monday_morning", "impact": 10, "detail": "Higher no-show day/time"})
        elif day_of_week == 4 and start_time.hour >= 17:  # Friday evening
            base_score += 8
            risk_factors.append({"factor": "friday_evening", "impact": 8, "detail": "Weekend plans often interfere"})
    
    # 3. Lead Time Analysis (how far in advance was booking made)
    if start_time:
        now = datetime.now(timezone.utc)
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        days_until = (start_time - now).days
        
        if days_until > 30:
            base_score += 20
            risk_factors.append({"factor": "far_advance_booking", "impact": 20, "detail": f"Booked {days_until} days ahead"})
        elif days_until > 14:
            base_score += 10
            risk_factors.append({"factor": "advance_booking", "impact": 10, "detail": f"Booked {days_until} days ahead"})
    
    # 4. Time of Day Analysis
    if start_time:
        hour = start_time.hour
        if hour < 9:  # Early morning
            base_score += 8
            risk_factors.append({"factor": "early_appointment", "impact": 8, "detail": "Before 9 AM"})
        elif hour >= 19:  # Late evening
            base_score += 5
            risk_factors.append({"factor": "late_appointment", "impact": 5, "detail": "After 7 PM"})
    
    # 5. Booking Source Analysis
    source = appointment_data.get("source", "online")
    if source == "online":
        base_score += 5
        risk_factors.append({"factor": "online_booking", "impact": 5, "detail": "Online bookings have slightly higher no-show rate"})
    elif source == "admin":
        base_score -= 5
        risk_factors.append({"factor": "staff_booking", "impact": -5, "detail": "Staff-created bookings are more reliable"})
    
    # 6. Service-specific analysis
    if service_id:
        # Check historical no-show rate for this service
        service_appointments = await db.appointments.find({
            "tenant_id": tenant_id,
            "service_id": service_id,
            "status": {"$in": ["completed", "no_show", "cancelled"]}
        }, {"_id": 0}).to_list(200)
        
        if len(service_appointments) >= 10:
            service_no_shows = sum(1 for a in service_appointments if a.get("status") == "no_show")
            service_no_show_rate = service_no_shows / len(service_appointments)
            
            if service_no_show_rate > 0.2:
                base_score += 10
                risk_factors.append({"factor": "high_risk_service", "impact": 10, "detail": f"Service has {int(service_no_show_rate*100)}% no-show rate"})
    
    # Ensure score is between 0-100
    final_score = max(0, min(100, base_score))
    
    # Determine risk level
    if final_score >= 50:
        risk_level = "high"
    elif final_score >= 25:
        risk_level = "medium"
    else:
        risk_level = "low"
    
    return {
        "score": final_score,
        "level": risk_level,
        "factors": risk_factors
    }

async def auto_promote_waitlist(tenant_id: str, appointment: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    When a high-risk appointment is detected, find matching waitlist entries
    and notify them about potential availability.
    """
    start_time = appointment.get("start_time")
    service_id = appointment.get("service_id")
    staff_id = appointment.get("staff_id")
    
    if isinstance(start_time, str):
        start_time = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
    
    appointment_date = start_time.strftime("%Y-%m-%d") if start_time else None
    appointment_time = start_time.strftime("%H:%M") if start_time else None
    
    # Find matching waitlist entries
    query = {
        "tenant_id": tenant_id,
        "status": "active"
    }
    
    waitlist_entries = await db.waitlist.find(query, {"_id": 0}).to_list(50)
    
    matches = []
    for entry in waitlist_entries:
        score = 0
        
        # Check date match
        if entry.get("flexible_dates") or (appointment_date and appointment_date in entry.get("preferred_dates", [])):
            score += 30
        
        # Check time match
        if entry.get("flexible_times") or (appointment_time and appointment_time in entry.get("preferred_times", [])):
            score += 20
        
        # Check service match
        if not entry.get("service_id") or entry.get("service_id") == service_id:
            score += 25
        
        # Check staff match
        if not entry.get("preferred_staff_id") or entry.get("preferred_staff_id") == staff_id:
            score += 25
        
        if score >= 50:  # Good enough match
            matches.append({"entry": entry, "match_score": score})
    
    # Sort by match score
    matches.sort(key=lambda x: x["match_score"], reverse=True)
    
    return matches[0]["entry"] if matches else None

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

class TenantLogin(BaseModel):
    email: str
    password: str
    tenant_slug: str

@api_router.post("/auth/tenant-login")
async def tenant_login(credentials: TenantLogin, response: Response):
    """Login with email/password for a specific tenant"""
    # Find tenant by slug
    tenant = await db.tenants.find_one({"booking_url_slug": credentials.tenant_slug, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Find user in this tenant
    user = await db.users.find_one({
        "email": credentials.email, 
        "tenant_id": tenant["tenant_id"]
    }, {"_id": 0})
    
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
        "token": token,
        "tenant_slug": credentials.tenant_slug
    }

@api_router.get("/public/tenant/{slug}")
async def get_public_tenant_info(slug: str):
    """Get public tenant info by slug"""
    tenant = await db.tenants.find_one({"booking_url_slug": slug, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Check if AI receptionist is enabled (growth/pro tiers)
    plan = tenant.get("plan", "starter")
    ai_receptionist_enabled = plan in ["growth", "pro"]
    
    return {
        "name": tenant.get("name"),
        "industry": tenant.get("industry"),
        "branding": tenant.get("branding", {}),
        "booking_url_slug": tenant.get("booking_url_slug"),
        "tenant_id": tenant.get("tenant_id"),
        "ai_receptionist_enabled": ai_receptionist_enabled
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

@api_router.put("/tenants/me/branding")
async def update_tenant_branding(branding: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Update tenant branding (colors, logo, etc.)"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=404, detail="No business found")
    
    allowed_fields = ["business_name", "primary_color", "secondary_color", "accent_color", "show_powered_by"]
    clean_branding = {k: v for k, v in branding.items() if k in allowed_fields}
    
    await db.tenants.update_one(
        {"tenant_id": user["tenant_id"]},
        {"$set": {"branding": clean_branding, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    return {"branding": tenant.get("branding", {})}

@api_router.get("/tenants/me/branding")
async def get_tenant_branding(user: Dict = Depends(get_current_user)):
    """Get tenant branding settings"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=404, detail="No business found")
    
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    default_branding = {
        "primary_color": "#E34A33",
        "secondary_color": "#0A0A0A",
        "accent_color": "#4F46E5",
        "show_powered_by": True
    }
    
    return {"branding": tenant.get("branding", default_branding), "logo_url": tenant.get("logo_url")}

# ================== FILE UPLOAD ==================

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

@api_router.post("/upload/image")
async def upload_image(file: UploadFile = File(...), user: Dict = Depends(get_current_user)):
    """Upload image file (logo, etc.)"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    # Validate file extension
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Read and validate size
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 5MB allowed.")
    
    # Generate storage path
    file_id = uuid.uuid4().hex
    path = f"{APP_NAME}/uploads/{user['tenant_id']}/{file_id}.{ext}"
    
    # Determine content type
    content_types = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
        "gif": "image/gif", "webp": "image/webp"
    }
    content_type = content_types.get(ext, "application/octet-stream")
    
    try:
        result = put_object(path, data, content_type)
        
        # Store reference in database
        file_record = {
            "file_id": file_id,
            "tenant_id": user["tenant_id"],
            "storage_path": result["path"],
            "original_filename": file.filename,
            "content_type": content_type,
            "size": result.get("size", len(data)),
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.files.insert_one({**file_record})
        
        return {
            "file_id": file_id,
            "path": result["path"],
            "url": f"/api/files/{file_id}"
        }
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Upload failed")

@api_router.get("/files/{file_id}")
async def get_file(file_id: str, auth: str = Query(None)):
    """Get uploaded file"""
    # Find file record
    record = await db.files.find_one({"file_id": file_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        data, content_type = get_object(record["storage_path"])
        return Response(content=data, media_type=record.get("content_type", content_type))
    except Exception as e:
        logger.error(f"File retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="File retrieval failed")

# ================== NOTIFICATIONS SYSTEM ==================

@api_router.get("/notifications")
async def get_notifications(user: Dict = Depends(get_current_user), limit: int = 20, unread_only: bool = False):
    """Get notifications for current user/tenant"""
    if not user.get("tenant_id"):
        return {"notifications": [], "unread_count": 0}
    
    query = {"tenant_id": user["tenant_id"]}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    unread_count = await db.notifications.count_documents({
        "tenant_id": user["tenant_id"],
        "read": False
    })
    
    return {"notifications": notifications, "unread_count": unread_count}

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: Dict = Depends(get_current_user)):
    """Mark notification as read"""
    await db.notifications.update_one(
        {"notification_id": notification_id, "tenant_id": user.get("tenant_id")},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Marked as read"}

@api_router.post("/notifications/read-all")
async def mark_all_notifications_read(user: Dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    if not user.get("tenant_id"):
        return {"message": "No notifications"}
    
    await db.notifications.update_many(
        {"tenant_id": user["tenant_id"], "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "All marked as read"}

async def create_notification(tenant_id: str, notif_type: str, title: str, message: str, data: Dict = None):
    """Create a notification for a tenant"""
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "tenant_id": tenant_id,
        "type": notif_type,  # booking, cancellation, approval_needed, etc.
        "title": title,
        "message": message,
        "data": data or {},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one({**notification})
    return notification

# ================== SMART BOOKING (Staff Recommendations) ==================

@api_router.get("/public/booking/{slug}/smart-availability")
async def get_smart_availability(
    slug: str,
    service_id: str,
    preferred_staff_id: Optional[str] = None,
    date: str = None
):
    """Get availability with staff recommendations if preferred is unavailable"""
    tenant = await db.tenants.find_one({"booking_url_slug": slug, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    service = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    duration = service.get("duration", 30)
    
    # Get all staff who can perform this service
    all_staff = await db.staff.find({"tenant_id": tenant["tenant_id"], "is_active": True}, {"_id": 0}).to_list(100)
    eligible_staff = [s for s in all_staff if not s.get("services") or service_id in s.get("services", [])]
    
    if not eligible_staff:
        return {"available": False, "message": "No staff available for this service", "alternatives": []}
    
    # Get existing appointments for the day
    start_of_day = f"{date}T00:00:00"
    end_of_day = f"{date}T23:59:59"
    
    existing_appointments = await db.appointments.find({
        "tenant_id": tenant["tenant_id"],
        "status": {"$nin": ["cancelled"]},
        "start_time": {"$gte": start_of_day, "$lte": end_of_day}
    }, {"_id": 0}).to_list(500)
    
    # Get time blocks (leave, lunch, etc.)
    time_blocks = await db.time_blocks.find({
        "tenant_id": tenant["tenant_id"],
        "$or": [
            {"start_date": {"$lte": date}, "end_date": {"$gte": date}},
            {"start_date": date}
        ]
    }, {"_id": 0}).to_list(200)
    
    # Build availability map for each staff
    staff_availability = {}
    
    for staff in eligible_staff:
        staff_id = staff["staff_id"]
        working_hours = staff.get("working_hours", {})
        
        # Get day of week
        try:
            date_obj = datetime.strptime(date, "%Y-%m-%d")
            day_name = date_obj.strftime("%A").lower()
        except:
            continue
        
        day_schedule = working_hours.get(day_name, {"enabled": True, "start": "09:00", "end": "17:00"})
        
        if not day_schedule.get("enabled", True):
            staff_availability[staff_id] = {"available": False, "reason": "Not working this day", "slots": []}
            continue
        
        # Check for time blocks (leave, etc.)
        staff_blocked = False
        for block in time_blocks:
            if block.get("staff_id") == staff_id and block.get("all_day"):
                staff_blocked = True
                break
        
        if staff_blocked:
            staff_availability[staff_id] = {"available": False, "reason": "On leave", "slots": []}
            continue
        
        # Calculate available slots
        start_hour, start_min = map(int, day_schedule.get("start", "09:00").split(":"))
        end_hour, end_min = map(int, day_schedule.get("end", "17:00").split(":"))
        
        slots = []
        current = datetime(date_obj.year, date_obj.month, date_obj.day, start_hour, start_min)
        end_time = datetime(date_obj.year, date_obj.month, date_obj.day, end_hour, end_min)
        
        while current < end_time:
            slot_start = current.strftime(f"{date}T%H:%M:%S")
            slot_end = (current + timedelta(minutes=duration)).strftime(f"{date}T%H:%M:%S")
            
            # Check for conflicts
            conflict = False
            for appt in existing_appointments:
                if appt.get("staff_id") == staff_id:
                    if appt["start_time"] < slot_end and appt["end_time"] > slot_start:
                        conflict = True
                        break
            
            if not conflict:
                slots.append({"start": slot_start, "end": slot_end})
            
            current += timedelta(minutes=30)
        
        staff_availability[staff_id] = {
            "available": len(slots) > 0,
            "slots": slots,
            "staff_name": staff["name"],
            "staff_title": staff.get("title", "")
        }
    
    # Check preferred staff first
    preferred_available = False
    preferred_slots = []
    
    if preferred_staff_id and preferred_staff_id in staff_availability:
        pref = staff_availability[preferred_staff_id]
        preferred_available = pref["available"]
        preferred_slots = pref.get("slots", [])
    
    # Build alternatives if preferred not available
    alternatives = []
    if not preferred_available or not preferred_slots:
        for staff_id, avail in staff_availability.items():
            if staff_id != preferred_staff_id and avail["available"] and avail.get("slots"):
                alternatives.append({
                    "staff_id": staff_id,
                    "staff_name": avail["staff_name"],
                    "staff_title": avail.get("staff_title", ""),
                    "available_slots": avail["slots"][:5]  # First 5 slots
                })
    
    # Suggest alternative days if no one available today
    alternative_days = []
    if not preferred_available and not alternatives:
        for days_ahead in range(1, 8):  # Check next 7 days
            future_date = (datetime.strptime(date, "%Y-%m-%d") + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
            alternative_days.append(future_date)
    
    return {
        "date": date,
        "service": service["name"],
        "preferred_staff_available": preferred_available,
        "preferred_slots": preferred_slots[:10] if preferred_slots else [],
        "alternative_staff": alternatives[:3],  # Top 3 alternatives
        "alternative_days": alternative_days[:5] if alternative_days else [],
        "message": "Preferred staff available" if preferred_available else "Preferred staff unavailable - see alternatives"
    }

# ================== BOOKING APPROVAL SYSTEM ==================

@api_router.get("/appointments/pending-approval")
async def get_pending_approvals(user: Dict = Depends(get_current_user)):
    """Get appointments pending approval"""
    if not user.get("tenant_id"):
        return {"appointments": []}
    
    # Get tenant settings for approval threshold
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    approval_threshold = tenant.get("settings", {}).get("approval_threshold_minutes", 60)
    
    # Find pending appointments
    appointments = await db.appointments.find({
        "tenant_id": user["tenant_id"],
        "status": "pending_approval"
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with service and staff names
    services = {s["service_id"]: s for s in await db.services.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).to_list(100)}
    staff = {s["staff_id"]: s for s in await db.staff.find({"tenant_id": user["tenant_id"]}, {"_id": 0}).to_list(100)}
    
    for appt in appointments:
        appt["service_name"] = services.get(appt.get("service_id"), {}).get("name", "Unknown")
        appt["staff_name"] = staff.get(appt.get("staff_id"), {}).get("name", "Unknown")
    
    return {"appointments": appointments, "approval_threshold": approval_threshold}

# Note: approve/reject endpoints moved to smart booking section

@api_router.put("/tenants/me/settings/approval")
async def update_approval_settings(body: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Update approval threshold settings"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    threshold = body.get("approval_threshold_minutes", 60)
    
    await db.tenants.update_one(
        {"tenant_id": user["tenant_id"]},
        {"$set": {"settings.approval_threshold_minutes": threshold}}
    )
    
    return {"message": "Settings updated", "approval_threshold_minutes": threshold}

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

# ================== STAFF LOGIN & ACCOUNTS ==================

@api_router.post("/staff/{staff_id}/create-account")
async def create_staff_account(staff_id: str, body: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Create login account for staff member (Admin only)"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    # Check admin permission
    current_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if current_user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    staff = await db.staff.find_one({"staff_id": staff_id, "tenant_id": user["tenant_id"]}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    if staff.get("user_id"):
        raise HTTPException(status_code=400, detail="Staff already has an account")
    
    password = body.get("password")
    if not password or len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Create user account for staff
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    new_user = User(
        email=staff["email"],
        name=staff["name"],
        tenant_id=user["tenant_id"],
        role=UserRole.STAFF
    )
    user_dict = new_user.model_dump()
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    user_dict["password_hash"] = hashed_password
    
    await db.users.insert_one({**user_dict})
    
    # Link staff to user account
    await db.staff.update_one(
        {"staff_id": staff_id},
        {"$set": {"user_id": new_user.user_id}}
    )
    
    return {"message": "Account created", "user_id": new_user.user_id, "email": staff["email"]}

@api_router.post("/staff/login")
async def staff_login(body: UserLogin):
    """Staff member login"""
    user = await db.users.find_one({"email": body.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(body.password.encode('utf-8'), user.get("password_hash", "").encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")
    
    # Get staff record for permissions
    staff = await db.staff.find_one({"user_id": user["user_id"], "tenant_id": user.get("tenant_id")}, {"_id": 0})
    
    # Generate token
    token = jwt.encode(
        {"user_id": user["user_id"], "tenant_id": user.get("tenant_id"), "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)},
        JWT_SECRET, algorithm=JWT_ALGORITHM
    )
    
    return {
        "token": token,
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "staff"),
            "tenant_id": user.get("tenant_id")
        },
        "staff": staff,
        "permissions": {
            "can_view_all_bookings": staff.get("can_view_all_bookings", False) if staff else False,
            "can_edit_services": staff.get("can_edit_services", False) if staff else False,
            "can_manage_staff": staff.get("can_manage_staff", False) if staff else False,
            "can_view_reports": staff.get("can_view_reports", False) if staff else False,
            "can_manage_customers": staff.get("can_manage_customers", True) if staff else True
        }
    }

@api_router.put("/staff/{staff_id}/permissions")
async def update_staff_permissions(staff_id: str, permissions: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Update staff permissions (Admin only)"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    current_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if current_user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    allowed_permissions = ["can_view_all_bookings", "can_edit_services", "can_manage_staff", "can_view_reports", "can_manage_customers", "role"]
    updates = {k: v for k, v in permissions.items() if k in allowed_permissions}
    
    await db.staff.update_one(
        {"staff_id": staff_id, "tenant_id": user["tenant_id"]},
        {"$set": updates}
    )
    
    staff = await db.staff.find_one({"staff_id": staff_id}, {"_id": 0})
    return {"staff": staff}

@api_router.put("/staff/{staff_id}/change-password")
async def change_staff_password(staff_id: str, body: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Change staff password (Admin or self)"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    staff = await db.staff.find_one({"staff_id": staff_id, "tenant_id": user["tenant_id"]}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    # Check permission (admin can change any, staff can change own)
    current_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    is_admin = current_user.get("role") in ["owner", "admin"]
    is_self = staff.get("user_id") == user["user_id"]
    
    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not staff.get("user_id"):
        raise HTTPException(status_code=400, detail="Staff has no account")
    
    new_password = body.get("new_password")
    if not new_password or len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    await db.users.update_one(
        {"user_id": staff["user_id"]},
        {"$set": {"password_hash": hashed}}
    )
    
    return {"message": "Password changed"}

# ================== TIME BLOCKS (Leave, Lunch, Unavailable) ==================

@api_router.get("/staff/{staff_id}/time-blocks")
async def get_staff_time_blocks(staff_id: str, user: Dict = Depends(get_current_user), start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get time blocks for staff member"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    query = {"staff_id": staff_id, "tenant_id": user["tenant_id"]}
    if start_date and end_date:
        query["$or"] = [
            {"start_date": {"$gte": start_date, "$lte": end_date}},
            {"end_date": {"$gte": start_date, "$lte": end_date}}
        ]
    
    blocks = await db.time_blocks.find(query, {"_id": 0}).to_list(200)
    return {"time_blocks": blocks}

@api_router.post("/staff/{staff_id}/time-blocks")
async def create_time_block(staff_id: str, block_data: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Create time block (annual leave, lunch, unavailable)"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    staff = await db.staff.find_one({"staff_id": staff_id, "tenant_id": user["tenant_id"]}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    block = TimeBlock(
        staff_id=staff_id,
        tenant_id=user["tenant_id"],
        block_type=block_data.get("block_type", "unavailable"),
        title=block_data.get("title", "Blocked"),
        start_date=block_data.get("start_date"),
        end_date=block_data.get("end_date"),
        start_time=block_data.get("start_time"),
        end_time=block_data.get("end_time"),
        all_day=block_data.get("all_day", False),
        recurring=block_data.get("recurring", False),
        notes=block_data.get("notes")
    )
    
    block_dict = block.model_dump()
    await db.time_blocks.insert_one({**block_dict})
    
    return {"time_block": block_dict}

@api_router.delete("/time-blocks/{block_id}")
async def delete_time_block(block_id: str, user: Dict = Depends(get_current_user)):
    """Delete time block"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    result = await db.time_blocks.delete_one({"block_id": block_id, "tenant_id": user["tenant_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Block not found")
    
    return {"message": "Block deleted"}

@api_router.get("/time-blocks")
async def get_all_time_blocks(user: Dict = Depends(get_current_user), start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get all time blocks for tenant"""
    if not user.get("tenant_id"):
        return {"time_blocks": []}
    
    query = {"tenant_id": user["tenant_id"]}
    if start_date and end_date:
        query["$or"] = [
            {"start_date": {"$gte": start_date, "$lte": end_date}},
            {"end_date": {"$gte": start_date, "$lte": end_date}}
        ]
    
    blocks = await db.time_blocks.find(query, {"_id": 0}).to_list(500)
    return {"time_blocks": blocks}

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
    
    # Check if AI receptionist is enabled (growth/pro tiers)
    plan = tenant.get("plan", "starter")
    ai_receptionist_enabled = plan in ["growth", "pro"]
    
    # Remove sensitive data
    tenant_public = {
        "name": tenant["name"],
        "industry": tenant["industry"],
        "logo_url": tenant.get("logo_url"),
        "address": tenant.get("address"),
        "phone": tenant.get("phone"),
        "timezone": tenant.get("timezone"),
        "branding": tenant.get("branding", {}),
        "booking_url_slug": slug,
        "ai_receptionist_enabled": ai_receptionist_enabled
    }
    
    # Include services info for each staff (which services they can perform)
    staff_public = []
    for s in staff:
        staff_public.append({
            "staff_id": s["staff_id"],
            "name": s["name"],
            "title": s.get("title"),
            "avatar_url": s.get("avatar_url"),
            "services": s.get("services", [])  # List of service_ids this staff can perform
        })
    
    return {
        "tenant": tenant_public,
        "services": services,
        "staff": staff_public
    }

@api_router.get("/public/booking/{slug}/staff-for-service")
async def get_staff_for_service(slug: str, service_id: str):
    """Get staff members who can perform a specific service"""
    tenant = await db.tenants.find_one({"booking_url_slug": slug, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Get all active staff
    all_staff = await db.staff.find({"tenant_id": tenant["tenant_id"], "is_active": True}, {"_id": 0}).to_list(100)
    
    # Filter staff who can perform this service
    # If staff has no services assigned, they can perform all services (backwards compatible)
    # If staff has services assigned, only show if service_id is in their list
    eligible_staff = []
    for s in all_staff:
        staff_services = s.get("services", [])
        if len(staff_services) == 0 or service_id in staff_services:
            eligible_staff.append({
                "staff_id": s["staff_id"],
                "name": s["name"],
                "title": s.get("title"),
                "avatar_url": s.get("avatar_url")
            })
    
    return {"staff": eligible_staff}

@api_router.get("/public/booking/{slug}/availability")
async def get_availability(
    slug: str,
    service_id: str,
    staff_id: str,
    date: str
):
    """Get available time slots for a date based on staff working hours"""
    tenant = await db.tenants.find_one({"booking_url_slug": slug, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    service = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Get staff working hours
    staff = await db.staff.find_one({"staff_id": staff_id, "is_active": True}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    working_hours = staff.get("working_hours", DEFAULT_WORKING_HOURS)
    
    # Get day of week
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        day_name = date_obj.strftime("%A").lower()
    except:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    day_schedule = working_hours.get(day_name, {"enabled": False})
    
    # If staff doesn't work this day, return empty slots
    if not day_schedule.get("enabled", False):
        return {"slots": [], "date": date, "message": "Staff not available on this day"}
    
    # Get working hours for the day
    start_hour, start_min = map(int, day_schedule.get("start", "09:00").split(":"))
    end_hour, end_min = map(int, day_schedule.get("end", "17:00").split(":"))
    
    # Get existing appointments for the day
    start_of_day = f"{date}T00:00:00"
    end_of_day = f"{date}T23:59:59"
    
    existing = await db.appointments.find({
        "tenant_id": tenant["tenant_id"],
        "staff_id": staff_id,
        "status": {"$nin": ["cancelled"]},
        "start_time": {"$gte": start_of_day, "$lte": end_of_day}
    }, {"_id": 0}).to_list(100)
    
    # Parse breaks
    breaks = day_schedule.get("breaks", [])
    
    # Generate available slots based on working hours
    duration = service.get("duration", 30)
    buffer = service.get("buffer_time", 0)
    slots = []
    
    # Generate time slots in 30-minute increments within working hours
    current_time = datetime(date_obj.year, date_obj.month, date_obj.day, start_hour, start_min)
    end_time = datetime(date_obj.year, date_obj.month, date_obj.day, end_hour, end_min)
    
    while current_time < end_time:
        slot_start = current_time
        slot_end = current_time + timedelta(minutes=duration + buffer)
        
        # Check if slot ends within working hours
        if slot_end > end_time:
            break
        
        slot_start_str = slot_start.strftime(f"{date}T%H:%M:%S")
        slot_end_str = slot_end.strftime(f"{date}T%H:%M:%S")
        
        # Check if slot is during a break
        in_break = False
        for brk in breaks:
            brk_start = brk.get("start", "12:00")
            brk_end = brk.get("end", "13:00")
            brk_start_time = datetime.strptime(f"{date} {brk_start}", "%Y-%m-%d %H:%M")
            brk_end_time = datetime.strptime(f"{date} {brk_end}", "%Y-%m-%d %H:%M")
            
            if slot_start < brk_end_time and slot_end > brk_start_time:
                in_break = True
                break
        
        if not in_break:
            # Check if slot conflicts with existing appointments
            conflict = False
            for appt in existing:
                if appt["start_time"] < slot_end_str and appt["end_time"] > slot_start_str:
                    conflict = True
                    break
            
            if not conflict:
                slots.append({
                    "start_time": slot_start_str,
                    "end_time": slot_end_str,
                    "available": True
                })
        
        # Move to next slot (30-minute increments)
        current_time += timedelta(minutes=30)
    
    return {"slots": slots, "date": date, "working_hours": {"start": day_schedule.get("start"), "end": day_schedule.get("end")}}

@api_router.post("/public/booking/{slug}/book")
async def create_public_booking(slug: str, booking_data: Dict[str, Any]):
    """Create a booking from public page with smart validation and suggestions"""
    tenant = await db.tenants.find_one({"booking_url_slug": slug, "is_active": True}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    service = await db.services.find_one({"service_id": booking_data["service_id"]}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    staff = await db.staff.find_one({"staff_id": booking_data["staff_id"]}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    requested_start = booking_data["start_time"]
    requested_end = booking_data["end_time"]
    
    # Parse the requested date/time
    start_dt = datetime.fromisoformat(requested_start)
    date_str = start_dt.strftime("%Y-%m-%d")
    day_of_week = start_dt.strftime("%A").lower()
    
    # Check 1: Staff working hours for that day
    working_hours = staff.get("working_hours", {})
    day_schedule = working_hours.get(day_of_week, {})
    
    if not day_schedule.get("enabled", False):
        # Staff not working that day - suggest alternative days
        alternative_days = await find_alternative_days(tenant["tenant_id"], staff["staff_id"], service, start_dt)
        alternative_staff = await find_available_staff_for_time(tenant["tenant_id"], booking_data["service_id"], requested_start, requested_end)
        
        raise HTTPException(status_code=409, detail={
            "reason": "staff_day_off",
            "message": f"{staff['name']} is not working on {start_dt.strftime('%A, %B %d')}.",
            "alternative_days": alternative_days,
            "alternative_staff": alternative_staff
        })
    
    # Check if requested time is within working hours
    work_start = day_schedule.get("start", "09:00")
    work_end = day_schedule.get("end", "17:00")
    work_start_dt = datetime.strptime(f"{date_str} {work_start}", "%Y-%m-%d %H:%M")
    work_end_dt = datetime.strptime(f"{date_str} {work_end}", "%Y-%m-%d %H:%M")
    end_dt = datetime.fromisoformat(requested_end)
    
    # Make all datetimes naive for comparison (strip timezone info)
    start_dt_naive = start_dt.replace(tzinfo=None) if start_dt.tzinfo else start_dt
    end_dt_naive = end_dt.replace(tzinfo=None) if end_dt.tzinfo else end_dt
    
    if start_dt_naive < work_start_dt or end_dt_naive > work_end_dt:
        alternative_times = await get_available_slots_for_day(tenant["tenant_id"], staff["staff_id"], service, date_str, working_hours)
        alternative_staff = await find_available_staff_for_time(tenant["tenant_id"], booking_data["service_id"], requested_start, requested_end)
        
        raise HTTPException(status_code=409, detail={
            "reason": "outside_working_hours",
            "message": f"{staff['name']} only works from {work_start} to {work_end} on {start_dt.strftime('%A')}.",
            "working_hours": {"start": work_start, "end": work_end},
            "alternative_times": alternative_times[:5],
            "alternative_staff": alternative_staff
        })
    
    # Check 2: Staff on break
    breaks = day_schedule.get("breaks", [])
    for brk in breaks:
        brk_start = datetime.strptime(f"{date_str} {brk.get('start', '12:00')}", "%Y-%m-%d %H:%M")
        brk_end = datetime.strptime(f"{date_str} {brk.get('end', '13:00')}", "%Y-%m-%d %H:%M")
        
        if start_dt_naive < brk_end and end_dt_naive > brk_start:
            alternative_times = await get_available_slots_for_day(tenant["tenant_id"], staff["staff_id"], service, date_str, working_hours)
            alternative_staff = await find_available_staff_for_time(tenant["tenant_id"], booking_data["service_id"], requested_start, requested_end)
            
            raise HTTPException(status_code=409, detail={
                "reason": "staff_on_break",
                "message": f"{staff['name']} has a scheduled break from {brk.get('start')} to {brk.get('end')}.",
                "break_time": {"start": brk.get('start'), "end": brk.get('end')},
                "alternative_times": alternative_times[:5],
                "alternative_staff": alternative_staff
            })
    
    # Check 3: Existing appointment conflict
    conflict = await db.appointments.find_one({
        "tenant_id": tenant["tenant_id"],
        "staff_id": booking_data["staff_id"],
        "status": {"$nin": ["cancelled", "rejected"]},
        "$or": [
            {"start_time": {"$lt": requested_end, "$gte": requested_start}},
            {"end_time": {"$gt": requested_start, "$lte": requested_end}},
            {"$and": [{"start_time": {"$lte": requested_start}}, {"end_time": {"$gte": requested_end}}]}
        ]
    }, {"_id": 0})
    
    if conflict:
        alternative_times = await get_available_slots_for_day(tenant["tenant_id"], staff["staff_id"], service, date_str, working_hours)
        alternative_staff = await find_available_staff_for_time(tenant["tenant_id"], booking_data["service_id"], requested_start, requested_end)
        
        raise HTTPException(status_code=409, detail={
            "reason": "already_booked",
            "message": f"{staff['name']} already has an appointment at this time.",
            "alternative_times": alternative_times[:5],
            "alternative_staff": alternative_staff
        })
    
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
    
    # Create appointment with PENDING status (requires approval)
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
        source="online",
        status="pending"  # Requires approval
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
        "message": "Booking request submitted! Awaiting confirmation from the business.",
        "status": "pending",
        "requires_approval": True
    }

async def find_alternative_days(tenant_id: str, staff_id: str, service: Dict, from_date: datetime, num_days: int = 5) -> List[Dict]:
    """Find alternative days when staff is working"""
    staff = await db.staff.find_one({"staff_id": staff_id}, {"_id": 0})
    if not staff:
        return []
    
    working_hours = staff.get("working_hours", {})
    alternatives = []
    current_date = from_date + timedelta(days=1)
    
    for _ in range(14):  # Look up to 2 weeks ahead
        day_name = current_date.strftime("%A").lower()
        day_schedule = working_hours.get(day_name, {})
        
        if day_schedule.get("enabled", False):
            alternatives.append({
                "date": current_date.strftime("%Y-%m-%d"),
                "day": current_date.strftime("%A"),
                "display": current_date.strftime("%A, %B %d"),
                "working_hours": {"start": day_schedule.get("start"), "end": day_schedule.get("end")}
            })
            
            if len(alternatives) >= num_days:
                break
        
        current_date += timedelta(days=1)
    
    return alternatives

async def find_available_staff_for_time(tenant_id: str, service_id: str, start_time: str, end_time: str) -> List[Dict]:
    """Find other staff members who can perform the service and are available at that time"""
    service = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not service:
        return []
    
    # Get all active staff for this tenant
    all_staff = await db.staff.find({"tenant_id": tenant_id, "is_active": True}, {"_id": 0}).to_list(100)
    available_staff = []
    
    start_dt = datetime.fromisoformat(start_time)
    end_dt = datetime.fromisoformat(end_time)
    date_str = start_dt.strftime("%Y-%m-%d")
    day_of_week = start_dt.strftime("%A").lower()
    
    for staff in all_staff:
        # Check if staff can perform this service
        assigned_services = staff.get("assigned_services", staff.get("services", []))
        if assigned_services and service_id not in assigned_services:
            continue
        
        # Check working hours
        working_hours = staff.get("working_hours", {})
        day_schedule = working_hours.get(day_of_week, {})
        
        if not day_schedule.get("enabled", False):
            continue
        
        work_start = day_schedule.get("start", "09:00")
        work_end = day_schedule.get("end", "17:00")
        work_start_dt = datetime.strptime(f"{date_str} {work_start}", "%Y-%m-%d %H:%M")
        work_end_dt = datetime.strptime(f"{date_str} {work_end}", "%Y-%m-%d %H:%M")
        
        if start_dt < work_start_dt or end_dt > work_end_dt:
            continue
        
        # Check breaks
        in_break = False
        for brk in day_schedule.get("breaks", []):
            brk_start = datetime.strptime(f"{date_str} {brk.get('start', '12:00')}", "%Y-%m-%d %H:%M")
            brk_end = datetime.strptime(f"{date_str} {brk.get('end', '13:00')}", "%Y-%m-%d %H:%M")
            if start_dt < brk_end and end_dt > brk_start:
                in_break = True
                break
        
        if in_break:
            continue
        
        # Check for conflicts
        conflict = await db.appointments.find_one({
            "tenant_id": tenant_id,
            "staff_id": staff["staff_id"],
            "status": {"$nin": ["cancelled", "rejected"]},
            "$or": [
                {"start_time": {"$lt": end_time, "$gte": start_time}},
                {"end_time": {"$gt": start_time, "$lte": end_time}},
                {"$and": [{"start_time": {"$lte": start_time}}, {"end_time": {"$gte": end_time}}]}
            ]
        }, {"_id": 0})
        
        if not conflict:
            available_staff.append({
                "staff_id": staff["staff_id"],
                "name": staff["name"],
                "title": staff.get("title"),
                "avatar_url": staff.get("avatar_url")
            })
    
    return available_staff

async def get_available_slots_for_day(tenant_id: str, staff_id: str, service: Dict, date: str, working_hours: Dict) -> List[Dict]:
    """Get available time slots for a specific staff on a specific day"""
    day_obj = datetime.strptime(date, "%Y-%m-%d")
    day_of_week = day_obj.strftime("%A").lower()
    day_schedule = working_hours.get(day_of_week, {})
    
    if not day_schedule.get("enabled", False):
        return []
    
    work_start = day_schedule.get("start", "09:00")
    work_end = day_schedule.get("end", "17:00")
    start_hour, start_min = map(int, work_start.split(":"))
    end_hour, end_min = map(int, work_end.split(":"))
    
    # Get existing appointments
    existing = await db.appointments.find({
        "tenant_id": tenant_id,
        "staff_id": staff_id,
        "status": {"$nin": ["cancelled", "rejected"]},
        "start_time": {"$gte": f"{date}T00:00:00", "$lte": f"{date}T23:59:59"}
    }, {"_id": 0}).to_list(100)
    
    breaks = day_schedule.get("breaks", [])
    duration = service.get("duration", 30)
    buffer = service.get("buffer_time", 0)
    slots = []
    
    current_time = datetime(day_obj.year, day_obj.month, day_obj.day, start_hour, start_min)
    end_time = datetime(day_obj.year, day_obj.month, day_obj.day, end_hour, end_min)
    
    while current_time < end_time:
        slot_start = current_time
        slot_end = current_time + timedelta(minutes=duration + buffer)
        
        if slot_end > end_time:
            break
        
        slot_start_str = slot_start.strftime(f"{date}T%H:%M:%S")
        slot_end_str = slot_end.strftime(f"{date}T%H:%M:%S")
        
        # Check breaks
        in_break = False
        for brk in breaks:
            brk_start_time = datetime.strptime(f"{date} {brk.get('start', '12:00')}", "%Y-%m-%d %H:%M")
            brk_end_time = datetime.strptime(f"{date} {brk.get('end', '13:00')}", "%Y-%m-%d %H:%M")
            if slot_start < brk_end_time and slot_end > brk_start_time:
                in_break = True
                break
        
        if not in_break:
            # Check conflicts
            conflict = False
            for appt in existing:
                if appt["start_time"] < slot_end_str and appt["end_time"] > slot_start_str:
                    conflict = True
                    break
            
            if not conflict:
                slots.append({
                    "start_time": slot_start_str,
                    "end_time": slot_end_str,
                    "display": slot_start.strftime("%I:%M %p")
                })
        
        current_time += timedelta(minutes=30)
    
    return slots

@api_router.post("/appointments/{appointment_id}/approve")
async def approve_appointment(appointment_id: str, user: Dict = Depends(get_current_user)):
    """Approve a pending appointment"""
    appointment = await db.appointments.find_one({
        "appointment_id": appointment_id,
        "tenant_id": user["tenant_id"]
    }, {"_id": 0})
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    if appointment.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Appointment is not pending approval")
    
    await db.appointments.update_one(
        {"appointment_id": appointment_id},
        {"$set": {"status": "confirmed", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Send confirmation notification to client
    updated_appt = await db.appointments.find_one({"appointment_id": appointment_id}, {"_id": 0})
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    await send_booking_confirmation(updated_appt, tenant)
    
    return {"message": "Appointment approved", "status": "confirmed"}

@api_router.post("/appointments/{appointment_id}/reject")
async def reject_pending_appointment(appointment_id: str, body: Dict[str, Any] = None, user: Dict = Depends(get_current_user)):
    """Reject a pending appointment"""
    appointment = await db.appointments.find_one({
        "appointment_id": appointment_id,
        "tenant_id": user["tenant_id"]
    }, {"_id": 0})
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    reason = body.get("reason", "") if body else ""
    
    await db.appointments.update_one(
        {"appointment_id": appointment_id},
        {"$set": {
            "status": "rejected", 
            "rejection_reason": reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Appointment rejected", "status": "rejected"}

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

@api_router.get("/reports/detailed")
async def get_detailed_reports(
    user: Dict = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    report_type: str = "overview"
):
    """Get detailed reports for admin"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    tenant_id = user["tenant_id"]
    
    # Default to last 30 days
    if not end_date:
        end_date = datetime.now(timezone.utc).date().isoformat()
    if not start_date:
        start_date = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
    
    # Get appointments in range
    appointments = await db.appointments.find({
        "tenant_id": tenant_id,
        "start_time": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
    }, {"_id": 0}).to_list(5000)
    
    # Get services and staff for lookups
    services = await db.services.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    staff = await db.staff.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    
    services_map = {s["service_id"]: s for s in services}
    staff_map = {s["staff_id"]: s for s in staff}
    
    # Calculate metrics
    total_revenue = sum(a.get("total_price", 0) for a in appointments if a.get("status") in ["completed", "confirmed"])
    total_bookings = len(appointments)
    completed = len([a for a in appointments if a.get("status") == "completed"])
    cancelled = len([a for a in appointments if a.get("status") == "cancelled"])
    no_shows = len([a for a in appointments if a.get("status") == "no_show"])
    
    # Revenue by service
    revenue_by_service = {}
    bookings_by_service = {}
    for a in appointments:
        service_id = a.get("service_id")
        service_name = services_map.get(service_id, {}).get("name", "Unknown")
        price = a.get("total_price", 0) if a.get("status") in ["completed", "confirmed"] else 0
        
        revenue_by_service[service_name] = revenue_by_service.get(service_name, 0) + price
        bookings_by_service[service_name] = bookings_by_service.get(service_name, 0) + 1
    
    # Revenue by staff
    revenue_by_staff = {}
    bookings_by_staff = {}
    for a in appointments:
        staff_id = a.get("staff_id")
        staff_name = staff_map.get(staff_id, {}).get("name", "Unknown")
        price = a.get("total_price", 0) if a.get("status") in ["completed", "confirmed"] else 0
        
        revenue_by_staff[staff_name] = revenue_by_staff.get(staff_name, 0) + price
        bookings_by_staff[staff_name] = bookings_by_staff.get(staff_name, 0) + 1
    
    # Daily trends
    daily_revenue = {}
    daily_bookings = {}
    for a in appointments:
        date = a.get("start_time", "")[:10]
        price = a.get("total_price", 0) if a.get("status") in ["completed", "confirmed"] else 0
        daily_revenue[date] = daily_revenue.get(date, 0) + price
        daily_bookings[date] = daily_bookings.get(date, 0) + 1
    
    # Busiest hours
    hourly_bookings = {}
    for a in appointments:
        try:
            hour = int(a.get("start_time", "T10:")[11:13])
            hourly_bookings[hour] = hourly_bookings.get(hour, 0) + 1
        except:
            pass
    
    return {
        "period": {"start": start_date, "end": end_date},
        "summary": {
            "total_revenue": total_revenue,
            "total_bookings": total_bookings,
            "completed": completed,
            "cancelled": cancelled,
            "no_shows": no_shows,
            "completion_rate": round(completed / total_bookings * 100, 1) if total_bookings > 0 else 0,
            "average_booking_value": round(total_revenue / completed, 2) if completed > 0 else 0
        },
        "by_service": [{"name": k, "revenue": v, "bookings": bookings_by_service.get(k, 0)} for k, v in sorted(revenue_by_service.items(), key=lambda x: x[1], reverse=True)],
        "by_staff": [{"name": k, "revenue": v, "bookings": bookings_by_staff.get(k, 0)} for k, v in sorted(revenue_by_staff.items(), key=lambda x: x[1], reverse=True)],
        "daily_trends": [{"date": k, "revenue": daily_revenue.get(k, 0), "bookings": v} for k, v in sorted(daily_bookings.items())],
        "busiest_hours": [{"hour": k, "bookings": v} for k, v in sorted(hourly_bookings.items())]
    }

@api_router.get("/reports/export")
async def export_reports(
    user: Dict = Depends(get_current_user),
    format: str = "csv",
    report_type: str = "appointments",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Export reports as CSV or PDF data"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    tenant_id = user["tenant_id"]
    
    # Default dates
    if not end_date:
        end_date = datetime.now(timezone.utc).date().isoformat()
    if not start_date:
        start_date = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
    
    if report_type == "appointments":
        # Get appointments with service and staff names
        appointments = await db.appointments.find({
            "tenant_id": tenant_id,
            "start_time": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
        }, {"_id": 0}).to_list(5000)
        
        services = await db.services.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
        staff = await db.staff.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
        
        services_map = {s["service_id"]: s["name"] for s in services}
        staff_map = {s["staff_id"]: s["name"] for s in staff}
        
        export_data = []
        for a in appointments:
            export_data.append({
                "Date": a.get("start_time", "")[:10],
                "Time": a.get("start_time", "")[11:16],
                "Client": a.get("client_name", "Walk-in"),
                "Service": services_map.get(a.get("service_id"), "Unknown"),
                "Staff": staff_map.get(a.get("staff_id"), "Unknown"),
                "Status": a.get("status", "pending"),
                "Price": a.get("total_price", 0),
                "Notes": a.get("notes", "")
            })
        
        if format == "csv":
            # Generate CSV string
            if not export_data:
                return {"csv": "No data", "filename": f"appointments_{start_date}_{end_date}.csv"}
            
            headers = list(export_data[0].keys())
            csv_lines = [",".join(headers)]
            for row in export_data:
                csv_lines.append(",".join([f'"{str(row.get(h, ""))}"' for h in headers]))
            
            return {
                "csv": "\n".join(csv_lines),
                "filename": f"appointments_{start_date}_{end_date}.csv",
                "row_count": len(export_data)
            }
        else:  # PDF data (frontend will generate PDF)
            return {
                "data": export_data,
                "title": f"Appointments Report ({start_date} to {end_date})",
                "columns": ["Date", "Time", "Client", "Service", "Staff", "Status", "Price"],
                "summary": {
                    "total_appointments": len(export_data),
                    "total_revenue": sum(d.get("Price", 0) for d in export_data),
                    "period": f"{start_date} to {end_date}"
                }
            }
    
    elif report_type == "clients":
        clients = await db.clients.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(5000)
        
        export_data = []
        for c in clients:
            export_data.append({
                "Name": c.get("name", ""),
                "Email": c.get("email", ""),
                "Phone": c.get("phone", ""),
                "VIP": "Yes" if c.get("is_vip") else "No",
                "Total Visits": c.get("total_appointments", 0),
                "Total Spent": c.get("total_spent", 0),
                "Notes": c.get("notes", ""),
                "Important Info": c.get("important_info", "")
            })
        
        if format == "csv":
            if not export_data:
                return {"csv": "No data", "filename": f"clients_{end_date}.csv"}
            
            headers = list(export_data[0].keys())
            csv_lines = [",".join(headers)]
            for row in export_data:
                csv_lines.append(",".join([f'"{str(row.get(h, ""))}"' for h in headers]))
            
            return {
                "csv": "\n".join(csv_lines),
                "filename": f"clients_{end_date}.csv",
                "row_count": len(export_data)
            }
        else:
            return {
                "data": export_data,
                "title": f"Clients Report",
                "columns": ["Name", "Email", "Phone", "VIP", "Total Visits", "Total Spent"],
                "summary": {
                    "total_clients": len(export_data),
                    "vip_clients": len([c for c in export_data if c.get("VIP") == "Yes"])
                }
            }
    
    elif report_type == "revenue":
        # Get detailed report
        detailed = await get_detailed_reports(user, start_date, end_date)
        
        if format == "csv":
            # Revenue by service
            csv_lines = ["Service,Revenue,Bookings"]
            for item in detailed.get("by_service", []):
                csv_lines.append(f'"{item["name"]}",{item["revenue"]},{item["bookings"]}')
            
            return {
                "csv": "\n".join(csv_lines),
                "filename": f"revenue_{start_date}_{end_date}.csv",
                "row_count": len(detailed.get("by_service", []))
            }
        else:
            return detailed
    
    return {"error": "Invalid report type"}

# ================== NOTIFICATIONS & SMS ADD-ON ==================

@api_router.get("/notifications/settings")
async def get_notification_settings(user: Dict = Depends(get_current_user)):
    """Get tenant notification settings"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return {
        "email_reminders_enabled": tenant.get("email_reminders_enabled", True),
        "sms_reminders_enabled": tenant.get("sms_reminders_enabled", False),
        "sms_addon_enabled": tenant.get("sms_addon_enabled", False),
        "reminder_hours_before": tenant.get("reminder_hours_before", 24),
        "sms_addon_price": SMS_ADDON_PRICE
    }

@api_router.put("/notifications/settings")
async def update_notification_settings(settings: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Update tenant notification settings"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    updates = {}
    
    # Email settings (always available)
    if "email_reminders_enabled" in settings:
        updates["email_reminders_enabled"] = settings["email_reminders_enabled"]
    
    if "reminder_hours_before" in settings:
        updates["reminder_hours_before"] = settings["reminder_hours_before"]
    
    # SMS settings (only if addon is enabled)
    if "sms_reminders_enabled" in settings:
        if settings["sms_reminders_enabled"] and not tenant.get("sms_addon_enabled"):
            raise HTTPException(status_code=403, detail="SMS add-on not enabled. Please enable SMS add-on first.")
        updates["sms_reminders_enabled"] = settings["sms_reminders_enabled"]
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.tenants.update_one(
        {"tenant_id": user["tenant_id"]},
        {"$set": updates}
    )
    
    return {"message": "Settings updated", "settings": updates}

@api_router.post("/notifications/sms-addon/enable")
async def enable_sms_addon(user: Dict = Depends(get_current_user)):
    """Enable SMS add-on for tenant (+€10/month)"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    await db.tenants.update_one(
        {"tenant_id": user["tenant_id"]},
        {"$set": {
            "sms_addon_enabled": True,
            "sms_addon_activated_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log the add-on activation
    await db.addon_logs.insert_one({
        "log_id": f"addon_log_{uuid.uuid4().hex[:12]}",
        "tenant_id": user["tenant_id"],
        "addon_type": "sms",
        "action": "enabled",
        "price": SMS_ADDON_PRICE,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "SMS add-on enabled",
        "monthly_cost": SMS_ADDON_PRICE,
        "currency": "EUR"
    }

@api_router.post("/notifications/sms-addon/disable")
async def disable_sms_addon(user: Dict = Depends(get_current_user)):
    """Disable SMS add-on for tenant"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    await db.tenants.update_one(
        {"tenant_id": user["tenant_id"]},
        {"$set": {
            "sms_addon_enabled": False,
            "sms_reminders_enabled": False,  # Also disable SMS reminders
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log the add-on deactivation
    await db.addon_logs.insert_one({
        "log_id": f"addon_log_{uuid.uuid4().hex[:12]}",
        "tenant_id": user["tenant_id"],
        "addon_type": "sms",
        "action": "disabled",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "SMS add-on disabled"}

# Notification sending functions (to be connected with Resend/Twilio)
async def send_email_notification(tenant_id: str, to_email: str, subject: str, body: str, template_type: str = "generic"):
    """Send email notification via Resend"""
    notification_log = {
        "log_id": f"notif_{uuid.uuid4().hex[:12]}",
        "tenant_id": tenant_id,
        "type": "email",
        "to": to_email,
        "subject": subject,
        "body": body[:500],
        "template_type": template_type,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notification_logs.insert_one({**notification_log})
    
    # Check if Resend is configured
    if not RESEND_AVAILABLE or not RESEND_API_KEY:
        logger.warning("Resend not configured - email queued but not sent")
        await db.notification_logs.update_one(
            {"log_id": notification_log["log_id"]},
            {"$set": {"status": "queued", "error": "Resend not configured"}}
        )
        return notification_log["log_id"]
    
    # Generate HTML email from plain text
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ border-bottom: 2px solid #E34A33; padding-bottom: 20px; margin-bottom: 20px; }}
            .content {{ white-space: pre-wrap; }}
            .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0; color: #0A0A0A;">BookSlot</h1>
            </div>
            <div class="content">{body}</div>
            <div class="footer">
                <p>This email was sent by BookSlot on behalf of your service provider.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_body
        }
        
        # Run sync SDK in thread to keep FastAPI non-blocking
        email_response = await asyncio.to_thread(resend.Emails.send, params)
        
        await db.notification_logs.update_one(
            {"log_id": notification_log["log_id"]},
            {"$set": {
                "status": "sent",
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "external_id": email_response.get("id")
            }}
        )
        logger.info(f"Email sent to {to_email}: {notification_log['log_id']}")
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to send email: {error_msg}")
        await db.notification_logs.update_one(
            {"log_id": notification_log["log_id"]},
            {"$set": {"status": "failed", "error": error_msg[:200]}}
        )
    
    return notification_log["log_id"]

async def send_sms_notification(tenant_id: str, to_phone: str, message: str):
    """Send SMS notification via Twilio"""
    # Check if tenant has SMS addon enabled
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not tenant or not tenant.get("sms_addon_enabled"):
        logger.warning(f"SMS addon not enabled for tenant {tenant_id}")
        return None
    
    notification_log = {
        "log_id": f"notif_{uuid.uuid4().hex[:12]}",
        "tenant_id": tenant_id,
        "type": "sms",
        "to": to_phone,
        "message": message[:160],  # SMS limit
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notification_logs.insert_one({**notification_log})
    
    # Check if Twilio is configured
    if not TWILIO_AVAILABLE or not twilio_client or not TWILIO_PHONE_NUMBER:
        logger.warning("Twilio not configured - SMS queued but not sent")
        await db.notification_logs.update_one(
            {"log_id": notification_log["log_id"]},
            {"$set": {"status": "queued", "error": "Twilio not configured"}}
        )
        return notification_log["log_id"]
    
    try:
        # Send SMS via Twilio
        sms_response = await asyncio.to_thread(
            twilio_client.messages.create,
            body=message[:160],
            from_=TWILIO_PHONE_NUMBER,
            to=to_phone
        )
        
        await db.notification_logs.update_one(
            {"log_id": notification_log["log_id"]},
            {"$set": {
                "status": "sent",
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "external_id": sms_response.sid
            }}
        )
        logger.info(f"SMS sent to {to_phone}: {notification_log['log_id']}")
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to send SMS: {error_msg}")
        await db.notification_logs.update_one(
            {"log_id": notification_log["log_id"]},
            {"$set": {"status": "failed", "error": error_msg[:200]}}
        )
    
    return notification_log["log_id"]

async def send_booking_confirmation(appointment: Dict, tenant: Dict):
    """Send booking confirmation via email and optionally SMS"""
    client_email = appointment.get("client_email")
    client_phone = appointment.get("client_phone")
    client_name = appointment.get("client_name", "Customer")
    
    # Get service name
    service = await db.services.find_one({"service_id": appointment.get("service_id")}, {"_id": 0})
    service_name = service.get("name", "Appointment") if service else "Appointment"
    
    # Format date/time
    start_time = appointment.get("start_time", "")
    if isinstance(start_time, str):
        try:
            dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            date_str = dt.strftime("%B %d, %Y")
            time_str = dt.strftime("%I:%M %p")
        except:
            date_str = start_time
            time_str = ""
    else:
        date_str = str(start_time)
        time_str = ""
    
    # Send email confirmation (always, if email provided)
    if client_email and tenant.get("email_reminders_enabled", True):
        subject = f"Booking Confirmed - {service_name}"
        body = f"""Hi {client_name},

Your appointment has been confirmed!

Service: {service_name}
Date: {date_str}
Time: {time_str}
Location: {tenant.get('address', 'See booking details')}

Confirmation Code: {appointment.get('appointment_id')}

To manage your booking, visit: /booking/{appointment.get('appointment_id')}

Thank you for choosing {tenant.get('name')}!
"""
        await send_email_notification(tenant["tenant_id"], client_email, subject, body, "booking_confirmation")
    
    # Send SMS confirmation (only if addon enabled and SMS reminders on)
    if client_phone and tenant.get("sms_addon_enabled") and tenant.get("sms_reminders_enabled"):
        sms_message = f"Booking confirmed at {tenant.get('name')}: {service_name} on {date_str} at {time_str}. Code: {appointment.get('appointment_id')[-6:]}"
        await send_sms_notification(tenant["tenant_id"], client_phone, sms_message)

@api_router.get("/notifications/logs")
async def get_notification_logs(user: Dict = Depends(get_current_user), limit: int = 50, type: Optional[str] = None):
    """Get notification logs for tenant"""
    if not user.get("tenant_id"):
        return {"logs": []}
    
    query = {"tenant_id": user["tenant_id"]}
    if type:
        query["type"] = type
    
    logs = await db.notification_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"logs": logs}

@api_router.get("/notifications/integration-status")
async def get_notification_integration_status(user: Dict = Depends(get_current_user)):
    """Check if notification integrations are configured"""
    return {
        "email": {
            "provider": "Resend",
            "configured": bool(RESEND_AVAILABLE and RESEND_API_KEY),
            "sender": SENDER_EMAIL if RESEND_API_KEY else None
        },
        "sms": {
            "provider": "Twilio",
            "configured": bool(TWILIO_AVAILABLE and twilio_client and TWILIO_PHONE_NUMBER),
            "phone": TWILIO_PHONE_NUMBER[-4:] if TWILIO_PHONE_NUMBER else None  # Only show last 4 digits
        }
    }

# ================== STAFF WORKING HOURS ==================

@api_router.get("/staff/{staff_id}/working-hours")
async def get_staff_working_hours(staff_id: str, user: Dict = Depends(get_current_user)):
    """Get working hours for a staff member"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    staff = await db.staff.find_one({
        "staff_id": staff_id,
        "tenant_id": user["tenant_id"]
    }, {"_id": 0})
    
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    return {
        "staff_id": staff_id,
        "working_hours": staff.get("working_hours", DEFAULT_WORKING_HOURS)
    }

@api_router.put("/staff/{staff_id}/working-hours")
async def update_staff_working_hours(staff_id: str, working_hours: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Update working hours for a staff member"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    result = await db.staff.update_one(
        {"staff_id": staff_id, "tenant_id": user["tenant_id"]},
        {"$set": {"working_hours": working_hours}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff not found")
    
    return {"message": "Working hours updated", "working_hours": working_hours}

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

@api_router.get("/webhooks/{webhook_id}/deliveries")
async def get_webhook_deliveries(webhook_id: str, user: Dict = Depends(get_current_user), limit: int = 50):
    """Get delivery logs for a webhook"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    # Verify webhook belongs to tenant
    webhook = await db.webhooks.find_one({
        "webhook_id": webhook_id,
        "tenant_id": user["tenant_id"]
    }, {"_id": 0})
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    deliveries = await db.webhook_deliveries.find(
        {"webhook_id": webhook_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return {"deliveries": deliveries}

@api_router.post("/webhooks/{webhook_id}/test")
async def test_webhook(webhook_id: str, user: Dict = Depends(get_current_user)):
    """Send a test webhook delivery"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    webhook = await db.webhooks.find_one({
        "webhook_id": webhook_id,
        "tenant_id": user["tenant_id"]
    }, {"_id": 0})
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    # Create test payload
    test_data = {
        "appointment_id": "test_appt_123",
        "service_name": "Test Service",
        "client_name": "Test Client",
        "start_time": datetime.now(timezone.utc).isoformat(),
        "test": True
    }
    
    # Trigger test webhook
    await trigger_webhook(user["tenant_id"], WebhookEvent.BOOKING_CREATED, test_data)
    
    return {"message": "Test webhook sent", "data": test_data}

@api_router.put("/webhooks/{webhook_id}")
async def update_webhook(webhook_id: str, updates: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Update webhook configuration"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    # Don't allow updating certain fields
    updates.pop("webhook_id", None)
    updates.pop("tenant_id", None)
    updates.pop("created_at", None)
    updates.pop("secret", None)  # Secret should not be changed via update
    
    # Validate events if provided
    if "events" in updates:
        updates["events"] = [WebhookEvent(e).value for e in updates["events"]]
    
    result = await db.webhooks.update_one(
        {"webhook_id": webhook_id, "tenant_id": user["tenant_id"]},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    webhook = await db.webhooks.find_one({"webhook_id": webhook_id}, {"_id": 0})
    return {"webhook": webhook}

@api_router.post("/webhooks/{webhook_id}/regenerate-secret")
async def regenerate_webhook_secret(webhook_id: str, user: Dict = Depends(get_current_user)):
    """Regenerate webhook secret"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    new_secret = uuid.uuid4().hex
    
    result = await db.webhooks.update_one(
        {"webhook_id": webhook_id, "tenant_id": user["tenant_id"]},
        {"$set": {"secret": new_secret}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    webhook = await db.webhooks.find_one({"webhook_id": webhook_id}, {"_id": 0})
    return {"webhook": webhook, "message": "Secret regenerated"}

def generate_webhook_signature(payload: str, secret: str) -> str:
    """Generate HMAC-SHA256 signature for webhook payload"""
    return hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

async def trigger_webhook(tenant_id: str, event: WebhookEvent, data: Dict[str, Any]):
    """Trigger webhooks for an event with logging and retry support"""
    webhooks = await db.webhooks.find({
        "tenant_id": tenant_id,
        "is_active": True,
        "events": event.value
    }, {"_id": 0}).to_list(100)
    
    for webhook in webhooks:
        # Create delivery log
        delivery_id = f"delivery_{uuid.uuid4().hex[:12]}"
        timestamp = datetime.now(timezone.utc).isoformat()
        
        payload = {
            "id": delivery_id,
            "event": event.value,
            "tenant_id": tenant_id,
            "data": data,
            "timestamp": timestamp,
            "api_version": "1.0"
        }
        
        payload_str = str(payload)
        signature = generate_webhook_signature(payload_str, webhook.get("secret", ""))
        
        delivery_log = {
            "delivery_id": delivery_id,
            "webhook_id": webhook["webhook_id"],
            "tenant_id": tenant_id,
            "event": event.value,
            "url": webhook["url"],
            "payload": payload,
            "status": "pending",
            "attempts": 0,
            "max_attempts": 3,
            "created_at": timestamp,
            "last_attempt_at": None,
            "response_status": None,
            "response_body": None,
            "error_message": None
        }
        
        # Store delivery log
        await db.webhook_deliveries.insert_one({**delivery_log})
        
        # Attempt delivery with retries
        await attempt_webhook_delivery(webhook, payload, signature, delivery_id)

async def attempt_webhook_delivery(webhook: Dict, payload: Dict, signature: str, delivery_id: str, attempt: int = 1):
    """Attempt to deliver webhook with retry logic"""
    max_attempts = 3
    retry_delays = [0, 30, 300]  # Immediate, 30 seconds, 5 minutes
    
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Secret": webhook.get("secret", ""),
        "X-Webhook-Signature": f"sha256={signature}",
        "X-Webhook-Delivery-ID": payload["id"],
        "X-BookSlot-Event": payload["event"],
        "User-Agent": "BookSlot-Webhook/1.0"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook["url"],
                json=payload,
                headers=headers,
                timeout=10
            )
            
            # Update delivery log
            await db.webhook_deliveries.update_one(
                {"delivery_id": delivery_id},
                {"$set": {
                    "status": "delivered" if response.status_code < 400 else "failed",
                    "attempts": attempt,
                    "last_attempt_at": datetime.now(timezone.utc).isoformat(),
                    "response_status": response.status_code,
                    "response_body": response.text[:500] if response.text else None
                }}
            )
            
            # Log success
            if response.status_code < 400:
                logger.info(f"Webhook delivered: {delivery_id} to {webhook['url']} (status: {response.status_code})")
            else:
                logger.warning(f"Webhook delivery failed: {delivery_id} (status: {response.status_code})")
                # Schedule retry if attempts remaining
                if attempt < max_attempts:
                    asyncio.create_task(
                        retry_webhook_delivery(webhook, payload, signature, delivery_id, attempt + 1, retry_delays[attempt])
                    )
                    
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Webhook delivery error: {delivery_id} - {error_msg}")
        
        # Update delivery log with error
        await db.webhook_deliveries.update_one(
            {"delivery_id": delivery_id},
            {"$set": {
                "status": "error" if attempt >= max_attempts else "retrying",
                "attempts": attempt,
                "last_attempt_at": datetime.now(timezone.utc).isoformat(),
                "error_message": error_msg[:500]
            }}
        )
        
        # Schedule retry if attempts remaining
        if attempt < max_attempts:
            asyncio.create_task(
                retry_webhook_delivery(webhook, payload, signature, delivery_id, attempt + 1, retry_delays[attempt])
            )

async def retry_webhook_delivery(webhook: Dict, payload: Dict, signature: str, delivery_id: str, attempt: int, delay: int):
    """Retry webhook delivery after a delay"""
    await asyncio.sleep(delay)
    await attempt_webhook_delivery(webhook, payload, signature, delivery_id, attempt)

# ================== NO-SHOW SHIELD - RISK MANAGEMENT ==================

@api_router.get("/risk/at-risk-appointments")
async def get_at_risk_appointments(user: Dict = Depends(get_current_user)):
    """Get all appointments with high/medium risk scores"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    tenant_id = user["tenant_id"]
    
    # Get upcoming appointments (next 7 days)
    now = datetime.now(timezone.utc)
    week_ahead = now + timedelta(days=7)
    
    appointments = await db.appointments.find({
        "tenant_id": tenant_id,
        "status": {"$in": ["pending", "confirmed"]},
        "start_time": {"$gte": now.isoformat(), "$lte": week_ahead.isoformat()}
    }, {"_id": 0}).to_list(200)
    
    at_risk = []
    for appt in appointments:
        # Calculate risk if not already calculated
        if "risk_score" not in appt:
            risk = await calculate_risk_score(tenant_id, appt)
            appt["risk_score"] = risk["score"]
            appt["risk_level"] = risk["level"]
            appt["risk_factors"] = risk["factors"]
            
            # Update in database
            await db.appointments.update_one(
                {"appointment_id": appt["appointment_id"]},
                {"$set": {
                    "risk_score": risk["score"],
                    "risk_level": risk["level"],
                    "risk_factors": risk["factors"]
                }}
            )
        
        if appt.get("risk_level") in ["medium", "high"]:
            at_risk.append(appt)
    
    # Sort by risk score (highest first)
    at_risk.sort(key=lambda x: x.get("risk_score", 0), reverse=True)
    
    # Get staff and service names for display
    staff_map = {}
    service_map = {}
    staff_list = await db.staff.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    service_list = await db.services.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    for s in staff_list:
        staff_map[s["staff_id"]] = s["name"]
    for s in service_list:
        service_map[s["service_id"]] = s["name"]
    
    for appt in at_risk:
        appt["staff_name"] = staff_map.get(appt.get("staff_id"), "Unknown")
        appt["service_name"] = service_map.get(appt.get("service_id"), "Unknown")
    
    return {
        "at_risk_appointments": at_risk,
        "total_count": len(at_risk),
        "high_risk_count": sum(1 for a in at_risk if a.get("risk_level") == "high"),
        "medium_risk_count": sum(1 for a in at_risk if a.get("risk_level") == "medium")
    }

@api_router.post("/risk/calculate/{appointment_id}")
async def calculate_appointment_risk(appointment_id: str, user: Dict = Depends(get_current_user)):
    """Calculate or recalculate risk score for a specific appointment"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    appointment = await db.appointments.find_one({
        "appointment_id": appointment_id,
        "tenant_id": user["tenant_id"]
    }, {"_id": 0})
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    risk = await calculate_risk_score(user["tenant_id"], appointment)
    
    # Update appointment with risk data
    await db.appointments.update_one(
        {"appointment_id": appointment_id},
        {"$set": {
            "risk_score": risk["score"],
            "risk_level": risk["level"],
            "risk_factors": risk["factors"],
            "risk_calculated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "appointment_id": appointment_id,
        "risk": risk
    }

@api_router.post("/risk/mark-no-show/{appointment_id}")
async def mark_appointment_no_show(appointment_id: str, user: Dict = Depends(get_current_user)):
    """Mark an appointment as no-show (for tracking)"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    result = await db.appointments.update_one(
        {"appointment_id": appointment_id, "tenant_id": user["tenant_id"]},
        {"$set": {
            "status": "no_show",
            "no_show_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    return {"message": "Marked as no-show", "status": "no_show"}

# ================== WAITLIST MANAGEMENT ==================

@api_router.get("/waitlist")
async def get_waitlist(user: Dict = Depends(get_current_user)):
    """Get all active waitlist entries"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    entries = await db.waitlist.find({
        "tenant_id": user["tenant_id"],
        "status": "active"
    }, {"_id": 0}).to_list(100)
    
    return {"waitlist": entries, "total": len(entries)}

@api_router.post("/waitlist")
async def add_to_waitlist(entry_data: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Add a client to the waitlist"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    entry = WaitlistEntry(
        tenant_id=user["tenant_id"],
        client_name=entry_data.get("client_name", ""),
        client_email=entry_data.get("client_email"),
        client_phone=entry_data.get("client_phone"),
        service_id=entry_data.get("service_id"),
        preferred_staff_id=entry_data.get("preferred_staff_id"),
        preferred_dates=entry_data.get("preferred_dates", []),
        preferred_times=entry_data.get("preferred_times", []),
        flexible_dates=entry_data.get("flexible_dates", True),
        flexible_times=entry_data.get("flexible_times", True),
        notes=entry_data.get("notes")
    )
    
    entry_dict = entry.model_dump()
    entry_dict["created_at"] = entry_dict["created_at"].isoformat()
    
    await db.waitlist.insert_one({**entry_dict})
    
    return {"message": "Added to waitlist", "waitlist_entry": entry_dict}

@api_router.post("/waitlist/{waitlist_id}/promote")
async def promote_waitlist_entry(waitlist_id: str, appointment_data: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Promote a waitlist entry to a confirmed appointment"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    # Get waitlist entry
    entry = await db.waitlist.find_one({
        "waitlist_id": waitlist_id,
        "tenant_id": user["tenant_id"],
        "status": "active"
    }, {"_id": 0})
    
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    
    # Create the appointment
    appointment_id = f"appt_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    appointment = {
        "appointment_id": appointment_id,
        "tenant_id": user["tenant_id"],
        "service_id": appointment_data.get("service_id") or entry.get("service_id"),
        "staff_id": appointment_data.get("staff_id") or entry.get("preferred_staff_id"),
        "client_name": entry["client_name"],
        "client_email": entry.get("client_email"),
        "client_phone": entry.get("client_phone"),
        "start_time": appointment_data["start_time"],
        "end_time": appointment_data["end_time"],
        "status": "confirmed",
        "source": "waitlist",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "notes": f"Promoted from waitlist. Original notes: {entry.get('notes', '')}"
    }
    
    await db.appointments.insert_one({**appointment})
    
    # Update waitlist entry status
    await db.waitlist.update_one(
        {"waitlist_id": waitlist_id},
        {"$set": {
            "status": "promoted",
            "promoted_to_appointment_id": appointment_id,
            "promoted_at": now.isoformat()
        }}
    )
    
    return {
        "message": "Promoted to appointment",
        "appointment_id": appointment_id,
        "appointment": appointment
    }

@api_router.delete("/waitlist/{waitlist_id}")
async def remove_from_waitlist(waitlist_id: str, user: Dict = Depends(get_current_user)):
    """Remove an entry from the waitlist"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    result = await db.waitlist.update_one(
        {"waitlist_id": waitlist_id, "tenant_id": user["tenant_id"]},
        {"$set": {"status": "cancelled"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    
    return {"message": "Removed from waitlist"}

@api_router.get("/waitlist/matches/{appointment_id}")
async def find_waitlist_matches(appointment_id: str, user: Dict = Depends(get_current_user)):
    """Find waitlist entries that match a specific appointment slot"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    appointment = await db.appointments.find_one({
        "appointment_id": appointment_id,
        "tenant_id": user["tenant_id"]
    }, {"_id": 0})
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Find matching waitlist entries
    match = await auto_promote_waitlist(user["tenant_id"], appointment)
    
    if match:
        return {"match_found": True, "waitlist_entry": match}
    return {"match_found": False, "waitlist_entry": None}

# ================== PUSH NOTIFICATIONS (PWA) ==================

@api_router.post("/push/subscribe")
async def subscribe_push_notifications(subscription_data: Dict[str, Any]):
    """Subscribe a client to push notifications (PWA)"""
    tenant_id = subscription_data.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID required")
    
    subscription = PushSubscription(
        tenant_id=tenant_id,
        client_id=subscription_data.get("client_id"),
        appointment_id=subscription_data.get("appointment_id"),
        endpoint=subscription_data["endpoint"],
        keys=subscription_data["keys"],
        client_name=subscription_data.get("client_name"),
        client_phone=subscription_data.get("client_phone")
    )
    
    sub_dict = subscription.model_dump()
    sub_dict["created_at"] = sub_dict["created_at"].isoformat()
    
    # Check if endpoint already exists
    existing = await db.push_subscriptions.find_one({"endpoint": subscription.endpoint}, {"_id": 0})
    if existing:
        # Update existing
        await db.push_subscriptions.update_one(
            {"endpoint": subscription.endpoint},
            {"$set": sub_dict}
        )
        return {"message": "Subscription updated", "subscription_id": existing["subscription_id"]}
    
    await db.push_subscriptions.insert_one({**sub_dict})
    
    return {"message": "Subscribed to notifications", "subscription_id": subscription.subscription_id}

@api_router.delete("/push/unsubscribe")
async def unsubscribe_push_notifications(endpoint: str = Query(...)):
    """Unsubscribe from push notifications"""
    result = await db.push_subscriptions.delete_one({"endpoint": endpoint})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    return {"message": "Unsubscribed from notifications"}

@api_router.post("/push/send-reminder")
async def send_push_reminder(reminder_data: Dict[str, Any], user: Dict = Depends(get_current_user)):
    """Send a push notification reminder to a client (admin action)"""
    if not user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="No business found")
    
    appointment_id = reminder_data.get("appointment_id")
    if not appointment_id:
        raise HTTPException(status_code=400, detail="Appointment ID required")
    
    # Get appointment details
    appointment = await db.appointments.find_one({
        "appointment_id": appointment_id,
        "tenant_id": user["tenant_id"]
    }, {"_id": 0})
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Find push subscription for this appointment or client
    subscription = await db.push_subscriptions.find_one({
        "$or": [
            {"appointment_id": appointment_id},
            {"client_phone": appointment.get("client_phone")},
            {"client_id": appointment.get("client_id")}
        ],
        "tenant_id": user["tenant_id"]
    }, {"_id": 0})
    
    if not subscription:
        return {
            "message": "No push subscription found for this client",
            "sent": False,
            "install_link": f"/book/{user['tenant_id']}?install=true"
        }
    
    # Get tenant for branding
    tenant = await db.tenants.find_one({"tenant_id": user["tenant_id"]}, {"_id": 0})
    
    # Get service name
    service = await db.services.find_one({"service_id": appointment.get("service_id")}, {"_id": 0})
    service_name = service.get("name", "Appointment") if service else "Appointment"
    
    # Format notification payload
    start_time = appointment.get("start_time")
    if isinstance(start_time, str):
        start_time = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
    
    notification_payload = {
        "title": f"Reminder: {service_name}",
        "body": f"You have a booking on {start_time.strftime('%A, %B %d')} at {start_time.strftime('%I:%M %p')}",
        "icon": tenant.get("logo_url", "/icon-192.png"),
        "badge": "/badge-72.png",
        "tag": f"reminder-{appointment_id}",
        "data": {
            "appointment_id": appointment_id,
            "url": f"/booking/confirm/{appointment_id}"
        },
        "actions": [
            {"action": "confirm", "title": "Confirm"},
            {"action": "reschedule", "title": "Reschedule"}
        ]
    }
    
    # Record notification attempt
    await db.push_notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "tenant_id": user["tenant_id"],
        "appointment_id": appointment_id,
        "subscription_id": subscription["subscription_id"],
        "payload": notification_payload,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Push notification queued",
        "sent": True,
        "payload": notification_payload,
        "subscription_id": subscription["subscription_id"]
    }

@api_router.get("/push/vapid-key")
async def get_vapid_public_key():
    """Get VAPID public key for push notification subscription"""
    # In production, this should be a proper VAPID key pair
    # For now, return a placeholder - the frontend can use it to subscribe
    vapid_public_key = os.environ.get("VAPID_PUBLIC_KEY", "")
    
    return {
        "public_key": vapid_public_key,
        "enabled": bool(vapid_public_key)
    }

@api_router.get("/push/app-install-link/{tenant_slug}")
async def get_app_install_link(tenant_slug: str):
    """Get the PWA install link for a tenant's booking app"""
    tenant = await db.tenants.find_one({
        "$or": [
            {"booking_url_slug": tenant_slug},
            {"tenant_id": tenant_slug}
        ]
    }, {"_id": 0})
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    base_url = os.environ.get("REACT_APP_BACKEND_URL", "")
    install_url = f"{base_url}/book/{tenant.get('booking_url_slug', tenant['tenant_id'])}?install=true"
    
    return {
        "install_url": install_url,
        "business_name": tenant["name"],
        "logo_url": tenant.get("logo_url")
    }

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

# ================== MOLTBOT AI CONVERSATION SYSTEM ==================

# Moltbot system prompt for understanding booking intents
MOLTBOT_SYSTEM_PROMPT = """You are Moltbot, an AI receptionist for {business_name}. You help customers:
1. Book appointments
2. Check availability
3. Reschedule existing appointments
4. Cancel bookings
5. Get information about services

BUSINESS CONTEXT:
- Business: {business_name}
- Services: {services_list}
- Today's date: {today_date}

INSTRUCTIONS:
- Be friendly, professional, and concise
- When a customer wants to book, ask for: service, preferred date/time, and their contact info
- When rescheduling, ask for their confirmation code and new preferred time
- When cancelling, ask for their confirmation code
- Always confirm details before taking action
- If you're unsure, ask clarifying questions

RESPOND WITH JSON in this format:
{{
    "response_text": "Your friendly message to the customer",
    "intent": "book|reschedule|cancel|check_availability|get_info|clarify|general",
    "action_ready": true/false,
    "extracted_data": {{
        "service_name": "if mentioned",
        "preferred_date": "YYYY-MM-DD if mentioned",
        "preferred_time": "HH:MM if mentioned",
        "client_name": "if provided",
        "client_email": "if provided",
        "client_phone": "if provided",
        "confirmation_code": "if provided for reschedule/cancel"
    }}
}}

If action_ready is true, you have enough info to execute the booking action.
Always keep response_text conversational and helpful."""

class MoltbotMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class MoltbotConversation(BaseModel):
    conversation_id: str = Field(default_factory=lambda: f"conv_{uuid.uuid4().hex[:12]}")
    tenant_id: str
    client_identifier: str  # phone or email
    channel: str  # "sms", "email", "chat"
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    context: Dict[str, Any] = Field(default_factory=dict)  # Extracted booking context
    status: str = "active"  # active, completed, abandoned
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

async def get_moltbot_context(tenant_id: str) -> Dict[str, Any]:
    """Get business context for Moltbot"""
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not tenant:
        return {}
    
    services = await db.services.find({"tenant_id": tenant_id, "is_active": True}, {"_id": 0}).to_list(20)
    services_list = ", ".join([f"{s['name']} (€{s.get('price', 0)}, {s.get('duration', 30)} min)" for s in services])
    
    return {
        "business_name": tenant.get("name", "the business"),
        "services_list": services_list or "Various services available",
        "today_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "services": services,
        "tenant": tenant
    }

async def process_moltbot_message(
    tenant_id: str,
    client_identifier: str,
    message: str,
    channel: str = "chat"
) -> Dict[str, Any]:
    """Process incoming message and generate AI response"""
    
    # Check if Moltbot is available
    if not MOLTBOT_LLM_AVAILABLE or not EMERGENT_LLM_KEY:
        return {
            "response": "AI assistant is not configured. Please contact the business directly.",
            "conversation_id": None,
            "action_taken": None
        }
    
    # Get or create conversation
    conversation = await db.moltbot_conversations.find_one({
        "tenant_id": tenant_id,
        "client_identifier": client_identifier,
        "status": "active"
    }, {"_id": 0})
    
    if not conversation:
        conv = MoltbotConversation(
            tenant_id=tenant_id,
            client_identifier=client_identifier,
            channel=channel
        )
        conversation = conv.model_dump()
        await db.moltbot_conversations.insert_one({**conversation})
    
    # Add user message to conversation
    user_msg = {
        "role": "user",
        "content": message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    conversation["messages"].append(user_msg)
    
    # Get business context
    context = await get_moltbot_context(tenant_id)
    
    # Build conversation history for LLM
    system_prompt = MOLTBOT_SYSTEM_PROMPT.format(**context)
    
    # Create LLM chat instance
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=conversation["conversation_id"],
        system_message=system_prompt
    ).with_model("openai", "gpt-4o-mini")
    
    # Build message history for context
    history_text = ""
    for msg in conversation["messages"][-10:]:  # Last 10 messages for context
        role = "Customer" if msg["role"] == "user" else "Moltbot"
        history_text += f"{role}: {msg['content']}\n"
    
    try:
        # Get AI response
        user_message = UserMessage(text=f"Conversation history:\n{history_text}\n\nCustomer's latest message: {message}")
        ai_response = await chat.send_message(user_message)
        
        # Parse JSON response
        try:
            # Try to extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', ai_response)
            if json_match:
                parsed = json.loads(json_match.group())
            else:
                parsed = {
                    "response_text": ai_response,
                    "intent": "general",
                    "action_ready": False,
                    "extracted_data": {}
                }
        except json.JSONDecodeError:
            parsed = {
                "response_text": ai_response,
                "intent": "general",
                "action_ready": False,
                "extracted_data": {}
            }
        
        response_text = parsed.get("response_text", ai_response)
        intent = parsed.get("intent", "general")
        action_ready = parsed.get("action_ready", False)
        extracted_data = parsed.get("extracted_data", {})
        
        # Update conversation context with extracted data
        for key, value in extracted_data.items():
            if value:
                conversation["context"][key] = value
        
        # Add assistant message
        assistant_msg = {
            "role": "assistant",
            "content": response_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "intent": intent,
            "action_ready": action_ready
        }
        conversation["messages"].append(assistant_msg)
        
        # Execute action if ready
        action_result = None
        if action_ready and intent in ["book", "reschedule", "cancel"]:
            action_result = await execute_moltbot_action(
                tenant_id=tenant_id,
                intent=intent,
                context=conversation["context"],
                services=context.get("services", [])
            )
            
            if action_result and action_result.get("success"):
                conversation["status"] = "completed"
        
        # Update conversation in DB
        conversation["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.moltbot_conversations.update_one(
            {"conversation_id": conversation["conversation_id"]},
            {"$set": conversation}
        )
        
        return {
            "response": response_text,
            "conversation_id": conversation["conversation_id"],
            "intent": intent,
            "action_ready": action_ready,
            "action_taken": action_result,
            "context": conversation["context"]
        }
        
    except Exception as e:
        logger.error(f"Moltbot AI error: {str(e)}")
        return {
            "response": "I apologize, but I'm having trouble processing your request. Please try again or contact us directly.",
            "conversation_id": conversation["conversation_id"],
            "error": str(e)
        }

# === PUBLIC MOLTBOT CHAT ENDPOINT (for customer-facing widget) ===

class PublicChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    client_identifier: Optional[str] = None  # anonymous if not provided

async def resolve_tenant(identifier: str) -> Optional[Dict[str, Any]]:
    """Resolve tenant by slug OR tenant_id"""
    # Try slug first
    tenant = await db.tenants.find_one({"booking_url_slug": identifier, "is_active": True}, {"_id": 0})
    if tenant:
        return tenant
    # Try tenant_id
    tenant = await db.tenants.find_one({"tenant_id": identifier, "is_active": True}, {"_id": 0})
    return tenant

@api_router.post("/public/chat/{identifier}")
async def public_moltbot_chat(identifier: str, request: PublicChatRequest):
    """Public chat endpoint for AI receptionist widget - works with slug or tenant_id"""
    
    # Resolve tenant by slug or tenant_id
    tenant = await resolve_tenant(identifier)
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    tenant_id = tenant["tenant_id"]
    plan = tenant.get("plan", "starter")
    
    # Check if AI receptionist is enabled for this plan
    if plan not in ["growth", "pro"]:
        return {
            "response": "AI assistant is only available on Growth and Pro plans. Please contact the business directly for assistance.",
            "conversation_id": None,
            "ai_enabled": False
        }
    
    # Use conversation_id if provided, or generate anonymous identifier
    client_id = request.client_identifier or f"anon_{uuid.uuid4().hex[:8]}"
    
    # If conversation_id is provided, use it to continue the conversation
    if request.conversation_id:
        existing_conv = await db.moltbot_conversations.find_one({
            "conversation_id": request.conversation_id,
            "tenant_id": tenant_id
        }, {"_id": 0})
        if existing_conv:
            client_id = existing_conv.get("client_identifier", client_id)
    
    # Process the message
    result = await process_moltbot_message(
        tenant_id=tenant_id,
        client_identifier=client_id,
        message=request.message,
        channel="chat"
    )
    
    result["ai_enabled"] = True
    result["business_name"] = tenant.get("name")
    
    return result

async def execute_moltbot_action(
    tenant_id: str,
    intent: str,
    context: Dict[str, Any],
    services: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Execute booking action based on intent"""
    
    if intent == "book":
        # Find matching service
        service_name = context.get("service_name", "")
        service = None
        for s in services:
            if service_name.lower() in s["name"].lower():
                service = s
                break
        
        if not service:
            return {"success": False, "error": "Service not found"}
        
        # Get available staff
        staff = await db.staff.find({"tenant_id": tenant_id, "is_active": True}, {"_id": 0}).to_list(1)
        if not staff:
            return {"success": False, "error": "No staff available"}
        
        # Parse date/time
        preferred_date = context.get("preferred_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        preferred_time = context.get("preferred_time", "10:00")
        
        start_time = f"{preferred_date}T{preferred_time}:00"
        end_time_dt = datetime.fromisoformat(start_time) + timedelta(minutes=service.get("duration", 30))
        end_time = end_time_dt.isoformat()
        
        # Create appointment
        appointment = Appointment(
            tenant_id=tenant_id,
            service_id=service["service_id"],
            staff_id=staff[0]["staff_id"],
            client_name=context.get("client_name", "AI Booking"),
            client_email=context.get("client_email"),
            client_phone=context.get("client_phone"),
            start_time=start_time,
            end_time=end_time,
            notes="Booked via Moltbot AI",
            source="ai_receptionist"
        )
        
        appt_dict = appointment.model_dump()
        appt_dict["created_at"] = appt_dict["created_at"].isoformat()
        appt_dict["updated_at"] = appt_dict["updated_at"].isoformat()
        
        await db.appointments.insert_one({**appt_dict})
        await trigger_webhook(tenant_id, WebhookEvent.BOOKING_CREATED, appt_dict)
        
        return {
            "success": True,
            "action": "booked",
            "confirmation_code": appointment.appointment_id,
            "details": {
                "service": service["name"],
                "date": preferred_date,
                "time": preferred_time
            }
        }
    
    elif intent == "cancel":
        confirmation_code = context.get("confirmation_code")
        if not confirmation_code:
            return {"success": False, "error": "Confirmation code required"}
        
        result = await db.appointments.update_one(
            {"appointment_id": confirmation_code, "tenant_id": tenant_id},
            {"$set": {
                "status": "cancelled",
                "cancellation_reason": "Cancelled via Moltbot AI",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if result.matched_count == 0:
            return {"success": False, "error": "Appointment not found"}
        
        return {"success": True, "action": "cancelled", "confirmation_code": confirmation_code}
    
    elif intent == "reschedule":
        confirmation_code = context.get("confirmation_code")
        new_date = context.get("preferred_date")
        new_time = context.get("preferred_time")
        
        if not confirmation_code:
            return {"success": False, "error": "Confirmation code required"}
        
        appointment = await db.appointments.find_one(
            {"appointment_id": confirmation_code, "tenant_id": tenant_id},
            {"_id": 0}
        )
        
        if not appointment:
            return {"success": False, "error": "Appointment not found"}
        
        # Calculate new times
        if new_date and new_time:
            new_start = f"{new_date}T{new_time}:00"
            old_start = datetime.fromisoformat(appointment["start_time"].replace('Z', '+00:00'))
            old_end = datetime.fromisoformat(appointment["end_time"].replace('Z', '+00:00'))
            duration = (old_end - old_start).total_seconds() / 60
            new_end_dt = datetime.fromisoformat(new_start) + timedelta(minutes=duration)
            new_end = new_end_dt.isoformat()
            
            await db.appointments.update_one(
                {"appointment_id": confirmation_code},
                {"$set": {
                    "start_time": new_start,
                    "end_time": new_end,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            return {
                "success": True,
                "action": "rescheduled",
                "confirmation_code": confirmation_code,
                "new_date": new_date,
                "new_time": new_time
            }
        
        return {"success": False, "error": "New date and time required"}
    
    return {"success": False, "error": "Unknown action"}

# Moltbot Conversation API Endpoints

@api_router.post("/moltbot/{tenant_id}/chat")
async def moltbot_chat(tenant_id: str, body: Dict[str, Any], api_key: str = Query(...)):
    """Chat endpoint for Moltbot AI - handles incoming messages and returns AI responses"""
    
    # Validate tenant
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Check if AI receptionist is enabled for this tenant
    features = tenant.get("features", {})
    if not features.get("ai_assistant", True):  # Default to True for testing
        raise HTTPException(status_code=403, detail="AI assistant not enabled for this business")
    
    message = body.get("message", "")
    client_identifier = body.get("client_identifier", body.get("phone", body.get("email", "anonymous")))
    channel = body.get("channel", "chat")
    
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    result = await process_moltbot_message(
        tenant_id=tenant_id,
        client_identifier=client_identifier,
        message=message,
        channel=channel
    )
    
    return result

@api_router.get("/moltbot/{tenant_id}/conversations")
async def get_moltbot_conversations(
    tenant_id: str,
    api_key: str = Query(...),
    status: Optional[str] = None,
    limit: int = 20
):
    """Get Moltbot conversations for a tenant"""
    
    query = {"tenant_id": tenant_id}
    if status:
        query["status"] = status
    
    conversations = await db.moltbot_conversations.find(
        query, {"_id": 0}
    ).sort("updated_at", -1).to_list(limit)
    
    return {"conversations": conversations}

@api_router.get("/moltbot/{tenant_id}/conversations/{conversation_id}")
async def get_moltbot_conversation(tenant_id: str, conversation_id: str, api_key: str = Query(...)):
    """Get a specific Moltbot conversation"""
    
    conversation = await db.moltbot_conversations.find_one({
        "tenant_id": tenant_id,
        "conversation_id": conversation_id
    }, {"_id": 0})
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return conversation

@api_router.post("/moltbot/{tenant_id}/conversations/{conversation_id}/close")
async def close_moltbot_conversation(tenant_id: str, conversation_id: str, api_key: str = Query(...)):
    """Close/end a Moltbot conversation"""
    
    result = await db.moltbot_conversations.update_one(
        {"tenant_id": tenant_id, "conversation_id": conversation_id},
        {"$set": {"status": "completed", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"message": "Conversation closed"}

@api_router.post("/moltbot/webhook/incoming-sms")
async def moltbot_incoming_sms(request: Request):
    """Webhook endpoint for incoming SMS (Twilio)"""
    
    form_data = await request.form()
    from_number = form_data.get("From", "")
    to_number = form_data.get("To", "")
    message_body = form_data.get("Body", "")
    
    # Find tenant by phone number (you'd need to store this mapping)
    # For now, log and return TwiML response
    logger.info(f"Incoming SMS from {from_number}: {message_body}")
    
    # Store incoming message
    await db.moltbot_incoming.insert_one({
        "message_id": f"sms_{uuid.uuid4().hex[:12]}",
        "channel": "sms",
        "from": from_number,
        "to": to_number,
        "body": message_body,
        "status": "received",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Return TwiML response (empty for now - response would be sent async)
    return Response(
        content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        media_type="application/xml"
    )

@api_router.post("/moltbot/webhook/incoming-email")
async def moltbot_incoming_email(request: Request):
    """Webhook endpoint for incoming emails (Resend inbound)"""
    
    body = await request.json()
    
    from_email = body.get("from", "")
    to_email = body.get("to", "")
    subject = body.get("subject", "")
    text_body = body.get("text", body.get("html", ""))
    
    logger.info(f"Incoming email from {from_email}: {subject}")
    
    # Store incoming message
    await db.moltbot_incoming.insert_one({
        "message_id": f"email_{uuid.uuid4().hex[:12]}",
        "channel": "email",
        "from": from_email,
        "to": to_email,
        "subject": subject,
        "body": text_body[:1000],
        "status": "received",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"received": True}

@api_router.get("/moltbot/status")
async def get_moltbot_status():
    """Check Moltbot AI system status"""
    return {
        "enabled": MOLTBOT_ENABLED,
        "llm_available": MOLTBOT_LLM_AVAILABLE,
        "llm_configured": bool(EMERGENT_LLM_KEY),
        "features": {
            "chat": True,
            "sms_webhook": bool(TWILIO_AVAILABLE and twilio_client),
            "email_webhook": bool(RESEND_AVAILABLE and RESEND_API_KEY)
        }
    }

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

@api_router.post("/admin/tenants/{tenant_id}/deactivate")
async def admin_deactivate_tenant(tenant_id: str, admin: Dict = Depends(get_super_admin)):
    """Deactivate tenant (soft disable - super admin only)"""
    result = await db.tenants.update_one(
        {"tenant_id": tenant_id},
        {"$set": {"is_active": False, "status": "deactivated", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Deactivate all users for this tenant
    await db.users.update_many(
        {"tenant_id": tenant_id},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "Tenant deactivated"}

@api_router.post("/admin/tenants/{tenant_id}/terminate")
async def admin_terminate_tenant(tenant_id: str, admin: Dict = Depends(get_super_admin)):
    """Permanently terminate and delete tenant (super admin only)"""
    tenant = await db.tenants.find_one({"tenant_id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Delete all related data
    await db.users.delete_many({"tenant_id": tenant_id})
    await db.staff.delete_many({"tenant_id": tenant_id})
    await db.services.delete_many({"tenant_id": tenant_id})
    await db.appointments.delete_many({"tenant_id": tenant_id})
    await db.clients.delete_many({"tenant_id": tenant_id})
    await db.webhooks.delete_many({"tenant_id": tenant_id})
    await db.conversations.delete_many({"tenant_id": tenant_id})
    
    # Finally delete the tenant
    await db.tenants.delete_one({"tenant_id": tenant_id})
    
    return {"message": "Tenant permanently terminated and all data deleted"}

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

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    
    # Seed super admin if not exists
    try:
        existing = await db.super_admins.find_one({"email": "admin@bookslot.io"}, {"_id": 0})
        if not existing:
            admin = {
                "admin_id": f"admin_{uuid.uuid4().hex[:12]}",
                "email": "admin@bookslot.io",
                "name": "Super Admin",
                "password_hash": hash_password("Admin123!"),
                "role": "super_admin",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.super_admins.insert_one(admin)
            logger.info("Super admin seeded: admin@bookslot.io")
    except Exception as e:
        logger.error(f"Super admin seed failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
