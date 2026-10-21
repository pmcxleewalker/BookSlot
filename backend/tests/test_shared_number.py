"""Shared BookSlot WhatsApp/SMS number used by many businesses: routing and isolation.
Scripted LLM + fake Twilio, no keys needed.

    MONGO_URL=... DB_NAME=bookslot_e2e python tests/test_shared_number.py
"""
import asyncio
import json
import os
import sys
import uuid
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DB_NAME", "bookslot_e2e")
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-1234")

from core import ai, config, notify  # noqa: E402
from core.db import db  # noqa: E402
from core.scheduling import DEFAULT_WORKING_HOURS  # noqa: E402
from routes import receptionist  # noqa: E402
from routes.tenants import create_tenant_record  # noqa: E402


class FakeMessages:
    def __init__(self):
        self.sent = []

    def create(self, body, from_, to):
        self.sent.append({"body": body, "from": from_, "to": to})
        return type("Msg", (), {"sid": f"SM{len(self.sent)}"})()


class Recorder:
    """Scripted LLM that records which business's prompt it was given."""
    def __init__(self):
        self.prompts = []
        self.queue = []

    async def __call__(self, system_prompt, messages, max_tokens=700):
        self.prompts.append(system_prompt)
        if self.queue:
            r = self.queue.pop(0)
            return r(messages) if callable(r) else r
        return {"reply": "ok", "action": "none", "params": {}}


async def make_tenant(name, run):
    t = await create_tenant_record({"name": f"{name} {run}", "email": f"{name.lower()}_{run}@example.com",
                                    "timezone": "Europe/Dublin"}, plan="growth", onboarding_completed=True)
    sid = f"service_{name.lower()}{run}"
    await db.services.insert_one({"service_id": sid, "tenant_id": t["tenant_id"], "name": f"{name} Cut", "duration": 30,
                                  "buffer_time": 0, "price": 20, "is_active": True, "created_at": "2026-01-01"})
    await db.staff.insert_one({"staff_id": f"staff_{name.lower()}{run}", "tenant_id": t["tenant_id"], "name": f"{name} Stylist",
                               "email": None, "services": [], "working_hours": DEFAULT_WORKING_HOURS, "is_active": True,
                               "created_at": "2026-01-01"})
    return await db.tenants.find_one({"tenant_id": t["tenant_id"]}, {"_id": 0}), sid


