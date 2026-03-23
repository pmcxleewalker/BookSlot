"""
Test V2 Features for TimeSlot Pro
Tests WebSocket support, Receptionist API, and Inbox functionality
"""
import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthEndpoints:
    """Health check endpoints for V2 features"""
    
    def test_main_health_check(self):
        """Test main API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print(f"✓ Main health check passed: {data}")
    
    def test_v1_receptionist_health_check(self):
        """Test V1 Receptionist API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/v1/receptionist/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "v1"
        assert "timestamp" in data
        print(f"✓ V1 Receptionist health check passed: {data}")


class TestReceptionistAPIAuth:
    """Test Receptionist API authentication requirements"""
    
    def test_services_requires_api_key(self):
        """Test that /api/v1/receptionist/services requires API key"""
        response = requests.get(f"{BASE_URL}/api/v1/receptionist/services")
        assert response.status_code == 401
        data = response.json()
        assert "API key required" in data.get("detail", "")
        print(f"✓ Services endpoint correctly requires API key: {data}")
    
    def test_staff_requires_api_key(self):
        """Test that /api/v1/receptionist/staff requires API key"""
        response = requests.get(f"{BASE_URL}/api/v1/receptionist/staff")
        assert response.status_code == 401
        data = response.json()
        assert "API key required" in data.get("detail", "")
        print(f"✓ Staff endpoint correctly requires API key: {data}")
    
    def test_availability_requires_api_key(self):
        """Test that /api/v1/receptionist/availability requires API key"""
        response = requests.post(
            f"{BASE_URL}/api/v1/receptionist/availability",
            json={"service_id": "test", "date": "2026-03-25"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "API key required" in data.get("detail", "")
        print(f"✓ Availability endpoint correctly requires API key: {data}")
    
    def test_slot_lock_requires_api_key(self):
        """Test that /api/v1/receptionist/slots/lock requires API key"""
        response = requests.post(
            f"{BASE_URL}/api/v1/receptionist/slots/lock",
            json={"staff_id": "test", "service_id": "test", "start_time": "2026-03-25T10:00:00Z"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "API key required" in data.get("detail", "")
        print(f"✓ Slot lock endpoint correctly requires API key: {data}")
    
    def test_bookings_requires_api_key(self):
        """Test that /api/v1/receptionist/bookings requires API key"""
        response = requests.post(
            f"{BASE_URL}/api/v1/receptionist/bookings",
            json={"staff_id": "test", "service_id": "test", "start_time": "2026-03-25T10:00:00Z", "client_name": "Test"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "API key required" in data.get("detail", "")
        print(f"✓ Bookings endpoint correctly requires API key: {data}")
    
    def test_conversations_requires_api_key(self):
        """Test that /api/v1/receptionist/conversations requires API key"""
        response = requests.post(
            f"{BASE_URL}/api/v1/receptionist/conversations",
            json={"client_name": "Test Client"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "API key required" in data.get("detail", "")
        print(f"✓ Conversations endpoint correctly requires API key: {data}")
    
    def test_inbox_stats_receptionist_requires_api_key(self):
        """Test that /api/v1/receptionist/inbox/stats requires API key"""
        response = requests.get(f"{BASE_URL}/api/v1/receptionist/inbox/stats")
        assert response.status_code == 401
        data = response.json()
        assert "API key required" in data.get("detail", "")
        print(f"✓ Receptionist inbox stats correctly requires API key: {data}")


class TestInboxAPIAuth:
    """Test Inbox API authentication requirements (dashboard routes)"""
    
    def test_inbox_stats_requires_auth(self):
        """Test that /api/inbox/stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/inbox/stats")
        assert response.status_code == 401
        data = response.json()
        assert "Not authenticated" in data.get("detail", "")
        print(f"✓ Inbox stats correctly requires auth: {data}")
    
    def test_inbox_conversations_requires_auth(self):
        """Test that /api/inbox/conversations requires authentication"""
        response = requests.get(f"{BASE_URL}/api/inbox/conversations")
        assert response.status_code == 401
        data = response.json()
        assert "Not authenticated" in data.get("detail", "")
        print(f"✓ Inbox conversations correctly requires auth: {data}")


class TestAuthenticatedInboxFlow:
    """Test authenticated inbox flow with user registration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user and session"""
        self.session = requests.Session()
        self.test_email = f"TEST_inbox_{datetime.now().strftime('%Y%m%d%H%M%S')}@test.com"
        self.test_password = "TestPass123!"
        self.test_name = "Test Inbox User"
    
    def test_register_and_access_inbox(self):
        """Test user registration and inbox access flow"""
        # Register user
        register_response = self.session.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": self.test_email,
                "password": self.test_password,
                "name": self.test_name
            }
        )
        assert register_response.status_code == 200
        user_data = register_response.json()
        assert "user_id" in user_data
        assert "session_token" in user_data
        print(f"✓ User registered: {user_data['email']}")
        
        # Set session token in cookies
        session_token = user_data["session_token"]
        self.session.cookies.set("session_token", session_token)
        
        # Create business (required for inbox access)
        business_response = self.session.post(
            f"{BASE_URL}/api/onboarding/create-business",
            json={
                "name": "Test Inbox Business",
                "industry": "salon",
                "email": self.test_email,
                "timezone": "America/New_York"
            }
        )
        assert business_response.status_code == 200
        business_data = business_response.json()
        assert "tenant_id" in business_data
        print(f"✓ Business created: {business_data['tenant_id']}")
        
        # Now test inbox stats
        stats_response = self.session.get(f"{BASE_URL}/api/inbox/stats")
        assert stats_response.status_code == 200
        stats_data = stats_response.json()
        assert "active_conversations" in stats_data
        assert "waiting_human" in stats_data
        assert "human_handling" in stats_data
        assert "resolved_today" in stats_data
        print(f"✓ Inbox stats retrieved: {stats_data}")
        
        # Test inbox conversations list
        conversations_response = self.session.get(f"{BASE_URL}/api/inbox/conversations")
        assert conversations_response.status_code == 200
        conversations_data = conversations_response.json()
        assert "conversations" in conversations_data
        assert "total" in conversations_data
        assert "page" in conversations_data
        print(f"✓ Inbox conversations retrieved: total={conversations_data['total']}")
        
        # Test with filters
        filtered_response = self.session.get(f"{BASE_URL}/api/inbox/conversations?status=active")
        assert filtered_response.status_code == 200
        print(f"✓ Filtered conversations retrieved")


class TestAPIKeyFlow:
    """Test API key creation and usage for Receptionist API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user and session"""
        self.session = requests.Session()
        self.test_email = f"TEST_apikey_{datetime.now().strftime('%Y%m%d%H%M%S')}@test.com"
        self.test_password = "TestPass123!"
        self.test_name = "Test API Key User"
    
    def test_create_api_key_and_use_receptionist_api(self):
        """Test creating API key and using it with Receptionist API"""
        # Register user
        register_response = self.session.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": self.test_email,
                "password": self.test_password,
                "name": self.test_name
            }
        )
        assert register_response.status_code == 200
        user_data = register_response.json()
        session_token = user_data["session_token"]
        self.session.cookies.set("session_token", session_token)
        print(f"✓ User registered: {user_data['email']}")
        
        # Create business
        business_response = self.session.post(
            f"{BASE_URL}/api/onboarding/create-business",
            json={
                "name": "Test API Key Business",
                "industry": "clinic",
                "email": self.test_email,
                "timezone": "America/New_York"
            }
        )
        assert business_response.status_code == 200
        business_data = business_response.json()
        print(f"✓ Business created: {business_data['tenant_id']}")
        
        # Create API key
        api_key_response = self.session.post(
            f"{BASE_URL}/api/api-keys",
            json={
                "name": "Test Receptionist Key",
                "permissions": ["read", "write"]
            }
        )
        assert api_key_response.status_code == 200
        api_key_data = api_key_response.json()
        assert "key" in api_key_data
        assert "api_key_id" in api_key_data
        api_key = api_key_data["key"]
        print(f"✓ API key created: {api_key_data['key_prefix']}...")
        
        # Use API key to access Receptionist API
        headers = {"X-API-Key": api_key}
        
        # Test services endpoint
        services_response = requests.get(
            f"{BASE_URL}/api/v1/receptionist/services",
            headers=headers
        )
        assert services_response.status_code == 200
        services_data = services_response.json()
        assert "services" in services_data
        assert "count" in services_data
        print(f"✓ Services retrieved via API key: count={services_data['count']}")
        
        # Test staff endpoint
        staff_response = requests.get(
            f"{BASE_URL}/api/v1/receptionist/staff",
            headers=headers
        )
        assert staff_response.status_code == 200
        staff_data = staff_response.json()
        assert "staff" in staff_data
        assert "count" in staff_data
        print(f"✓ Staff retrieved via API key: count={staff_data['count']}")
        
        # Test inbox stats via receptionist API
        inbox_stats_response = requests.get(
            f"{BASE_URL}/api/v1/receptionist/inbox/stats",
            headers=headers
        )
        assert inbox_stats_response.status_code == 200
        inbox_stats_data = inbox_stats_response.json()
        assert "active_conversations" in inbox_stats_data
        print(f"✓ Inbox stats via API key: {inbox_stats_data}")


class TestInvalidAPIKey:
    """Test invalid API key handling"""
    
    def test_invalid_api_key_rejected(self):
        """Test that invalid API key is rejected"""
        headers = {"X-API-Key": "invalid_key_12345"}
        response = requests.get(
            f"{BASE_URL}/api/v1/receptionist/services",
            headers=headers
        )
        assert response.status_code == 401
        data = response.json()
        assert "Invalid API key" in data.get("detail", "")
        print(f"✓ Invalid API key correctly rejected: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
