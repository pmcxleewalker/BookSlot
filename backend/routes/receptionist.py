"""External booking API (API-key protected) and the AI receptionist."""
import hmac
import json
import logging
from datetime import timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, Response

from core import ai, booking, config
from core.db import db
import re
from datetime import datetime, timezone
from core.notify import same_phone, send_chat_reply, send_plain_text, to_e164
from core.deps import Actor, get_actor, get_manager
from core.plans import plan_features
from core.scheduling import DAYS, fmt, local_now, parse_date, to_local_naive
from core.security import new_id, now_iso, rate_limit, sha256
from routes.public import get_public_tenant, slots_for

router = APIRouter()
logger = logging.getLogger("bookslot.receptionist")


# =====================================================================
# External API (for phone bots, Zapier, your own website...)
# =====================================================================
async def api_tenant(tenant_id: str, request: Request, api_key: Optional[str] = Query(None)) -> Dict[str, Any]:
    key = request.headers.get("X-API-Key") or api_key
    if not key:
        raise HTTPException(status_code=401, detail="Missing API key (send it in the X-API-Key header)")
    tenant = await db.tenants.find_one({"tenant_id": tenant_id, "is_active": True}, {"_id": 0})
    if not tenant or not tenant.get("api_key_hash") or not hmac.compare_digest(tenant["api_key_hash"], sha256(key)):
        raise HTTPException(status_code=401, detail="Invalid API key")
    if not plan_features(tenant).get("api_webhooks"):
        raise HTTPException(status_code=403, detail="API access requires the Pro plan")
    return tenant


def opening_summary(staff_list: List[Dict[str, Any]]) -> str:
    lines = []
    for day in DAYS:
        spans = sorted({f"{(s.get('working_hours') or {}).get(day, {}).get('start')}-"
                        f"{(s.get('working_hours') or {}).get(day, {}).get('end')}"
                        for s in staff_list if (s.get("working_hours") or {}).get(day, {}).get("enabled")})
        lines.append(f"{day.title()}: {', '.join(spans) if spans else 'closed'}")
    return "; ".join(lines)


@router.get("/receptionist/{tenant_id}/info")
async def api_info(tenant: Dict = Depends(api_tenant)):
    services = await db.services.find({"tenant_id": tenant["tenant_id"], "is_active": True}, {"_id": 0}).to_list(200)
    staff = await db.staff.find({"tenant_id": tenant["tenant_id"], "is_active": True}, {"_id": 0}).to_list(200)
    return {
        "business": {k: tenant.get(k) for k in ("name", "industry", "address", "phone", "email", "timezone", "currency")},
        "opening_hours": opening_summary(staff),
        "services": [{"id": s["service_id"], "name": s["name"], "duration": s.get("duration"), "price": s.get("price")}
                     for s in services],
        "staff": [{"id": s["staff_id"], "name": s["name"], "services": s.get("services", [])} for s in staff],
    }


@router.get("/receptionist/{tenant_id}/availability")
async def api_availability(service_id: str, date: str, staff_id: str = "any", tenant: Dict = Depends(api_tenant)):
    service = await booking.get_service(tenant["tenant_id"], service_id)
    try:
        day = parse_date(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    slots = await slots_for(tenant, service, staff_id, day)
    return {"date": date, "service": service["name"], "duration_minutes": service.get("duration"),
            "available_slots": [{"start": fmt(s), "end": fmt(e), "staff_id": st["staff_id"], "staff_name": st["name"]}
                                for s, e, st in slots]}


async def _book(tenant: Dict[str, Any], data: Dict[str, Any], source: str) -> Dict[str, Any]:
    service = await booking.get_service(tenant["tenant_id"], data.get("service_id", ""))
    try:
        start = to_local_naive(data.get("start_time"), tenant.get("timezone"))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="start_time must be an ISO date-time like 2026-10-20T14:30:00")
    name, email, phone = booking.validate_client_details(data.get("client_name"), data.get("client_email"),
                                                         data.get("client_phone"))
    if not (email or phone):
        raise HTTPException(status_code=400, detail="An email address or phone number is required")
    staff_id = data.get("staff_id") or "any"
    if staff_id == "any":
        candidates = [st for s, _, st in await slots_for(tenant, service, "any", start.date()) if s == start]
    else:
        candidates = [await booking.get_staff_member(tenant["tenant_id"], staff_id)]
    if not candidates:
        raise HTTPException(status_code=409, detail="That time isn't available")
    error = None
    for staff in candidates:
        try:
            appt = await booking.create_booking(tenant, service, staff, start, client_name=name, client_email=email,
                                                client_phone=phone, notes=data.get("notes"), source=source)
            return {"appointment": appt, "service": service, "staff": staff}
        except HTTPException as e:
            error = e
            if e.status_code != 409:
                raise
    raise error


