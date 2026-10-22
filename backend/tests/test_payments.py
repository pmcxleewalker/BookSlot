"""Online deposits via Stripe Connect, against a fake Stripe (no keys or network needed).

    MONGO_URL=... DB_NAME=bookslot_e2e python tests/test_payments.py
"""
import asyncio
import hashlib
import hmac
import json
import os
import sys
import time
import uuid
from datetime import date, timedelta
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DB_NAME", "bookslot_e2e")
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-1234")

from core import config, payments  # noqa: E402
from core.db import db  # noqa: E402
from core.scheduling import DEFAULT_WORKING_HOURS  # noqa: E402
from core.security import create_jwt_token, hash_password, new_id, now_iso  # noqa: E402
from routes.tenants import create_tenant_record  # noqa: E402


class FakeStripe:
    def __init__(self):
        self.calls = []

    async def __call__(self, method, url, data=None, account=None, idempotency_key=None):
        self.calls.append({"method": method, "url": url, "data": data or {}, "account": account})
        if url.endswith("/oauth/token"):
            return {"stripe_user_id": "acct_salon" + data["code"][-4:]}
        if url.endswith("/oauth/deauthorize"):
            return {}
        if url.endswith("/v1/checkout/sessions"):
            return {"id": f"cs_test_{len(self.calls)}", "url": f"https://checkout.stripe.com/c/pay/cs_test_{len(self.calls)}"}
        if url.endswith("/v1/refunds"):
            return {"id": f"re_{len(self.calls)}", "status": "succeeded"}
        raise AssertionError(f"unexpected Stripe call {url}")

    def last(self, suffix):
        return [c for c in self.calls if c["url"].endswith(suffix)]


