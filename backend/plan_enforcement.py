"""
Plan Enforcement for TimeSlot Pro
Gates features based on subscription plan
"""
from typing import Optional, List, Dict, Any
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from models import PlanType


# Plan feature definitions
PLAN_FEATURES: Dict[str, Dict[str, Any]] = {
    "starter": {
        "price_monthly": 29,
        "max_staff": 2,
        "max_locations": 1,
        "max_services": 10,
        "max_resources": 2,
        "features": [
            "online_booking",
            "email_confirmations",
            "calendar_view",
            "client_management",
            "basic_reports",
        ],
        "restricted": [
            "sms_notifications",
            "automated_reminders",
            "waitlist",
            "deposits",
            "packages",
            "ai_receptionist",
            "api_access",
            "webhooks",
            "multi_location",
            "advanced_reports",
            "custom_forms",
            "white_label",
        ]
    },
    "growth": {
        "price_monthly": 79,
        "max_staff": 8,
        "max_locations": 1,
        "max_services": 50,
        "max_resources": 10,
        "features": [
            "online_booking",
            "email_confirmations",
            "calendar_view",
            "client_management",
            "basic_reports",
            "sms_notifications",
            "automated_reminders",
            "waitlist",
            "deposits",
            "packages",
            "ai_receptionist",
            "advanced_reports",
        ],
        "restricted": [
            "api_access",
            "webhooks",
            "multi_location",
            "custom_forms",
            "white_label",
        ]
    },
    "pro": {
        "price_monthly": 149,
        "max_staff": 50,
        "max_locations": 10,
        "max_services": 999,
        "max_resources": 50,
        "features": [
            "online_booking",
            "email_confirmations",
            "calendar_view",
            "client_management",
            "basic_reports",
            "sms_notifications",
            "automated_reminders",
            "waitlist",
            "deposits",
            "packages",
            "ai_receptionist",
            "advanced_reports",
            "api_access",
            "webhooks",
            "multi_location",
            "custom_forms",
            "white_label",
        ],
        "restricted": []
    }
}


async def get_tenant_plan(db: AsyncIOMotorDatabase, tenant_id: str) -> Optional[Dict[str, Any]]:
    """Get the current plan for a tenant"""
    subscription = await db.subscriptions.find_one(
        {"tenant_id": tenant_id, "is_active": True},
        {"_id": 0}
    )
    
    if not subscription:
        return None
    
    plan_name = subscription.get("plan", "starter")
    plan_config = PLAN_FEATURES.get(plan_name, PLAN_FEATURES["starter"])
    
    return {
        "plan": plan_name,
        "subscription": subscription,
        "config": plan_config
    }


async def check_feature_access(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    feature: str
) -> bool:
    """
    Check if a tenant has access to a specific feature.
    Returns True if allowed, False if restricted.
    """
    plan_data = await get_tenant_plan(db, tenant_id)
    
    if not plan_data:
        # No subscription, allow basic features only
        return feature in PLAN_FEATURES["starter"]["features"]
    
    plan_config = plan_data["config"]
    
    # Check if feature is in allowed list
    if feature in plan_config["features"]:
        return True
    
    # Check if feature is restricted
    if feature in plan_config["restricted"]:
        return False
    
    # Default allow if not explicitly restricted
    return True


async def require_feature(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    feature: str,
    feature_name: str = None
):
    """
    Require a feature to be available for the tenant.
    Raises HTTPException if not allowed.
    """
    if not await check_feature_access(db, tenant_id, feature):
        plan_data = await get_tenant_plan(db, tenant_id)
        current_plan = plan_data["plan"] if plan_data else "starter"
        
        # Find which plan has this feature
        upgrade_to = None
        for plan_name in ["growth", "pro"]:
            if feature in PLAN_FEATURES[plan_name]["features"]:
                upgrade_to = plan_name
                break
        
        raise HTTPException(
            status_code=403,
            detail={
                "error": "feature_restricted",
                "message": f"{feature_name or feature} is not available on your current plan",
                "current_plan": current_plan,
                "upgrade_to": upgrade_to,
                "feature": feature
            }
        )


async def check_resource_limit(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    resource_type: str,  # "staff", "locations", "services", "resources"
    current_count: Optional[int] = None
) -> Dict[str, Any]:
    """
    Check if tenant can add more of a resource type.
    Returns dict with allowed, current, limit, and remaining.
    """
    plan_data = await get_tenant_plan(db, tenant_id)
    
    if not plan_data:
        plan_config = PLAN_FEATURES["starter"]
    else:
        plan_config = plan_data["config"]
    
    limit_key = f"max_{resource_type}"
    limit = plan_config.get(limit_key, 999)
    
    # Get current count if not provided
    if current_count is None:
        collection_map = {
            "staff": "staff",
            "locations": "locations",
            "services": "services",
            "resources": "resources"
        }
        collection = collection_map.get(resource_type)
        if collection:
            current_count = await db[collection].count_documents({
                "tenant_id": tenant_id,
                "is_active": True
            })
        else:
            current_count = 0
    
    return {
        "allowed": current_count < limit,
        "current": current_count,
        "limit": limit,
        "remaining": max(0, limit - current_count),
        "plan": plan_data["plan"] if plan_data else "starter"
    }


async def require_resource_limit(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    resource_type: str,
    resource_name: str = None
):
    """
    Require that tenant hasn't hit resource limit.
    Raises HTTPException if limit reached.
    """
    limit_check = await check_resource_limit(db, tenant_id, resource_type)
    
    if not limit_check["allowed"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "limit_reached",
                "message": f"You've reached the maximum number of {resource_name or resource_type} for your plan",
                "current": limit_check["current"],
                "limit": limit_check["limit"],
                "plan": limit_check["plan"],
                "resource_type": resource_type
            }
        )


async def get_plan_usage_summary(
    db: AsyncIOMotorDatabase,
    tenant_id: str
) -> Dict[str, Any]:
    """
    Get a summary of plan usage for a tenant.
    Used for dashboard display.
    """
    plan_data = await get_tenant_plan(db, tenant_id)
    
    if not plan_data:
        plan_name = "starter"
        plan_config = PLAN_FEATURES["starter"]
    else:
        plan_name = plan_data["plan"]
        plan_config = plan_data["config"]
    
    # Get counts
    staff_count = await db.staff.count_documents({"tenant_id": tenant_id, "is_active": True})
    location_count = await db.locations.count_documents({"tenant_id": tenant_id, "is_active": True})
    service_count = await db.services.count_documents({"tenant_id": tenant_id, "is_active": True})
    resource_count = await db.resources.count_documents({"tenant_id": tenant_id, "is_active": True})
    
    return {
        "plan": plan_name,
        "price_monthly": plan_config["price_monthly"],
        "features": plan_config["features"],
        "restricted_features": plan_config["restricted"],
        "usage": {
            "staff": {
                "current": staff_count,
                "limit": plan_config["max_staff"],
                "percentage": round((staff_count / plan_config["max_staff"]) * 100, 1)
            },
            "locations": {
                "current": location_count,
                "limit": plan_config["max_locations"],
                "percentage": round((location_count / plan_config["max_locations"]) * 100, 1)
            },
            "services": {
                "current": service_count,
                "limit": plan_config["max_services"],
                "percentage": round((service_count / plan_config["max_services"]) * 100, 1)
            },
            "resources": {
                "current": resource_count,
                "limit": plan_config["max_resources"],
                "percentage": round((resource_count / plan_config["max_resources"]) * 100, 1)
            }
        }
    }
