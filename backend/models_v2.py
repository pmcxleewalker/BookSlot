"""
V2 Models for TimeSlot Pro - AI Receptionist & Inbox
Extended models for conversations, messages, handoff, and slot locking
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import uuid


def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


# =====================
# Conversation & Inbox
# =====================

class ConversationStatus(str, Enum):
    ACTIVE = "active"           # Ongoing AI conversation
    WAITING_HUMAN = "waiting_human"  # Escalated, waiting for staff
    HUMAN_HANDLING = "human_handling"  # Staff has taken over
    RESOLVED = "resolved"       # Completed successfully
    ABANDONED = "abandoned"     # Customer left without resolution


class ConversationChannel(str, Enum):
    API = "api"                 # Direct API integration (MoltBot)
    WIDGET = "widget"           # Website chat widget
    PHONE = "phone"             # Phone/voice
    SMS = "sms"                 # SMS
    WHATSAPP = "whatsapp"       # WhatsApp
    EMAIL = "email"             # Email


class MessageSenderType(str, Enum):
    CLIENT = "client"           # Customer message
    AI = "ai"                   # AI receptionist response
    STAFF = "staff"             # Human staff response
    SYSTEM = "system"           # System notification


class HandoffReason(str, Enum):
    CLIENT_REQUEST = "client_request"     # Customer asked for human
    AI_UNCERTAIN = "ai_uncertain"         # AI unsure how to proceed
    COMPLEX_BOOKING = "complex_booking"   # Booking too complex
    VIP_CLIENT = "vip_client"             # VIP client requires human
    COMPLAINT = "complaint"               # Customer complaint
    PAYMENT_ISSUE = "payment_issue"       # Payment related issue
    POLICY_EXCEPTION = "policy_exception" # Needs policy exception
    TECHNICAL_ERROR = "technical_error"   # Technical issue occurred


class ConversationPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class TimestampMixin(BaseModel):
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Conversation(TimestampMixin):
    """A conversation thread between client and AI/staff"""
    model_config = ConfigDict(extra="ignore")
    
    conversation_id: str = Field(default_factory=lambda: generate_id("conv_"))
    tenant_id: str
    
    # Client info (may be anonymous initially)
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    
    # Conversation metadata
    channel: ConversationChannel = ConversationChannel.API
    status: ConversationStatus = ConversationStatus.ACTIVE
    priority: ConversationPriority = ConversationPriority.NORMAL
    
    # AI handling
    ai_session_id: Optional[str] = None  # External AI session reference
    ai_model: Optional[str] = None       # AI model used (e.g., "moltbot-v1")
    
    # Human handoff
    handoff_reason: Optional[HandoffReason] = None
    handoff_requested_at: Optional[datetime] = None
    assigned_staff_id: Optional[str] = None
    assigned_at: Optional[datetime] = None
    
    # Resolution
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    
    # Booking context
    booking_intent_detected: bool = False
    related_appointment_id: Optional[str] = None
    
    # Analytics
    message_count: int = 0
    ai_message_count: int = 0
    human_message_count: int = 0
    first_response_time_ms: Optional[int] = None
    resolution_time_ms: Optional[int] = None
    
    # Tags for filtering/search
    tags: List[str] = Field(default_factory=list)
    
    # Summary (AI-generated or staff notes)
    summary: Optional[str] = None


class ConversationMessage(TimestampMixin):
    """Individual message in a conversation"""
    model_config = ConfigDict(extra="ignore")
    
    message_id: str = Field(default_factory=lambda: generate_id("msg_"))
    conversation_id: str
    tenant_id: str
    
    # Sender
    sender_type: MessageSenderType
    sender_id: Optional[str] = None  # staff_id or client_id
    sender_name: Optional[str] = None
    
    # Content
    content: str
    content_type: str = "text"  # text, image, file, booking_card, etc.
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    # AI context (for AI messages)
    ai_confidence: Optional[float] = None
    ai_intent_detected: Optional[str] = None
    
    # Delivery status
    delivered: bool = True
    read: bool = False
    read_at: Optional[datetime] = None


class ConversationCreate(BaseModel):
    """Request model for creating a conversation"""
    channel: ConversationChannel = ConversationChannel.API
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    ai_session_id: Optional[str] = None
    initial_message: Optional[str] = None


class MessageCreate(BaseModel):
    """Request model for adding a message"""
    content: str
    sender_type: MessageSenderType
    sender_id: Optional[str] = None
    sender_name: Optional[str] = None
    content_type: str = "text"
    metadata: Dict[str, Any] = Field(default_factory=dict)
    ai_confidence: Optional[float] = None
    ai_intent_detected: Optional[str] = None


class HandoffRequest(BaseModel):
    """Request model for human handoff"""
    reason: HandoffReason
    priority: ConversationPriority = ConversationPriority.NORMAL
    notes: Optional[str] = None


# =====================
# Slot Locking (Booking Safety)
# =====================

class SlotLockStatus(str, Enum):
    ACTIVE = "active"
    RELEASED = "released"
    EXPIRED = "expired"
    CONVERTED = "converted"  # Converted to booking


class SlotLock(TimestampMixin):
    """Temporary lock on a time slot during booking process"""
    model_config = ConfigDict(extra="ignore")
    
    lock_id: str = Field(default_factory=lambda: generate_id("lock_"))
    tenant_id: str
    
    # Slot details
    staff_id: str
    service_id: str
    resource_id: Optional[str] = None
    start_time: datetime
    end_time: datetime
    
    # Lock metadata
    status: SlotLockStatus = SlotLockStatus.ACTIVE
    expires_at: datetime  # Lock auto-expires
    
    # Idempotency
    idempotency_key: Optional[str] = None
    
    # Context
    conversation_id: Optional[str] = None
    api_key_id: Optional[str] = None
    source: str = "api"  # api, widget, admin


class SlotLockRequest(BaseModel):
    """Request to lock a slot"""
    staff_id: str
    service_id: str
    start_time: datetime
    resource_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    lock_duration_seconds: int = 300  # 5 minutes default


# =====================
# Rate Limiting
# =====================

class RateLimitWindow(TimestampMixin):
    """Rate limit tracking per API key"""
    model_config = ConfigDict(extra="ignore")
    
    window_id: str = Field(default_factory=lambda: generate_id("rlw_"))
    api_key_id: str
    tenant_id: str
    
    # Window details
    window_start: datetime
    window_size_seconds: int = 60  # 1 minute window
    
    # Counts
    request_count: int = 0
    
    # Limits (from plan)
    max_requests: int = 100  # Default limit


# =====================
# Idempotency
# =====================

class IdempotencyRecord(TimestampMixin):
    """Record of idempotent API calls"""
    model_config = ConfigDict(extra="ignore")
    
    record_id: str = Field(default_factory=lambda: generate_id("idem_"))
    idempotency_key: str
    tenant_id: str
    api_key_id: Optional[str] = None
    
    # Request context
    endpoint: str
    method: str
    request_hash: str  # Hash of request body
    
    # Response
    status_code: int
    response_body: Dict[str, Any]
    
    # Expiry
    expires_at: datetime


# =====================
# Receptionist Analytics
# =====================

class ConversationAnalytics(BaseModel):
    """Analytics for a time period"""
    period_start: datetime
    period_end: datetime
    
    # Volume
    total_conversations: int = 0
    new_conversations: int = 0
    resolved_conversations: int = 0
    
    # Handoff
    handoff_count: int = 0
    handoff_rate: float = 0.0
    
    # Response times
    avg_first_response_ms: float = 0.0
    avg_resolution_time_ms: float = 0.0
    
    # Booking conversion
    booking_intents_detected: int = 0
    bookings_created: int = 0
    conversion_rate: float = 0.0
    
    # By channel
    by_channel: Dict[str, int] = Field(default_factory=dict)
    
    # By handoff reason
    by_handoff_reason: Dict[str, int] = Field(default_factory=dict)


# =====================
# Message Templates
# =====================

class MessageTemplateType(str, Enum):
    BOOKING_CONFIRMATION = "booking_confirmation"
    BOOKING_REMINDER = "booking_reminder"
    BOOKING_CANCELLATION = "booking_cancellation"
    BOOKING_RESCHEDULED = "booking_rescheduled"
    WELCOME = "welcome"
    HANDOFF_NOTICE = "handoff_notice"
    CUSTOM = "custom"


class MessageTemplate(TimestampMixin):
    """Reusable message templates"""
    model_config = ConfigDict(extra="ignore")
    
    template_id: str = Field(default_factory=lambda: generate_id("tmpl_"))
    tenant_id: str
    
    name: str
    template_type: MessageTemplateType
    channel: ConversationChannel
    
    # Content with placeholders
    subject: Optional[str] = None  # For email
    content: str  # Supports {{client_name}}, {{service_name}}, etc.
    
    # Settings
    is_active: bool = True
    is_default: bool = False


# =====================
# API Response Models
# =====================

class ConversationListResponse(BaseModel):
    """Response for listing conversations"""
    conversations: List[Dict[str, Any]]
    total: int
    page: int
    page_size: int
    has_more: bool


class InboxStats(BaseModel):
    """Stats for inbox dashboard"""
    active_conversations: int = 0
    waiting_human: int = 0
    human_handling: int = 0
    resolved_today: int = 0
    avg_response_time_ms: float = 0.0
