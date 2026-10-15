"""End-to-end API tests. Runs against a live server + database.

    BASE_URL=http://localhost:8001 MONGO_URL=mongodb://localhost:27017 DB_NAME=bookslot_e2e \
    SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... python tests/test_e2e.py

(Use a throwaway database: the tests create businesses, bookings, etc.)
Also works with pytest: `pytest tests/test_e2e.py` (tests run in file order).
"""
import hashlib
import hmac
import json
import os
import threading
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

import httpx
from pymongo import MongoClient

BASE = os.environ.get("BASE_URL", "http://localhost:8001").rstrip("/") + "/api"
DB = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "bookslot_e2e")]
ADMIN_EMAIL = os.environ.get("SUPER_ADMIN_EMAIL", "admin@bookslot.test")
ADMIN_PASSWORD = os.environ.get("SUPER_ADMIN_PASSWORD", "SuperSecret123")

RUN = uuid.uuid4().hex[:6]
S = {}  # shared state between steps


def c(token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return httpx.Client(base_url=BASE, headers=headers, timeout=20)


def ok(resp, code=200):
    assert resp.status_code == code, f"{resp.request.method} {resp.request.url} -> {resp.status_code}: {resp.text[:400]}"
    return resp.json()


def next_weekday(weekday: int, weeks_ahead: int = 1) -> date:
    today = date.today()
    days = (weekday - today.weekday()) % 7 or 7
    return today + timedelta(days=days + 7 * (weeks_ahead - 1))


# ---------------------------------------------------------------- setup
def test_01_register_and_onboard():
    email = f"owner_{RUN}@example.com"
    r = ok(c().post("/auth/register", json={"name": "Olive Owner", "email": email.upper(), "password": "password123"}))
    assert r["user"]["email"] == email and r["user"]["role"] == "owner"
    S["owner"] = r["token"]
    # role in the request body must be ignored
    r2 = ok(c().post("/auth/register", json={"name": "X", "email": f"x_{RUN}@example.com", "password": "password123", "role": "admin"}))
    assert r2["user"]["role"] == "owner"
    # duplicate & weak password
    assert c().post("/auth/register", json={"name": "O", "email": email, "password": "password123"}).status_code == 400
    assert c().post("/auth/register", json={"name": "O", "email": f"w_{RUN}@example.com", "password": "short"}).status_code == 400

    t = ok(c(S["owner"]).post("/tenants", json={"name": "Glow Studio", "industry": "salon", "email": email,
                                                 "timezone": "Europe/Dublin"}))["tenant"]
    S["tenant"] = t
    assert t["booking_url_slug"].startswith("glow-studio")
    assert t["plan"] == "starter"
    ok(c(S["owner"]).post("/demo/seed"))
    ok(c(S["owner"]).post("/demo/seed"))  # idempotent
    ok(c(S["owner"]).post("/tenants/me/complete-onboarding"))
    staff = ok(c(S["owner"]).get("/staff"))["staff"]
    services = ok(c(S["owner"]).get("/services"))["services"]
    assert len(staff) == 1 and len(services) == 3
    S["owner_staff"] = staff[0]
    S["services"] = {s["name"]: s for s in services}


def test_02_login_is_case_insensitive_and_me():
    r = ok(c().post("/auth/login", json={"email": f"OWNER_{RUN}@example.com", "password": "password123"}))
    me = ok(c(r["token"]).get("/auth/me"))
    assert me["tenant_id"] == S["tenant"]["tenant_id"]
    assert c().post("/auth/login", json={"email": f"owner_{RUN}@example.com", "password": "wrong-pass"}).status_code == 401


def test_03_tenant_update_is_whitelisted():
    r = ok(c(S["owner"]).put("/tenants/me", json={"phone": "+353 1 234 5678", "plan": "pro", "is_active": False,
                                                    "sms_addon_enabled": True, "tenant_id": "hacked"}))
    t = r["tenant"]
    assert t["phone"] == "+353 1 234 5678" and t["plan"] == "starter" and t["is_active"] is True
    assert t["tenant_id"] == S["tenant"]["tenant_id"] and not t.get("sms_addon_enabled")


def test_04_staff_and_permissions():
    owner = c(S["owner"])
    svc = S["services"]["Consultation"]
    r = ok(owner.post("/staff", json={"name": "Sam Stylist", "email": f"sam_{RUN}@example.com", "password": "staffpass1",
                                      "services": [svc["service_id"], "service_doesnotexist"]}))
    sam = r["staff"]
    assert sam["has_account"] and sam["services"] == [svc["service_id"]]
    S["sam"] = sam
    # starter plan: max 2 staff
    assert owner.post("/staff", json={"name": "Third", "email": f"t_{RUN}@example.com"}).status_code == 403

    tok = ok(c().post("/auth/login", json={"email": f"sam_{RUN}@example.com", "password": "staffpass1"}))["token"]
    S["sam_token"] = tok
    staff_c = c(tok)
    assert staff_c.put("/tenants/me", json={"name": "Hijacked"}).status_code == 403
    assert staff_c.post("/services", json={"name": "Free stuff", "duration": 30}).status_code == 403
    assert staff_c.put(f"/staff/{S['owner_staff']['staff_id']}", json={"name": "x"}).status_code == 403
    assert staff_c.get("/webhooks").status_code == 403
    assert staff_c.get("/reports/detailed").status_code == 403
    # staff can edit their own hours
    hours = {d: {"enabled": d not in ("saturday", "sunday"), "start": "09:00", "end": "17:00", "breaks": []}
             for d in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]}
    ok(staff_c.put(f"/staff/{sam['staff_id']}/working-hours", json=hours))


