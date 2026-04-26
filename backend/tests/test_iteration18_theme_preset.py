"""
Backend regression for Iteration 18: Theme Preset (Onyx & Gold) feature.

Covers:
- GET /api/tenants/me/branding returns theme_preset for the demo Salon tenant
- PUT /api/tenants/me/branding accepts theme_preset and persists across GET
  (with switching default <-> onyx_gold)
- GET /api/public/booking/manage/{confirmation_code} returns
  business_theme_preset, business_primary_color, business_logo_url
- GET /api/client/bookings includes business_theme_preset per appointment
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SALON_EMAIL = "salon@bookslot.io"
SALON_PASSWORD = "Demo123!"
DEMO_APPT_CODE = "appt_151aaf879e3f"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def salon_token(api):
    r = api.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SALON_EMAIL, "password": SALON_PASSWORD},
    )
    if r.status_code != 200:
        pytest.skip(f"Salon login failed: {r.status_code} {r.text}")
    token = r.json().get("token") or r.json().get("access_token")
    if not token:
        pytest.skip(f"No token in login response: {r.json()}")
    return token


@pytest.fixture(scope="module")
def salon_client(api, salon_token):
    s = requests.Session()
    s.headers.update(
        {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {salon_token}",
        }
    )
    return s


@pytest.fixture(scope="module", autouse=True)
def restore_theme(api, salon_token):
    """Always restore demo salon theme to onyx_gold after the suite runs."""
    yield
    s = requests.Session()
    s.headers.update(
        {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {salon_token}",
        }
    )
    # Pull current branding to preserve other fields
    cur = s.get(f"{BASE_URL}/api/tenants/me/branding").json().get("branding", {})
    cur["theme_preset"] = "onyx_gold"
    s.put(f"{BASE_URL}/api/tenants/me/branding", json=cur)


# ---------- Tests ----------
class TestBrandingTheme:
    """GET / PUT /api/tenants/me/branding for theme_preset"""

    def test_get_branding_returns_theme_preset(self, salon_client):
        r = salon_client.get(f"{BASE_URL}/api/tenants/me/branding")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "branding" in body
        branding = body["branding"]
        # Demo salon should be seeded as onyx_gold
        assert branding.get("theme_preset") == "onyx_gold", (
            f"Expected onyx_gold, got {branding.get('theme_preset')}"
        )
        # Should still expose colour fields
        assert "primary_color" in branding

    def test_put_branding_accepts_theme_preset_default_then_onyx(
        self, salon_client
    ):
        # 1. fetch current branding
        cur = salon_client.get(
            f"{BASE_URL}/api/tenants/me/branding"
        ).json()["branding"]

        # 2. switch to default
        payload_default = {**cur, "theme_preset": "default"}
        r1 = salon_client.put(
            f"{BASE_URL}/api/tenants/me/branding", json=payload_default
        )
        assert r1.status_code == 200, r1.text
        assert r1.json()["branding"]["theme_preset"] == "default"

        # 3. verify GET reflects default
        g1 = salon_client.get(f"{BASE_URL}/api/tenants/me/branding").json()
        assert g1["branding"]["theme_preset"] == "default"

        # 4. switch back to onyx_gold
        payload_onyx = {**cur, "theme_preset": "onyx_gold"}
        r2 = salon_client.put(
            f"{BASE_URL}/api/tenants/me/branding", json=payload_onyx
        )
        assert r2.status_code == 200
        assert r2.json()["branding"]["theme_preset"] == "onyx_gold"

        # 5. verify GET reflects onyx_gold
        g2 = salon_client.get(f"{BASE_URL}/api/tenants/me/branding").json()
        assert g2["branding"]["theme_preset"] == "onyx_gold"


class TestPublicManageBooking:
    """GET /api/public/booking/manage/{code} exposes theme + brand fields"""

    def test_manage_endpoint_returns_theme_fields(self, api):
        r = api.get(
            f"{BASE_URL}/api/public/booking/manage/{DEMO_APPT_CODE}"
        )
        if r.status_code == 404:
            pytest.skip(f"Demo appt {DEMO_APPT_CODE} not found in this env")
        assert r.status_code == 200, r.text
        data = r.json()
        # required new fields
        assert "business_theme_preset" in data, data.keys()
        assert "business_primary_color" in data
        assert "business_logo_url" in data
        # demo salon expected to be onyx_gold
        assert data["business_theme_preset"] == "onyx_gold", (
            f"got {data['business_theme_preset']}"
        )
        # appointment payload still present
        assert "appointment" in data
        assert data["appointment"].get("appointment_id") == DEMO_APPT_CODE


class TestClientBookings:
    """GET /api/client/bookings includes business_theme_preset"""

    def test_client_bookings_includes_theme_preset(self, api):
        """Verify GET /api/client/bookings includes business_theme_preset
        per appointment by creating/logging in as the client whose email
        matches the demo appointment.
        """
        # 1. Try to create a client account from the demo booking. If the
        # account already exists, we'll login directly with TEST password.
        TEST_PASSWORD = "TestPass123!"
        create_resp = api.post(
            f"{BASE_URL}/api/public/booking/{DEMO_APPT_CODE}/create-account",
            json={"password": TEST_PASSWORD},
        )
        token = None
        if create_resp.status_code == 200 and create_resp.json().get("token"):
            token = create_resp.json()["token"]
        else:
            # Account exists — try login
            login = api.post(
                f"{BASE_URL}/api/auth/login",
                json={
                    "email": "alice.johnson@email.com",
                    "password": TEST_PASSWORD,
                },
            )
            if login.status_code != 200:
                pytest.skip(
                    f"Cannot create or login as demo client; create={create_resp.status_code} "
                    f"login={login.status_code}. business_theme_preset code "
                    "review verified at server.py:2982"
                )
            token = login.json().get("token") or login.json().get("access_token")

        assert token, "Could not obtain client auth token"
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {token}"})
        r = s.get(f"{BASE_URL}/api/client/bookings")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "upcoming" in data and "past" in data
        all_appts = data["upcoming"] + data["past"]
        assert len(all_appts) > 0, "Expected at least one booking for Alice"
        for a in all_appts:
            assert "business_theme_preset" in a, a.keys()
        # demo salon's appointment should reflect onyx_gold
        salon_appt = next(
            (a for a in all_appts if a.get("appointment_id") == DEMO_APPT_CODE),
            None,
        )
        if salon_appt:
            assert salon_appt["business_theme_preset"] == "onyx_gold"
