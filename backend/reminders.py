"""
Reminder System for TimeSlot Pro
Supports Email and WhatsApp-friendly messaging
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from enum import Enum
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from models import BookingStatus, generate_id

logger = logging.getLogger(__name__)


class ReminderChannel(str, Enum):
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    SMS = "sms"


class ReminderType(str, Enum):
    CONFIRMATION = "confirmation"
    REMINDER_24H = "reminder_24h"
    REMINDER_2H = "reminder_2h"
    CANCELLATION = "cancellation"
    RESCHEDULE = "reschedule"
    FOLLOW_UP = "follow_up"
    WAITLIST_AVAILABLE = "waitlist_available"


class ReminderStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Reminder(BaseModel):
    """Scheduled reminder model"""
    reminder_id: str = Field(default_factory=lambda: generate_id("rem_"))
    tenant_id: str
    appointment_id: Optional[str] = None
    client_id: Optional[str] = None
    
    reminder_type: ReminderType
    channel: ReminderChannel
    
    recipient_name: str
    recipient_contact: str  # Email or phone number
    
    scheduled_for: datetime
    sent_at: Optional[datetime] = None
    
    status: ReminderStatus = ReminderStatus.PENDING
    
    subject: Optional[str] = None
    message: str
    
    # WhatsApp specific
    whatsapp_template_id: Optional[str] = None
    whatsapp_variables: Dict[str, str] = Field(default_factory=dict)
    
    error: Optional[str] = None
    retry_count: int = 0
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MessageTemplate(BaseModel):
    """Message template for reminders"""
    template_id: str = Field(default_factory=lambda: generate_id("tmpl_"))
    tenant_id: str
    
    name: str
    reminder_type: ReminderType
    channel: ReminderChannel
    
    # Email specific
    subject: Optional[str] = None
    
    # Content with placeholders: {{client_name}}, {{service_name}}, {{date}}, {{time}}, {{staff_name}}, {{business_name}}, {{booking_link}}
    content: str
    
    # WhatsApp specific - for WhatsApp Business API templates
    whatsapp_template_name: Optional[str] = None
    
    is_active: bool = True
    is_default: bool = False
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Default templates
DEFAULT_TEMPLATES = {
    # Email templates
    (ReminderType.CONFIRMATION, ReminderChannel.EMAIL): {
        "name": "Booking Confirmation Email",
        "subject": "Booking Confirmed - {{service_name}} at {{business_name}}",
        "content": """Hi {{client_name}},

Your booking has been confirmed!

📅 Date: {{date}}
🕐 Time: {{time}}
💇 Service: {{service_name}}
👤 With: {{staff_name}}
📍 At: {{business_name}}

Need to make changes? Click here: {{booking_link}}

See you soon!
{{business_name}}"""
    },
    (ReminderType.REMINDER_24H, ReminderChannel.EMAIL): {
        "name": "24 Hour Reminder Email",
        "subject": "Reminder: Your appointment tomorrow at {{business_name}}",
        "content": """Hi {{client_name}},

This is a friendly reminder about your appointment tomorrow.

📅 Date: {{date}}
🕐 Time: {{time}}
💇 Service: {{service_name}}
👤 With: {{staff_name}}

Can't make it? Please let us know: {{booking_link}}

See you tomorrow!
{{business_name}}"""
    },
    (ReminderType.REMINDER_2H, ReminderChannel.EMAIL): {
        "name": "2 Hour Reminder Email",
        "subject": "Your appointment is in 2 hours!",
        "content": """Hi {{client_name}},

Your appointment is coming up in 2 hours!

🕐 Time: {{time}}
💇 Service: {{service_name}}
👤 With: {{staff_name}}
📍 At: {{business_name}}

We look forward to seeing you soon!"""
    },
    (ReminderType.CANCELLATION, ReminderChannel.EMAIL): {
        "name": "Cancellation Confirmation Email",
        "subject": "Booking Cancelled - {{business_name}}",
        "content": """Hi {{client_name}},

Your booking has been cancelled as requested.

Cancelled appointment:
📅 Date: {{date}}
🕐 Time: {{time}}
💇 Service: {{service_name}}

We'd love to see you again! Book your next appointment: {{booking_link}}