def test_05_working_hours_validation():
    owner = c(S["owner"])
    sid = S["owner_staff"]["staff_id"]
    bad = {"monday": {"enabled": True, "start": "17:00", "end": "09:00", "breaks": []}}
    assert owner.put(f"/staff/{sid}/working-hours", json=bad).status_code == 400
    hours = {d: {"enabled": d != "sunday", "start": "09:00", "end": "17:00",
                 "breaks": [{"start": "13:00", "end": "14:00"}]} for d in
             ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]}
    ok(owner.put(f"/staff/{sid}/working-hours", json=hours))


def test_06_public_availability_respects_hours_breaks_and_time_off():
    slug = S["tenant"]["booking_url_slug"]
    page = ok(c().get(f"/public/booking/{slug}"))
    assert page["tenant"]["name"] == "Glow Studio" and len(page["services"]) == 3
    assert "api_key_hash" not in json.dumps(page)
    svc = S["services"]["Standard Appointment"]  # 60 min
    owner_id = S["owner_staff"]["staff_id"]
    monday = next_weekday(0)
    S["monday"] = monday
    slots = ok(c().get(f"/public/booking/{slug}/availability", params={
        "service_id": svc["service_id"], "staff_id": owner_id, "date": monday.isoformat()}))["slots"]
    starts = [s["start_time"][11:16] for s in slots]
    assert starts[0] == "09:00" and starts[-1] == "16:00", starts
    assert "12:30" not in starts and "13:00" not in starts and "13:30" not in starts  # lunch break
    assert "12:00" in starts and "14:00" in starts
    assert all(s["start_time"][10] == "T" and len(s["start_time"]) == 19 for s in slots)  # naive local strings

    # Sam doesn't do the Standard Appointment
    sam_slots = ok(c().get(f"/public/booking/{slug}/availability", params={
        "service_id": svc["service_id"], "staff_id": S["sam"]["staff_id"], "date": monday.isoformat()}))["slots"]
    assert sam_slots == []
    eligible = ok(c().get(f"/public/booking/{slug}/staff-for-service", params={"service_id": svc["service_id"]}))["staff"]
    assert [s["staff_id"] for s in eligible] == [owner_id]

    # all-day time off removes the day
    tuesday = monday + timedelta(days=1)
    ok(c(S["owner"]).post(f"/staff/{owner_id}/time-blocks", json={"start_date": tuesday.isoformat(), "end_date": tuesday.isoformat(),
                                                                   "block_type": "annual_leave", "title": "Holiday"}))
    tue = ok(c().get(f"/public/booking/{slug}/availability", params={
        "service_id": svc["service_id"], "staff_id": owner_id, "date": tuesday.isoformat()}))["slots"]
    assert tue == []
    # partial block
    wed = monday + timedelta(days=2)
    ok(c(S["owner"]).post(f"/staff/{owner_id}/time-blocks", json={"start_date": wed.isoformat(), "start_time": "09:00",
                                                                   "end_time": "11:00", "all_day": False}))
    wed_starts = [s["start_time"][11:16] for s in ok(c().get(f"/public/booking/{slug}/availability", params={
        "service_id": svc["service_id"], "staff_id": owner_id, "date": wed.isoformat()}))["slots"]]
    assert wed_starts[0] == "11:00", wed_starts
    # Sunday closed
    sunday = monday + timedelta(days=6)
    assert ok(c().get(f"/public/booking/{slug}/availability", params={
        "service_id": svc["service_id"], "staff_id": owner_id, "date": sunday.isoformat()}))["slots"] == []
    dates = ok(c().get(f"/public/booking/{slug}/available-dates", params={
        "service_id": svc["service_id"], "month": monday.strftime("%Y-%m")}))["available_dates"]
    assert tuesday.isoformat() not in dates and (monday.isoformat() in dates or monday.month != monday.month)