@router.post("/receptionist/{tenant_id}/book")
async def api_book(body: Dict[str, Any] = Body(...), tenant: Dict = Depends(api_tenant)):
    result = await _book(tenant, body, "api")
    appt = result["appointment"]
    return {"success": True, "confirmation_code": appt["appointment_id"], "status": appt["status"],
            "appointment": {"service": result["service"]["name"], "staff": result["staff"]["name"],
                            "start_time": appt["start_time"], "end_time": appt["end_time"]}}


async def _find_booking(tenant: Dict[str, Any], code: str) -> Dict[str, Any]:
    appt = await db.appointments.find_one({"appointment_id": (code or "").strip(), "tenant_id": tenant["tenant_id"]}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Booking not found")
    return appt


@router.get("/receptionist/{tenant_id}/booking/{code}")
async def api_get_booking(code: str, tenant: Dict = Depends(api_tenant)):
    appt = await _find_booking(tenant, code)
    appt.pop("blocked_until", None)
    return {"appointment": appt}


@router.post("/receptionist/{tenant_id}/cancel")
async def api_cancel(body: Dict[str, Any] = Body(...), tenant: Dict = Depends(api_tenant)):
    appt = await _find_booking(tenant, body.get("confirmation_code"))
    await booking.change_status(tenant, appt, "cancelled", reason=body.get("reason") or "Cancelled via API", by="client")
    return {"success": True, "message": "Booking cancelled"}


@router.post("/receptionist/{tenant_id}/reschedule")
async def api_reschedule(body: Dict[str, Any] = Body(...), tenant: Dict = Depends(api_tenant)):
    appt = await _find_booking(tenant, body.get("confirmation_code"))
    try:
        new_start = to_local_naive(body.get("new_start_time"), tenant.get("timezone"))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="new_start_time must be an ISO date-time")
    updated = await booking.reschedule(tenant, appt, new_start, enforce_availability=True)
    updated.pop("blocked_until", None)
    return {"success": True, "appointment": updated}


# =====================================================================
# AI receptionist
# =====================================================================
SYSTEM_PROMPT = """You are the friendly AI receptionist for {business_name}, a {industry} business.
You chat with customers to answer questions and to book, check or cancel appointments.

Current local date and time: {now} ({weekday}). Timezone: {timezone}. Prices are in {currency}.
Business details: address: {address}; phone: {phone}; email: {email}.
Opening hours (by team member): {hours}

Services (id | name | minutes | price):
{services}

Team (id | name | services they offer, 'all' = every service):
{staff}

{extra}
{channel_note}
HOW TO WORK
- Reply in plain, warm, concise language (1-4 short sentences). Never use markdown.
- NEVER guess availability. Before suggesting any time, use the check_availability action.
- Only use the book action after the customer has clearly confirmed the service, date, time and given
  their full name and an email address{phone_rule}. Repeat the details back and ask "Shall I book that?" first.
- To cancel or look up a booking you need the confirmation code (it starts with "appt_") AND the email
  address used for the booking.
- If you can't help (complaints, medical/legal questions, payments), give the business's phone/email.
- Don't make up services, prices or policies that aren't listed.

Respond with ONE JSON object and nothing else:
{{"reply": "message to show the customer (empty if you are only running an action)",
  "action": "none" | "check_availability" | "book" | "lookup_booking" | "cancel_booking",
  "params": {{ ... }} }}

Action params:
- check_availability: {{"service_id": "...", "date": "YYYY-MM-DD", "staff_id": "... or any"}}
- book: {{"service_id": "...", "staff_id": "... or any", "start_time": "YYYY-MM-DDTHH:MM:00",
          "client_name": "...", "client_email": "...", "client_phone": "... or empty", "notes": "..."}}
- lookup_booking / cancel_booking: {{"confirmation_code": "appt_...", "client_email": "..."}}
- my_bookings (text message / WhatsApp only): {{}} -> the customer's upcoming bookings for the number they are texting from
When you run an action you'll receive a RESULT message; then reply to the customer based on it."""


