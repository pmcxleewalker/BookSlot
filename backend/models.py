"""
Pydantic models for TimeSlot Pro - Multi-tenant SaaS Booking Platform
"""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, time
from enum import Enum
import uuid


def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


# Enums
class PlanType(str, Enum):
    STARTER = "starter"
    GROWTH = "growth"
    PRO = "pro"


class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    STAFF = "staff"


class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    NO_SHOW = "no_show"


class IndustryType(str, Enum):
    SALON = "salon"
    CLINIC = "clinic"
    DENTIST = "dentist"
    DOCTOR = "doctor"
    VET = "vet"
    CONSULTANT = "consultant"
    OTHER = "other"


# Base models
class TimestampMixin(BaseModel):
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Tenant/Business
class Tenant(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    tenant_id: str = Field(default_factory=lambda: generate_id("tenant_"))
    name: str
    slug: str  # URL-friendly identifier
    industry: IndustryType
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    timezone: str = "Europe/London"
    currency: str = "EUR"
    logo_url: Optional[str] = None
    website: Optional[str] = None
    booking_url: Optional[str] = None
    settings: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    # Branding customization
    branding: Dict[str, Any] = Field(default_factory=lambda: {
        "primary_color": "#2E473B",
        "secondary_color": "#C26A58",
        "accent_color": "#E6B861",
        "background_color": "#FAF9F6",
        "text_color": "#1C1C1C",
        "font_family": "Inter",
        "logo_position": "left",
        "show_powered_by": True,
        "custom_css": ""
    })


class TenantCreate(BaseModel):
    name: str
    industry: IndustryType
    email: str
    phone: Optional[str] = None
    timezone: str = "Europe/London"
    currency: str = "EUR"


# Subscription
class Subscription(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    subscription_id: str = Field(default_factory=lambda: generate_id("sub_"))
    tenant_id: str
    plan: PlanType
    price_monthly: float
    max_locations: int
    max_staff: int
    features: List[str] = Field(default_factory=list)
    start_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    end_date: Optional[datetime] = None
    is_active: bool = True
    is_trial: bool = False
    trial_ends_at: Optional[datetime] = None


# User (business owner/staff)
class User(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    user_id: str = Field(default_factory=lambda: generate_id("user_"))
    tenant_id: Optional[str] = None
    email: str
    name: str
    picture: Optional[str] = None
    role: UserRole = UserRole.OWNER
    is_active: bool = True
    password_hash: Optional[str] = None  # For JWT auth
    google_id: Optional[str] = None  # For Google OAuth


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# Session for auth
class UserSession(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(default_factory=lambda: generate_id("sess_"))
    user_id: str
    session_token: str
    expires_at: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


# Location (for multi-location support in Pro plan)
class Location(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    location_id: str = Field(default_factory=lambda: generate_id("loc_"))
    tenant_id: str
    name: str
    address: str
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    timezone: str = "Europe/London"
    is_primary: bool = False
    is_active: bool = True


class LocationCreate(BaseModel):
    name: str
    address: str
    city: Optional[str] = None
    phone: Optional[str] = None
    timezone: str = "Europe/London"


# Staff Member
class StaffMember(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    staff_id: str = Field(default_factory=lambda: generate_id("staff_"))
    tenant_id: str
    user_id: Optional[str] = None  # Link to User if they have login
    location_id: Optional[str] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    color: str = "#2E473B"  # For calendar display
    services: List[str] = Field(default_factory=list)  # service_ids this staff can perform
    is_active: bool = True


class StaffCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    color: str = "#2E473B"
    services: List[str] = Field(default_factory=list)


# Working Hours
class WorkingHours(BaseModel):
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: str  # "09:00"
    end_time: str  # "17:00"
    is_working: bool = True


class StaffSchedule(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    schedule_id: str = Field(default_factory=lambda: generate_id("sched_"))
    staff_id: str
    tenant_id: str
    working_hours: List[WorkingHours] = Field(default_factory=list)
    breaks: List[Dict[str, Any]] = Field(default_factory=list)
    time_off: List[Dict[str, Any]] = Field(default_factory=list)


# Service Category
class ServiceCategory(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    category_id: str = Field(default_factory=lambda: generate_id("cat_"))
    tenant_id: str
    name: str
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class ServiceCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


# Service
class Service(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    service_id: str = Field(default_factory=lambda: generate_id("svc_"))
    tenant_id: str
    category_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    duration: int = 30  # minutes
    buffer_before: int = 0  # minutes
    buffer_after: int = 0  # minutes
    price: float = 0.0
    deposit_required: bool = False
    deposit_amount: Optional[float] = None
    max_bookings_per_slot: int = 1
    color: str = "#2E473B"
    is_active: bool = True


class ServiceCreate(BaseModel):
    name: str
    category_id: Optional[str] = None
    description: Optional[str] = None
    duration: int = 30
    buffer_before: int = 0
    buffer_after: int = 0
    price: float = 0.0
    deposit_required: bool = False
    deposit_amount: Optional[float] = None
    color: str = "#2E473B"


# Resource (rooms, equipment)
class Resource(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    resource_id: str = Field(default_factory=lambda: generate_id("res_"))
    tenant_id: str
    location_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    resource_type: str = "room"  # room, equipment, etc.
    capacity: int = 1
    services: List[str] = Field(default_factory=list)  # Compatible service_ids
    is_active: bool = True


class ResourceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    resource_type: str = "room"
    capacity: int = 1
    services: List[str] = Field(default_factory=list)


# Client (customers)
class Client(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    client_id: str = Field(default_factory=lambda: generate_id("client_"))
    tenant_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    is_active: bool = True
    marketing_consent: bool = False
    total_bookings: int = 0
    total_spent: float = 0.0
    last_visit: Optional[datetime] = None


class ClientCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    marketing_consent: bool = False


# Appointment/Booking
class Appointment(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    appointment_id: str = Field(default_factory=lambda: generate_id("apt_"))
    tenant_id: str
    location_id: Optional[str] = None
    client_id: Optional[str] = None
    staff_id: str
    service_id: str
    resource_id: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: BookingStatus = BookingStatus.CONFIRMED
    notes: Optional[str] = None
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    price: float = 0.0
    deposit_paid: float = 0.0
    is_guest: bool = True  # True if booked without account
    reminder_sent: bool = False
    confirmation_sent: bool = False
    source: str = "online"  # online, phone, walk-in, api
    cancel_reason: Optional[str] = None


class AppointmentCreate(BaseModel):
    staff_id: str
    service_id: str
    start_time: datetime
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    notes: Optional[str] = None
    resource_id: Optional[str] = None


class AppointmentUpdate(BaseModel):
    staff_id: Optional[str] = None
    service_id: Optional[str] = None
    start_time: Optional[datetime] = None
    status: Optional[BookingStatus] = None
    notes: Optional[str] = None
    resource_id: Optional[str] = None


# Custom Form
class FormField(BaseModel):
    field_id: str = Field(default_factory=lambda: generate_id("field_"))
    label: str
    field_type: str  # text, email, phone, textarea, select, checkbox, date
    required: bool = False
    options: List[str] = Field(default_factory=list)  # For select fields
    placeholder: Optional[str] = None


class CustomForm(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    form_id: str = Field(default_factory=lambda: generate_id("form_"))
    tenant_id: str
    name: str
    description: Optional[str] = None
    fields: List[FormField] = Field(default_factory=list)
    services: List[str] = Field(default_factory=list)  # Linked service_ids
    is_active: bool = True


class FormSubmission(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    submission_id: str = Field(default_factory=lambda: generate_id("fsub_"))
    form_id: str
    tenant_id: str
    appointment_id: Optional[str] = None
    client_id: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)


# Waitlist
class WaitlistEntry(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    waitlist_id: str = Field(default_factory=lambda: generate_id("wait_"))
    tenant_id: str
    client_id: Optional[str] = None
    client_name: str
    client_email: str
    client_phone: Optional[str] = None
    service_id: str
    staff_id: Optional[str] = None  # Preferred staff
    preferred_dates: List[str] = Field(default_factory=list)
    preferred_times: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    status: str = "waiting"  # waiting, contacted, booked, expired
    notified_at: Optional[datetime] = None


# Webhook
class Webhook(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    webhook_id: str = Field(default_factory=lambda: generate_id("wh_"))
    tenant_id: str
    url: str
    events: List[str] = Field(default_factory=list)  # booking.created, booking.cancelled, etc.
    secret: str = Field(default_factory=lambda: generate_id("whsec_"))
    is_active: bool = True
    last_triggered: Optional[datetime] = None
    failure_count: int = 0


class WebhookCreate(BaseModel):
    url: str
    events: List[str]


# API Key for integrations
class APIKey(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    api_key_id: str = Field(default_factory=lambda: generate_id("ak_"))
    tenant_id: str
    name: str
    key_hash: str
    key_prefix: str  # First 8 chars for display
    permissions: List[str] = Field(default_factory=list)
    is_active: bool = True
    last_used: Optional[datetime] = None


# Audit Log
class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str = Field(default_factory=lambda: generate_id("log_"))
    tenant_id: str
    user_id: Optional[str] = None
    action: str
    entity_type: str
    entity_id: str
    changes: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Notification/Reminder
class Notification(TimestampMixin):
    model_config = ConfigDict(extra="ignore")
    notification_id: str = Field(default_factory=lambda: generate_id("notif_"))
    tenant_id: str
    appointment_id: Optional[str] = None
    client_id: Optional[str] = None
    notification_type: str  # confirmation, reminder_24h, reminder_1h, cancellation, etc.
    channel: str  # email, sms
    recipient: str
    subject: Optional[str] = None
    content: str
    status: str = "pending"  # pending, sent, failed
    sent_at: Optional[datetime] = None
    error: Optional[str] = None


# Response models for API
class AvailabilitySlot(BaseModel):
    start_time: datetime
    end_time: datetime
    staff_id: str
    staff_name: str
    resource_id: Optional[str] = None


class AvailabilityResponse(BaseModel):
    date: str
    slots: List[AvailabilitySlot]


class BookingConfirmation(BaseModel):
    appointment_id: str
    service_name: str
    staff_name: str
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    confirmation_code: str


# Moltbot API models
class MoltbotBookingIntent(BaseModel):
    """Model for Moltbot to submit booking intent"""
    tenant_slug: str
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    service_name: Optional[str] = None  # Can be fuzzy matched
    service_id: Optional[str] = None
    preferred_date: Optional[str] = None  # YYYY-MM-DD
    preferred_time: Optional[str] = None  # HH:MM
    staff_preference: Optional[str] = None  # Staff name or ID
    notes: Optional[str] = None


class MoltbotAvailabilityQuery(BaseModel):
    """Model for Moltbot to query availability"""
    tenant_slug: str
    service_id: Optional[str] = None
    staff_id: Optional[str] = None
    date: str  # YYYY-MM-DD
    duration: Optional[int] = None  # Override service duration


class MoltbotBookingAction(BaseModel):
    """Model for Moltbot to perform booking actions"""
    action: str  # create, reschedule, cancel
    appointment_id: Optional[str] = None  # For reschedule/cancel
    booking_intent: Optional[MoltbotBookingIntent] = None
    new_start_time: Optional[datetime] = None  # For reschedule


# Dashboard stats
class DashboardStats(BaseModel):
    today_appointments: int
    week_appointments: int
    month_revenue: float
    new_clients: int
    pending_confirmations: int
    cancellation_rate: float
    popular_services: List[Dict[str, Any]]
    staff_utilization: List[Dict[str, Any]]
