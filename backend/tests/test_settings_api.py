"""
Test Settings API endpoints for Phase 1 improvements:
- Booking Rules GET/PUT
- Branding GET/PUT
- Business Settings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "salon@bookslot.io"
TEST_PASSWORD = "Demo123!"


class TestSettingsAPI:
    """Test Settings API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    # ========== BOOKING RULES TESTS ==========
    
    def test_get_booking_rules(self):
        """Test GET /api/tenants/me/booking-rules returns all rule fields"""
        response = self.session.get(f"{BASE_URL}/api/tenants/me/booking-rules")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "booking_rules" in data, "Response should contain booking_rules"
        
        rules = data["booking_rules"]
        
        # Check all required fields exist
        required_fields = [
            "online_booking_enabled",
            "approval_required",
            "cancellation_window_hours",
            "reschedule_window_hours",
            "lead_time_hours",
            "buffer_minutes",
            "require_phone",
            "require_email",
            "client_self_cancel"
        ]
        
        for field in required_fields:
            assert field in rules, f"Missing field: {field}"
        
        print(f"GET booking-rules: {rules}")
    
    def test_put_booking_rules_update(self):
        """Test PUT /api/tenants/me/booking-rules updates rules correctly"""
        # First get current rules
        get_response = self.session.get(f"{BASE_URL}/api/tenants/me/booking-rules")
        assert get_response.status_code == 200
        original_rules = get_response.json()["booking_rules"]
        
        # Update with new values
        new_rules = {
            "online_booking_enabled": True,
            "approval_required": False,
            "cancellation_window_hours": 48,
            "reschedule_window_hours": 48,
            "lead_time_hours": 2,
            "buffer_minutes": 15,
            "require_phone": True,
            "require_email": True,
            "client_self_cancel": False
        }
        
        put_response = self.session.put(f"{BASE_URL}/api/tenants/me/booking-rules", json=new_rules)
        
        assert put_response.status_code == 200, f"Expected 200, got {put_response.status_code}"
        
        data = put_response.json()
        assert "booking_rules" in data, "Response should contain booking_rules"
        
        # Verify the update was applied
        updated_rules = data["booking_rules"]
        assert updated_rules["cancellation_window_hours"] == 48
        assert updated_rules["buffer_minutes"] == 15
        assert updated_rules["require_email"] == True
        assert updated_rules["client_self_cancel"] == False
        
        print(f"PUT booking-rules successful: {updated_rules}")
        
        # Verify persistence with GET
        verify_response = self.session.get(f"{BASE_URL}/api/tenants/me/booking-rules")
        assert verify_response.status_code == 200
        verified_rules = verify_response.json()["booking_rules"]
        
        assert verified_rules["cancellation_window_hours"] == 48
        assert verified_rules["buffer_minutes"] == 15
        print("Booking rules persisted correctly")
        
        # Restore original values
        self.session.put(f"{BASE_URL}/api/tenants/me/booking-rules", json=original_rules)
    
    def test_put_booking_rules_partial_update(self):
        """Test partial update of booking rules"""
        # Only update one field
        partial_update = {
            "lead_time_hours": 3
        }
        
        response = self.session.put(f"{BASE_URL}/api/tenants/me/booking-rules", json=partial_update)
        
        assert response.status_code == 200
        
        # Verify the field was updated
        get_response = self.session.get(f"{BASE_URL}/api/tenants/me/booking-rules")
        rules = get_response.json()["booking_rules"]
        assert rules["lead_time_hours"] == 3
        
        print("Partial update successful")
    
    # ========== BRANDING TESTS ==========
    
    def test_get_branding(self):
        """Test GET /api/tenants/me/branding returns branding settings"""
        response = self.session.get(f"{BASE_URL}/api/tenants/me/branding")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "branding" in data, "Response should contain branding"
        
        branding = data["branding"]
        
        # Branding should be a dict (may have default or custom values)
        assert isinstance(branding, dict), "Branding should be a dictionary"
        
        print(f"GET branding: {branding}")
    
    def test_put_branding_update(self):
        """Test PUT /api/tenants/me/branding updates branding correctly"""
        # First get current branding
        get_response = self.session.get(f"{BASE_URL}/api/tenants/me/branding")
        assert get_response.status_code == 200
        original_branding = get_response.json()["branding"]
        
        # Update with new colors
        new_branding = {
            "business_name": "Test Salon",
            "primary_color": "#FF5733",
            "secondary_color": "#333333",
            "accent_color": "#FFD700"
        }
        
        put_response = self.session.put(f"{BASE_URL}/api/tenants/me/branding", json=new_branding)
        
        assert put_response.status_code == 200, f"Expected 200, got {put_response.status_code}"
        
        data = put_response.json()
        assert "branding" in data, "Response should contain branding"
        
        # Verify the update was applied
        updated_branding = data["branding"]
        assert updated_branding["primary_color"] == "#FF5733"
        assert updated_branding["secondary_color"] == "#333333"
        assert updated_branding["accent_color"] == "#FFD700"
        
        print(f"PUT branding successful: {updated_branding}")
        
        # Restore original values
        self.session.put(f"{BASE_URL}/api/tenants/me/branding", json=original_branding)
    
    # ========== TENANT/BUSINESS SETTINGS TESTS ==========
    
    def test_get_tenant_me(self):
        """Test GET /api/tenants/me returns tenant info"""
        response = self.session.get(f"{BASE_URL}/api/tenants/me")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "tenant" in data, "Response should contain tenant"
        
        tenant = data["tenant"]
        
        # Check required fields
        required_fields = ["name", "email", "timezone", "currency"]
        for field in required_fields:
            assert field in tenant, f"Missing field: {field}"
        
        print(f"GET tenant/me: name={tenant.get('name')}, email={tenant.get('email')}")
    
    def test_put_tenant_me_update(self):
        """Test PUT /api/tenants/me updates tenant info"""
        # First get current tenant
        get_response = self.session.get(f"{BASE_URL}/api/tenants/me")
        assert get_response.status_code == 200
        original_tenant = get_response.json()["tenant"]
        
        # Update with new values
        updates = {
            "phone": "+353 1 234 9999",
            "timezone": "Europe/London"
        }
        
        put_response = self.session.put(f"{BASE_URL}/api/tenants/me", json=updates)
        
        assert put_response.status_code == 200, f"Expected 200, got {put_response.status_code}"
        
        data = put_response.json()
        assert "tenant" in data, "Response should contain tenant"
        
        # Verify the update was applied
        updated_tenant = data["tenant"]
        assert updated_tenant["phone"] == "+353 1 234 9999"
        assert updated_tenant["timezone"] == "Europe/London"
        
        print(f"PUT tenant/me successful")
        
        # Restore original values
        restore = {
            "phone": original_tenant.get("phone", ""),
            "timezone": original_tenant.get("timezone", "Europe/Dublin")
        }
        self.session.put(f"{BASE_URL}/api/tenants/me", json=restore)


class TestAuthAndAccess:
    """Test authentication and access control"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        
        print(f"Login successful for {TEST_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@example.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Invalid credentials correctly rejected")
    
    def test_unauthorized_access(self):
        """Test accessing protected endpoint without auth"""
        response = requests.get(f"{BASE_URL}/api/tenants/me/booking-rules")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Unauthorized access correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
