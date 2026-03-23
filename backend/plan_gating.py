"""
Plan Feature Gating for TimeSlot Pro
Enforces feature access based on subscription plan
"""
from typing import Dict, List, Optional, Any
from enum import Enum
from functools import wraps
from fastapi import HTTPException


class PlanFeature(str, Enum):
    """All gated features in the system"""
    # Starter features (included in all plans)
    ONLINE_BOOKING = "online_booking"
    EMAIL_REMINDERS = "email_reminders"
    BASIC_CALENDAR = "basic_calendar"
    DEPOSITS = "deposits"
    CALENDAR_SYNC = "calendar_sync"
    
    # Growth features
    WAITLIST = "waitlist"
    PACKAGES = "packages"
    AI_ASSISTANT = "ai_assistant"
    SMS_REMINDERS = "sms_reminders"
    WHATSAPP_REMINDERS = "whatsapp_reminders"
    BASIC_REPORTS = "basic_reports"
    CUSTOM_FORMS = "custom_forms"
    
    # Pro features
    MULTI_LOCATION = "multi_location"
    UNLIMITED_STAFF = "unlimited_staff"
    ADVANCED_PERMISSIONS = "advanced_permissions"
    RESOURCE_BOOKING = "resource_booking"
    WHITE_LABEL = "white_label"
    API_ACCESS = "api_access"
    WEBHOOKS = "webhooks"
    ADVANCED_REPORTS = "advanced_reports"
    RECURRING_APPOINTMENTS = "recurring_appointments"
    VIP_MANAGEMENT = "vip_management"
    APPROVAL_WORKFLOWS = "approval_workflows"


# Plan definitions with features and limits
PLAN_DEFINITIONS = {
    "starter": {
        "name": "Starter",
        "price_monthly": 29.0,
        "max_staff": 2,
        "max_locations": 1,
        "max_services": 10,
        "max_bookings_per_month": 100,
        "max_clients": 200,
        "max_api_keys": 0,
        "max_webhooks": 0,
        "features": [
            PlanFeature.ONLINE_BOOKING,
            PlanFeature.EMAIL_REMINDERS,
            PlanFeature.BASIC_CALENDAR,
            PlanFeature.DEPOSITS,
            PlanFeature.CALENDAR_SYNC,
        ]
    },
    "growth": {
        "name": "Growth",
        "price_monthly": 79.0,
        "max_staff": 8,
        "max_locations": 1,
        "max_services": 50,
        "max_bookings_per_month": 500,
        "max_clients": 1000,
        "max_api_keys": 2,
        "max_webhooks": 3,
        "features": [
            # All starter features
            PlanFeature.ONLINE_BOOKING,
            PlanFeature.EMAIL_REMINDERS,
            PlanFeature.BASIC_CALENDAR,
            PlanFeature.DEPOSITS,
            PlanFeature.CALENDAR_SYNC,
            # Growth features
            PlanFeature.WAITLIST,
            PlanFeature.PACKAGES,
            PlanFeature.AI_ASSISTANT,
            PlanFeature.SMS_REMINDERS,
            PlanFeature.WHATSAPP_REMINDERS,
            PlanFeature.BASIC_REPORTS,
            PlanFeature.CUSTOM_FORMS,
        ]
    },
    "pro": {
        "name": "Pro",
        "price_monthly": 149.0,
        "max_staff": 999,  # Effectively unlimited
        "max_locations": 10,
        "max_services": 999,
        "max_bookings_per_month": 99999,
        "max_clients": 99999,
        "max_api_keys": 10,
        "max_webhooks": 20,
        "features": [
            # All features
            PlanFeature.ONLINE_BOOKING,
            PlanFeature.EMAIL_REMINDERS,
            PlanFeature.BASIC_CALENDAR,
            PlanFeature.DEPOSITS,
            PlanFeature.CALENDAR_SYNC,
            PlanFeature.WAITLIST,
            PlanFeature.PACKAGES,
            PlanFeature.AI_ASSISTANT,
            PlanFeature.SMS_REMINDERS,
            PlanFeature.WHATSAPP_REMINDERS,
            PlanFeature.BASIC_REPORTS,
            PlanFeature.CUSTOM_FORMS,
            PlanFeature.MULTI_LOCATION,
            PlanFeature.UNLIMITED_STAFF,
            PlanFeature.ADVANCED_PERMISSIONS,
            PlanFeature.RESOURCE_BOOKING,
            PlanFeature.WHITE_LABEL,
            PlanFeature.API_ACCESS,
            PlanFeature.WEBHOOKS,
            PlanFeature.ADVANCED_REPORTS,
            PlanFeature.RECURRING_APPOINTMENTS,
            PlanFeature.VIP_MANAGEMENT,
            PlanFeature.APPROVAL_WORKFLOWS,
        ]
    }
}


