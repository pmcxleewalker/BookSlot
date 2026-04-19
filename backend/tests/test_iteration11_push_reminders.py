"""
Iteration 11 Tests: Push Notification Reminders & Staff Creation Bug Fix
Tests:
- Push notification endpoints (VAPID key, subscribe-admin, reminder settings)
- Reminder settings CRUD
- Upcoming reminders endpoint
- Staff creation without email (bug fix verification)
- Staff service assignment
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SALON_EMAIL = "salon@bookslot.io"
SALON_PASSWORD = "Demo123!"
ADMIN_EMAIL = "admin@bookslot.io"
ADMIN_PASSWORD = "Admin123!"


class TestPushNotificationEndpoints:
    """Test push notification related endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SALON_EMAIL,
            "password": SALON_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_vapid_key(self):
        """GET /api/push/vapid-key returns enabled=true with public key"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-key")
        assert response.status_code == 200, f"VAPID key endpoint failed: {response.text}"
        
        data = response.json()
        assert "enabled" in data, "Response missing 'enabled' field"
        assert "public_key" in data, "Response missing 'public_key' field"
        assert data["enabled"] == True, "VAPID should be enabled"
        assert len(data["public_key"]) > 50, "VAPID public key should be a long string"
        print(f"VAPID key enabled: {data['enabled']}, key length: {len(data['public_key'])}")
    
    def test_get_reminder_settings(self):
        """GET /api/reminders/settings returns push_enabled and reminder_hours"""
        response = requests.get(f"{BASE_URL}/api/reminders/settings", headers=self.headers)
        assert response.status_code == 200, f"Get reminder settings failed: {response.text}"
        
        data = response.json()
        assert "settings" in data, "Response missing 'settings' field"
        settings = data["settings"]
        assert "push_enabled" in settings, "Settings missing 'push_enabled'"
        assert "reminder_hours" in settings, "Settings missing 'reminder_hours'"
        print(f"Reminder settings: push_enabled={settings['push_enabled']}, hours={settings['reminder_hours']}")
    
    def test_update_reminder_settings(self):
        """POST /api/reminders/settings updates push_enabled and reminder_hours"""
        # Update settings
        new_settings = {
            "push_enabled": True,
            "reminder_hours": 12
        }
        response = requests.post(f"{BASE_URL}/api/reminders/settings", 
                                 json=new_settings, headers=self.headers)
        assert response.status_code == 200, f"Update reminder settings failed: {response.text}"
        
        data = response.json()
        assert "settings" in data, "Response missing 'settings' field"
        assert data["settings"]["push_enabled"] == True
        assert data["settings"]["reminder_hours"] == 12
        
        # Verify by fetching again
        verify_response = requests.get(f"{BASE_URL}/api/reminders/settings", headers=self.headers)
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["settings"]["push_enabled"] == True
        assert verify_data["settings"]["reminder_hours"] == 12
        
        # Reset to default
        requests.post(f"{BASE_URL}/api/reminders/settings", 
                     json={"push_enabled": False, "reminder_hours": 24}, headers=self.headers)
        print("Reminder settings update and verification: PASS")
    
    def test_get_upcoming_reminders(self):
        """GET /api/reminders/upcoming returns upcoming appointments within reminder window"""
        response = requests.get(f"{BASE_URL}/api/reminders/upcoming", headers=self.headers)
        assert response.status_code == 200, f"Get upcoming reminders failed: {response.text}"
        
        data = response.json()
        assert "reminders" in data, "Response missing 'reminders' field"
        assert "reminder_hours" in data, "Response missing 'reminder_hours' field"
        assert isinstance(data["reminders"], list), "Reminders should be a list"
        print(f"Upcoming reminders count: {len(data['reminders'])}, window: {data['reminder_hours']} hours")
    
    def test_subscribe_admin_push(self):
        """POST /api/push/subscribe-admin accepts subscription endpoint and keys"""
        # Create a mock subscription (won't actually work for push, but tests the endpoint)
        mock_subscription = {
            "endpoint": f"https://fcm.googleapis.com/fcm/send/test-{uuid.uuid4().hex[:8]}",
            "keys": {
                "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
                "auth": "tBHItJI5svbpez7KI4CCXg"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/push/subscribe-admin", 
                                json=mock_subscription, headers=self.headers)
        assert response.status_code == 200, f"Subscribe admin push failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response missing 'message' field"
        print(f"Admin push subscription: {data['message']}")


class TestStaffCreationBugFix:
    """Test staff creation without email (bug fix verification)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SALON_EMAIL,
            "password": SALON_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.created_staff_ids = []
    
    def teardown_method(self, method):
        """Clean up created test staff"""
        for staff_id in self.created_staff_ids:
            try:
                requests.delete(f"{BASE_URL}/api/staff/{staff_id}", headers=self.headers)
            except:
                pass
    
    def test_create_staff_with_name_only(self):
        """Staff creation with name only (no email) should work - bug fix verification"""
        staff_data = {
            "name": f"TEST_Staff_{uuid.uuid4().hex[:6]}"
        }
        
        response = requests.post(f"{BASE_URL}/api/staff", json=staff_data, headers=self.headers)
        assert response.status_code == 200, f"Staff creation with name only failed: {response.text}"
        
        data = response.json()
        assert "staff" in data, "Response missing 'staff' field"
        staff = data["staff"]
        assert staff["name"] == staff_data["name"]
        assert staff.get("email") is None or staff.get("email") == ""
        
        self.created_staff_ids.append(staff["staff_id"])
        print(f"Staff created with name only: {staff['name']} (ID: {staff['staff_id']})")
    
    def test_create_staff_with_name_and_phone(self):
        """Staff creation with name and phone (no email) should work"""
        staff_data = {
            "name": f"TEST_Staff_{uuid.uuid4().hex[:6]}",
            "phone": "+353123456789"
        }
        
        response = requests.post(f"{BASE_URL}/api/staff", json=staff_data, headers=self.headers)
        assert response.status_code == 200, f"Staff creation with name and phone failed: {response.text}"
        
        data = response.json()
        staff = data["staff"]
        assert staff["name"] == staff_data["name"]
        assert staff["phone"] == staff_data["phone"]
        
        self.created_staff_ids.append(staff["staff_id"])
        print(f"Staff created with name and phone: {staff['name']}")
    
    def test_create_staff_with_services(self):
        """Staff creation with service assignments should work"""
        # First get available services
        services_response = requests.get(f"{BASE_URL}/api/services", headers=self.headers)
        assert services_response.status_code == 200
        services = services_response.json().get("services", [])
        
        if len(services) >= 2:
            service_ids = [services[0]["service_id"], services[1]["service_id"]]
        else:
            service_ids = []
        
        staff_data = {
            "name": f"TEST_Staff_{uuid.uuid4().hex[:6]}",
            "services": service_ids
        }
        
        response = requests.post(f"{BASE_URL}/api/staff", json=staff_data, headers=self.headers)
        assert response.status_code == 200, f"Staff creation with services failed: {response.text}"
        
        data = response.json()
        staff = data["staff"]
        assert staff["name"] == staff_data["name"]
        assert staff.get("services") == service_ids
        
        self.created_staff_ids.append(staff["staff_id"])
        print(f"Staff created with {len(service_ids)} services assigned")
    
    def test_create_staff_with_valid_email(self):
        """Staff creation with valid email should still work"""
        staff_data = {
            "name": f"TEST_Staff_{uuid.uuid4().hex[:6]}",
            "email": f"test_{uuid.uuid4().hex[:6]}@example.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/staff", json=staff_data, headers=self.headers)
        assert response.status_code == 200, f"Staff creation with valid email failed: {response.text}"
        
        data = response.json()
        staff = data["staff"]
        assert staff["name"] == staff_data["name"]
        assert staff["email"] == staff_data["email"]
        
        self.created_staff_ids.append(staff["staff_id"])
        print(f"Staff created with valid email: {staff['email']}")


