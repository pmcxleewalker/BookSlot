"""
Email service for TimeSlot Pro
Handles transactional emails using Resend
"""
import os
import asyncio
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# Check if Resend is configured
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")

# Initialize Resend if available
resend = None
if RESEND_API_KEY:
    try:
        import resend as resend_lib
        resend_lib.api_key = RESEND_API_KEY
        resend = resend_lib
        logger.info("Resend email service initialized")
    except ImportError:
        logger.warning("Resend library not installed")
else:
    logger.warning("RESEND_API_KEY not configured - emails will be logged only")


async def send_email(
    to: str,
    subject: str,
    html_content: str
) -> bool:
    """
    Send an email using Resend
    Returns True if sent successfully, False otherwise
    """
    if not resend:
        # Log email instead of sending
        logger.info(f"[EMAIL MOCK] To: {to}, Subject: {subject}")
        logger.info(f"[EMAIL MOCK] Content preview: {html_content[:200]}...")
        return True
    
    params = {
        "from": SENDER_EMAIL,
        "to": [to],
        "subject": subject,
        "html": html_content
    }
    
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to}, ID: {email.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {str(e)}")
        return False


def generate_booking_confirmation_email(
    client_name: str,
    service_name: str,
    staff_name: str,
    start_time: datetime,
    business_name: str,
    confirmation_code: str,
    manage_url: str
) -> str:
    """Generate HTML for booking confirmation email"""
    formatted_date = start_time.strftime("%A, %B %d, %Y")
    formatted_time = start_time.strftime("%I:%M %p")
    
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #FAF9F6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #2E473B; padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
                            <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 600;">Booking Confirmed</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 32px;">
                            <p style="color: #1C1C1C; font-size: 16px; margin: 0 0 24px 0;">
                                Hi {client_name},
                            </p>
                            <p style="color: #6B6B6B; font-size: 16px; margin: 0 0 32px 0;">
                                Your appointment at <strong style="color: #1C1C1C;">{business_name}</strong> has been confirmed.
                            </p>
                            
                            <!-- Appointment Details Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F6; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="padding-bottom: 16px;">
                                                    <span style="color: #6B6B6B; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Service</span><br>
                                                    <span style="color: #1C1C1C; font-size: 16px; font-weight: 600;">{service_name}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-bottom: 16px;">
                                                    <span style="color: #6B6B6B; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">With</span><br>
                                                    <span style="color: #1C1C1C; font-size: 16px; font-weight: 600;">{staff_name}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-bottom: 16px;">
                                                    <span style="color: #6B6B6B; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Date</span><br>
                                                    <span style="color: #1C1C1C; font-size: 16px; font-weight: 600;">{formatted_date}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>
                                                    <span style="color: #6B6B6B; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Time</span><br>
                                                    <span style="color: #1C1C1C; font-size: 16px; font-weight: 600;">{formatted_time}</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #6B6B6B; font-size: 14px; margin: 0 0 8px 0;">
                                Confirmation Code: <strong style="color: #1C1C1C;">{confirmation_code}</strong>
                            </p>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                                <tr>
                                    <td align="center">
                                        <a href="{manage_url}" style="display: inline-block; background-color: #2E473B; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                                            Manage Booking
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px 32px; border-top: 1px solid #E5E5E0; text-align: center;">
                            <p style="color: #6B6B6B; font-size: 12px; margin: 0;">
                                Need to make changes? <a href="{manage_url}" style="color: #2E473B;">Manage your booking</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


def generate_reminder_email(
    client_name: str,
    service_name: str,
    staff_name: str,
    start_time: datetime,
    business_name: str,
    hours_before: int,
    manage_url: str
) -> str:
    """Generate HTML for appointment reminder email"""
    formatted_date = start_time.strftime("%A, %B %d, %Y")
    formatted_time = start_time.strftime("%I:%M %p")
    
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #FAF9F6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #C26A58; padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
                            <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 600;">Appointment Reminder</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 32px;">
                            <p style="color: #1C1C1C; font-size: 16px; margin: 0 0 24px 0;">
                                Hi {client_name},
                            </p>
                            <p style="color: #6B6B6B; font-size: 16px; margin: 0 0 32px 0;">
                                This is a friendly reminder that your appointment at <strong style="color: #1C1C1C;">{business_name}</strong> is coming up in <strong style="color: #C26A58;">{hours_before} hours</strong>.
                            </p>
                            
                            <!-- Appointment Details Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F6; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="padding-bottom: 16px;">
                                                    <span style="color: #6B6B6B; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Service</span><br>
                                                    <span style="color: #1C1C1C; font-size: 16px; font-weight: 600;">{service_name}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-bottom: 16px;">
                                                    <span style="color: #6B6B6B; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">With</span><br>
                                                    <span style="color: #1C1C1C; font-size: 16px; font-weight: 600;">{staff_name}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-bottom: 16px;">
                                                    <span style="color: #6B6B6B; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Date</span><br>
                                                    <span style="color: #1C1C1C; font-size: 16px; font-weight: 600;">{formatted_date}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>
                                                    <span style="color: #6B6B6B; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Time</span><br>
                                                    <span style="color: #1C1C1C; font-size: 16px; font-weight: 600;">{formatted_time}</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                                <tr>
                                    <td align="center">
                                        <a href="{manage_url}" style="display: inline-block; background-color: #2E473B; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                                            View or Reschedule
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px 32px; border-top: 1px solid #E5E5E0; text-align: center;">
                            <p style="color: #6B6B6B; font-size: 12px; margin: 0;">
                                We look forward to seeing you!
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


def generate_cancellation_email(
    client_name: str,
    service_name: str,
    start_time: datetime,
    business_name: str,
    booking_url: str
) -> str:
    """Generate HTML for booking cancellation email"""
    formatted_date = start_time.strftime("%A, %B %d, %Y")
    formatted_time = start_time.strftime("%I:%M %p")
    
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #FAF9F6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #6B6B6B; padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
                            <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 600;">Booking Cancelled</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 32px;">
                            <p style="color: #1C1C1C; font-size: 16px; margin: 0 0 24px 0;">
                                Hi {client_name},
                            </p>
                            <p style="color: #6B6B6B; font-size: 16px; margin: 0 0 32px 0;">
                                Your appointment at <strong style="color: #1C1C1C;">{business_name}</strong> has been cancelled.
                            </p>
                            
                            <!-- Cancelled Appointment Details -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F6; border-radius: 12px; padding: 24px; margin-bottom: 32px; opacity: 0.8;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <p style="color: #6B6B6B; margin: 0 0 8px 0; text-decoration: line-through;">
                                            {service_name}
                                        </p>
                                        <p style="color: #6B6B6B; margin: 0; text-decoration: line-through;">
                                            {formatted_date} at {formatted_time}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #6B6B6B; font-size: 14px; margin: 0 0 32px 0;">
                                Would you like to book another appointment?
                            </p>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <a href="{booking_url}" style="display: inline-block; background-color: #2E473B; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                                            Book New Appointment
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px 32px; border-top: 1px solid #E5E5E0; text-align: center;">
                            <p style="color: #6B6B6B; font-size: 12px; margin: 0;">
                                We hope to see you again soon!
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