def test_07_public_booking_and_double_booking_protection():
    slug = S["tenant"]["booking_url_slug"]
    svc = S["services"]["Standard Appointment"]
    monday = S["monday"]
    body = {"service_id": svc["service_id"], "staff_id": "any", "start_time": f"{monday}T10:00:00",
            "client_name": "Cara Client", "client_email": "Cara@Example.com", "client_phone": "+353 87 123 4567",
            "end_time": "1999-01-01T00:00:00Z"}  # client-supplied end_time must be ignored
    r = ok(c().post(f"/public/booking/{slug}/book", json=body))
    appt = r["appointment"]
    assert appt["start_time"] == f"{monday}T10:00:00" and appt["end_time"] == f"{monday}T11:00:00"
    assert appt["status"] == "confirmed" and appt["client_email"] == "cara@example.com"
    S["appt1"] = r["confirmation_code"]
    # same slot again
    assert c().post(f"/public/booking/{slug}/book", json=body).status_code == 409
    # overlapping slot (10:30 for 60 min)
    assert c().post(f"/public/booking/{slug}/book", json={**body, "start_time": f"{monday}T10:30:00"}).status_code == 409
    # outside working hours and during lunch
    assert c().post(f"/public/booking/{slug}/book", json={**body, "start_time": f"{monday}T07:00:00"}).status_code == 409
    assert c().post(f"/public/booking/{slug}/book", json={**body, "start_time": f"{monday}T13:00:00"}).status_code == 409
    # in the past
    past = date.today() - timedelta(days=7)
    assert c().post(f"/public/booking/{slug}/book", json={**body, "start_time": f"{past}T10:00:00"}).status_code == 409
    # missing email (required by default) / bad email
    assert c().post(f"/public/booking/{slug}/book", json={**body, "start_time": f"{monday}T15:00:00", "client_email": ""}).status_code == 400
    assert c().post(f"/public/booking/{slug}/book", json={**body, "start_time": f"{monday}T15:00:00", "client_email": "nope"}).status_code == 400
    # slot disappears from availability
    starts = [s["start_time"][11:16] for s in ok(c().get(f"/public/booking/{slug}/availability", params={
        "service_id": svc["service_id"], "staff_id": "any", "date": monday.isoformat()}))["slots"]]
    assert "10:00" not in starts and "10:30" not in starts and "09:30" not in starts and "11:00" in starts
    # timezone-aware input gets converted to business time (Europe/Dublin)
    from zoneinfo import ZoneInfo
    aware_day = S["monday"] + timedelta(days=3)  # Thursday
    utc = datetime(aware_day.year, aware_day.month, aware_day.day, 11, 0, tzinfo=ZoneInfo("UTC"))
    expected = utc.astimezone(ZoneInfo("Europe/Dublin")).strftime("%Y-%m-%dT%H:%M:%S")
    r = ok(c().post(f"/public/booking/{slug}/book", json={**body, "start_time": f"{aware_day}T11:00:00Z"}))
    assert r["appointment"]["start_time"] == expected, (r["appointment"]["start_time"], expected)


