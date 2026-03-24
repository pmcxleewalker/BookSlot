"""
Test suite for Notification System and Staff Working Hours features
- Notification settings (email/SMS)
- SMS add-on enable/disable
- Staff working hours CRUD
- Public booking availability respecting working hours
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
DEMO_EMAIL = "demo@bookslot.io"
DEMO_PASSWORD = "Demo123!"

# Known test data from previous testing
TENANT_ID = "tenant_126e958c4b6b"
STAFF_ID = "staff_0184f512181f"
BOOKING_SLUG = "demo-salon-8c4b6b"


class TestNotificationSettings:
    """Test notification settings endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_notification_settings(self):
        """GET /api/notifications/settings - returns email and SMS settings"""
        response = requests.get(f"{BASE_URL}/api/notifications/settings", headers=self.headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "email_reminders_enabled" in data
        assert "sms_reminders_enabled" in data
        assert "sms_addon_enabled" in data
        assert "reminder_hours_before" in data
        assert "sms_addon_price" in data
        
        # Verify data types
        assert isinstance(data["email_reminders_enabled"], bool)
        assert isinstance(data["sms_reminders_enabled"], bool)
        assert isinstance(data["sms_addon_enabled"], bool)
        assert isinstance(data["reminder_hours_before"], int)
        assert data["sms_addon_price"] == 10  # €10/month
        
        print(f"Notification settings: email={data['email_reminders_enabled']}, sms_addon={data['sms_addon_enabled']}")
    
    def test_update_reminder_hours(self):
        """PUT /api/notifications/settings - can update reminder_hours_before"""
        # Update to 48 hours
        response = requests.put(
            f"{BASE_URL}/api/notifications/settings",
            json={"reminder_hours_before": 48},
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["settings"]["reminder_hours_before"] == 48
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/notifications/settings", headers=self.headers)
        assert get_response.json()["reminder_hours_before"] == 48
        
        # Reset to 24 hours
        requests.put(
            f"{BASE_URL}/api/notifications/settings",
            json={"reminder_hours_before": 24},
            headers=self.headers
        )
        print("Reminder hours update: PASS")
    
    def test_update_email_reminders(self):
        """PUT /api/notifications/settings - can toggle email reminders"""
        # Get current state
        current = requests.get(f"{BASE_URL}/api/notifications/settings", headers=self.headers).json()
        original_state = current["email_reminders_enabled"]
        
        # Toggle
        response = requests.put(
            f"{BASE_URL}/api/notifications/settings",
            json={"email_reminders_enabled": not original_state},
            headers=self.headers
        )
        assert response.status_code == 200
        
        # Verify change
        updated = requests.get(f"{BASE_URL}/api/notifications/settings", headers=self.headers).json()
        assert updated["email_reminders_enabled"] == (not original_state)
        
        # Restore original
        requests.put(
            f"{BASE_URL}/api/notifications/settings",
            json={"email_reminders_enabled": original_state},
            headers=self.headers
        )
        print("Email reminders toggle: PASS")


class TestSMSAddon:
    """Test SMS add-on enable/disable functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_enable_sms_addon(self):
        """POST /api/notifications/sms-addon/enable - enables SMS add-on"""
        response = requests.post(f"{BASE_URL}/api/notifications/sms-addon/enable", headers=self.headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["message"] == "SMS add-on enabled"
        assert data["monthly_cost"] == 10
        assert data["currency"] == "EUR"
        
        # Verify persistence
        settings = requests.get(f"{BASE_URL}/api/notifications/settings", headers=self.headers).json()
        assert settings["sms_addon_enabled"] == True
        
        print("SMS addon enable: PASS")
    
    def test_disable_sms_addon(self):
        """POST /api/notifications/sms-addon/disable - disables SMS add-on and SMS reminders"""
        # First ensure it's enabled
        requests.post(f"{BASE_URL}/api/notifications/sms-addon/enable", headers=self.headers)
        
        # Enable SMS reminders
        requests.put(
            f"{BASE_URL}/api/notifications/settings",
            json={"sms_reminders_enabled": True},
            headers=self.headers
        )
        
        # Now disable
        response = requests.post(f"{BASE_URL}/api/notifications/sms-addon/disable", headers=self.headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        assert response.json()["message"] == "SMS add-on disabled"
        
        # Verify both addon and reminders are disabled
        settings = requests.get(f"{BASE_URL}/api/notifications/settings", headers=self.headers).json()
        assert settings["sms_addon_enabled"] == False
        assert settings["sms_reminders_enabled"] == False
        
        print("SMS addon disable (also disables SMS reminders): PASS")
    
    def test_sms_reminders_require_addon(self):
        """PUT /api/notifications/settings with SMS on but addon off - should fail with 403"""
        # Ensure addon is disabled
        requests.post(f"{BASE_URL}/api/notifications/sms-addon/disable", headers=self.headers)
        
        # Try to enable SMS reminders without addon
        response = requests.put(
            f"{BASE_URL}/api/notifications/settings",
            json={"sms_reminders_enabled": True},
            headers=self.headers
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        assert "SMS add-on not enabled" in response.json()["detail"]
        
        print("SMS reminders require addon: PASS (correctly returns 403)")


class TestIntegrationStatus:
    """Test notification integration status endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_integration_status(self):
        """GET /api/notifications/integration-status - shows Resend and Twilio config status"""
        response = requests.get(f"{BASE_URL}/api/notifications/integration-status", headers=self.headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify email integration structure
        assert "email" in data
        assert data["email"]["provider"] == "Resend"
        assert "configured" in data["email"]
        assert isinstance(data["email"]["configured"], bool)
        
        # Verify SMS integration structure
        assert "sms" in data
        assert data["sms"]["provider"] == "Twilio"
        assert "configured" in data["sms"]
        assert isinstance(data["sms"]["configured"], bool)
        
        # Note: In test environment, these are expected to be NOT configured
        print(f"Integration status: email_configured={data['email']['configured']}, sms_configured={data['sms']['configured']}")
        print("Integration status endpoint: PASS")


class TestNotificationLogs:
    """Test notification logs endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_notification_logs(self):
        """GET /api/notifications/logs - returns notification history"""
        response = requests.get(f"{BASE_URL}/api/notifications/logs", headers=self.headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "logs" in data
        assert isinstance(data["logs"], list)
        
        # If there are logs, verify structure
        if len(data["logs"]) > 0:
            log = data["logs"][0]
            assert "log_id" in log
            assert "type" in log  # email or sms
            assert "status" in log
            assert "created_at" in log
        
        print(f"Notification logs: {len(data['logs'])} logs found")
    
    def test_filter_logs_by_type(self):
        """GET /api/notifications/logs?type=email - filter by type"""
        response = requests.get(f"{BASE_URL}/api/notifications/logs?type=email", headers=self.headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # All logs should be email type
        for log in data["logs"]:
            assert log["type"] == "email"
        
        print(f"Filtered email logs: {len(data['logs'])} logs")


class TestStaffWorkingHours:
    """Test staff working hours endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_staff_working_hours(self):
        """GET /api/staff/{id}/working-hours - returns staff working hours"""
        response = requests.get(f"{BASE_URL}/api/staff/{STAFF_ID}/working-hours", headers=self.headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["staff_id"] == STAFF_ID
        assert "working_hours" in data
        
        # Verify working hours structure
        working_hours = data["working_hours"]
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        
        for day in days:
            assert day in working_hours, f"Missing day: {day}"
            day_data = working_hours[day]
            assert "enabled" in day_data
            assert "start" in day_data
            assert "end" in day_data
            assert "breaks" in day_data
        
        print(f"Staff working hours retrieved for {STAFF_ID}")
    
    def test_update_staff_working_hours(self):
        """PUT /api/staff/{id}/working-hours - can update working hours with breaks"""
        # Get current hours
        current = requests.get(f"{BASE_URL}/api/staff/{STAFF_ID}/working-hours", headers=self.headers).json()
        original_hours = current["working_hours"]
        
        # Update with new hours including breaks
        new_hours = {
            "monday": {"enabled": True, "start": "08:00", "end": "18:00", "breaks": [{"start": "12:00", "end": "13:00"}]},
            "tuesday": {"enabled": True, "start": "08:00", "end": "18:00", "breaks": []},
            "wednesday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
            "thursday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
            "friday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
            "saturday": {"enabled": True, "start": "10:00", "end": "14:00", "breaks": []},
            "sunday": {"enabled": False, "start": "10:00", "end": "14:00", "breaks": []}
        }
        
        response = requests.put(
            f"{BASE_URL}/api/staff/{STAFF_ID}/working-hours",
            json=new_hours,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["message"] == "Working hours updated"
        
        # Verify persistence
        updated = requests.get(f"{BASE_URL}/api/staff/{STAFF_ID}/working-hours", headers=self.headers).json()
        assert updated["working_hours"]["monday"]["start"] == "08:00"
        assert updated["working_hours"]["monday"]["breaks"][0]["start"] == "12:00"
        assert updated["working_hours"]["sunday"]["enabled"] == False
        
        print("Staff working hours update with breaks: PASS")
    
    def test_working_hours_not_found(self):
        """GET /api/staff/{invalid_id}/working-hours - returns 404"""
        response = requests.get(f"{BASE_URL}/api/staff/invalid_staff_id/working-hours", headers=self.headers)
        assert response.status_code == 404
        print("Invalid staff ID returns 404: PASS")


class TestPublicAvailabilityWithWorkingHours:
    """Test that public booking availability respects staff working hours"""
    
    def test_availability_on_disabled_day(self):
        """GET /api/public/booking/{slug}/availability - no slots on disabled days"""
        # First, login and ensure Sunday is disabled for the staff
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        token = login_response.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Ensure Sunday is disabled
        working_hours = {
            "monday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
            "tuesday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
            "wednesday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
            "thursday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
            "friday": {"enabled": True, "start": "09:00", "end": "17:00", "breaks": []},
            "saturday": {"enabled": True, "start": "10:00", "end": "16:00", "breaks": []},
            "sunday": {"enabled": False, "start": "10:00", "end": "16:00", "breaks": []}
        }
        requests.put(f"{BASE_URL}/api/staff/{STAFF_ID}/working-hours", json=working_hours, headers=headers)
        
        # Get services to find a valid service_id
        services_response = requests.get(f"{BASE_URL}/api/services", headers=headers)
        services = services_response.json().get("services", [])
        if not services:
            pytest.skip("No services available for testing")
        service_id = services[0]["service_id"]
        
        # Find next Sunday
        today = datetime.now()
        days_until_sunday = (6 - today.weekday()) % 7
        if days_until_sunday == 0:
            days_until_sunday = 7
        next_sunday = today + timedelta(days=days_until_sunday)
        sunday_date = next_sunday.strftime("%Y-%m-%d")
        
        # Check availability on Sunday (should be empty)
        response = requests.get(
            f"{BASE_URL}/api/public/booking/{BOOKING_SLUG}/availability",
            params={
                "service_id": service_id,
                "staff_id": STAFF_ID,
                "date": sunday_date
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should have no slots or message about staff not available
        assert len(data.get("slots", [])) == 0 or "not available" in data.get("message", "").lower()
        
        print(f"Availability on disabled day (Sunday {sunday_date}): No slots returned - PASS")
    
    def test_availability_on_enabled_day(self):
        """GET /api/public/booking/{slug}/availability - has slots on enabled days"""
        # Login to get service_id
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        })
        token = login_response.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get services
        services_response = requests.get(f"{BASE_URL}/api/services", headers=headers)
        services = services_response.json().get("services", [])
        if not services:
            pytest.skip("No services available for testing")
        service_id = services[0]["service_id"]
        
        # Find next Monday (enabled day)
        today = datetime.now()
        days_until_monday = (7 - today.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7
        next_monday = today + timedelta(days=days_until_monday)
        monday_date = next_monday.strftime("%Y-%m-%d")
        
        # Check availability on Monday (should have slots)
        response = requests.get(
            f"{BASE_URL}/api/public/booking/{BOOKING_SLUG}/availability",
            params={
                "service_id": service_id,
                "staff_id": STAFF_ID,
                "date": monday_date
            }
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should have slots
        assert len(data.get("slots", [])) > 0, f"Expected slots on Monday, got: {data}"
        
        # Verify working hours are returned
        assert "working_hours" in data
        
        print(f"Availability on enabled day (Monday {monday_date}): {len(data['slots'])} slots - PASS")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