{{business_name}}"""
    },
    
    # WhatsApp templates (formatted for WhatsApp Business API or direct messaging)
    (ReminderType.CONFIRMATION, ReminderChannel.WHATSAPP): {
        "name": "Booking Confirmation WhatsApp",
        "content": """✅ *Booking Confirmed!*

Hi {{client_name}}! Your appointment is booked.

📅 *{{date}}*
🕐 *{{time}}*
💇 {{service_name}}
👤 With {{staff_name}}
📍 {{business_name}}

Need to change? Tap here:
{{booking_link}}

Reply HELP for assistance."""
    },
    (ReminderType.REMINDER_24H, ReminderChannel.WHATSAPP): {
        "name": "24 Hour Reminder WhatsApp",
        "content": """⏰ *Reminder: Tomorrow!*

Hi {{client_name}}, your appointment is tomorrow!

📅 *{{date}}*
🕐 *{{time}}*
💇 {{service_name}}
👤 With {{staff_name}}

Can't make it? Let us know:
{{booking_link}}

Reply YES to confirm or RESCHEDULE to change."""
    },
    (ReminderType.REMINDER_2H, ReminderChannel.WHATSAPP): {
        "name": "2 Hour Reminder WhatsApp",
        "content": """🔔 *2 Hours to Go!*

Hi {{client_name}}, see you soon!

🕐 *{{time}}*
💇 {{service_name}}
👤 {{staff_name}}
📍 {{business_name}}

We're looking forward to seeing you!"""
    },
    (ReminderType.CANCELLATION, ReminderChannel.WHATSAPP): {
        "name": "Cancellation WhatsApp",
        "content": """❌ *Booking Cancelled*

Hi {{client_name}}, your booking has been cancelled.

📅 {{date}} at {{time}}
💇 {{service_name}}

Book again anytime:
{{booking_link}}

We'd love to see you soon!"""
    },
    (ReminderType.WAITLIST_AVAILABLE, ReminderChannel.WHATSAPP): {
        "name": "Waitlist Availability WhatsApp",
        "content": """🎉 *Spot Available!*

Hi {{client_name}}! Good news - a slot just opened up!

📅 *{{date}}*
🕐 *{{time}}*
💇 {{service_name}}

Want to book? Reply YES quickly to secure it!

This slot may not last long."""
    },
}


def render_template(template: str, variables: Dict[str, str]) -> str:
    """Render a template with variables"""
    result = template
    for key, value in variables.items():
        result = result.replace(f"{{{{{key}}}}}", str(value))
    return result


async def get_template(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    reminder_type: ReminderType,
    channel: ReminderChannel
) -> Dict[str, Any]:
    """Get template for a reminder type and channel"""
    # Try tenant-specific template first
    template = await db.message_templates.find_one(
        {
            "tenant_id": tenant_id,
            "reminder_type": reminder_type.value,
            "channel": channel.value,
            "is_active": True
        },
        {"_id": 0}
    )
    
    if template:
        return template
    
    # Fall back to default
    default = DEFAULT_TEMPLATES.get((reminder_type, channel))
    if default:
        return {
            **default,
            "reminder_type": reminder_type.value,
            "channel": channel.value,
            "is_default": True
        }
    
    return None


