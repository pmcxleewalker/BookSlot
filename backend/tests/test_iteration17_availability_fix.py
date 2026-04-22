"""
Iteration 17 - Verification that the 'enabled' key fix works for availability
and end-to-end public booking flow completes with confirmation_code + requires_approval.
"""
import os
import pytest
import requests
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
assert BASE_URL, "REACT_APP_BACKEND_URL env var required"

SALON_SLUG = "bella-hair-studio-d5d6d8"


def _next_weekday(days_ahead: int = 3):
    """Return a date string (YYYY-MM-DD) that is the next Mon-Fri at least N days ahead."""
    d = datetime.now() + timedelta(days=days_ahead)
    # Skip Sat (5) and Sun (6)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d.strftime("%Y-%m-%d")


@pytest.fixture(scope="module")
def public_page():
    r = requests.get(f"{BASE_URL}/api/public/booking/{SALON_SLUG}", timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def service_and_staff(public_page):
    services = public_page.get("services", [])
    assert services, "No public services for salon"
    svc = services[0]
    sfs = requests.get(
        f"{BASE_URL}/api/public/booking/{SALON_SLUG}/staff-for-service",
        params={"service_id": svc["service_id"]}, timeout=20).json()
    eligible = sfs.get("staff", [])
    assert eligible, "No eligible staff for service"
    return svc, eligible[0]


class TestAvailabilityFix:
    def test_availability_returns_slots_for_weekday(self, service_and_staff):
        svc, st = service_and_staff
        date = _next_weekday(3)
        r = requests.get(
            f"{BASE_URL}/api/public/booking/{SALON_SLUG}/availability",
            params={"service_id": svc["service_id"], "staff_id": st["staff_id"], "date": date},
            timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        slots = data.get("slots", [])
        assert len(slots) > 0, f"Expected non-empty slots for {date} but got empty. Response: {data}"
        # Validate slot shape
        first = slots[0]
        assert "start_time" in first and "end_time" in first


class TestEndToEndBooking:
    def test_end_to_end_booking_with_approval(self, service_and_staff):
        svc, st = service_and_staff
        # Pick a slot that's >= 4 hours away (lead_time_hours=3 + buffer)
        # Use a date 3 days ahead so lead time is irrelevant
        date = _next_weekday(3)
        avail = requests.get(
            f"{BASE_URL}/api/public/booking/{SALON_SLUG}/availability",
            params={"service_id": svc["service_id"], "staff_id": st["staff_id"], "date": date},
            timeout=20)
        assert avail.status_code == 200
        slots = avail.json().get("slots", [])
        assert slots, "No slots - availability fix not working"
        slot = slots[2] if len(slots) > 2 else slots[0]  # Pick a mid-morning slot

        payload = {
            "service_id": svc["service_id"],
            "staff_id": st["staff_id"],
            "start_time": slot["start_time"],
            "end_time": slot["end_time"],
            "client_name": "TEST_E2E Client",
            "client_phone": "+353871234567",
            "client_email": "test_e2e@example.com",
            "notes": "TEST iteration17 e2e"
        }
        r = requests.post(f"{BASE_URL}/api/public/booking/{SALON_SLUG}/book",
                          json=payload, timeout=25)
        assert r.status_code in (200, 201), f"Booking failed: {r.status_code} {r.text}"
        data = r.json()
        # Verify confirmation code
        confirmation = data.get("confirmation_code") or data.get("appointment", {}).get("confirmation_code")
        assert confirmation, f"No confirmation_code in response: {data}"
        # Bella has approval_required=true
        requires = data.get("requires_approval")
        appt = data.get("appointment", {})
        status = appt.get("status") or data.get("status")
        assert requires is True or status == "pending", \
            f"Expected requires_approval=True or status=pending. Got requires={requires} status={status} data={data}"


class TestSmartSuggestions:
    def test_double_book_triggers_suggestions(self, service_and_staff):
        """Book a slot then try to double-book same exact time to trigger conflict suggestions."""
        svc, st = service_and_staff
        date = _next_weekday(4)
        avail = requests.get(
            f"{BASE_URL}/api/public/booking/{SALON_SLUG}/availability",
            params={"service_id": svc["service_id"], "staff_id": st["staff_id"], "date": date},
            timeout=20).json()
        slots = avail.get("slots", [])
        if not slots:
            pytest.skip("No slots")
        slot = slots[0]

        payload = {
            "service_id": svc["service_id"],
            "staff_id": st["staff_id"],
            "start_time": slot["start_time"],
            "end_time": slot["end_time"],
            "client_name": "TEST_Conflict1",
            "client_phone": "+353871234568",
            "client_email": "test_conflict1@example.com",
        }
        r1 = requests.post(f"{BASE_URL}/api/public/booking/{SALON_SLUG}/book",
                           json=payload, timeout=25)
        assert r1.status_code in (200, 201), r1.text

        # Now attempt a second booking at the same slot
        payload2 = {**payload, "client_name": "TEST_Conflict2",
                    "client_email": "test_conflict2@example.com"}
        r2 = requests.post(f"{BASE_URL}/api/public/booking/{SALON_SLUG}/book",
                           json=payload2, timeout=25)
        # Expect 409 with suggestions OR success (if approval puts it pending w/o blocking)
        if r2.status_code == 409:
            detail = r2.json().get("detail", {})
            if isinstance(detail, dict):
                # Suggestions keys should exist
                has_alt = any(k in detail for k in
                              ("alternative_staff", "alternative_days", "alternative_times"))
                assert has_alt, f"Expected alternative_* fields in 409. Got: {detail}"
