"""
Extended models for TimeSlot Pro - AI Receptionist & Enhanced Features
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum
from models import generate_id, TimestampMixin


# =====================
# Conversation / Receptionist Models
# =====================

class ConversationStatus(str, Enum):
    ACTIVE = "active"
    PENDING_HANDOFF = "pending_handoff"
    HANDED_OFF = "handed_off"
    RESOLVED = "resolved"
    ABANDONED = "abandoned"


class ConversationChannel(str, Enum):
    WEB_CHAT = "web_chat"
    WHATSAPP = "whatsapp"
    SMS = "sms"
    VOICE = "voice"
    API = "api"


class HandoffReason(str, Enum):
    UNCERTAIN_REQUEST = "uncertain_request"
    VIP_CLIENT = "vip_client"
    COMPLEX_BOOKING = "complex_booking"
    COMPLAINT = "complaint"
    CUSTOM_REQUEST = "custom_request"
    AI_FAILURE = "ai_failure"
    USER_REQUESTED = "user_requested"
    BLOCKED_CLIENT = "blocked_client"


class Conversation(TimestampMixin):
    """AI Receptionist conversation with a customer"""
    model_config = ConfigDict(extra="ignore")
    conversation_id: str = Field(default_factory=lambda: generate_id("conv_"))
    tenant_id: str
    channel: ConversationChannel = ConversationChannel.WEB_CHAT
    channel_session_id: Optional[str] = None  # External session ID from channel
    status: ConversationStatus = ConversationStatus.ACTIVE
    
    # Customer info (collected during conversation)
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    client_id: Optional[str] = None  # If matched to existing client
    
    # Booking intent
    booking_intent: Optional[Dict[str, Any]] = None  # service, staff preference, times
    service_id: Optional[str] = None
    staff_id: Optional[str] = None
    preferred_date: Optional[str] = None
    preferred_time: Optional[str] = None
    
    # Outcome
    appointment_id: Optional[str] = None  # If booking was created
    lead_id: Optional[str] = None  # If lead was created instead
    
    # Handoff
    requires_handoff: bool = False
    handoff_reason: Optional[HandoffReason] = None
    handoff_task_id: Optional[str] = None
    assigned_staff_id: Optional[str] = None
    
    # Metrics
    message_count: int = 0
    ai_actions_count: int = 0
    first_response_time_ms: Optional[int] = None
    resolution_time_ms: Optional[int] = None
    
    # Notes
    notes: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class ConversationMessage(TimestampMixin):
    """Individual message in a conversation"""
    model_config = ConfigDict(extra="ignore")
    message_id: str = Field(default_factory=lambda: generate_id("msg_"))
    conversation_id: str
    tenant_id: str
    
    sender_type: str  # "customer", "ai", "staff"
    sender_id: Optional[str] = None  # staff_id if staff
    content: str
    content_type: str = "text"  # text, image, file, system
    
    # AI-specific
    ai_confidence: Optional[float] = None
    ai_intent_detected: Optional[str] = None
    ai_action_taken: Optional[str] = None
    ai_action_result: Optional[Dict[str, Any]] = None


class ReceptionistLead(TimestampMixin):
    """Lead/inquiry created by receptionist when booking couldn't be completed"""
    model_config = ConfigDict(extra="ignore")
    lead_id: str = Field(default_factory=lambda: generate_id("lead_"))
    tenant_id: str
    conversation_id: Optional[str] = None
    
    # Contact info
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    
    # Intent
    service_interest: Optional[str] = None
    notes: Optional[str] = None
    source: str = "receptionist"
    
    # Status
    status: str = "new"  # new, contacted, converted, lost
    assigned_staff_id: Optional[str] = None
    follow_up_date: Optional[datetime] = None


# =====================
# Handoff / Task Models
# =====================

class HandoffTaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class HandoffTaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class HandoffTask(TimestampMixin):
    """Task created when AI hands off to human staff"""
    model_config = ConfigDict(extra="ignore")
    task_id: str = Field(default_factory=lambda: generate_id("task_"))
    tenant_id: str
    conversation_id: Optional[str] = None
    appointment_id: Optional[str] = None
    
    title: str
    description: Optional[str] = None
    reason: HandoffReason
    priority: HandoffTaskPriority = HandoffTaskPriority.MEDIUM
    status: HandoffTaskStatus = HandoffTaskStatus.PENDING
    
    # Assignment
    assigned_staff_id: Optional[str] = None
    assigned_at: Optional[datetime] = None
    
    # Customer context
    customer_name: Optional[str] = None
    customer_contact: Optional[str] = None
    booking_intent: Optional[Dict[str, Any]] = None
    
    # Resolution
    resolution_notes: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    
    # AI action that was attempted
    ai_action_attempted: Optional[str] = None
    ai_error: Optional[str] = None


# =====================
# Message Templates
# =====================

class MessageTemplateType(str, Enum):
    CONFIRMATION = "confirmation"
    REMINDER_24H = "reminder_24h"
    REMINDER_1H = "reminder_1h"
    CANCELLATION = "cancellation"
    RESCHEDULE = "reschedule"
    FOLLOW_UP = "follow_up"
    CUSTOM = "custom"


class MessageTemplate(TimestampMixin):
    """Customizable message templates for notifications"""
    model_config = ConfigDict(extra="ignore")
    template_id: str = Field(default_factory=lambda: generate_id("tmpl_"))
    tenant_id: str
    
    name: str
    template_type: MessageTemplateType
    channel: str = "email"  # email, sms
    
    subject: Optional[str] = None  # For email
    content: str  # Supports variables like {{client_name}}, {{service_name}}
    
    is_active: bool = True
    is_default: bool = False
    
    # Tone/branding
    tone: str = "professional"  # professional, friendly, casual


class MessageLog(TimestampMixin):
    """Log of all messages sent"""
    model_config = ConfigDict(extra="ignore")
    log_id: str = Field(default_factory=lambda: generate_id("mlog_"))
    tenant_id: str
    
    template_id: Optional[str] = None
    appointment_id: Optional[str] = None
    client_id: Optional[str] = None
    conversation_id: Optional[str] = None
    
    channel: str  # email, sms
    recipient: str
    subject: Optional[str] = None
    content: str
    
    status: str = "pending"  # pending, sent, delivered, failed, bounced
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    error: Optional[str] = None
    
    # Tracking
    opened_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None


# =====================
# Slot Locking (Booking Safety)
# =====================

class SlotLock(BaseModel):
    """Temporary lock on a time slot during booking checkout"""
    model_config = ConfigDict(extra="ignore")
    lock_id: str = Field(default_factory=lambda: generate_id("lock_"))
    tenant_id: str
    staff_id: str
    service_id: str
    resource_id: Optional[str] = None
    
    start_time: datetime
    end_time: datetime
    
    # Lock metadata
    locked_by: str  # session_id or conversation_id
    locked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime  # Typically 5-10 minutes
    
    # Status
    is_active: bool = True
    converted_to_booking: bool = False
    appointment_id: Optional[str] = None


class IdempotencyRecord(BaseModel):
    """Record for idempotent API operations"""
    model_config = ConfigDict(extra="ignore")
    idempotency_key: str
    tenant_id: str
    operation: str  # booking.create, booking.cancel, etc.
    
    request_hash: str  # Hash of request body
    response: Dict[str, Any]
    status_code: int
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime  # Typically 24 hours


# =====================
# Receptionist Analytics
# =====================

class ReceptionistStats(BaseModel):
    """Aggregated receptionist analytics"""
    total_conversations: int = 0
    active_conversations: int = 0
    resolved_conversations: int = 0
    handoff_conversations: int = 0
    
    bookings_created: int = 0
    bookings_rescheduled: int = 0
    bookings_cancelled: int = 0
    
    conversion_rate: float = 0.0  # conversations -> bookings
    handoff_rate: float = 0.0
    avg_response_time_ms: int = 0
    avg_resolution_time_ms: int = 0
    
    # By channel
    by_channel: Dict[str, int] = Field(default_factory=dict)
    
    # Top intents
    top_services_requested: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Failures
    failed_automations: int = 0
    faq_resolutions: int = 0