async def create_appointment_reminders(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    appointment: Dict[str, Any],
    channels: List[ReminderChannel] = None
) -> List[str]:
    """Create all reminders for an appointment"""
    if channels is None:
        # Get tenant's preferred channels
        tenant = await db.tenants.find_one(
            {"tenant_id": tenant_id},
            {"_id": 0, "settings": 1, "name": 1}
        )
        settings = tenant.get("settings", {}) if tenant else {}
        channels = []
        if settings.get("email_reminders", True):
            channels.append(ReminderChannel.EMAIL)
        if settings.get("whatsapp_reminders", False):
            channels.append(ReminderChannel.WHATSAPP)
        
        if not channels:
            channels = [ReminderChannel.EMAIL]  # Default to email
    
    business_name = tenant.get("name", "Our Business") if tenant else "Our Business"
    
    # Parse appointment time
    start_time = datetime.fromisoformat(appointment["start_time"].replace("Z", "+00:00"))
    
    # Get service and staff names
    service = await db.services.find_one(
        {"service_id": appointment["service_id"]},
        {"_id": 0, "name": 1}
    )
    staff = await db.staff.find_one(
        {"staff_id": appointment["staff_id"]},
        {"_id": 0, "name": 1}
    )
    
    # Build variables
    variables = {
        "client_name": appointment.get("client_name", "Valued Customer"),
        "service_name": service.get("name", "Service") if service else "Service",
        "staff_name": staff.get("name", "Staff") if staff else "Staff",
        "date": start_time.strftime("%A, %B %d, %Y"),
        "time": start_time.strftime("%I:%M %p"),
        "business_name": business_name,
        "booking_link": f"/manage/{appointment['appointment_id']}"  # Will be prefixed with domain
    }
    
    reminder_ids = []
    now = datetime.now(timezone.utc)
    
    for channel in channels:
        # Determine recipient
        if channel == ReminderChannel.EMAIL:
            recipient = appointment.get("client_email")
            if not recipient:
                continue
        else:  # WhatsApp/SMS
            recipient = appointment.get("client_phone")
            if not recipient:
                continue
        
        # Create reminders for each type
        reminder_configs = [
            (ReminderType.CONFIRMATION, now),  # Send immediately
            (ReminderType.REMINDER_24H, start_time - timedelta(hours=24)),
            (ReminderType.REMINDER_2H, start_time - timedelta(hours=2)),
        ]
        
        for reminder_type, scheduled_time in reminder_configs:
            # Don't schedule past reminders
            if scheduled_time < now and reminder_type != ReminderType.CONFIRMATION:
                continue
            
            template = await get_template(db, tenant_id, reminder_type, channel)
            if not template:
                continue
            
            message = render_template(template["content"], variables)
            subject = render_template(template.get("subject", ""), variables) if template.get("subject") else None
            
            reminder = Reminder(
                tenant_id=tenant_id,
                appointment_id=appointment["appointment_id"],
                reminder_type=reminder_type,
                channel=channel,
                recipient_name=appointment.get("client_name", "Customer"),
                recipient_contact=recipient,
                scheduled_for=scheduled_time if reminder_type != ReminderType.CONFIRMATION else now,
                subject=subject,
                message=message,
                whatsapp_template_id=template.get("whatsapp_template_name")
            )
            
            doc = reminder.model_dump()
            doc["scheduled_for"] = doc["scheduled_for"].isoformat()
            doc["created_at"] = doc["created_at"].isoformat()
            doc["updated_at"] = doc["updated_at"].isoformat()
            
            await db.reminders.insert_one(doc)
            reminder_ids.append(reminder.reminder_id)
    
    return reminder_ids