class TestCalendarAndExistingFeatures:
    """Verify existing features still work after push notification changes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SALON_EMAIL,
            "password": SALON_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_calendar_appointments_endpoint(self):
        """Calendar appointments endpoint still works"""
        from datetime import datetime, timedelta
        today = datetime.now().strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/appointments?start_date={today}&end_date={end_date}T23:59:59",
            headers=self.headers
        )
        assert response.status_code == 200, f"Calendar appointments failed: {response.text}"
        
        data = response.json()
        assert "appointments" in data
        print(f"Calendar appointments: {len(data['appointments'])} found")
    
    def test_staff_list_endpoint(self):
        """Staff list endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/staff", headers=self.headers)
        assert response.status_code == 200, f"Staff list failed: {response.text}"
        
        data = response.json()
        assert "staff" in data
        print(f"Staff count: {len(data['staff'])}")
    
    def test_services_list_endpoint(self):
        """Services list endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/services", headers=self.headers)
        assert response.status_code == 200, f"Services list failed: {response.text}"
        
        data = response.json()
        assert "services" in data
        print(f"Services count: {len(data['services'])}")
    
    def test_notification_settings_endpoint(self):
        """Notification settings endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/notifications/settings", headers=self.headers)
        assert response.status_code == 200, f"Notification settings failed: {response.text}"
        
        data = response.json()
        assert "email_reminders_enabled" in data
        print(f"Email reminders enabled: {data['email_reminders_enabled']}")


class TestSuperAdminAccess:
    """Verify super admin still works"""
    
    def test_super_admin_login(self):
        """Super admin login at /api/admin/login still works"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        
        data = response.json()
        assert "token" in data
        assert "admin" in data
        print(f"Super admin login successful: {data['admin'].get('email')}")
    
    def test_super_admin_dashboard_data(self):
        """Super admin can access dashboard data"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get tenants
        response = requests.get(f"{BASE_URL}/api/admin/tenants", headers=headers)
        assert response.status_code == 200, f"Admin tenants failed: {response.text}"
        
        data = response.json()
        assert "tenants" in data
        print(f"Super admin can see {len(data['tenants'])} tenants")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