def get_plan_definition(plan: str) -> Dict[str, Any]:
    """Get plan definition by name"""
    return PLAN_DEFINITIONS.get(plan.lower(), PLAN_DEFINITIONS["starter"])


def has_feature(plan: str, feature: PlanFeature) -> bool:
    """Check if a plan has a specific feature"""
    plan_def = get_plan_definition(plan)
    return feature in plan_def.get("features", [])


def get_plan_limit(plan: str, limit_name: str) -> int:
    """Get a specific limit for a plan"""
    plan_def = get_plan_definition(plan)
    return plan_def.get(limit_name, 0)


async def check_feature_access(
    db,
    tenant_id: str,
    feature: PlanFeature,
    raise_error: bool = True
) -> bool:
    """
    Check if tenant has access to a feature based on their plan
    """
    subscription = await db.subscriptions.find_one(
        {"tenant_id": tenant_id, "is_active": True},
        {"_id": 0}
    )
    
    if not subscription:
        if raise_error:
            raise HTTPException(status_code=403, detail="No active subscription")
        return False
    
    plan = subscription.get("plan", "starter")
    
    if not has_feature(plan, feature):
        if raise_error:
            plan_def = get_plan_definition(plan)
            raise HTTPException(
                status_code=403,
                detail=f"This feature requires an upgrade. Your plan: {plan_def['name']}. "
                       f"Please upgrade to access {feature.value.replace('_', ' ').title()}."
            )
        return False
    
    return True


async def check_resource_limit(
    db,
    tenant_id: str,
    resource_type: str,
    current_count: Optional[int] = None,
    raise_error: bool = True
) -> bool:
    """
    Check if tenant has reached resource limits
    resource_type: staff, locations, services, bookings_month, clients, api_keys, webhooks
    """
    subscription = await db.subscriptions.find_one(
        {"tenant_id": tenant_id, "is_active": True},
        {"_id": 0}
    )
    
    if not subscription:
        if raise_error:
            raise HTTPException(status_code=403, detail="No active subscription")
        return False
    
    plan = subscription.get("plan", "starter")
    plan_def = get_plan_definition(plan)
    
    # Map resource types to limit names and collections
    resource_map = {
        "staff": ("max_staff", "staff", {"is_active": True}),
        "locations": ("max_locations", "locations", {"is_active": True}),
        "services": ("max_services", "services", {"is_active": True}),
        "clients": ("max_clients", "clients", {"is_active": True}),
        "api_keys": ("max_api_keys", "api_keys", {"is_active": True}),
        "webhooks": ("max_webhooks", "webhooks", {"is_active": True}),
    }
    
    if resource_type not in resource_map:
        return True
    
    limit_name, collection, extra_query = resource_map[resource_type]
    max_allowed = plan_def.get(limit_name, 0)
    
    # Get current count if not provided
    if current_count is None:
        query = {"tenant_id": tenant_id, **extra_query}
        current_count = await db[collection].count_documents(query)
    
    if current_count >= max_allowed:
        if raise_error:
            raise HTTPException(
                status_code=403,
                detail=f"You've reached the {resource_type} limit for your plan ({max_allowed}). "
                       f"Please upgrade to add more."
            )
        return False
    
    return True


