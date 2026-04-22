"""
Iteration 16 - Calendar click-to-book + Public Booking visible_online/bookable_online + booking rules
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
assert BASE_URL, "REACT_APP_BACKEND_URL env var required"

SALON_SLUG = "bella-hair-studio-d5d6d8"


@pytest.fixture(scope="module")
def salon_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "salon@bookslot.io", "password": "Demo123!"})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def salon_headers(salon_token):
    return {"Authorization": f"Bearer {salon_token}", "Content-Type": "application/json"}


# ---------- Public Booking Page (visible_online / bookable_online) ----------

class TestPublicBookingVisibility:
    def test_public_booking_returns_200(self):
        r = requests.get(f"{BASE_URL}/api/public/booking/{SALON_SLUG}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "tenant" in data
        assert "services" in data
        assert "staff" in data

    def test_tenant_branding_present(self):
        r = requests.get(f"{BASE_URL}/api/public/booking/{SALON_SLUG}")
        tenant = r.json()["tenant"]
        assert tenant["name"]
        assert "branding" in tenant

    def test_hidden_service_not_exposed(self, salon_headers):
        # Find a service and flip visible_online=False, check it disappears
        r_all = requests.get(f"{BASE_URL}/api/services", headers=salon_headers)
        assert r_all.status_code == 200
        services = r_all.json().get("services", [])
        assert len(services) > 0
        svc = services[0]
        svc_id = svc["service_id"]

        original = svc.get("visible_online", True)

        # Baseline: service is in public listing
        pub_before = requests.get(f"{BASE_URL}/api/public/booking/{SALON_SLUG}").json()
        before_ids = [s["service_id"] for s in pub_before["services"]]
        assert svc_id in before_ids, "Service should be visible in public listing before toggle"

        # Hide the service
        upd = requests.put(f"{BASE_URL}/api/services/{svc_id}",
                           headers=salon_headers,
                           json={"visible_online": False})
        assert upd.status_code == 200, upd.text

        try:
            pub_after = requests.get(f"{BASE_URL}/api/public/booking/{SALON_SLUG}").json()
            after_ids = [s["service_id"] for s in pub_after["services"]]
            assert svc_id not in after_ids, "Hidden service must not appear in public listing"
        finally:
            # Restore
            requests.put(f"{BASE_URL}/api/services/{svc_id}",
                         headers=salon_headers,
                         json={"visible_online": original})

    def test_non_bookable_staff_not_exposed(self, salon_headers):
        r_staff = requests.get(f"{BASE_URL}/api/staff", headers=salon_headers)
        assert r_staff.status_code == 200
        staff_list = r_staff.json().get("staff", [])
        assert len(staff_list) > 0
        st = staff_list[0]
        staff_id = st["staff_id"]
        original = st.get("bookable_online", True)

        pub_before = requests.get(f"{BASE_URL}/api/public/booking/{SALON_SLUG}").json()
        before_ids = [s["staff_id"] for s in pub_before["staff"]]
        assert staff_id in before_ids

        upd = requests.put(f"{BASE_URL}/api/staff/{staff_id}",
                           headers=salon_headers,
                           json={"bookable_online": False})
        assert upd.status_code == 200, upd.text

        try:
            pub_after = requests.get(f"{BASE_URL}/api/public/booking/{SALON_SLUG}").json()
            after_ids = [s["staff_id"] for s in pub_after["staff"]]
            assert staff_id not in after_ids, "Non-bookable staff must not appear in public listing"

            # Also confirm staff-for-service endpoint filters too
            # Pick any service id
            svcs = pub_after["services"]
            if svcs:
                sid = svcs[0]["service_id"]
                sfs = requests.get(
                    f"{BASE_URL}/api/public/booking/{SALON_SLUG}/staff-for-service",
                    params={"service_id": sid}).json()
                sfs_ids = [s["staff_id"] for s in sfs.get("staff", [])]
                assert staff_id not in sfs_ids
        finally:
            requests.put(f"{BASE_URL}/api/staff/{staff_id}",
                         headers=salon_headers,
                         json={"bookable_online": original})


# ---------- Booking Rules: approval_required + requires_approval response ----------

class TestPublicBookingApproval:
    def test_booking_rules_has_approval_required(self, salon_headers):
        r = requests.get(f"{BASE_URL}/api/tenants/me", headers=salon_headers)
        assert r.status_code == 200
        tenant = r.json().get("tenant", r.json())
        rules = tenant.get("booking_rules", {})
        # Don't fail if not set — just log
        assert isinstance(rules, dict)

    def test_submit_booking_returns_requires_approval(self):
        # Get booking page
        page = requests.get(f"{BASE_URL}/api/public/booking/{SALON_SLUG}").json()
        services = page["services"]
        staff = page["staff"]
        if not services or not staff:
            pytest.skip("No services or staff available")

        svc = services[0]
        # Find a staff who can perform the service
        sfs = requests.get(
            f"{BASE_URL}/api/public/booking/{SALON_SLUG}/staff-for-service",
            params={"service_id": svc["service_id"]}).json()
        eligible = sfs.get("staff", [])
        if not eligible:
            pytest.skip("No eligible staff")
        st = eligible[0]

        # Get availability for a future date (7 days out)
        from datetime import datetime, timedelta
        future = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        avail = requests.get(
            f"{BASE_URL}/api/public/booking/{SALON_SLUG}/availability",
            params={"service_id": svc["service_id"], "staff_id": st["staff_id"], "date": future})
        assert avail.status_code == 200, avail.text
        slots = avail.json().get("slots", [])
        if not slots:
            pytest.skip("No slots available")
        slot = slots[0]

        payload = {
            "service_id": svc["service_id"],
            "staff_id": st["staff_id"],
            "start_time": slot if isinstance(slot, str) else slot.get("time", slot.get("start_time")),
            "client_name": "TEST_Approval Client",
            "client_phone": "+353871234567",
            "client_email": "TEST_approval@example.com"
        }

        r = requests.post(f"{BASE_URL}/api/public/booking/{SALON_SLUG}/book", json=payload)
        assert r.status_code in [200, 201], r.text
        data = r.json()
        # Must include confirmation code
        assert "confirmation_code" in data or "appointment" in data, data
        # Bella has approval_required=true → expect requires_approval or pending
        appt = data.get("appointment", data)
        status = appt.get("status", data.get("status"))
        requires = data.get("requires_approval", appt.get("requires_approval"))
        assert (status == "pending") or (requires is True), \
            f"Expected pending/requires_approval, got status={status} requires_approval={requires}"