async def cancel_appointment_reminders(
    db: AsyncIOMotorDatabase,
    appointment_id: str
):
    """Cancel all pending reminders for an appointment"""
    await db.reminders.update_many(
        {
            "appointment_id": appointment_id,
            "status": ReminderStatus.PENDING.value
        },
        {
            "$set": {
                "status": ReminderStatus.CANCELLED.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )


async def send_cancellation_notification(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    appointment: Dict[str, Any]
):
    """Send cancellation notification"""
    tenant = await db.tenants.find_one(
        {"tenant_id": tenant_id},
        {"_id": 0, "name": 1, "settings": 1}
    )
    
    settings = tenant.get("settings", {}) if tenant else {}
    channels = []
    if settings.get("email_reminders", True) and appointment.get("client_email"):
        channels.append((ReminderChannel.EMAIL, appointment["client_email"]))
    if settings.get("whatsapp_reminders", False) and appointment.get("client_phone"):
        channels.append((ReminderChannel.WHATSAPP, appointment["client_phone"]))
    
    start_time = datetime.fromisoformat(appointment["start_time"].replace("Z", "+00:00"))
    
    service = await db.services.find_one(
        {"service_id": appointment["service_id"]},
        {"_id": 0, "name": 1}
    )
    
    variables = {
        "client_name": appointment.get("client_name", "Valued Customer"),
        "service_name": service.get("name", "Service") if service else "Service",
        "date": start_time.strftime("%A, %B %d, %Y"),
        "time": start_time.strftime("%I:%M %p"),
        "business_name": tenant.get("name", "Our Business") if tenant else "Our Business",
        "booking_link": f"/book/{tenant_id}"
    }
    
    for channel, recipient in channels:
        template = await get_template(db, tenant_id, ReminderType.CANCELLATION, channel)
        if not template:
            continue
        
        message = render_template(template["content"], variables)
        subject = render_template(template.get("subject", ""), variables) if template.get("subject") else None
        
        reminder = Reminder(
            tenant_id=tenant_id,
            appointment_id=appointment["appointment_id"],
            reminder_type=ReminderType.CANCELLATION,
            channel=channel,
            recipient_name=appointment.get("client_name", "Customer"),
            recipient_contact=recipient,
            scheduled_for=datetime.now(timezone.utc),
            subject=subject,
            message=message
        )
        
        doc = reminder.model_dump()
        doc["scheduled_for"] = doc["scheduled_for"].isoformat()
        doc["created_at"] = doc["created_at"].isoformat()
        doc["updated_at"] = doc["updated_at"].isoformat()
        
        await db.reminders.insert_one(doc)


async def process_pending_reminders(db: AsyncIOMotorDatabase):
    """
    Process and send pending reminders.
    This should be called periodically (e.g., every minute via cron/scheduler).
    """
    now = datetime.now(timezone.utc)
    
    # Get pending reminders that are due
    pending = await db.reminders.find(
        {
            "status": ReminderStatus.PENDING.value,
            "scheduled_for": {"$lte": now.isoformat()}
        },
        {"_id": 0}
    ).limit(100).to_list(100)
    
    for reminder in pending:
        try:
            success = False
            
            if reminder["channel"] == ReminderChannel.EMAIL.value:
                # Send email via existing email service
                from email_service import send_email
                success = await send_email(
                    to_email=reminder["recipient_contact"],
                    subject=reminder.get("subject", "Reminder"),
                    html_content=reminder["message"].replace("\n", "<br>")
                )
            
            elif reminder["channel"] in [ReminderChannel.WHATSAPP.value, ReminderChannel.SMS.value]:
                # For WhatsApp/SMS - log the message for now
                # In production, integrate with WhatsApp Business API or Twilio
                logger.info(
                    f"WhatsApp/SMS to {reminder['recipient_contact']}: "
                    f"{reminder['message'][:100]}..."
                )
                # Mark as sent for demo purposes
                success = True
            
            # Update status
            new_status = ReminderStatus.SENT.value if success else ReminderStatus.FAILED.value
            await db.reminders.update_one(
                {"reminder_id": reminder["reminder_id"]},
                {
                    "$set": {
                        "status": new_status,
                        "sent_at": now.isoformat() if success else None,
                        "updated_at": now.isoformat(),
                        "error": None if success else "Failed to send"
                    },
                    "$inc": {"retry_count": 0 if success else 1}
                }
            )
            
        except Exception as e:
            logger.error(f"Error processing reminder {reminder['reminder_id']}: {e}")
            await db.reminders.update_one(
                {"reminder_id": reminder["reminder_id"]},
                {
                    "$set": {
                        "error": str(e),
                        "updated_at": now.isoformat()
                    },
                    "$inc": {"retry_count": 1}
                }
            )


async def get_whatsapp_click_to_chat_link(
    phone: str,
    message: str
) -> str:
    """
    Generate WhatsApp click-to-chat link.
    This allows businesses to send WhatsApp messages without WhatsApp Business API.
    """
    import urllib.parse
    
    # Clean phone number (remove spaces, dashes, etc.)
    clean_phone = ''.join(filter(str.isdigit, phone))
    
    # URL encode the message
    encoded_message = urllib.parse.quote(message)
    
    return f"https://wa.me/{clean_phone}?text={encoded_message}"


def format_whatsapp_message(
    template: str,
    variables: Dict[str, str]
) -> str:
    """
    Format a message for WhatsApp with proper formatting.
    WhatsApp supports: *bold*, _italic_, ~strikethrough~, ```monospace```
    """
    message = render_template(template, variables)
    
    # Ensure proper line breaks (WhatsApp uses \n)
    message = message.replace("<br>", "\n").replace("<br/>", "\n")
    
    return message