def test_08_concurrent_bookings_only_one_wins():
    slug = S["tenant"]["booking_url_slug"]
    svc = S["services"]["Consultation"]
    friday = S["monday"] + timedelta(days=4)
    body = {"service_id": svc["service_id"], "staff_id": S["owner_staff"]["staff_id"], "start_time": f"{friday}T09:00:00",
            "client_name": "Racer", "client_email": "racer@example.com"}
    results = []

    def go():
        results.append(c().post(f"/public/booking/{slug}/book", json=body).status_code)

    threads = [threading.Thread(target=go) for _ in range(5)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert sorted(results).count(200) == 1, results


def test_09_dashboard_create_move_and_status():
    owner = c(S["owner"])
    svc = S["services"]["Consultation"]
    monday = S["monday"]
    sid = S["owner_staff"]["staff_id"]
    # overlaps the 10:00-11:00 online booking
    r = owner.post("/appointments", json={"service_id": svc["service_id"], "staff_id": sid,
                                          "start_time": f"{monday}T10:30:00", "client_name": "Walk In"})
    assert r.status_code == 409, r.text
    # admin may book outside normal hours if free
    a = ok(owner.post("/appointments", json={"service_id": svc["service_id"], "staff_id": sid,
                                             "start_time": f"{monday}T17:30:00", "client_name": "Late Larry",
                                             "client_email": "larry@example.com"}))["appointment"]
    assert a["status"] == "confirmed" and a["end_time"] == f"{monday}T18:00:00" and a["service_name"] == "Consultation"
    S["appt_admin"] = a["appointment_id"]
    # drag onto the online booking -> conflict
    assert owner.put(f"/appointments/{a['appointment_id']}", json={"start_time": f"{monday}T10:00:00"}).status_code == 409
    moved = ok(owner.put(f"/appointments/{a['appointment_id']}", json={"start_time": f"{monday}T11:00:00"}))["appointment"]
    assert moved["start_time"] == f"{monday}T11:00:00" and moved["end_time"] == f"{monday}T11:30:00"
    # protected fields can't be overwritten
    ok(owner.put(f"/appointments/{a['appointment_id']}", json={"tenant_id": "other", "notes": "Prefers tea"}))
    got = ok(owner.get(f"/appointments/{a['appointment_id']}"))["appointment"]
    assert got["tenant_id"] == S["tenant"]["tenant_id"] and got["notes"] == "Prefers tea"
    # status flow
    ok(owner.put(f"/appointments/{a['appointment_id']}", json={"status": "completed"}))
    assert owner.put(f"/appointments/{a['appointment_id']}", json={"status": "cancelled"}).status_code == 400
    assert owner.put(f"/appointments/{a['appointment_id']}", json={"status": "bogus"}).status_code == 400


def test_10_staff_only_see_their_own_bookings():
    sam = c(S["sam_token"])
    appts = ok(sam.get("/appointments"))["appointments"]
    assert all(a["staff_id"] == S["sam"]["staff_id"] for a in appts)
    assert sam.get(f"/appointments/{S['appt1']}").status_code == 404
    assert sam.post("/appointments", json={"service_id": S["services"]["Consultation"]["service_id"],
                                           "staff_id": S["owner_staff"]["staff_id"], "start_time": f"{S['monday']}T15:00:00",
                                           "client_name": "X"}).status_code == 403


def test_11_approval_workflow():
    owner = c(S["owner"])
    ok(owner.put("/tenants/me/settings", json={"approval_threshold_minutes": 90}))
    slug = S["tenant"]["booking_url_slug"]
    svc = S["services"]["Extended Appointment"]  # 90 min
    thursday = S["monday"] + timedelta(days=3)
    r = ok(c().post(f"/public/booking/{slug}/book", json={"service_id": svc["service_id"], "staff_id": "any",
                                                         "start_time": f"{thursday}T09:00:00", "client_name": "Pat",
                                                         "client_email": "pat@example.com"}))
    assert r["status"] == "pending_approval"
    code = r["confirmation_code"]
    pending = ok(owner.get("/appointments/pending-approval"))["appointments"]
    assert [p["appointment_id"] for p in pending] == [code]
    notes = ok(owner.get("/notifications"))
    assert any(n["type"] == "approval_needed" for n in notes["notifications"])
    ok(owner.post(f"/appointments/{code}/approve"))
    assert ok(owner.get(f"/appointments/{code}"))["appointment"]["status"] == "confirmed"
    assert owner.post(f"/appointments/{code}/approve").status_code == 400
    ok(owner.put("/tenants/me/settings", json={"approval_threshold_minutes": 0}))


def test_12_manage_booking_and_client_cancel():
    m = ok(c().get(f"/public/booking/manage/{S['appt1']}"))
    assert m["can_cancel"] and m["service_name"] == "Standard Appointment" and "client_email" not in m["appointment"]
    ok(c().post(f"/public/booking/manage/{S['appt1']}/cancel", json={"reason": "Can't make it"}))
    assert c().post(f"/public/booking/manage/{S['appt1']}/cancel", json={}).status_code == 400
    owner = c(S["owner"])
    notes = ok(owner.get("/notifications"))["notifications"]
    assert any(n["type"] == "booking_cancelled" for n in notes)
    # slot is free again
    slug = S["tenant"]["booking_url_slug"]
    starts = [s["start_time"][11:16] for s in ok(c().get(f"/public/booking/{slug}/availability", params={
        "service_id": S["services"]["Standard Appointment"]["service_id"], "staff_id": "any",
        "date": S["monday"].isoformat()}))["slots"]]
    assert "10:00" in starts
    # business can switch off client cancellation
    ok(owner.put("/tenants/me/settings", json={"allow_client_cancellation": False}))
    r = ok(c().post(f"/public/booking/{slug}/book", json={"service_id": S["services"]["Consultation"]["service_id"],
                                                         "staff_id": "any", "start_time": f"{S['monday']}T15:00:00",
                                                         "client_name": "Cara Client", "client_email": "cara@example.com"}))
    assert not ok(c().get(f"/public/booking/manage/{r['confirmation_code']}"))["can_cancel"]
    assert c().post(f"/public/booking/manage/{r['confirmation_code']}/cancel", json={}).status_code == 400
    ok(owner.put("/tenants/me/settings", json={"allow_client_cancellation": True}))


def test_13_clients_have_live_stats_and_history():
    owner = c(S["owner"])
    clients = ok(owner.get("/clients", params={"search": "cara"}))["clients"]
    assert len(clients) == 1, clients
    cara = clients[0]
    assert cara["total_appointments"] == 2 and cara["next_appointment"]  # one cancelled booking doesn't count
    detail = ok(owner.get(f"/clients/{cara['client_id']}"))["client"]
    assert len(detail["service_history"]) == 3
    ok(owner.put(f"/clients/{cara['client_id']}", json={"is_vip": True, "important_info": "Allergic to latex", "tenant_id": "x"}))
    assert ok(owner.get(f"/clients/{cara['client_id']}"))["client"]["is_vip"] is True
    # search input is treated literally (no regex injection)
    assert owner.get("/clients", params={"search": "(.*"}).status_code == 200
    new = ok(owner.post("/clients", json={"name": "Temp Person", "email": "temp@example.com"}))["client"]
    ok(owner.delete(f"/clients/{new['client_id']}"))
    assert owner.get(f"/clients/{new['client_id']}").status_code == 404


def test_13b_booking_for_existing_client_uses_their_details():
    owner = c(S["owner"])
    cara = ok(owner.get("/clients", params={"search": "cara"}))["clients"][0]
    day = S["monday"] + timedelta(days=9)
    a = ok(owner.post("/appointments", json={"service_id": S["services"]["Consultation"]["service_id"],
                                             "staff_id": S["owner_staff"]["staff_id"], "start_time": f"{day}T12:00:00",
                                             "client_id": cara["client_id"]}))["appointment"]
    assert a["client_name"] == "Cara Client" and a["client_email"] == "cara@example.com" and a["client_id"] == cara["client_id"]
    # walk-ins without contact details don't create client records
    before = len(ok(owner.get("/clients"))["clients"])
    ok(owner.post("/appointments", json={"service_id": S["services"]["Consultation"]["service_id"],
                                         "staff_id": S["owner_staff"]["staff_id"], "start_time": f"{day}T14:00:00"}))
    assert len(ok(owner.get("/clients"))["clients"]) == before
    ok(owner.post(f"/appointments/{a['appointment_id']}/cancel", json={"reason": "test"}))


def test_14_reports_and_export():
    owner = c(S["owner"])
    start = date.today().isoformat()
    end = (S["monday"] + timedelta(days=14)).isoformat()
    rep = ok(owner.get("/reports/detailed", params={"start_date": start, "end_date": end}))
    assert rep["summary"]["total_bookings"] >= 4 and rep["summary"]["cancelled"] >= 1
    assert rep["summary"]["total_revenue"] == 40.0  # only the completed consultation counts
    csv = ok(owner.get("/reports/export", params={"report_type": "appointments", "start_date": start, "end_date": end}))
    assert csv["csv"].startswith("Date,Time,Client") and csv["row_count"] >= 4
    ok(owner.get("/reports/export", params={"report_type": "clients"}))
    dash = ok(owner.get("/reports/dashboard"))
    assert "upcoming_appointments" in dash and dash["stats"]["total_clients"] >= 3


def test_15_api_key_and_plan_gating():
    owner = c(S["owner"])
    tid = S["tenant"]["tenant_id"]
    assert c().get(f"/receptionist/{tid}/info").status_code == 401
    assert c().get(f"/receptionist/{tid}/info", params={"api_key": "admin"}).status_code == 401
    assert owner.post("/tenants/me/api-key").status_code == 403  # starter plan
    assert owner.post("/webhooks", json={"url": "https://example.com/hook", "events": ["booking.created"]}).status_code == 403
    assert owner.post("/moltbot/chat", json={"message": "hi"}).status_code == 403

    adm = ok(c().post("/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}))
    S["admin"] = adm["token"]
    ok(c(S["admin"]).put(f"/admin/tenants/{tid}", json={"plan": "pro"}))

    key = ok(owner.post("/tenants/me/api-key"))["api_key"]
    api = httpx.Client(base_url=BASE, headers={"X-API-Key": key}, timeout=20)
    info = ok(api.get(f"/receptionist/{tid}/info"))
    assert info["business"]["name"] == "Glow Studio" and len(info["services"]) == 3
    svc = S["services"]["Consultation"]["service_id"]
    day = S["monday"] + timedelta(days=7)
    av = ok(api.get(f"/receptionist/{tid}/availability", params={"service_id": svc, "date": day.isoformat()}))
    first = av["available_slots"][0]
    b = ok(api.post(f"/receptionist/{tid}/book", json={"service_id": svc, "start_time": first["start"],
                                                        "client_name": "Api User", "client_email": "api@example.com"}))
    assert b["success"] and b["confirmation_code"].startswith("appt_")
    assert api.post(f"/receptionist/{tid}/book", json={"service_id": svc, "start_time": first["start"],
                                                      "staff_id": first["staff_id"], "client_name": "Api User",
                                                      "client_email": "api@example.com"}).status_code == 409
    ok(api.post(f"/receptionist/{tid}/cancel", json={"confirmation_code": b["confirmation_code"]}))
    # key for this tenant can't touch another tenant
    assert api.get("/receptionist/tenant_doesnotexist/info").status_code == 401
    S["api_key"] = key


class _Hook(BaseHTTPRequestHandler):
    received = []

    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"])).decode()
        _Hook.received.append((dict(self.headers), body))
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *args):
        pass


def test_16_webhooks_are_signed():
    server = HTTPServer(("127.0.0.1", 0), _Hook)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    owner = c(S["owner"])
    hook = ok(owner.post("/webhooks", json={"url": f"http://127.0.0.1:{server.server_port}/hook",
                                            "events": ["booking.created", "booking.cancelled", "nonsense"]}))["webhook"]
    assert hook["events"] == ["booking.created", "booking.cancelled"] and hook["secret"].startswith("whsec_")
    slug = S["tenant"]["booking_url_slug"]
    day = S["monday"] + timedelta(days=8)
    ok(c().post(f"/public/booking/{slug}/book", json={"service_id": S["services"]["Consultation"]["service_id"],
                                                     "staff_id": "any", "start_time": f"{day}T09:00:00",
                                                     "client_name": "Hook", "client_email": "hook@example.com"}))
    for _ in range(30):
        if _Hook.received:
            break
        time.sleep(0.2)
    assert _Hook.received, "webhook not delivered"
    headers, body = _Hook.received[0]
    sig = hmac.new(hook["secret"].encode(), body.encode(), hashlib.sha256).hexdigest()
    assert headers.get("X-BookSlot-Signature") == f"sha256={sig}"
    assert "X-Webhook-Secret" not in headers
    payload = json.loads(body)
    assert payload["event"] == "booking.created" and payload["data"]["client_name"] == "Hook"
    deliveries = ok(owner.get(f"/webhooks/{hook['webhook_id']}/deliveries"))["deliveries"]
    assert deliveries and deliveries[0]["status"] == "delivered"
    server.shutdown()


def test_17_tenant_isolation():
    other = ok(c().post("/auth/register", json={"name": "Other", "email": f"other_{RUN}@example.com", "password": "password123"}))["token"]
    ok(c(other).post("/tenants", json={"name": "Other Biz", "email": f"other_{RUN}@example.com"}))
    o = c(other)
    assert o.get(f"/appointments/{S['appt_admin']}").status_code == 404
    assert o.put(f"/appointments/{S['appt_admin']}", json={"notes": "x"}).status_code == 404
    assert o.put(f"/services/{S['services']['Consultation']['service_id']}", json={"name": "x"}).status_code == 404
    assert o.put(f"/staff/{S['sam']['staff_id']}", json={"name": "x"}).status_code == 404
    assert o.get("/clients").json()["clients"] == []
    assert o.post("/appointments", json={"service_id": S["services"]["Consultation"]["service_id"],
                                         "staff_id": S["owner_staff"]["staff_id"], "start_time": f"{S['monday']}T16:00:00",
                                         "client_name": "x"}).status_code == 404


def test_18_super_admin():
    a = c(S["admin"])
    stats = ok(a.get("/admin/stats"))
    assert stats["tenants"]["total"] >= 2 and stats["revenue"]["mrr"] >= 149
    tenants = ok(a.get("/admin/tenants", params={"search": "glow"}))["tenants"]
    assert any(t["tenant_id"] == S["tenant"]["tenant_id"] for t in tenants)
    assert all("api_key_hash" not in t for t in tenants)
    detail = ok(a.get(f"/admin/tenants/{S['tenant']['tenant_id']}"))
    imp = ok(a.post(f"/admin/impersonate/{detail['owner']['user_id']}"))
    assert ok(c(imp["token"]).get("/auth/me"))["email"] == f"owner_{RUN}@example.com"
    created = ok(a.post("/admin/tenants", json={"business_name": "Admin Made", "industry": "clinic",
                                               "owner_name": "Ada", "owner_email": f"ada_{RUN}@example.com",
                                               "owner_password": "password123", "plan": "growth"}))
    assert created["tenant"]["plan"] == "growth"
    ok(c().post("/auth/login", json={"email": f"ada_{RUN}@example.com", "password": "password123"}))
    # deactivating a tenant locks its users out
    ok(a.delete(f"/admin/tenants/{created['tenant']['tenant_id']}"))
    assert c().post("/auth/login", json={"email": f"ada_{RUN}@example.com", "password": "password123"}).status_code == 403
    assert c().get("/admin/stats").status_code == 401
    assert c(S["owner"]).get("/admin/stats").status_code == 401


def test_19_password_reset_and_change():
    ok(c().post("/auth/forgot-password", json={"email": f"owner_{RUN}@example.com"}))
    ok(c().post("/auth/forgot-password", json={"email": "nobody@example.com"}))  # same response, no leak
    token = uuid.uuid4().hex
    user = DB.users.find_one({"email": f"owner_{RUN}@example.com"})
    DB.password_resets.insert_one({"token_hash": hashlib.sha256(token.encode()).hexdigest(), "user_id": user["user_id"],
                                   "used": False, "expires_at": (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)).isoformat() + "+00:00"})
    old_token = S["owner"]
    r = ok(c().post("/auth/reset-password", json={"token": token, "password": "newpassword1"}))
    assert c(old_token).get("/auth/me").status_code == 401  # old sessions are revoked
    assert c().post("/auth/reset-password", json={"token": token, "password": "another123"}).status_code == 400
    S["owner"] = r["token"]
    r = ok(c(S["owner"]).post("/auth/change-password", json={"current_password": "newpassword1", "new_password": "password123"}))
    S["owner"] = r["token"]
    ok(c(S["owner"]).get("/auth/me"))


def test_20_image_upload():
    png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
           b"\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82")
    owner = c(S["owner"])
    r = ok(owner.post("/upload/image", files={"file": ("logo.png", png, "image/png")}))
    got = c().get(r["path"].replace("/api", "", 1))
    assert got.status_code == 200 and got.content == png and got.headers["content-type"] == "image/png"
    bad = owner.post("/upload/image", files={"file": ("evil.png", b"<script>alert(1)</script>", "image/png")})
    assert bad.status_code == 400


