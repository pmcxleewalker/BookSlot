from typing import Any, Dict

PLAN_FEATURES: Dict[str, Dict[str, Any]] = {
    "starter": {
        "name": "Starter", "price": 29, "max_locations": 1, "max_staff": 2,
        "online_booking": True, "reminders": True, "deposits": True, "calendar_sync": True,
        "basic_reports": True, "waitlist": False, "packages": False, "ai_assistant": False,
        "sms_automations": False, "advanced_reports": False, "multi_location": False,
        "advanced_permissions": False, "resource_booking": False, "custom_forms": False,
        "white_label": False, "api_webhooks": False,
    },
    "growth": {
        "name": "Growth", "price": 79, "max_locations": 1, "max_staff": 8,
        "online_booking": True, "reminders": True, "deposits": True, "calendar_sync": True,
        "basic_reports": True, "waitlist": True, "packages": True, "ai_assistant": True,
        "sms_automations": True, "advanced_reports": True, "multi_location": False,
        "advanced_permissions": False, "resource_booking": False, "custom_forms": False,
        "white_label": False, "api_webhooks": False,
    },
    "pro": {
        "name": "Pro", "price": 149, "max_locations": 999, "max_staff": 999,
        "online_booking": True, "reminders": True, "deposits": True, "calendar_sync": True,
        "basic_reports": True, "waitlist": True, "packages": True, "ai_assistant": True,
        "sms_automations": True, "advanced_reports": True, "multi_location": True,
        "advanced_permissions": True, "resource_booking": True, "custom_forms": True,
        "white_label": True, "api_webhooks": True,
    },
}

FEATURE_LABELS = {
    "ai_assistant": "the AI Receptionist (Growth plan or higher)",
    "api_webhooks": "API access and webhooks (Pro plan)",
    "custom_forms": "custom forms (Pro plan)",
    "white_label": "removing BookSlot branding (Pro plan)",
}


def plan_features(tenant: Dict[str, Any]) -> Dict[str, Any]:
    plan = (tenant or {}).get("plan", "starter")
    features = dict(PLAN_FEATURES.get(plan, PLAN_FEATURES["starter"]))
    # Super admin can grant/revoke individual features per tenant
    features.update((tenant or {}).get("feature_overrides") or {})
    return features