TEXT_CHANNEL_NOTE = """
THIS CONVERSATION IS BY {channel_name}. The customer is messaging from {phone}.
- Use {phone} as client_phone when booking. Don't ask for their phone number. An email address is optional here:
  ask for it once, but book without it if they'd rather not give one.
- To check, move or cancel their appointments, use my_bookings (no code needed), then cancel_booking with the
  confirmation_code from that result (client_email can be empty). To move one: book the new time, then cancel the old one.
- Keep replies short, like a text message from a receptionist.
"""


async def build_prompt(tenant: Dict[str, Any], channel: str = "web", client_phone: Optional[str] = None) -> str:
    services = await db.services.find({"tenant_id": tenant["tenant_id"], "is_active": True}, {"_id": 0}).to_list(100)
    staff = await db.staff.find({"tenant_id": tenant["tenant_id"], "is_active": True}, {"_id": 0}).to_list(100)
    names = {s["service_id"]: s["name"] for s in services}
    now = local_now(tenant.get("timezone"))
    settings = booking.tenant_settings(tenant)
    return SYSTEM_PROMPT.format(
        business_name=tenant.get("name"), industry=tenant.get("industry", "service"),
        now=now.strftime("%Y-%m-%d %H:%M"), weekday=now.strftime("%A"), timezone=tenant.get("timezone"),
        currency=tenant.get("currency", "EUR"), address=tenant.get("address") or "not listed",
        phone=tenant.get("phone") or "not listed", email=tenant.get("email") or "not listed",
        hours=opening_summary(staff),
        services="\n".join(f"{s['service_id']} | {s['name']} | {s.get('duration', 30)} | {s.get('price', 0)}"
                           + (f" | {s['description'][:150]}" if s.get("description") else "") for s in services) or "(none yet)",
        staff="\n".join(f"{s['staff_id']} | {s['name']} | "
                        + (", ".join(names.get(x, x) for x in s.get("services", [])) or "all") for s in staff) or "(none yet)",
        extra=("Extra instructions from the business:\n" + tenant["ai_instructions"][:2000]) if tenant.get("ai_instructions") else "",
        phone_rule=" and phone number" if settings.get("require_phone") else "",
        channel_note=TEXT_CHANNEL_NOTE.format(channel_name="WHATSAPP" if channel == "whatsapp" else "TEXT MESSAGE (SMS)",
                                              phone=client_phone) if channel in ("sms", "whatsapp") and client_phone else "",
    )