async def main():
    from httpx import ASGITransport, AsyncClient
    from twilio.request_validator import RequestValidator
    import server

    run = uuid.uuid4().hex[:6]
    config.AI_ENABLED = True
    config.TWILIO_AUTH_TOKEN = "test-twilio-token"
    config.BACKEND_PUBLIC_URL = "https://api.example.com"
    shared = f"+35319{int(run, 16) % 10**5:05d}"
    config.TWILIO_WHATSAPP_NUMBER = shared
    fake = type("T", (), {"messages": FakeMessages()})()
    notify.twilio_client = fake
    llm = Recorder()
    ai.chat_json = llm

    a, sid_a = await make_tenant("Alpha", run)
    b, sid_b = await make_tenant("Bravo", run)
    client = f"+35387{int(run, 16) % 10**7:07d}"
    path = "/api/moltbot/webhook/incoming-whatsapp"

    async def send(text, frm=client, sid=None):
        form = {"From": f"whatsapp:{frm}", "To": f"whatsapp:{shared}", "Body": text, "MessageSid": sid or "SM" + uuid.uuid4().hex}
        sig = RequestValidator(config.TWILIO_AUTH_TOKEN).compute_signature(config.BACKEND_PUBLIC_URL + path, form)
        before = len(fake.messages.sent)
        async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://test") as c:
            r = await c.post(path, data=form, headers={"X-Twilio-Signature": sig})
        assert r.status_code == 200 and "<Message>" not in r.text
        for _ in range(60):
            if len(fake.messages.sent) > before:
                break
            await asyncio.sleep(0.05)
        await asyncio.sleep(0.1)
        return fake.messages.sent[before:]

    # links carry the business code
    links = notify.messaging_links(a)
    assert links["whatsapp"].startswith(f"https://wa.me/{shared.lstrip('+')}?text=") and f"%23{a['booking_url_slug']}" in links["whatsapp"]
    print("PASS each business gets its own WhatsApp link with its code")

    # unknown client, no code -> asked which business (once), nothing reaches any AI
    n_prompts = len(llm.prompts)
    out = await send("hello?")
    assert len(out) == 1 and "Which one would you like" in out[0]["body"] and out[0]["from"] == f"whatsapp:{shared}"
    assert await send("hello again?") == []  # no repeat within 10 minutes
    assert len(llm.prompts) == n_prompts
    print("PASS without a code the client is asked which business, and no AI sees the message")

    # code routes to Alpha; prompt contains only Alpha's services
    out = await send(f"Hi Alpha #{a['booking_url_slug']}")
    assert len(out) == 1 and out[0]["from"] == f"whatsapp:{shared}" and out[0]["to"] == f"whatsapp:{client}"
    p = llm.prompts[-1]
    assert sid_a in p and sid_b not in p and "Bravo" not in p
    # follow-up without code stays with Alpha
    await send("what times tomorrow?")
    p = llm.prompts[-1]
    assert sid_a in p and sid_b not in p
    print("PASS the code binds the client to that business; follow-ups stay with it")

    # client books at Alpha
    day = date.today() + timedelta(days=(0 - date.today().weekday()) % 7 or 7)

    def book(messages):
        slot = json.loads(messages[-1]["content"].split("RESULT: ", 1)[1])["free_times"][0]["start_time"]
        return {"reply": "", "action": "book", "params": {"service_id": sid_a, "start_time": slot, "client_name": "Shared Client"}}
    llm.queue = [{"reply": "", "action": "check_availability", "params": {"service_id": sid_a, "date": day.isoformat()}},
                 book, {"reply": "Booked", "action": "none", "params": {}}]
    await send("book a cut monday")
    assert await db.appointments.count_documents({"tenant_id": a["tenant_id"], "client_phone": client}) == 1

    # switch to Bravo with its code: Bravo's AI can't see or cancel the Alpha booking, and can't book Alpha services
    seen = {}
    llm.queue = [{"reply": "", "action": "my_bookings", "params": {}},
                 lambda m: seen.update(mine=json.loads(m[-1]["content"].split("RESULT: ", 1)[1])) or
                 {"reply": "", "action": "book", "params": {"service_id": sid_a, "start_time": f"{day}T10:00:00", "client_name": "X"}},
                 lambda m: seen.update(cross=json.loads(m[-1]["content"].split("RESULT: ", 1)[1])) or
                 {"reply": "none", "action": "none", "params": {}}]
    await send(f"#{b['booking_url_slug']} my bookings?")
    assert sid_b in llm.prompts[-1] and sid_a not in llm.prompts[-1]
    assert seen["mine"]["bookings"] == [], seen
    assert not seen["cross"].get("success"), seen
    assert await db.appointments.count_documents({"tenant_id": b["tenant_id"]}) == 0
    print("PASS switching business isolates bookings: Bravo can't see, cancel or book Alpha's")

    # conversations are stored per business
    ca = await db.moltbot_conversations.count_documents({"tenant_id": a["tenant_id"], "client_identifier": f"whatsapp:{client}"})
    cb = await db.moltbot_conversations.count_documents({"tenant_id": b["tenant_id"], "client_identifier": f"whatsapp:{client}"})
    assert ca == 1 and cb == 1
    print("PASS each business only has its own conversation history")

    # a business with its own number is still routed by that number
    own = f"+35321{int(run, 16) % 10**5:05d}"
    await db.tenants.update_one({"tenant_id": a["tenant_id"]}, {"$set": {"whatsapp_number": own}})
    form = {"From": f"whatsapp:{client}", "To": f"whatsapp:{own}", "Body": "hi", "MessageSid": "SMown" + run}
    sig = RequestValidator(config.TWILIO_AUTH_TOKEN).compute_signature(config.BACKEND_PUBLIC_URL + path, form)
    before = len(fake.messages.sent)
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://test") as c:
        await c.post(path, data=form, headers={"X-Twilio-Signature": sig})
    for _ in range(60):
        if len(fake.messages.sent) > before:
            break
        await asyncio.sleep(0.05)
    assert fake.messages.sent[-1]["from"] == f"whatsapp:{own}" and sid_a in llm.prompts[-1]
    print("PASS a business's own number still works and replies from that number")
    print("\nAll shared-number checks passed")


if __name__ == "__main__":
    asyncio.run(main())