# =====================
# FAQs / Help Content
# =====================

class FAQ(TimestampMixin):
    """FAQ entries for AI receptionist to answer"""
    model_config = ConfigDict(extra="ignore")
    faq_id: str = Field(default_factory=lambda: generate_id("faq_"))
    tenant_id: str
    
    question: str
    answer: str
    keywords: List[str] = Field(default_factory=list)
    category: Optional[str] = None
    
    is_active: bool = True
    usage_count: int = 0


# =====================
# Webhook Delivery Log
# =====================

class WebhookDelivery(TimestampMixin):
    """Log of webhook delivery attempts"""
    model_config = ConfigDict(extra="ignore")
    delivery_id: str = Field(default_factory=lambda: generate_id("whd_"))
    webhook_id: str
    tenant_id: str
    
    event: str
    payload: Dict[str, Any]
    
    # Delivery status
    status: str = "pending"  # pending, success, failed, retrying
    attempts: int = 0
    max_attempts: int = 5
    
    # Response
    response_status: Optional[int] = None
    response_body: Optional[str] = None
    error: Optional[str] = None
    
    # Timing
    next_retry_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None


# =====================
# API Request Models
# =====================

class ReceptionistBookingRequest(BaseModel):
    """Request model for receptionist API booking"""
    idempotency_key: Optional[str] = None
    
    # Client info
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    
    # Booking details
    service_id: str
    staff_id: Optional[str] = None
    resource_id: Optional[str] = None
    start_time: datetime
    
    # Context
    conversation_id: Optional[str] = None
    notes: Optional[str] = None
    source: str = "receptionist"


class ReceptionistAvailabilityRequest(BaseModel):
    """Request model for checking availability"""
    service_id: str
    date: str  # YYYY-MM-DD
    staff_id: Optional[str] = None
    resource_id: Optional[str] = None
    location_id: Optional[str] = None
    duration_override: Optional[int] = None


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation"""
    channel: ConversationChannel = ConversationChannel.API
    channel_session_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    initial_message: Optional[str] = None


class HandoffRequest(BaseModel):
    """Request to create a handoff task"""
    conversation_id: Optional[str] = None
    appointment_id: Optional[str] = None
    reason: HandoffReason
    priority: HandoffTaskPriority = HandoffTaskPriority.MEDIUM
    title: str
    description: Optional[str] = None
    customer_name: Optional[str] = None
    customer_contact: Optional[str] = None
    booking_intent: Optional[Dict[str, Any]] = None


class ConversationMessageRequest(BaseModel):
    """Request to add a message to conversation"""
    content: str
    sender_type: str = "customer"  # customer, ai, staff
    content_type: str = "text"
    ai_confidence: Optional[float] = None
    ai_intent_detected: Optional[str] = None
    ai_action_taken: Optional[str] = None


# =====================
# WebSocket Events
# =====================

class WSEventType(str, Enum):
    BOOKING_CREATED = "booking.created"
    BOOKING_UPDATED = "booking.updated"
    BOOKING_CANCELLED = "booking.cancelled"
    CONVERSATION_NEW = "conversation.new"
    CONVERSATION_MESSAGE = "conversation.message"
    CONVERSATION_HANDOFF = "conversation.handoff"
    HANDOFF_TASK_CREATED = "handoff.created"
    HANDOFF_TASK_ASSIGNED = "handoff.assigned"
    SLOT_LOCKED = "slot.locked"
    SLOT_RELEASED = "slot.released"


class WSEvent(BaseModel):
    """WebSocket event payload"""
    event_type: WSEventType
    tenant_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data: Dict[str, Any]
