"""AI receptionist flow with a scripted (fake) LLM - no API key needed.

Checks that the assistant must check availability before booking, that the booking it makes
is real and validated, and that cancelling needs the right code + email.

    MONGO_URL=... DB_NAME=bookslot_e2e python tests/test_ai_flow.py
"""
import asyncio
import json
import os
import sys
import uuid
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DB_NAME", "bookslot_e2e")

from core import ai, config  # noqa: E402
from core.db import db  # noqa: E402
from core.scheduling import DEFAULT_WORKING_HOURS  # noqa: E402
from routes import receptionist  # noqa: E402
from routes.tenants import create_tenant_record  # noqa: E402


class ScriptedLLM:
    def __init__(self, replies):
        self.replies = list(replies)
        self.seen = []

    async def __call__(self, system_prompt, messages, max_tokens=700):
        self.seen.append(messages)
        reply = self.replies.pop(0)
        return reply(messages) if callable(reply) else reply


async def main():
    config.AI_ENABLED = True
    run = uuid.uuid4().hex[:6]
    tenant = await create_tenant_record({"name": f"AI Test {run}", "email": f"ai_{run}@example.com",
                                         "timezone": "Europe/Dublin"}, plan="growth", onboarding_completed=True)
    tid = tenant["tenant_id"]
    await db.services.insert_one({"service_id": f"service_ai{run}", "tenant_id": tid, "name": "Haircut", "duration": 45,
                                  "buffer_time": 0, "price": 30, "is_active": True, "created_at": "2026-01-01"})
    await db.staff.insert_one({"staff_id": f"staff_ai{run}", "tenant_id": tid, "name": "Alex", "email": "alex@example.com",
                               "services": [], "working_hours": DEFAULT_WORKING_HOURS, "is_active": True,
                               "created_at": "2026-01-01"})
    day = date.today() + timedelta(days=(0 - date.today().weekday()) % 7 or 7)  # next Monday

    captured = {}

    def book_from_results(messages):
        result = json.loads(messages[-1]["content"].split("RESULT: ", 1)[1])
        first = result["free_times"][0]
        captured["slot"] = first["start_time"]
        return {"reply": "", "action": "book", "params": {
            "service_id": f"service_ai{run}", "staff_id": "any", "start_time": first["start_time"],
            "client_name": "Chat Person", "client_email": "chat@example.com"}}

    def confirm(messages):
        result = json.loads(messages[-1]["content"].split("RESULT: ", 1)[1])
        assert result["success"], result
        captured["code"] = result["confirmation_code"]
        return {"reply": f"You're booked! Code {result['confirmation_code']}", "action": "none", "params": {}}

    llm = ScriptedLLM([
        {"reply": "", "action": "check_availability", "params": {"service_id": f"service_ai{run}", "date": day.isoformat()}},
        book_from_results,
        confirm,
    ])
    ai.chat_json = llm
    out = await receptionist.process_message(tenant, "web:test", "web", "Book me a haircut on Monday please")
    assert "You're booked" in out["response"], out
    appt = await db.appointments.find_one({"appointment_id": captured["code"]}, {"_id": 0})
    assert appt and appt["source"] == "ai_receptionist" and appt["start_time"] == captured["slot"]
    assert appt["start_time"].startswith(day.isoformat()) and appt["start_time"][11:16] == "09:00"
    print("PASS ai books a real, validated slot")

    # booking a taken slot is refused by the engine, not by trusting the model
    llm2 = ScriptedLLM([
        {"reply": "", "action": "book", "params": {"service_id": f"service_ai{run}", "start_time": captured["slot"],
                                                   "client_name": "Other", "client_email": "o@example.com"}},
        lambda m: {"reply": "That time is gone", "action": "none",
                   "params": {}} if '"success": false' in m[-1]["content"] else {"reply": "BOOKED?!", "action": "none"},
    ])
    ai.chat_json = llm2
    out = await receptionist.process_message(tenant, "web:test2", "web", "Book the same time")
    assert out["response"] == "That time is gone", out
    print("PASS ai can't double-book")

    # cancel needs the matching email
    llm3 = ScriptedLLM([
        {"reply": "", "action": "cancel_booking", "params": {"confirmation_code": captured["code"], "client_email": "wrong@example.com"}},
        {"reply": "I couldn't find that booking", "action": "none", "params": {}},
    ])
    ai.chat_json = llm3
    await receptionist.process_message(tenant, "web:test3", "web", "cancel")
    assert (await db.appointments.find_one({"appointment_id": captured["code"]}))["status"] == "confirmed"
    llm4 = ScriptedLLM([
        {"reply": "", "action": "cancel_booking", "params": {"confirmation_code": captured["code"], "client_email": "CHAT@example.com"}},
        {"reply": "Cancelled", "action": "none", "params": {}},
    ])
    ai.chat_json = llm4
    await receptionist.process_message(tenant, "web:test4", "web", "cancel")
    assert (await db.appointments.find_one({"appointment_id": captured["code"]}))["status"] == "cancelled"
    print("PASS ai cancel requires code + matching email")

    # conversation is stored and readable, tool messages hidden
    conv = await db.moltbot_conversations.find_one({"tenant_id": tid, "client_identifier": "web:test"}, {"_id": 0})
    visible = receptionist.visible(conv)
    assert all(m["role"] in ("user", "assistant") for m in visible["messages"])
    # history passed to the LLM alternates roles and starts with the user
    hist = receptionist.history_for_llm(conv["messages"])
    assert hist[0]["role"] == "user" and all(hist[i]["role"] != hist[i + 1]["role"] for i in range(len(hist) - 1))
    print("PASS conversation history is well-formed")

    # prompt contains the real business data
    prompt = await receptionist.build_prompt(tenant)
    assert "Haircut" in prompt and f"service_ai{run}" in prompt and "Alex" in prompt
    print("PASS prompt grounded in business data")
    print("\nAll AI flow checks passed")


if __name__ == "__main__":
    asyncio.run(main())
