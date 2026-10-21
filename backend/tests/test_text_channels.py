"""AI receptionist by SMS / WhatsApp (Twilio) with a scripted LLM and a fake Twilio client - no keys needed.

    MONGO_URL=... DB_NAME=bookslot_e2e python tests/test_text_channels.py
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


class ScriptedLLM:
    def __init__(self, replies):
        self.replies = list(replies)

    async def __call__(self, system_prompt, messages, max_tokens=700):
        self.last_prompt = system_prompt
        reply = self.replies.pop(0)
        return reply(messages) if callable(reply) else reply


class FakeMessages:
    def __init__(self):
        self.sent = []

    def create(self, body, from_, to):
        self.sent.append({"body": body, "from": from_, "to": to})
        return type("Msg", (), {"sid": f"SM{len(self.sent)}"})()


class FakeTwilio:
    def __init__(self):
        self.messages = FakeMessages()


def result_of(messages):
    return json.loads(messages[-1]["content"].split("RESULT: ", 1)[1])


async def main():
    # ---- phone numbers
    t_ie = {"timezone": "Europe/Dublin"}
    assert notify.to_e164("087 123 4567", t_ie) == "+353871234567"
    assert notify.to_e164("+353 87 123 4567", t_ie) == "+353871234567"
    assert notify.to_e164("00353871234567", t_ie) == "+353871234567"
    assert notify.to_e164("whatsapp:+353871234567", t_ie) == "+353871234567"
    assert notify.to_e164("07700 900123", {"timezone": "Europe/London"}) == "+447700900123"
    assert notify.to_e164("12", t_ie) is None and notify.to_e164("", t_ie) is None
    assert notify.same_phone("087-123 4567", "+353871234567", t_ie)
    print("PASS Irish/UK numbers are converted to international format")

    config.AI_ENABLED = True
    fake = FakeTwilio()
    notify.twilio_client = fake
    run = uuid.uuid4().hex[:6]
    tenant = await create_tenant_record({"name": f"Text Salon {run}", "email": f"txt_{run}@example.com",
                                         "timezone": "Europe/Dublin"}, plan="growth", onboarding_completed=True)
    tid = tenant["tenant_id"]
    sms_no, wa_no = f"+3531{int(run, 16) % 10**7:07d}", f"+3532{int(run, 16) % 10**7:07d}"
    await db.tenants.update_one({"tenant_id": tid}, {"$set": {"sms_number": sms_no, "whatsapp_number": wa_no,
                                                              "sms_addon_enabled": True}})
    tenant = await db.tenants.find_one({"tenant_id": tid}, {"_id": 0})
    sid = f"service_tx{run}"
    await db.services.insert_one({"service_id": sid, "tenant_id": tid, "name": "Blow dry", "duration": 30,
                                  "buffer_time": 0, "price": 25, "is_active": True, "created_at": "2026-01-01"})
    await db.staff.insert_one({"staff_id": f"staff_tx{run}", "tenant_id": tid, "name": "Aoife", "email": "a@example.com",
                               "services": [], "working_hours": DEFAULT_WORKING_HOURS, "is_active": True,
                               "created_at": "2026-01-01"})
    day = date.today() + timedelta(days=(1 - date.today().weekday()) % 7 or 7)  # next Tuesday
    client = "+353861112233"
    got = {}

    def book_first(messages):
        got["slot"] = result_of(messages)["free_times"][0]["start_time"]
        return {"reply": "", "action": "book", "params": {"service_id": sid, "staff_id": "any",
                                                          "start_time": got["slot"], "client_name": "Niamh Text"}}

    def booked(messages):
        r = result_of(messages)
        assert r["success"], r
        got["code"] = r["confirmation_code"]
        return {"reply": "Booked!", "action": "none", "params": {}}

    llm = ScriptedLLM([{"reply": "", "action": "check_availability", "params": {"service_id": sid, "date": day.isoformat()}},
                       book_first, booked])
    ai.chat_json = llm
    out = await receptionist.process_message(tenant, f"sms:{client}", "sms", "blow dry tuesday?", client_phone=client)
    assert out["response"] == "Booked!", out
    assert client in llm.last_prompt and "TEXT MESSAGE" in llm.last_prompt
    appt = await db.appointments.find_one({"appointment_id": got["code"]}, {"_id": 0})
    assert appt["client_phone"] == client and not appt.get("client_email")
    print("PASS AI books by text using the sender's number, no email needed")

    # my_bookings + cancel with no code/email from the same phone
    def cancel_it(messages):
        r = result_of(messages)
        assert [b["confirmation_code"] for b in r["bookings"]] == [got["code"]], r
        return {"reply": "", "action": "cancel_booking", "params": {"confirmation_code": got["code"]}}

    ai.chat_json = ScriptedLLM([{"reply": "", "action": "my_bookings", "params": {}}, cancel_it,
                                {"reply": "Cancelled", "action": "none", "params": {}}])
    await receptionist.process_message(tenant, "sms:+353 86 111 2233", "sms", "cancel my appt", client_phone="0861112233")
    assert (await db.appointments.find_one({"appointment_id": got["code"]}))["status"] == "cancelled"
    print("PASS client can see and cancel their own bookings by text")

    # a different number can't see or cancel them
    await db.appointments.update_one({"appointment_id": got["code"]}, {"$set": {"status": "confirmed"}})
    stranger = {}
    ai.chat_json = ScriptedLLM([{"reply": "", "action": "my_bookings", "params": {}},
                                lambda m: stranger.update(r=result_of(m)) or
                                {"reply": "", "action": "cancel_booking", "params": {"confirmation_code": got["code"]}},
                                lambda m: stranger.update(c=result_of(m)) or {"reply": "no", "action": "none", "params": {}}])
    await receptionist.process_message(tenant, "sms:+353869999999", "sms", "cancel", client_phone="+353869999999")
    assert stranger["r"]["bookings"] == [] and not stranger["c"]["success"]
    assert (await db.appointments.find_one({"appointment_id": got["code"]}))["status"] == "confirmed"
    print("PASS other numbers can't see or cancel someone else's booking")

    # ---- Twilio webhook: signed, answers immediately, replies on the same channel
    from httpx import ASGITransport, AsyncClient
    from twilio.request_validator import RequestValidator
    import server
    config.TWILIO_AUTH_TOKEN = "test-twilio-token"
    config.BACKEND_PUBLIC_URL = "https://api.example.com"
    path = "/api/moltbot/webhook/incoming-sms"

    async def post(form, sign=True):
        sig = RequestValidator(config.TWILIO_AUTH_TOKEN).compute_signature(config.BACKEND_PUBLIC_URL + path, form) if sign else "bad"
        async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://test") as c:
            return await c.post(path, data=form, headers={"X-Twilio-Signature": sig})

    r = await post({"From": client, "To": sms_no, "Body": "hi", "MessageSid": "SMx" + run}, sign=False)
    assert r.status_code == 403
    for channel, to in (("sms", sms_no), ("whatsapp", f"whatsapp:{wa_no}")):
        ai.chat_json = ScriptedLLM([{"reply": f"Hi from {channel}", "action": "none", "params": {}}])
        before = len(fake.messages.sent)
        frm = f"whatsapp:{client}" if channel == "whatsapp" else client
        form = {"From": frm, "To": to, "Body": "are you open saturday", "MessageSid": f"SM{channel}{run}"}
        r = await post(form)
        assert r.status_code == 200 and "<Message>" not in r.text, r.text
        r2 = await post(form)  # Twilio retry of the same message is ignored
        assert r2.status_code == 200
        for _ in range(50):
            if len(fake.messages.sent) > before:
                break
            await asyncio.sleep(0.05)
        await asyncio.sleep(0.2)
        new = fake.messages.sent[before:]
        assert len(new) == 1, new
        if channel == "whatsapp":
            assert new[0] == {"body": "Hi from whatsapp", "from": f"whatsapp:{wa_no}", "to": f"whatsapp:{client}"}, new
        else:
            assert new[0] == {"body": "Hi from sms", "from": sms_no, "to": client}, new
    print("PASS SMS and WhatsApp webhooks answer at once and reply on the same channel (retries ignored)")

    # unknown number / starter plan: no reply
    before = len(fake.messages.sent)
    r = await post({"From": client, "To": "+353100000000", "Body": "hello", "MessageSid": "SMunk" + run})
    await asyncio.sleep(0.3)
    assert r.status_code == 200 and len(fake.messages.sent) == before
    print("PASS messages to unknown numbers are ignored")

    # reminders go from the salon's own number, to the client's local number converted
    await notify.send_sms(tenant, "086 111 2233", "Reminder: tomorrow 10:00")
    assert fake.messages.sent[-1] == {"body": "Reminder: tomorrow 10:00", "from": sms_no, "to": client}
    print("PASS text reminders use the salon's number and convert 08x numbers")
    print("\nAll text channel checks passed")


if __name__ == "__main__":
    asyncio.run(main())
