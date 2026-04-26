"""
Iteration 19 backend tests:
  - Instant Rebooking (public) endpoints
  - Fill My Day blast endpoint (owner-only)
  - CLV settings + clients/appointments enrichment + lifetime-stats
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for local invocation outside of frontend env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

DEMO_CODE = "appt_151aaf879e3f"
SALON_EMAIL = "salon@bookslot.io"
SALON_PASSWORD = "Demo123!"
SUPER_ADMIN_EMAIL = "admin@bookslot.io"
SUPER_ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def salon_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": SALON_EMAIL, "password": SALON_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def super_token(api):
    # super admin uses a different auth route in this app; skip if not login-able
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"super admin login not available via /api/auth/login: {r.status_code}")
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture
def salon_client(api, salon_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {salon_token}"})
    return s


@pytest.fixture
def super_client(api, super_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {super_token}"})
    return s


# ---------- 1. Instant Rebooking ----------

class TestRebookSuggestions:
    def test_get_suggestions_public(self, api):
        r = api.get(f"{BASE_URL}/api/public/booking/{DEMO_CODE}/rebook-suggestions")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "ai_suggestion_weeks" in data
        assert isinstance(data["ai_suggestion_weeks"], int)
        assert "options" in data
        assert isinstance(data["options"], list)
        # Could be 3 unique values or 4 if AI weeks differs from {4,6,8}
        assert 3 <= len(data["options"]) <= 4
        ai_picks = [o for o in data["options"] if o.get("is_ai_pick")]
        assert len(ai_picks) >= 1
        for o in data["options"]:
            assert "weeks" in o and "next_date" in o and "display" in o and "is_ai_pick" in o

    def test_get_suggestions_404(self, api):
        r = api.get(f"{BASE_URL}/api/public/booking/appt_doesnotexist/rebook-suggestions")
        assert r.status_code == 404


class TestRebookCreate:
    created_id = None

    def test_rebook_invalid_zero(self, api):
        r = api.post(f"{BASE_URL}/api/public/booking/{DEMO_CODE}/rebook", json={"weeks": 0})
        assert r.status_code == 400

    def test_rebook_invalid_too_high(self, api):
        r = api.post(f"{BASE_URL}/api/public/booking/{DEMO_CODE}/rebook", json={"weeks": 27})
        assert r.status_code == 400

    def test_rebook_creates_pending(self, api, salon_client):
        # use a varied weeks count to reduce conflict odds
        r = api.post(f"{BASE_URL}/api/public/booking/{DEMO_CODE}/rebook", json={"weeks": 13})
        assert r.status_code == 200, r.text
        data = r.json()
        # If conflict happened just retry with another week count
        if not data.get("success"):
            r = api.post(f"{BASE_URL}/api/public/booking/{DEMO_CODE}/rebook", json={"weeks": 17})
            assert r.status_code == 200, r.text
            data = r.json()
        assert data.get("success") is True, data
        assert "appointment_id" in data
        TestRebookCreate.created_id = data["appointment_id"]

        # Verify it's persisted as pending via GET /api/appointments
        r2 = salon_client.get(f"{BASE_URL}/api/appointments?status=pending")
        assert r2.status_code == 200, r2.text
        body = r2.json()
        appts = body.get("appointments", body) if isinstance(body, dict) else body
        ids = [a.get("appointment_id") for a in appts]
        assert TestRebookCreate.created_id in ids

    def test_cleanup_rebook(self, salon_client):
        if TestRebookCreate.created_id:
            salon_client.delete(f"{BASE_URL}/api/appointments/{TestRebookCreate.created_id}")


# ---------- 2. Fill My Day blast ----------

class TestBlastAvailability:
    def test_super_admin_forbidden(self, super_client):
        r = super_client.post(f"{BASE_URL}/api/appointments/{DEMO_CODE}/blast-availability")
        # super_admin doesn't belong to a tenant -> 403 or 404
        assert r.status_code in (403, 404), r.text

    def test_owner_can_blast(self, salon_client):
        r = salon_client.post(f"{BASE_URL}/api/appointments/{DEMO_CODE}/blast-availability")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["subscribers_total", "sent_count", "failed_count", "deep_link"]:
            assert k in d
        assert isinstance(d["subscribers_total"], int)
        assert "/book/" in d["deep_link"]

    def test_blasted_at_marked(self, salon_client):
        r = salon_client.get(f"{BASE_URL}/api/appointments")
        assert r.status_code == 200
        body = r.json()
        appts = body.get("appointments", body) if isinstance(body, dict) else body
        target = next((a for a in appts if a.get("appointment_id") == DEMO_CODE), None)
        assert target is not None
        assert target.get("blasted_at"), "blasted_at should be set"


# ---------- 3. CLV settings + enrichment ----------

class TestCLVSettings:
    original_threshold = None

    def test_get_default(self, salon_client):
        r = salon_client.get(f"{BASE_URL}/api/tenants/me/clv-settings")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "vip_threshold_euros" in d
        TestCLVSettings.original_threshold = d["vip_threshold_euros"]

    def test_put_persists(self, salon_client):
        r = salon_client.put(f"{BASE_URL}/api/tenants/me/clv-settings", json={"vip_threshold_euros": 750})
        assert r.status_code == 200, r.text
        assert r.json()["vip_threshold_euros"] == 750.0
        # GET again
        r2 = salon_client.get(f"{BASE_URL}/api/tenants/me/clv-settings")
        assert r2.json()["vip_threshold_euros"] == 750.0

    def test_clamp_too_high(self, salon_client):
        r = salon_client.put(f"{BASE_URL}/api/tenants/me/clv-settings", json={"vip_threshold_euros": 9999999})
        assert r.status_code == 200
        assert r.json()["vip_threshold_euros"] <= 100000

    def test_clamp_negative(self, salon_client):
        r = salon_client.put(f"{BASE_URL}/api/tenants/me/clv-settings", json={"vip_threshold_euros": -5})
        assert r.status_code == 200
        assert r.json()["vip_threshold_euros"] >= 0

    def test_restore(self, salon_client):
        threshold = TestCLVSettings.original_threshold or 500
        r = salon_client.put(f"{BASE_URL}/api/tenants/me/clv-settings", json={"vip_threshold_euros": 500})
        assert r.status_code == 200
        assert r.json()["vip_threshold_euros"] == 500.0


class TestClientsEnriched:
    def test_clients_lifetime(self, salon_client):
        r = salon_client.get(f"{BASE_URL}/api/clients")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "vip_threshold_euros" in body
        assert "clients" in body
        if body["clients"]:
            c = body["clients"][0]
            for k in ["lifetime_value", "visit_count", "is_vip_auto", "is_vip_effective"]:
                assert k in c, f"missing {k}"


class TestAppointmentsEnriched:
    def test_appointments_clv(self, salon_client):
        r = salon_client.get(f"{BASE_URL}/api/appointments")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "vip_threshold_euros" in body
        appts = body.get("appointments", [])
        if appts:
            a = appts[0]
            assert "client_lifetime_value" in a
            assert "client_is_vip" in a
            assert isinstance(a["client_lifetime_value"], (int, float))
            assert isinstance(a["client_is_vip"], bool)


class TestLifetimeStats:
    def test_lifetime_stats_endpoint(self, salon_client):
        # find any client
        r = salon_client.get(f"{BASE_URL}/api/clients")
        clients = r.json().get("clients", [])
        if not clients:
            pytest.skip("No clients to test lifetime-stats")
        cid = clients[0].get("client_id") or clients[0].get("id")
        r2 = salon_client.get(f"{BASE_URL}/api/clients/{cid}/lifetime-stats")
        assert r2.status_code == 200, r2.text
        d = r2.json()
        for k in ["lifetime_value", "visit_count", "last_visit", "average_spend",
                  "is_vip", "vip_threshold_euros", "manual_vip"]:
            assert k in d, f"missing {k}"