def test_21_reminders_are_sent_once():
    tid = S["tenant"]["tenant_id"]
    owner = c(S["owner"])
    from zoneinfo import ZoneInfo
    now_local = datetime.now(ZoneInfo("Europe/Dublin")).replace(tzinfo=None)
    start = (now_local + timedelta(hours=3)).replace(minute=0, second=0, microsecond=0)
    appt = ok(owner.post("/appointments", json={"service_id": S["services"]["Consultation"]["service_id"],
                                                "staff_id": S["sam"]["staff_id"], "start_time": start.isoformat(),
                                                "client_name": "Remy Reminder", "client_email": "remy@example.com"}))["appointment"]
    # pretend it was booked two days ago so the reminder window applies
    DB.appointments.update_one({"appointment_id": appt["appointment_id"]},
                               {"$set": {"created_at": (datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=2)).isoformat() + "+00:00"}})
    for _ in range(40):
        doc = DB.appointments.find_one({"appointment_id": appt["appointment_id"]})
        if doc.get("reminder_sent_at"):
            break
        time.sleep(0.5)
    assert doc.get("reminder_sent_at"), "reminder job didn't run"
    time.sleep(1)
    logs = list(DB.notification_logs.find({"tenant_id": tid, "to": "remy@example.com", "template_type": "reminder"}))
    assert len(logs) == 1


def test_22_ai_chat_degrades_gracefully_without_keys():
    slug = S["tenant"]["booking_url_slug"]
    r = ok(c().post(f"/public/booking/{slug}/chat", json={"message": "Can I book?", "session_id": "abc"}))
    assert r["response"]
    st = ok(c().get("/moltbot/status"))
    assert "enabled" in st


def test_23_login_rate_limit():
    for _ in range(500):
        code = c().post("/auth/login", json={"email": "ratelimit@example.com", "password": "wrong-pass"}).status_code
        if code == 429:
            break
    assert code == 429


if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"PASS {name}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"FAIL {name}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    raise SystemExit(1 if failed else 0)
