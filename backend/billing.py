"""
Billing Module for TimeSlot Pro
Stripe subscription billing for tenant plans
"""
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import HTTPException, Request
import os
import logging

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, 
    CheckoutSessionResponse, 
    CheckoutStatusResponse, 
    CheckoutSessionRequest
)
from models import generate_id

logger = logging.getLogger(__name__)

# Fixed subscription plans - NEVER accept amounts from frontend
SUBSCRIPTION_PLANS = {
    "starter": {
        "name": "Starter",
        "price_monthly": 29.00,
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
        ]
    },
    "growth": {
        "name": "Growth",
        "price_monthly": 79.00,
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
        ]
    },
    "pro": {
        "name": "Pro",
        "price_monthly": 149.00,
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
        ]
    }
}


def get_stripe_checkout(request: Request) -> StripeCheckout:
    """Initialize Stripe checkout with webhook URL"""
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    return StripeCheckout(api_key=api_key, webhook_url=webhook_url)


async def create_subscription_checkout(
    db: AsyncIOMotorDatabase,
    request: Request,
    tenant_id: str,
    user_id: str,
    user_email: str,
    plan_id: str,
    origin_url: str
) -> Dict[str, Any]:
    """
    Create a Stripe checkout session for subscription payment.
    Amount is fetched from server-side SUBSCRIPTION_PLANS, never from frontend.
    """
    # Validate plan exists
    if plan_id not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {plan_id}")
    
    plan = SUBSCRIPTION_PLANS[plan_id]
    amount = plan["price_monthly"]
    
    # Build URLs from frontend origin
    success_url = f"{origin_url}/dashboard/billing?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/dashboard/billing?cancelled=true"
    
    # Initialize Stripe
    stripe_checkout = get_stripe_checkout(request)
    
    # Create checkout request
    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency="eur",  # Irish market uses EUR
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "tenant_id": tenant_id,
            "user_id": user_id,
            "plan_id": plan_id,
            "type": "subscription"
        }
    )
    
    # Create checkout session
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
    
    # MANDATORY: Create payment transaction record BEFORE redirect
    transaction = {
        "transaction_id": generate_id("txn_"),
        "tenant_id": tenant_id,
        "user_id": user_id,
        "user_email": user_email,
        "session_id": session.session_id,
        "amount": amount,
        "currency": "eur",
        "plan_id": plan_id,
        "type": "subscription",
        "payment_status": "pending",
        "status": "initiated",
        "metadata": {
            "plan_name": plan["name"],
            "max_staff": plan["max_staff"],
            "max_locations": plan["max_locations"]
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payment_transactions.insert_one(transaction)
    
    return {
        "checkout_url": session.url,
        "session_id": session.session_id,
        "plan": plan_id,
        "amount": amount,
        "currency": "eur"
    }


async def check_payment_status(
    db: AsyncIOMotorDatabase,
    request: Request,
    session_id: str,
    tenant_id: str
) -> Dict[str, Any]:
    """
    Check payment status and update subscription if successful.
    Prevents duplicate processing of the same payment.
    """
    # Get existing transaction
    transaction = await db.payment_transactions.find_one(
        {"session_id": session_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # If already processed successfully, return cached status
    if transaction.get("payment_status") == "paid":
        return {
            "status": "complete",
            "payment_status": "paid",
            "plan_id": transaction.get("plan_id"),
            "message": "Payment already processed"
        }
    
    # Check status with Stripe
    stripe_checkout = get_stripe_checkout(request)
    
    try:
        checkout_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        logger.error(f"Error checking payment status: {e}")
        return {
            "status": transaction.get("status", "pending"),
            "payment_status": transaction.get("payment_status", "pending"),
            "error": "Could not verify payment status"
        }
    
    # Update transaction status
    new_status = "complete" if checkout_status.payment_status == "paid" else checkout_status.status
    new_payment_status = checkout_status.payment_status
    
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": new_status,
            "payment_status": new_payment_status,
            "stripe_amount_total": checkout_status.amount_total,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # If payment successful, upgrade subscription
    if checkout_status.payment_status == "paid":
        plan_id = transaction.get("plan_id")
        if plan_id and plan_id in SUBSCRIPTION_PLANS:
            await upgrade_tenant_subscription(db, tenant_id, plan_id)
    
    return {
        "status": new_status,
        "payment_status": new_payment_status,
        "amount_total": checkout_status.amount_total,
        "currency": checkout_status.currency,
        "plan_id": transaction.get("plan_id")
    }


async def upgrade_tenant_subscription(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    plan_id: str
) -> bool:
    """
    Upgrade tenant subscription after successful payment.
    """
    if plan_id not in SUBSCRIPTION_PLANS:
        return False
    
    plan = SUBSCRIPTION_PLANS[plan_id]
    
    # Update subscription
    result = await db.subscriptions.update_one(
        {"tenant_id": tenant_id, "is_active": True},
        {"$set": {
            "plan": plan_id,
            "price_monthly": plan["price_monthly"],
            "max_staff": plan["max_staff"],
            "max_locations": plan["max_locations"],
            "features": plan["features"],
            "is_trial": False,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "last_payment_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        # Create new subscription if none exists
        subscription = {
            "subscription_id": generate_id("sub_"),
            "tenant_id": tenant_id,
            "plan": plan_id,
            "price_monthly": plan["price_monthly"],
            "max_staff": plan["max_staff"],
            "max_locations": plan["max_locations"],
            "features": plan["features"],
            "is_active": True,
            "is_trial": False,
            "start_date": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "last_payment_at": datetime.now(timezone.utc).isoformat()
        }
        await db.subscriptions.insert_one(subscription)
    
    logger.info(f"Tenant {tenant_id} upgraded to {plan_id} plan")
    return True


async def handle_stripe_webhook(
    db: AsyncIOMotorDatabase,
    request: Request,
    body: bytes
) -> Dict[str, Any]:
    """
    Handle Stripe webhook events.
    """
    stripe_checkout = get_stripe_checkout(request)
    signature = request.headers.get("Stripe-Signature")
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        logger.info(f"Stripe webhook received: {webhook_response.event_type}")
        
        # Handle checkout.session.completed event
        if webhook_response.event_type in ["checkout.session.completed", "payment_intent.succeeded"]:
            session_id = webhook_response.session_id
            metadata = webhook_response.metadata or {}
            
            # Update transaction
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "payment_status": webhook_response.payment_status,
                    "status": "complete",
                    "webhook_event_id": webhook_response.event_id,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Upgrade subscription if applicable
            tenant_id = metadata.get("tenant_id")
            plan_id = metadata.get("plan_id")
            
            if tenant_id and plan_id:
                await upgrade_tenant_subscription(db, tenant_id, plan_id)
        
        return {"received": True, "event_type": webhook_response.event_type}
    
    except Exception as e:
        logger.error(f"Webhook handling error: {e}")
        return {"received": True, "error": str(e)}


def get_plan_details(plan_id: str) -> Optional[Dict[str, Any]]:
    """Get details for a specific plan"""
    return SUBSCRIPTION_PLANS.get(plan_id)


def get_all_plans() -> Dict[str, Any]:
    """Get all available plans"""
    return SUBSCRIPTION_PLANS