def history_for_llm(messages: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for m in messages[-24:]:
        role = "assistant" if m["role"] == "assistant" else "user"
        content = m.get("raw") or m.get("content") or ""
        if m["role"] == "tool":
            content = f"RESULT: {content}"
        if out and out[-1]["role"] == role:
            out[-1]["content"] += "\n\n" + content
        else:
            out.append({"role": role, "content": content})
    while out and out[0]["role"] != "user":
        out.pop(0)
    return out


async def run_action(tenant: Dict[str, Any], action: str, params: Dict[str, Any], conv: Dict[str, Any]) -> Dict[str, Any]:
    try:
        if action == "check_availability":
            service = await booking.get_service(tenant["tenant_id"], params.get("service_id", ""))
            day = parse_date(str(params.get("date", "")))
            slots = await slots_for(tenant, service, params.get("staff_id") or "any", day)
            result: Dict[str, Any] = {"date": day.isoformat(), "service": service["name"],
                                      "free_times": [{"start_time": fmt(s), "staff_id": st["staff_id"], "staff": st["name"]}
                                                     for s, _, st in slots[:24]]}
            if not slots:
                nxt = []
                for i in range(1, 15):
                    d = day + timedelta(days=i)
                    if await slots_for(tenant, service, params.get("staff_id") or "any", d):
                        nxt.append(d.isoformat())
                    if len(nxt) >= 3:
                        break
                result["next_days_with_space"] = nxt
            return result
        if action == "my_bookings":
            phone = conv.get("context", {}).get("phone")
            if not phone:
                return {"success": False, "error": "Only available by text message / WhatsApp"}
            now = local_now(tenant.get("timezone")).strftime("%Y-%m-%dT%H:%M:%S")
            appts = await db.appointments.find({"tenant_id": tenant["tenant_id"], "start_time": {"$gte": now},
                                                "status": {"$in": ["confirmed", "pending_approval"]}},
                                               {"_id": 0}).sort("start_time", 1).to_list(500)
            mine = [a for a in appts if same_phone(a.get("client_phone"), phone, tenant)][:5]
            names = {s["service_id"]: s["name"] for s in await db.services.find(
                {"tenant_id": tenant["tenant_id"]}, {"_id": 0, "service_id": 1, "name": 1}).to_list(200)}
            return {"success": True, "bookings": [{"confirmation_code": a["appointment_id"], "status": a["status"],
                                                   "start_time": a["start_time"], "service": names.get(a["service_id"])}
                                                  for a in mine]}
        if action == "book":
            if conv.get("context", {}).get("phone"):
                params = {**params, "client_phone": params.get("client_phone") or conv["context"]["phone"]}
            res = await _book(tenant, params, "ai_receptionist")
            appt = res["appointment"]
            conv["context"]["last_booking"] = appt["appointment_id"]
            return {"success": True, "confirmation_code": appt["appointment_id"], "status": appt["status"],
                    "service": res["service"]["name"], "staff": res["staff"]["name"], "start_time": appt["start_time"],
                    "note": "Booking needs staff approval" if appt["status"] == "pending_approval" else "Confirmed; confirmation email sent"}
        if action in ("lookup_booking", "cancel_booking"):
            appt = await db.appointments.find_one({"tenant_id": tenant["tenant_id"],
                                                   "appointment_id": str(params.get("confirmation_code", "")).strip()}, {"_id": 0})
            email = booking.normalize_email(params.get("client_email"))
            phone = conv.get("context", {}).get("phone")
            owns = bool(appt) and ((email and (appt.get("client_email") or "") == email)
                                   or (phone and same_phone(appt.get("client_phone"), phone, tenant)))
            if not owns:
                return {"success": False, "error": "No booking found with that code and email"}
            service = await db.services.find_one({"service_id": appt["service_id"]}, {"_id": 0, "name": 1}) or {}
            info = {"confirmation_code": appt["appointment_id"], "status": appt["status"],
                    "start_time": appt["start_time"], "service": service.get("name")}
            if action == "lookup_booking":
                return {"success": True, "booking": info}
            from routes.public import can_client_cancel
            ok, why = can_client_cancel(tenant, appt)
            if not ok:
                return {"success": False, "error": why or "This booking can't be cancelled online"}
            await booking.change_status(tenant, appt, "cancelled", reason="Cancelled via AI receptionist", by="client")
            return {"success": True, "cancelled": info}
        return {"success": False, "error": f"Unknown action {action}"}
    except HTTPException as e:
        return {"success": False, "error": e.detail}
    except ValueError as e:
        return {"success": False, "error": f"Invalid input: {e}"}


async def process_message(tenant: Dict[str, Any], session_key: str, channel: str, message: str,
                          client_phone: Optional[str] = None) -> Dict[str, Any]:
    if not config.AI_ENABLED:
        return {"response": "Our online assistant isn't available right now. "
                            f"Please book online or contact {tenant.get('name')} directly.",
                "conversation_id": None, "ai_available": False}
    conv = await db.moltbot_conversations.find_one({"tenant_id": tenant["tenant_id"], "client_identifier": session_key,
                                                    "status": "active"}, {"_id": 0})
    if not conv:
        conv = {"conversation_id": new_id("conv"), "tenant_id": tenant["tenant_id"], "client_identifier": session_key,
                "channel": channel, "messages": [], "context": {}, "status": "active",
                "created_at": now_iso(), "updated_at": now_iso()}
        await db.moltbot_conversations.insert_one({**conv})
    conv.setdefault("context", {})
    if channel in ("sms", "whatsapp") and client_phone:
        conv["context"]["phone"] = client_phone
    conv["messages"].append({"role": "user", "content": message[:2000], "timestamp": now_iso()})
    prompt = await build_prompt(tenant, channel, conv["context"].get("phone"))
    reply_text = ""
    actions_taken = []
    try:
        for _ in range(4):
            parsed = await ai.chat_json(prompt, history_for_llm(conv["messages"]))
            action = str(parsed.get("action") or "none")
            params = parsed.get("params") or {}
            reply_text = str(parsed.get("reply") or "").strip()
            conv["messages"].append({"role": "assistant", "content": reply_text, "raw": json.dumps(parsed)[:4000],
                                     "action": action, "timestamp": now_iso()})
            if action in ("none", "", None) or not isinstance(params, dict):
                break
            result = await run_action(tenant, action, params, conv)
            actions_taken.append({"action": action, "result": result})
            conv["messages"].append({"role": "tool", "content": json.dumps(result, default=str)[:4000],
                                     "timestamp": now_iso()})
        if not reply_text:
            reply_text = "Sorry, I didn't quite catch that. Could you rephrase?"
    except ai.AIError as e:
        logger.error("AI error: %s", e)
        reply_text = (f"Sorry, I'm having trouble right now. Please book online or contact {tenant.get('name')}"
                      + (f" on {tenant['phone']}" if tenant.get("phone") else "") + ".")
    if any(a["action"] == "book" and a["result"].get("success") for a in actions_taken):
        conv["context"]["booked"] = True
    conv["updated_at"] = now_iso()
    conv["messages"] = conv["messages"][-80:]
    await db.moltbot_conversations.update_one({"conversation_id": conv["conversation_id"]},
                                              {"$set": {"messages": conv["messages"], "context": conv["context"],
                                                        "updated_at": conv["updated_at"]}})
    return {"response": reply_text, "conversation_id": conv["conversation_id"], "actions": actions_taken,
            "ai_available": True}


def visible(conv: Dict[str, Any]) -> Dict[str, Any]:
    conv = dict(conv)
    conv["messages"] = [{k: m.get(k) for k in ("role", "content", "timestamp", "action")}
                        for m in conv.get("messages", []) if m.get("role") in ("user", "assistant") and m.get("content")]
    return conv


# ---------- Public chat on the booking page ----------
@router.post("/public/booking/{slug}/chat")
async def public_chat(slug: str, request: Request, body: Dict[str, Any] = Body(...)):
    rate_limit(request, "chat", 30, 300)
    tenant = await get_public_tenant(slug)
    if not plan_features(tenant).get("ai_assistant") or not tenant.get("ai_chat_enabled", True):
        raise HTTPException(status_code=403, detail="Chat isn't available for this business")
    message = str(body.get("message") or "").strip()
    session_id = str(body.get("session_id") or "").strip()[:64]
    if not message or not session_id:
        raise HTTPException(status_code=400, detail="message and session_id are required")
    result = await process_message(tenant, f"web:{session_id}", "web", message)
    return {"response": result["response"], "conversation_id": result["conversation_id"],
            "ai_available": result.get("ai_available", True)}


# ---------- Dashboard ----------
@router.get("/moltbot/status")
async def ai_status():
    return {"enabled": config.AI_ENABLED, "llm_available": config.AI_ENABLED, "llm_configured": config.AI_ENABLED,
            "provider": config.AI_PROVIDER or None, "model": config.AI_MODEL or None,
            "features": {"chat": config.AI_ENABLED}}


@router.get("/moltbot/settings")
async def get_ai_settings(actor: Actor = Depends(get_actor)):
    return {"ai_chat_enabled": actor.tenant.get("ai_chat_enabled", True),
            "ai_instructions": actor.tenant.get("ai_instructions") or "",
            "plan_allows": bool(actor.features.get("ai_assistant")), "configured": config.AI_ENABLED}


@router.put("/moltbot/settings")
async def update_ai_settings(body: Dict[str, Any], actor: Actor = Depends(get_manager)):
    data = {}
    if "ai_chat_enabled" in body:
        data["ai_chat_enabled"] = bool(body["ai_chat_enabled"])
    if "ai_instructions" in body:
        data["ai_instructions"] = str(body["ai_instructions"] or "")[:2000]
    await db.tenants.update_one({"tenant_id": actor.tenant_id}, {"$set": data})
    return {"message": "AI settings saved", **data}


@router.post("/moltbot/chat")
async def test_chat(body: Dict[str, Any], actor: Actor = Depends(get_actor)):
    actor.require_feature("ai_assistant")
    message = str(body.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    session = str(body.get("session_id") or actor.user_id)[:64]
    return await process_message(actor.tenant, f"test:{session}", "test", message)


@router.get("/moltbot/conversations")
async def list_conversations(actor: Actor = Depends(get_actor), status: Optional[str] = None, limit: int = 50):
    q: Dict[str, Any] = {"tenant_id": actor.tenant_id}
    if status:
        q["status"] = status
    convs = await db.moltbot_conversations.find(q, {"_id": 0}).sort("updated_at", -1).to_list(min(max(limit, 1), 200))
    return {"conversations": [visible(c) for c in convs]}


@router.get("/moltbot/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, actor: Actor = Depends(get_actor)):
    conv = await db.moltbot_conversations.find_one({"tenant_id": actor.tenant_id, "conversation_id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return visible(conv)


@router.post("/moltbot/conversations/{conversation_id}/close")
async def close_conversation(conversation_id: str, actor: Actor = Depends(get_actor)):
    result = await db.moltbot_conversations.update_one(
        {"tenant_id": actor.tenant_id, "conversation_id": conversation_id},
        {"$set": {"status": "completed", "updated_at": now_iso()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"message": "Conversation closed"}


# ---------- External chat API (e.g. connect your own SMS/WhatsApp bridge) ----------
@router.post("/moltbot/{tenant_id}/chat")
async def api_chat(body: Dict[str, Any] = Body(...), tenant: Dict = Depends(api_tenant)):
    if not plan_features(tenant).get("ai_assistant"):
        raise HTTPException(status_code=403, detail="AI assistant isn't included in this plan")
    message = str(body.get("message") or "").strip()
    client_id = str(body.get("client_identifier") or body.get("phone") or body.get("email") or "").strip()[:100]
    if not message or not client_id:
        raise HTTPException(status_code=400, detail="message and client_identifier are required")
    return await process_message(tenant, f"api:{client_id}", str(body.get("channel") or "api")[:20], message)


async def _reply_to_text(tenant: Dict[str, Any], channel: str, from_number: str, text: str,
                         via: Optional[str] = None) -> None:
    try:
        result = await process_message(tenant, f"{channel}:{from_number}", channel, text, client_phone=from_number)
        if result.get("response"):
            await send_chat_reply(tenant, channel, from_number, result["response"], via=via)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to answer %s message", channel)


CODE_RE = re.compile(r"#([a-z0-9][a-z0-9-]{1,59})", re.I)
BINDING_DAYS = 60


def shared_number(channel: str) -> str:
    return to_e164(config.TWILIO_WHATSAPP_NUMBER if channel == "whatsapp" else config.TWILIO_PHONE_NUMBER) or ""


async def resolve_shared(channel: str, from_number: str, text: str):
    """Which business is this client talking to on the shared number? Returns (tenant, cleaned_text).
    Isolation: a client is bound to one business at a time; everything the AI sees and does is scoped to it."""
    key = f"{channel}:{from_number}"
    m = CODE_RE.search(text)
    if m:
        tenant = await db.tenants.find_one({"booking_url_slug": m.group(1).lower(), "is_active": True}, {"_id": 0})
        if tenant:
            await db.channel_bindings.update_one({"_id": key}, {"$set": {
                "tenant_id": tenant["tenant_id"], "updated_at": now_iso()}}, upsert=True)
            cleaned = CODE_RE.sub("", text).strip(" ,.-") or "Hi"
            return tenant, cleaned
    binding = await db.channel_bindings.find_one({"_id": key})
    if binding:
        try:
            age = datetime.now(timezone.utc) - datetime.fromisoformat(binding["updated_at"].replace("Z", "+00:00"))
        except (KeyError, ValueError):
            age = None
        if age is not None and age.days <= BINDING_DAYS:
            tenant = await db.tenants.find_one({"tenant_id": binding["tenant_id"], "is_active": True}, {"_id": 0})
            if tenant:
                await db.channel_bindings.update_one({"_id": key}, {"$set": {"updated_at": now_iso()}})
                return tenant, text
    return None, text


async def _ask_which_business(channel: str, from_number: str, sender: str) -> None:
    key = f"ask:{channel}:{from_number}"
    recent = await db.channel_bindings.find_one({"_id": key})
    if recent and recent.get("updated_at", "") > (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat():
        return  # don't spam
    await db.channel_bindings.update_one({"_id": key}, {"$set": {"updated_at": now_iso()}}, upsert=True)
    await send_plain_text(channel, from_number, sender,
                          "Hi! This is the BookSlot booking line, used by several businesses. Which one would you like "
                          "to book with? Please tap the WhatsApp or text link on their booking page, or include their "
                          "code, e.g. #their-booking-link.")


@router.post("/moltbot/webhook/incoming-sms")
@router.post("/moltbot/webhook/incoming-whatsapp")
async def incoming_message(request: Request):
    """Twilio inbound SMS or WhatsApp -> AI receptionist.
    In Twilio, set the number's "A message comes in" webhook (SMS and/or WhatsApp sender) to
    <BACKEND_PUBLIC_URL>/api/moltbot/webhook/incoming-sms, and in /admin set the business's SMS number and/or
    WhatsApp number to that Twilio number. We answer Twilio straight away and send the AI's reply separately,
    so slow AI replies never time out."""
    form = await request.form()
    if not config.TWILIO_AUTH_TOKEN:
        raise HTTPException(status_code=503, detail="SMS is not configured")
    try:
        from twilio.request_validator import RequestValidator
    except ImportError:  # pragma: no cover
        raise HTTPException(status_code=503, detail="SMS is not configured")
    url = (config.BACKEND_PUBLIC_URL + request.url.path) if config.BACKEND_PUBLIC_URL else str(request.url)
    if not RequestValidator(config.TWILIO_AUTH_TOKEN).validate(url, dict(form), request.headers.get("X-Twilio-Signature", "")):
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")
    empty = Response(content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>', media_type="application/xml")
    to_raw, from_raw, text = str(form.get("To", "")), str(form.get("From", "")), str(form.get("Body", "")).strip()
    channel = "whatsapp" if to_raw.startswith("whatsapp:") else "sms"
    to_number, from_number = to_e164(to_raw), to_e164(from_raw)
    if not (to_number and from_number and text):
        return empty
    sid = str(form.get("MessageSid") or "")
    if sid:
        try:
            await db.inbound_messages.insert_one({"_id": sid, "created_at": now_iso()})
        except Exception:  # duplicate delivery from Twilio retry
            return empty
    from core.webhooks import spawn
    field = "whatsapp_number" if channel == "whatsapp" else "sms_number"
    tenant = await db.tenants.find_one({field: to_number, "is_active": True}, {"_id": 0})
    if not tenant and to_number == shared_number(channel):
        tenant, text = await resolve_shared(channel, from_number, text)
        if not tenant:
            spawn(_ask_which_business(channel, from_number, to_number))
            return empty
    if not tenant or not plan_features(tenant).get("ai_assistant") or not tenant.get("ai_chat_enabled", True):
        return empty
    spawn(_reply_to_text(tenant, channel, from_number, text[:2000], via=to_number))
    return empty