def signed(event, secret):
    payload = json.dumps(event).encode()
    ts = int(time.time())
    sig = hmac.new(secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()
    return payload, f"t={ts},v1={sig}"


async def main():
    from httpx import ASGITransport, AsyncClient
    import server

    run = uuid.uuid4().hex[:6]
    fake = FakeStripe()
    payments.stripe_call = fake
    config.STRIPE_SECRET_KEY, config.STRIPE_CLIENT_ID, config.STRIPE_WEBHOOK_SECRET = "", "", "whsec_test"
    config.BACKEND_PUBLIC_URL, config.FRONTEND_URL = "https://api.example.com", "https://site.example.com"

    tenant = await create_tenant_record({"name": f"Pay Salon {run}", "email": f"pay_{run}@example.com",
                                         "timezone": "Europe/Dublin"}, plan="growth", onboarding_completed=True)
    tid = tenant["tenant_id"]
    user = {"user_id": new_id("user"), "email": f"owner_{run}@example.com", "name": "Owner", "tenant_id": tid,
            "role": "owner", "is_active": True, "token_version": 0, "password_hash": hash_password("Password123!"),
            "created_at": now_iso()}
    await db.users.insert_one({**user})
    H = {"Authorization": "Bearer " + create_jwt_token(user["user_id"], tid, 0)}
    sid = f"service_pay{run}"
    await db.services.insert_one({"service_id": sid, "tenant_id": tid, "name": "Balayage", "duration": 60, "buffer_time": 0,
                                  "price": 140, "deposit_required": True, "deposit_amount": 20, "is_active": True,
                                  "created_at": "2026-01-01"})
    await db.staff.insert_one({"staff_id": f"staff_pay{run}", "tenant_id": tid, "name": "Sharon", "services": [],
                               "working_hours": DEFAULT_WORKING_HOURS, "is_active": True, "created_at": "2026-01-01"})
    slug = (await db.tenants.find_one({"tenant_id": tid}))["booking_url_slug"]
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://test") as c:
        # --- not available until the platform keys exist
        r = await c.get("/api/payments/status", headers=H)
        assert r.json()["platform_ready"] is False and r.json()["connected"] is False
        assert (await c.post("/api/payments/stripe/connect", headers=H)).status_code == 400
        config.STRIPE_SECRET_KEY, config.STRIPE_CLIENT_ID = "sk_test_x", "ca_test_x"

        # --- connect: Stripe OAuth URL, then the callback stores the account
        url = (await c.post("/api/payments/stripe/connect", headers=H)).json()["url"]
        q = parse_qs(urlparse(url).query)
        assert url.startswith("https://connect.stripe.com/oauth/authorize") and q["client_id"] == ["ca_test_x"]
        assert q["redirect_uri"] == ["https://api.example.com/api/payments/stripe/callback"] and q["scope"] == ["read_write"]
        state = q["state"][0]
        r = await c.get(f"/api/payments/stripe/callback?state=bogus&code=ac_1234")
        assert r.status_code == 302 and "stripe=expired" in r.headers["location"]
        r = await c.get(f"/api/payments/stripe/callback?state={state}&code=ac_{run[:4]}")
        assert r.status_code == 302 and r.headers["location"] == "https://site.example.com/settings?tab=payments&stripe=connected"
        acct = (await db.tenants.find_one({"tenant_id": tid}))["stripe_account_id"]
        assert acct == "acct_salon" + run[:4]
        r = await c.get(f"/api/payments/stripe/callback?state={state}&code=ac_9999")  # state is single-use
        assert "stripe=expired" in r.headers["location"]
        print("PASS salon connects its own Stripe account (single-use, expiring state)")

        # --- deposits off: booking confirms straight away, no Stripe
        day = date.today() + timedelta(days=(0 - date.today().weekday()) % 7 or 7)
        book = lambda t, name="Client": c.post(f"/api/public/booking/{slug}/book", json={
            "service_id": sid, "start_time": f"{day}T{t}:00", "client_name": name, "client_email": "c@example.com"})
        r = await book("09:00")
        assert r.status_code == 200 and r.json()["status"] == "confirmed" and "payment_url" not in r.json()
        print("PASS with deposits switched off nothing changes")

        # --- switch on
        assert (await c.put("/api/payments/settings", headers=H, json={"deposits_enabled": True, "refund_hours": 24})).json()["taking_deposits"]
        page = (await c.get(f"/api/public/booking/{slug}")).json()
        assert page["tenant"]["deposits_online"] is True
        r = await book("11:00", "Deposit Client")
        body = r.json()
        assert r.status_code == 200 and body["status"] == "pending_payment" and body["payment_url"].startswith("https://checkout.stripe.com")
        assert body["deposit_due"] == 20
        sess = fake.last("/v1/checkout/sessions")[-1]
        assert sess["account"] == acct and sess["data"]["line_items"][0]["price_data"]["unit_amount"] == 2000
        assert sess["data"]["metadata"]["appointment_id"] == body["confirmation_code"]
        appt_id = body["confirmation_code"]
        # the slot is held while they pay
        assert (await book("11:00", "Someone Else")).status_code == 409
        # nothing announced yet
        assert await db.notifications.count_documents({"tenant_id": tid, "data.appointment_id": appt_id}) == 0
        print("PASS deposit booking holds the slot and sends the client to Stripe Checkout on the salon's account")

        # --- webhook: bad signature rejected, wrong account ignored, right one confirms (once)
        ev = {"id": "evt_" + run, "type": "checkout.session.completed", "account": acct, "data": {"object": {
            "id": sess and "cs_x", "payment_status": "paid", "amount_total": 2000, "payment_intent": "pi_" + run,
            "metadata": {"appointment_id": appt_id}}}}
        payload, sig = signed(ev, "whsec_wrong")
        assert (await c.post("/api/payments/stripe/webhook", content=payload, headers={"Stripe-Signature": sig})).status_code == 400
        evil = {**ev, "id": "evt_evil" + run, "account": "acct_someone_else"}
        payload, sig = signed(evil, "whsec_test")
        r = await c.post("/api/payments/stripe/webhook", content=payload, headers={"Stripe-Signature": sig})
        assert r.json()["result"] == "wrong account"
        assert (await db.appointments.find_one({"appointment_id": appt_id}))["status"] == "pending_payment"
        payload, sig = signed(ev, "whsec_test")
        r = await c.post("/api/payments/stripe/webhook", content=payload, headers={"Stripe-Signature": sig})
        assert r.json()["result"] == "confirmed", r.json()
        a = await db.appointments.find_one({"appointment_id": appt_id})
        assert a["status"] == "confirmed" and a["deposit_paid"] and a["deposit_amount"] == 20 and a["payment_intent_id"] == "pi_" + run
        r = await c.post("/api/payments/stripe/webhook", content=payload, headers={"Stripe-Signature": sig})
        assert r.json().get("duplicate")
        await asyncio.sleep(0.2)
        assert await db.notifications.count_documents({"tenant_id": tid, "type": "new_booking", "data.appointment_id": appt_id}) == 1
        m = (await c.get(f"/api/public/booking/manage/{appt_id}")).json()
        assert m["appointment"]["deposit_paid"] and "refunded if you cancel" in m["refund_note"]
        print("PASS signed webhook from the right account confirms once; forged/other-account events are ignored")

        # --- client cancels in time -> refunded on the salon's account
        r = await c.post(f"/api/public/booking/manage/{appt_id}/cancel", json={})
        assert r.status_code == 200
        await asyncio.sleep(0.3)
        ref = fake.last("/v1/refunds")[-1]
        assert ref["account"] == acct and ref["data"]["payment_intent"] == "pi_" + run
        assert (await db.appointments.find_one({"appointment_id": appt_id}))["deposit_refunded"]
        print("PASS client cancelling more than 24h ahead is refunded automatically")

        # --- late client cancellation keeps the deposit; business cancellation always refunds
        await c.put("/api/payments/settings", headers=H, json={"refund_hours": 24 * 14})
        tenant_now = await db.tenants.find_one({"tenant_id": tid}, {"_id": 0})
        late = {"appointment_id": "x", "start_time": f"{day}T13:00:00", "deposit_paid": True}
        assert payments.refund_due(tenant_now, late, "client") is False and payments.refund_due(tenant_now, late, "business")
        print("PASS late client cancellations keep the deposit; the salon cancelling always refunds")

        # --- abandoned checkout: expired event releases the slot, and the timer job too
        r = await book("14:00", "Abandoner")
        held = r.json()["confirmation_code"]
        ev2 = {"id": "evt2_" + run, "type": "checkout.session.expired", "account": acct,
               "data": {"object": {"id": "cs_y", "metadata": {"appointment_id": held}}}}
        payload, sig = signed(ev2, "whsec_test")
        assert (await c.post("/api/payments/stripe/webhook", content=payload, headers={"Stripe-Signature": sig})).json()["result"] == "released"
        assert (await db.appointments.find_one({"appointment_id": held}))["status"] == "cancelled"
        assert (await book("14:00", "Next Person")).status_code == 200  # (deposit again -> pending)
        r = await book("15:00", "Timer")
        t_id = r.json()["confirmation_code"]
        await db.appointments.update_one({"appointment_id": t_id}, {"$set": {"payment_expires_at": "2000-01-01T00:00:00+00:00"}})
        assert await payments.release_expired_holds() >= 1
        assert (await db.appointments.find_one({"appointment_id": t_id}))["status"] == "cancelled"
        print("PASS unpaid holds are released (Stripe expiry event or background timer)")

        # --- Stripe down: no ghost booking left behind
        async def broken(*a, **k):
            raise payments.StripeError("down")
        payments.stripe_call = broken
        r = await book("16:00", "Unlucky")
        assert r.status_code == 502
        assert await db.appointments.count_documents({"tenant_id": tid, "client_name": "Unlucky", "status": {"$ne": "cancelled"}}) == 0
        payments.stripe_call = fake
        print("PASS if Stripe is unavailable the slot isn't left blocked")

        # --- disconnect turns deposits off
        s = (await c.post("/api/payments/stripe/disconnect", headers=H)).json()
        assert not s["connected"] and not s["taking_deposits"]
        assert (await book("16:00", "After")).json()["status"] == "confirmed"
        print("PASS disconnecting Stripe switches deposits off")
    print("\nAll payment checks passed")


if __name__ == "__main__":
    asyncio.run(main())
