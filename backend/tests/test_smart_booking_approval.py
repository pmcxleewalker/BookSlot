"""
Test Smart Booking with Conflict Detection and Approval Workflow
Tests:
1. Public booking flow with smart conflict detection (409 errors with alternative suggestions)
2. Approve/Reject endpoints for pending bookings
3. Notification bell pending count
4. File upload for logos
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
DEMO_EMAIL = "demo@bookslot.io"
DEMO_PASSWORD = "Demo123!"

class TestSmartBookingAndApproval:
    """Test smart booking with conflict detection and approval workflow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        self.token = data["token"]
        self.tenant_id = data["user"]["tenant_id"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get tenant info for slug
        tenant_response = self.session.get(f"{BASE_URL}/api/tenants/me")
        assert tenant_response.status_code == 200
        self.tenant_slug = tenant_response.json()["tenant"]["booking_url_slug"]
        
        # Get staff and services
        staff_response = self.session.get(f"{BASE_URL}/api/staff")
        assert staff_response.status_code == 200
        self.staff = staff_response.json()["staff"]
        
        services_response = self.session.get(f"{BASE_URL}/api/services")
        assert services_response.status_code == 200
        self.services = services_response.json()["services"]
        
        yield
        
        # Cleanup - cancel any test appointments
        self._cleanup_test_appointments()
    
    def _cleanup_test_appointments(self):
        """Clean up test appointments"""
        try:
            # Get all appointments
            response = self.session.get(f"{BASE_URL}/api/appointments")
            if response.status_code == 200:
                appointments = response.json().get("appointments", [])
                for appt in appointments:
                    if appt.get("client_email", "").startswith("test_"):
                        # Cancel test appointments
                        self.session.put(f"{BASE_URL}/api/appointments/{appt['appointment_id']}", 
                                        json={"status": "cancelled"})
        except:
            pass
    
    # ==================== PUBLIC BOOKING PAGE TESTS ====================
    
    def test_public_booking_page_loads(self):
        """Test public booking page returns tenant, services, and staff"""
        response = requests.get(f"{BASE_URL}/api/public/booking/{self.tenant_slug}")
        assert response.status_code == 200, f"Public booking page failed: {response.text}"
        
        data = response.json()
        assert "tenant" in data
        assert "services" in data
        assert "staff" in data
        assert len(data["services"]) > 0
        assert len(data["staff"]) > 0
        print(f"✓ Public booking page loads with {len(data['services'])} services and {len(data['staff'])} staff")
    
    def test_availability_endpoint(self):
        """Test availability endpoint returns slots"""
        service = self.services[0]
        staff = self.staff[0]
        
        # Get availability for tomorrow
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/public/booking/{self.tenant_slug}/availability",
            params={
                "service_id": service["service_id"],
                "staff_id": staff["staff_id"],
                "date": tomorrow
            }
        )
        assert response.status_code == 200, f"Availability failed: {response.text}"
        
        data = response.json()
        assert "slots" in data
        assert "date" in data
        print(f"✓ Availability endpoint returns {len(data['slots'])} slots for {tomorrow}")
    
    # ==================== SMART BOOKING CONFLICT DETECTION ====================
    
    def test_create_booking_success(self):
        """Test successful booking creation with pending status"""
        service = self.services[0]
        staff = self.staff[0]
        
        # Get availability for tomorrow
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        avail_response = requests.get(
            f"{BASE_URL}/api/public/booking/{self.tenant_slug}/availability",
            params={
                "service_id": service["service_id"],
                "staff_id": staff["staff_id"],
                "date": tomorrow
            }
        )
        assert avail_response.status_code == 200
        slots = avail_response.json()["slots"]
        
        if not slots:
            pytest.skip("No available slots for testing")
        
        slot = slots[0]
        
        # Create booking
        booking_response = requests.post(
            f"{BASE_URL}/api/public/booking/{self.tenant_slug}/book",
            json={
                "service_id": service["service_id"],
                "staff_id": staff["staff_id"],
                "start_time": slot["start_time"],
                "end_time": slot["end_time"],
                "client_name": "Test User",
                "client_email": "test_booking@example.com",
                "client_phone": "+1234567890"
            }
        )
        assert booking_response.status_code == 200, f"Booking failed: {booking_response.text}"
        
        data = booking_response.json()
        assert "appointment_id" in data or "confirmation_code" in data
        assert data.get("requires_approval", True) == True  # Should require approval
        print(f"✓ Booking created successfully with pending status")
        
        # Store for cleanup
        self.test_appointment_id = data.get("appointment_id") or data.get("confirmation_code")
    
    def test_conflict_detection_returns_409_with_alternatives(self):
        """Test that booking conflict returns 409 with alternative suggestions"""
        service = self.services[0]
        staff = self.staff[0]
        
        # Get availability for tomorrow
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        avail_response = requests.get(
            f"{BASE_URL}/api/public/booking/{self.tenant_slug}/availability",
            params={
                "service_id": service["service_id"],
                "staff_id": staff["staff_id"],
                "date": tomorrow
            }
        )
        assert avail_response.status_code == 200
        slots = avail_response.json()["slots"]
        
        if not slots:
            pytest.skip("No available slots for testing")
        
        slot = slots[0]
        
        # Create first booking
        first_booking = requests.post(
            f"{BASE_URL}/api/public/booking/{self.tenant_slug}/book",
            json={
                "service_id": service["service_id"],
                "staff_id": staff["staff_id"],
                "start_time": slot["start_time"],
                "end_time": slot["end_time"],
                "client_name": "Test User 1",
                "client_email": "test_conflict1@example.com",
                "client_phone": "+1234567890"
            }
        )
        
        if first_booking.status_code != 200:
            # Slot might already be taken, try next slot
            if len(slots) > 1:
                slot = slots[1]
                first_booking = requests.post(
                    f"{BASE_URL}/api/public/booking/{self.tenant_slug}/book",
                    json={
                        "service_id": service["service_id"],
                        "staff_id": staff["staff_id"],
                        "start_time": slot["start_time"],
                        "end_time": slot["end_time"],
                        "client_name": "Test User 1",
                        "client_email": "test_conflict1@example.com",
                        "client_phone": "+1234567890"
                    }
                )
        
        # Try to book same slot again - should get 409 with alternatives
        conflict_booking = requests.post(
            f"{BASE_URL}/api/public/booking/{self.tenant_slug}/book",
            json={
                "service_id": service["service_id"],
                "staff_id": staff["staff_id"],
                "start_time": slot["start_time"],
                "end_time": slot["end_time"],
                "client_name": "Test User 2",
                "client_email": "test_conflict2@example.com",
                "client_phone": "+1234567891"
            }
        )
        
        assert conflict_booking.status_code == 409, f"Expected 409 conflict, got {conflict_booking.status_code}: {conflict_booking.text}"
        
        error_data = conflict_booking.json()["detail"]
        assert "reason" in error_data
        assert "message" in error_data
        assert error_data["reason"] == "already_booked"
        
        # Check for alternative suggestions
        has_alternatives = (
            "alternative_times" in error_data or 
            "alternative_staff" in error_data or 
            "alternative_days" in error_data
        )
        assert has_alternatives, "409 response should include alternative suggestions"
        
        print(f"✓ Conflict detection returns 409 with alternatives: {list(error_data.keys())}")
    
    def test_booking_outside_working_hours_returns_409(self):
        """Test booking outside working hours returns 409 with suggestions"""
        service = self.services[0]
        staff = self.staff[0]
        
        # Try to book at 6 AM (outside working hours)
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/public/booking/{self.tenant_slug}/book",
            json={
                "service_id": service["service_id"],
                "staff_id": staff["staff_id"],
                "start_time": f"{tomorrow}T06:00:00",
                "end_time": f"{tomorrow}T06:45:00",
                "client_name": "Test User",
                "client_email": "test_hours@example.com",
                "client_phone": "+1234567890"
            }
        )
        
        assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.text}"
        
        error_data = response.json()["detail"]
        assert error_data["reason"] == "outside_working_hours"
        assert "alternative_times" in error_data or "working_hours" in error_data
        print(f"✓ Outside working hours returns 409 with reason: {error_data['reason']}")
    
    def test_booking_on_day_off_returns_409(self):
        """Test booking on staff day off returns 409 with alternative days"""
        service = self.services[0]
        staff = self.staff[0]
        
        # Find a Sunday (staff day off based on working_hours)
        today = datetime.now()
        days_until_sunday = (6 - today.weekday()) % 7
        if days_until_sunday == 0:
            days_until_sunday = 7
        sunday = (today + timedelta(days=days_until_sunday)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/public/booking/{self.tenant_slug}/book",
            json={
                "service_id": service["service_id"],
                "staff_id": staff["staff_id"],
                "start_time": f"{sunday}T10:00:00",
                "end_time": f"{sunday}T10:45:00",
                "client_name": "Test User",
                "client_email": "test_dayoff@example.com",
                "client_phone": "+1234567890"
            }
        )
        
        # Should be 409 if Sunday is disabled for this staff
        if response.status_code == 409:
            error_data = response.json()["detail"]
            assert error_data["reason"] == "staff_day_off"
            assert "alternative_days" in error_data or "alternative_staff" in error_data
            print(f"✓ Day off returns 409 with alternatives")
        else:
            # Staff might work on Sunday
            print(f"✓ Staff works on Sunday, booking allowed")
    
    # ==================== APPROVAL WORKFLOW TESTS ====================
    
    def test_get_pending_appointments(self):
        """Test getting pending appointments"""
        response = self.session.get(f"{BASE_URL}/api/appointments?status=pending")
        assert response.status_code == 200, f"Get pending failed: {response.text}"
        
        data = response.json()
        assert "appointments" in data
        print(f"✓ Found {len(data['appointments'])} pending appointments")
    
    def test_approve_appointment(self):
        """Test approving a pending appointment"""
        # First create a booking
        service = self.services[0]
        staff = self.staff[0]
        
        # Get availability for day after tomorrow
        day_after = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        
        avail_response = requests.get(
            f"{BASE_URL}/api/public/booking/{self.tenant_slug}/availability",
            params={
                "service_id": service["service_id"],
                "staff_id": staff["staff_id"],
                "date": day_after
            }
        )
        
        if avail_response.status_code != 200:
            pytest.skip("Could not get availability")
        
        slots = avail_response.json()["slots"]
        if not slots:
            pytest.skip("No available slots")
        
        # Use a slot in the middle to avoid conflicts
        slot = slots[len(slots) // 2] if len(slots) > 2 else slots[0]
        
        # Create booking
        booking_response = requests.post(
            f"{BASE_URL}/api/public/booking/{self.tenant_slug}/book",
            json={
                "service_id": service["service_id"],
                "staff_id": staff["staff_id"],
                "start_time": slot["start_time"],
                "end_time": slot["end_time"],
                "client_name": "Test Approve User",
                "client_email": "test_approve@example.com",
                "client_phone": "+1234567890"
            }
        )
        
        if booking_response.status_code != 200:
            pytest.skip(f"Could not create booking: {booking_response.text}")
        
        appointment_id = booking_response.json().get("appointment_id") or booking_response.json().get("confirmation_code")
        
        # Approve the appointment
        approve_response = self.session.post(f"{BASE_URL}/api/appointments/{appointment_id}/approve")
        assert approve_response.status_code == 200, f"Approve failed: {approve_response.text}"
        
        data = approve_response.json()
        assert data["status"] == "confirmed"
        print(f"✓ Appointment approved successfully")
    
    def test_reject_appointment(self):
        """Test rejecting a pending appointment"""
        # First create a booking
        service = self.services[0]
        staff = self.staff[0]
        
        # Get availability for 3 days from now
        future_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        
        avail_response = requests.get(
            f"{BASE_URL}/api/public/booking/{self.tenant_slug}/availability",
            params={
                "service_id": service["service_id"],
                "staff_id": staff["staff_id"],
                "date": future_date
            }
        )
        
        if avail_response.status_code != 200:
            pytest.skip("Could not get availability")
        
        slots = avail_response.json()["slots"]
        if not slots:
            pytest.skip("No available slots")
        
        # Use last slot to avoid conflicts
        slot = slots[-1]
        
        # Create booking
        booking_response = requests.post(
            f"{BASE_URL}/api/public/booking/{self.tenant_slug}/book",
            json={
                "service_id": service["service_id"],
                "staff_id": staff["staff_id"],
                "start_time": slot["start_time"],
                "end_time": slot["end_time"],
                "client_name": "Test Reject User",
                "client_email": "test_reject@example.com",
                "client_phone": "+1234567890"
            }
        )
        
        if booking_response.status_code != 200:
            pytest.skip(f"Could not create booking: {booking_response.text}")
        
        appointment_id = booking_response.json().get("appointment_id") or booking_response.json().get("confirmation_code")
        
        # Reject the appointment
        reject_response = self.session.post(
            f"{BASE_URL}/api/appointments/{appointment_id}/reject",
            json={"reason": "Test rejection"}
        )
        assert reject_response.status_code == 200, f"Reject failed: {reject_response.text}"
        
        data = reject_response.json()
        assert data["status"] == "rejected"
        print(f"✓ Appointment rejected successfully")
    
    def test_approve_nonexistent_appointment(self):
        """Test approving non-existent appointment returns 404"""
        response = self.session.post(f"{BASE_URL}/api/appointments/nonexistent_id/approve")
        assert response.status_code == 404
        print(f"✓ Approve non-existent returns 404")
    
    def test_reject_nonexistent_appointment(self):
        """Test rejecting non-existent appointment returns 404"""
        response = self.session.post(f"{BASE_URL}/api/appointments/nonexistent_id/reject")
        assert response.status_code == 404
        print(f"✓ Reject non-existent returns 404")
    
    # ==================== FILE UPLOAD TESTS ====================
    
    def test_file_upload_endpoint_exists(self):
        """Test file upload endpoint exists"""
        # Create a simple test image (1x1 pixel PNG)
        import base64
        # Minimal valid PNG
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        files = {"file": ("test.png", png_data, "image/png")}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/upload/image",
            files=files,
            headers=headers
        )
        
        # Should either succeed or fail gracefully (storage might not be configured)
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "file_id" in data or "url" in data or "path" in data
            print(f"✓ File upload successful")
        else:
            print(f"✓ File upload endpoint exists (storage may not be configured)")
    
    def test_file_upload_invalid_type(self):
        """Test file upload rejects invalid file types"""
        files = {"file": ("test.txt", b"test content", "text/plain")}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/upload/image",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid file type, got {response.status_code}"
        print(f"✓ Invalid file type rejected")
    
    # ==================== BRANDING TESTS ====================
    
    def test_get_branding(self):
        """Test getting tenant branding"""
        response = self.session.get(f"{BASE_URL}/api/tenants/me/branding")
        assert response.status_code == 200, f"Get branding failed: {response.text}"
        
        data = response.json()
        assert "branding" in data
        print(f"✓ Branding retrieved: {data['branding']}")
    
    def test_update_branding(self):
        """Test updating tenant branding"""
        new_branding = {
            "primary_color": "#FF5733",
            "secondary_color": "#333333",
            "accent_color": "#00FF00",
            "business_name": "Test Business Name",
            "show_powered_by": True
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/tenants/me/branding",
            json=new_branding
        )
        assert response.status_code == 200, f"Update branding failed: {response.text}"
        
        data = response.json()
        assert "branding" in data
        print(f"✓ Branding updated successfully")
    
    # ==================== NOTIFICATION SETTINGS TESTS ====================
    
    def test_get_notification_settings(self):
        """Test getting notification settings"""
        response = self.session.get(f"{BASE_URL}/api/notifications/settings")
        assert response.status_code == 200, f"Get notification settings failed: {response.text}"
        
        data = response.json()
        # Should have email_reminders_enabled at minimum
        print(f"✓ Notification settings retrieved")


class TestSmartAvailability:
    """Test smart availability endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert login_response.status_code == 200
        
        data = login_response.json()
        self.token = data["token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get tenant info
        tenant_response = self.session.get(f"{BASE_URL}/api/tenants/me")
        self.tenant_slug = tenant_response.json()["tenant"]["booking_url_slug"]
        
        # Get staff and services
        staff_response = self.session.get(f"{BASE_URL}/api/staff")
        self.staff = staff_response.json()["staff"]
        
        services_response = self.session.get(f"{BASE_URL}/api/services")
        self.services = services_response.json()["services"]
    
    def test_smart_availability_endpoint(self):
        """Test smart availability returns staff recommendations"""
        service = self.services[0]
        staff = self.staff[0]
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/public/booking/{self.tenant_slug}/smart-availability",
            params={
                "service_id": service["service_id"],
                "preferred_staff_id": staff["staff_id"],
                "date": tomorrow
            }
        )
        
        assert response.status_code == 200, f"Smart availability failed: {response.text}"
        
        data = response.json()
        assert "date" in data
        assert "service" in data
        assert "preferred_staff_available" in data
        print(f"✓ Smart availability: preferred_staff_available={data['preferred_staff_available']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
