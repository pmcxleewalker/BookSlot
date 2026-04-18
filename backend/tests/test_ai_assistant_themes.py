"""
Test AI Admin Assistant and Industry Themes
Tests the new AI assistant endpoint and industry-themed features
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTenantAuth:
    """Test tenant authentication"""
    
    def test_tenant_login(self):
        """Test tenant login with demo credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@bookslot.io",
            "password": "Demo123!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        print(f"Tenant login successful, user: {data['user'].get('email')}")
        return data["token"]


class TestAIAssistantEndpoint:
    """Test AI Admin Assistant chat endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tenant"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@bookslot.io",
            "password": "Demo123!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_ai_assistant_chat_returns_response(self, auth_token):
        """Test AI assistant returns a response with ai_name"""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            json={"message": "Hello, what can you help me with?", "history": []},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"AI chat failed: {response.text}"
        data = response.json()
        assert "response" in data, "No response field in AI response"
        assert "ai_name" in data, "No ai_name field in AI response"
        print(f"AI response received, ai_name: {data['ai_name']}")
        print(f"Response preview: {data['response'][:100]}...")
    
    def test_ai_assistant_returns_bella_for_salon(self, auth_token):
        """Test AI assistant returns Bella for salon industry"""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            json={"message": "What's my schedule today?", "history": []},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Demo tenant is salon industry, should return Bella
        assert data.get("ai_name") == "Bella", f"Expected ai_name=Bella, got {data.get('ai_name')}"
        print(f"Confirmed AI name is Bella for salon industry")
    
    def test_ai_assistant_requires_auth(self):
        """Test AI assistant requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            json={"message": "Hello", "history": []}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("AI assistant correctly requires authentication")
    
    def test_ai_assistant_requires_message(self, auth_token):
        """Test AI assistant requires message"""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            json={"message": "", "history": []},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("AI assistant correctly requires message")
    
    def test_ai_assistant_with_history(self, auth_token):
        """Test AI assistant handles conversation history"""
        history = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there! How can I help?"}
        ]
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            json={"message": "What appointments do I have?", "history": history},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"AI chat with history failed: {response.text}"
        data = response.json()
        assert "response" in data
        print(f"AI handled conversation history successfully")


class TestTenantData:
    """Test tenant data retrieval for theme verification"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tenant"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@bookslot.io",
            "password": "Demo123!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_tenant_has_industry_field(self, auth_token):
        """Test tenant data includes industry field"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get tenant failed: {response.text}"
        data = response.json()
        tenant = data.get("tenant", {})
        assert "industry" in tenant, "Tenant missing industry field"
        print(f"Tenant industry: {tenant.get('industry')}")
    
    def test_demo_tenant_is_salon(self, auth_token):
        """Test demo tenant has salon industry"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        tenant = data.get("tenant", {})
        assert tenant.get("industry") == "salon", f"Expected salon, got {tenant.get('industry')}"
        print("Demo tenant confirmed as salon industry")


class TestSuperAdminAuth:
    """Test super admin authentication"""
    
    def test_super_admin_login(self):
        """Test super admin login"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "admin@bookslot.io",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in admin response"
        print(f"Super admin login successful")
        return data["token"]


class TestAppointmentsAPI:
    """Test appointments API for dashboard data"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tenant"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@bookslot.io",
            "password": "Demo123!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_appointments(self, auth_token):
        """Test getting appointments"""
        response = requests.get(
            f"{BASE_URL}/api/appointments",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get appointments failed: {response.text}"
        data = response.json()
        assert "appointments" in data
        print(f"Got {len(data['appointments'])} appointments")
    
    def test_get_pending_appointments(self, auth_token):
        """Test getting pending appointments"""
        response = requests.get(
            f"{BASE_URL}/api/appointments?status=pending",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "appointments" in data
        print(f"Got {len(data['appointments'])} pending appointments")


class TestStaffAPI:
    """Test staff API"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tenant"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@bookslot.io",
            "password": "Demo123!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_staff(self, auth_token):
        """Test getting staff list"""
        response = requests.get(
            f"{BASE_URL}/api/staff",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get staff failed: {response.text}"
        data = response.json()
        assert "staff" in data
        print(f"Got {len(data['staff'])} staff members")


class TestServicesAPI:
    """Test services API"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tenant"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@bookslot.io",
            "password": "Demo123!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_services(self, auth_token):
        """Test getting services list"""
        response = requests.get(
            f"{BASE_URL}/api/services",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get services failed: {response.text}"
        data = response.json()
        assert "services" in data
        print(f"Got {len(data['services'])} services")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
