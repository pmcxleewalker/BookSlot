"""
Trial System for TimeSlot Pro
Handles 3-day free trials with early signup discounts
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import HTTPException
import secrets

from models import generate_id
from auth import hash_password  # Use the same password hashing as auth module

# Trial configuration
TRIAL_DURATION_DAYS = 3
EARLY_SIGNUP_DISCOUNT_PERCENT = 5
EARLY_SIGNUP_DISCOUNT_MONTHS = 3

# Plan configurations (must match billing.py)
PLAN_CONFIGS = {
    "starter": {"price": 90, "max_staff": 2, "max_locations": 1, "max_services": 10, "max_resources": 2},
    "growth": {"price": 145, "max_staff": 8, "max_locations": 1, "max_services": 50, "max_resources": 10},
    "pro": {"price": 299, "max_staff": 50, "max_locations": 10, "max_services": 999, "max_resources": 50},
}

TRIAL_FEATURES = [
    "online_booking",
    "email_confirmations", 
    "calendar_view",
    "client_management",
    "calendar_sync",
    "automated_reminders",
    "ai_receptionist",
    "reports",
]


def generate_slug(business_name: str) -> str:
    """Generate URL-safe slug from business name"""
    slug = business_name.lower()
    slug = ''.join(c if c.isalnum() or c == ' ' else '' for c in slug)
    slug = '-'.join(slug.split())
    # Add random suffix to ensure uniqueness
    slug = f"{slug}-{secrets.token_hex(3)}"
    return slug


async def create_trial_tenant(
    db: AsyncIOMotorDatabase,
    business_name: str,
    owner_name: str,
    owner_email: str,
    owner_password: str,
    business_type: str = "general"
) -> Dict[str, Any]:
    """
    Create a new tenant with 3-day trial.
    Returns tenant info including booking URL.
    """
    # Check if email already exists
    existing_user = await db.users.find_one({"email": owner_email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered. Please login instead.")
    
    # Generate IDs and slug
    tenant_id = generate_id("tenant_")
    user_id = generate_id("user_")
    slug = generate_slug(business_name)
    
    # Ensure slug is unique
    existing_slug = await db.tenants.find_one({"slug": slug})
    if existing_slug:
        slug = f"{slug}-{secrets.token_hex(2)}"
    
    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=TRIAL_DURATION_DAYS)
    
    # Create tenant
    tenant = {
        "tenant_id": tenant_id,
        "name": business_name,
        "slug": slug,
        "industry": business_type,
        "email": owner_email.lower(),
        "phone": "",
        "address": "",
        "timezone": "Europe/Dublin",
        "currency": "EUR",
        "is_active": True,
        "branding": {
            "primary_color": "#1f2937",
            "secondary_color": "#6b7280",
            "accent_color": "#10b981"
        },
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    # Create subscription with trial
    subscription = {
        "subscription_id": generate_id("sub_"),
        "tenant_id": tenant_id,
        "plan": "trial",
        "price_monthly": 0,
        "max_staff": 8,  # Give growth-level limits during trial
        "max_locations": 1,
        "max_services": 50,
        "max_resources": 10,
        "features": TRIAL_FEATURES,
        "is_active": True,
        "is_trial": True,
        "trial_start_date": now.isoformat(),
        "trial_end_date": trial_end.isoformat(),
        "early_signup_eligible": True,
        "early_signup_discount_percent": EARLY_SIGNUP_DISCOUNT_PERCENT,
        "early_signup_discount_months": EARLY_SIGNUP_DISCOUNT_MONTHS,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    # Create owner user
    user = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "email": owner_email.lower(),
        "password_hash": hash_password(owner_password),
        "name": owner_name,
        "role": "owner",
        "is_active": True,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    # Create default staff member (owner)
    staff = {
        "staff_id": generate_id("staff_"),
        "tenant_id": tenant_id,
        "user_id": user_id,
        "name": owner_name,
        "email": owner_email.lower(),
        "role": "owner",
        "services": [],
        "working_hours": {
            "monday": {"start": "09:00", "end": "17:00", "enabled": True},
            "tuesday": {"start": "09:00", "end": "17:00", "enabled": True},
            "wednesday": {"start": "09:00", "end": "17:00", "enabled": True},
            "thursday": {"start": "09:00", "end": "17:00", "enabled": True},
            "friday": {"start": "09:00", "end": "17:00", "enabled": True},
            "saturday": {"start": "10:00", "end": "14:00", "enabled": False},
            "sunday": {"start": "10:00", "end": "14:00", "enabled": False},
        },
        "is_active": True,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    # Insert all records
    await db.tenants.insert_one(tenant)
    await db.subscriptions.insert_one(subscription)
    await db.users.insert_one(user)
    await db.staff.insert_one(staff)
    
    return {
        "tenant_id": tenant_id,
        "user_id": user_id,
        "business_name": business_name,
        "slug": slug,
        "booking_url": f"/book/{slug}",
        "trial_end_date": trial_end.isoformat(),
        "days_remaining": TRIAL_DURATION_DAYS,
        "early_signup_discount": f"{EARLY_SIGNUP_DISCOUNT_PERCENT}% off for {EARLY_SIGNUP_DISCOUNT_MONTHS} months"
    }


async def get_trial_status(
    db: AsyncIOMotorDatabase,
    tenant_id: str
) -> Dict[str, Any]:
    """
    Get current trial status for a tenant.
    Returns trial info including days remaining and discount eligibility.
    """
    subscription = await db.subscriptions.find_one(
        {"tenant_id": tenant_id, "is_active": True},
        {"_id": 0}
    )
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    is_trial = subscription.get("is_trial", False)
    
    if not is_trial:
        return {
            "is_trial": False,
            "plan": subscription.get("plan"),
            "trial_expired": False,
            "early_signup_eligible": False
        }
    
    trial_end_str = subscription.get("trial_end_date")
    if not trial_end_str:
        return {
            "is_trial": True,
            "trial_expired": True,
            "days_remaining": 0,
            "early_signup_eligible": False
        }
    
    trial_end = datetime.fromisoformat(trial_end_str.replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    
    time_remaining = trial_end - now
    days_remaining = max(0, time_remaining.days)
    hours_remaining = max(0, int(time_remaining.total_seconds() // 3600))
    
    trial_expired = now >= trial_end
    early_signup_eligible = not trial_expired and subscription.get("early_signup_eligible", False)
    
    return {
        "is_trial": True,
        "trial_expired": trial_expired,
        "trial_end_date": trial_end_str,
        "days_remaining": days_remaining,
        "hours_remaining": hours_remaining,
        "early_signup_eligible": early_signup_eligible,
        "discount_percent": EARLY_SIGNUP_DISCOUNT_PERCENT if early_signup_eligible else 0,
        "discount_months": EARLY_SIGNUP_DISCOUNT_MONTHS if early_signup_eligible else 0,
        "plans": [
            {
                "id": "starter",
                "name": "Starter",
                "price": PLAN_CONFIGS["starter"]["price"],
                "discounted_price": round(PLAN_CONFIGS["starter"]["price"] * (1 - EARLY_SIGNUP_DISCOUNT_PERCENT/100), 2) if early_signup_eligible else PLAN_CONFIGS["starter"]["price"]
            },
            {
                "id": "growth", 
                "name": "Growth",
                "price": PLAN_CONFIGS["growth"]["price"],
                "discounted_price": round(PLAN_CONFIGS["growth"]["price"] * (1 - EARLY_SIGNUP_DISCOUNT_PERCENT/100), 2) if early_signup_eligible else PLAN_CONFIGS["growth"]["price"]
            },
            {
                "id": "pro",
                "name": "Pro", 
                "price": PLAN_CONFIGS["pro"]["price"],
                "discounted_price": round(PLAN_CONFIGS["pro"]["price"] * (1 - EARLY_SIGNUP_DISCOUNT_PERCENT/100), 2) if early_signup_eligible else PLAN_CONFIGS["pro"]["price"]
            }
        ]
    }


async def convert_trial_to_paid(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    plan_id: str,
    apply_discount: bool = False
) -> Dict[str, Any]:
    """
    Convert a trial subscription to a paid plan.
    Applies early signup discount if eligible.
    """
    if plan_id not in PLAN_CONFIGS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    subscription = await db.subscriptions.find_one(
        {"tenant_id": tenant_id, "is_active": True},
        {"_id": 0}
    )
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Check discount eligibility
    trial_status = await get_trial_status(db, tenant_id)
    discount_eligible = trial_status.get("early_signup_eligible", False) and apply_discount
    
    plan_config = PLAN_CONFIGS[plan_id]
    base_price = plan_config["price"]
    
    discount_info = None
    if discount_eligible:
        discounted_price = round(base_price * (1 - EARLY_SIGNUP_DISCOUNT_PERCENT/100), 2)
        discount_info = {
            "discount_percent": EARLY_SIGNUP_DISCOUNT_PERCENT,
            "discount_months": EARLY_SIGNUP_DISCOUNT_MONTHS,
            "original_price": base_price,
            "discounted_price": discounted_price,
            "discount_expires_at": (datetime.now(timezone.utc) + timedelta(days=30 * EARLY_SIGNUP_DISCOUNT_MONTHS)).isoformat()
        }
    
    # Get features for this plan from billing
    from billing import SUBSCRIPTION_PLANS
    plan_features = SUBSCRIPTION_PLANS.get(plan_id, {}).get("features", [])
    
    # Update subscription
    now = datetime.now(timezone.utc)
    update_data = {
        "plan": plan_id,
        "price_monthly": base_price,
        "max_staff": plan_config["max_staff"],
        "max_locations": plan_config["max_locations"],
        "max_services": plan_config.get("max_services", 50),
        "max_resources": plan_config.get("max_resources", 10),
        "features": plan_features,
        "is_trial": False,
        "trial_converted_at": now.isoformat(),
        "early_signup_eligible": False,
        "updated_at": now.isoformat()
    }
    
    if discount_info:
        update_data["active_discount"] = discount_info
    
    await db.subscriptions.update_one(
        {"tenant_id": tenant_id, "is_active": True},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "plan": plan_id,
        "price": base_price,
        "discount_applied": discount_info,
        "message": f"Successfully upgraded to {plan_id.title()} plan"
    }


async def check_trial_access(
    db: AsyncIOMotorDatabase,
    tenant_id: str
) -> bool:
    """
    Check if tenant has access (either active trial or paid plan).
    Returns False if trial expired and no paid plan.
    """
    trial_status = await get_trial_status(db, tenant_id)
    
    if not trial_status.get("is_trial"):
        return True  # Paid plan
    
    if trial_status.get("trial_expired"):
        return False  # Trial expired
    
    return True  # Trial still active