async def check_monthly_booking_limit(
    db,
    tenant_id: str,
    raise_error: bool = True
) -> bool:
    """Check if tenant has reached monthly booking limit"""
    from datetime import datetime, timezone
    
    subscription = await db.subscriptions.find_one(
        {"tenant_id": tenant_id, "is_active": True},
        {"_id": 0}
    )
    
    if not subscription:
        if raise_error:
            raise HTTPException(status_code=403, detail="No active subscription")
        return False
    
    plan = subscription.get("plan", "starter")
    plan_def = get_plan_definition(plan)
    max_bookings = plan_def.get("max_bookings_per_month", 100)
    
    # Get first day of current month
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Count bookings this month
    booking_count = await db.appointments.count_documents({
        "tenant_id": tenant_id,
        "created_at": {"$gte": month_start.isoformat()}
    })
    
    if booking_count >= max_bookings:
        if raise_error:
            raise HTTPException(
                status_code=403,
                detail=f"You've reached your monthly booking limit ({max_bookings}). "
                       f"Please upgrade to accept more bookings."
            )
        return False
    
    return True


def get_upgrade_prompt(current_plan: str, required_feature: PlanFeature) -> Dict[str, Any]:
    """Get upgrade prompt information for a required feature"""
    # Find minimum plan that has this feature
    for plan_name in ["growth", "pro"]:
        if has_feature(plan_name, required_feature):
            plan_def = get_plan_definition(plan_name)
            return {
                "required_plan": plan_name,
                "plan_name": plan_def["name"],
                "price": plan_def["price_monthly"],
                "feature": required_feature.value.replace("_", " ").title()
            }
    
    return {
        "required_plan": "pro",
        "plan_name": "Pro",
        "price": 149.0,
        "feature": required_feature.value.replace("_", " ").title()
    }


async def get_tenant_usage(db, tenant_id: str) -> Dict[str, Any]:
    """Get current usage stats for a tenant"""
    from datetime import datetime, timezone
    
    subscription = await db.subscriptions.find_one(
        {"tenant_id": tenant_id, "is_active": True},
        {"_id": 0}
    )
    
    plan = subscription.get("plan", "starter") if subscription else "starter"
    plan_def = get_plan_definition(plan)
    
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get counts
    staff_count = await db.staff.count_documents({"tenant_id": tenant_id, "is_active": True})
    location_count = await db.locations.count_documents({"tenant_id": tenant_id, "is_active": True})
    service_count = await db.services.count_documents({"tenant_id": tenant_id, "is_active": True})
    client_count = await db.clients.count_documents({"tenant_id": tenant_id, "is_active": True})
    api_key_count = await db.api_keys.count_documents({"tenant_id": tenant_id, "is_active": True})
    webhook_count = await db.webhooks.count_documents({"tenant_id": tenant_id, "is_active": True})
    monthly_bookings = await db.appointments.count_documents({
        "tenant_id": tenant_id,
        "created_at": {"$gte": month_start.isoformat()}
    })
    
    return {
        "plan": plan,
        "plan_name": plan_def["name"],
        "usage": {
            "staff": {"current": staff_count, "max": plan_def["max_staff"]},
            "locations": {"current": location_count, "max": plan_def["max_locations"]},
            "services": {"current": service_count, "max": plan_def["max_services"]},
            "clients": {"current": client_count, "max": plan_def["max_clients"]},
            "api_keys": {"current": api_key_count, "max": plan_def["max_api_keys"]},
            "webhooks": {"current": webhook_count, "max": plan_def["max_webhooks"]},
            "bookings_this_month": {"current": monthly_bookings, "max": plan_def["max_bookings_per_month"]},
        },
        "features": [f.value for f in plan_def["features"]]
    }
