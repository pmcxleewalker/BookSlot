"""
Backend tests for BookSlot Admin Dashboard and Tenant Management
Tests: Super Admin login, Dashboard stats, Clients (Tenants) CRUD, Tenant login
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
SUPER_ADMIN_EMAIL = "admin@bookslot.io"
SUPER_ADMIN_PASSWORD = "Admin123!"
TENANT_EMAIL = "demo@bookslot.io"
TENANT_PASSWORD = "Demo123!"


class TestSuperAdminAuth:
    """Super Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test super admin login at /admin"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "admin" in data, "No admin data in response"
        assert data["admin"]["email"] == SUPER_ADMIN_EMAIL
        print(f"✓ Super admin login successful: {data['admin']['name']}")
        return data["token"]
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials rejected correctly")
    
    def test_admin_me_endpoint(self):
        """Test /admin/me returns admin info"""
        # First login
        login_resp = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        token = login_resp.json()["token"]
        
        # Get admin info
        response = requests.get(f"{BASE_URL}/api/admin/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Admin me failed: {response.text}"
        data = response.json()
        assert data["email"] == SUPER_ADMIN_EMAIL
        print(f"✓ Admin me endpoint working: {data['name']}")


class TestAdminDashboardStats:
    """Admin dashboard statistics tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_admin_stats_endpoint(self, admin_token):
        """Test /admin/stats returns dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        
        # Verify stats structure
        assert "tenants" in data, "Missing tenants stats"
        assert "appointments" in data, "Missing appointments stats"
        assert "users" in data, "Missing users stats"
        assert "revenue" in data, "Missing revenue stats"
        assert "plans" in data, "Missing plans breakdown"
        
        # Verify tenants stats
        assert "total" in data["tenants"]
        assert "active" in data["tenants"]
        
        # Verify appointments stats
        assert "total" in data["appointments"]
        assert "this_month" in data["appointments"]
        
        print(f"✓ Dashboard stats: {data['tenants']['total']} clients, {data['appointments']['total']} bookings")
        return data


class TestClientsManagement:
    """Clients (Tenants) management tests - renamed from Tenants"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_all_clients(self, admin_token):
        """Test GET /admin/tenants returns client list"""
        response = requests.get(f"{BASE_URL}/api/admin/tenants", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Get clients failed: {response.text}"
        data = response.json()
        
        assert "tenants" in data, "Missing tenants array"
        tenants = data["tenants"]
        
        if len(tenants) > 0:
            tenant = tenants[0]
            # Verify client data structure for Client List panel
            assert "tenant_id" in tenant, "Missing tenant_id"
            assert "name" in tenant, "Missing name"
            assert "plan" in tenant, "Missing plan"
            assert "is_active" in tenant, "Missing is_active"
            assert "booking_url_slug" in tenant, "Missing booking_url_slug"
            
            # Check for owner credentials (for Admin Dashboard link)
            # owner_email and owner_initial_password should be present
            print(f"✓ Found {len(tenants)} clients")
            print(f"  First client: {tenant['name']} ({tenant['plan']} plan)")
        else:
            print("✓ No clients found (empty list)")
        
        return tenants
    
    def test_client_has_required_urls(self, admin_token):
        """Test that clients have booking_url_slug for generating URLs"""
        response = requests.get(f"{BASE_URL}/api/admin/tenants", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        data = response.json()
        tenants = data.get("tenants", [])
        
        for tenant in tenants:
            assert "booking_url_slug" in tenant, f"Client {tenant.get('name')} missing booking_url_slug"
            if tenant.get("booking_url_slug"):
                print(f"✓ Client '{tenant['name']}' has slug: {tenant['booking_url_slug']}")
    
    def test_get_single_client(self, admin_token):
        """Test GET /admin/tenants/{id} returns single client details"""
        # First get list
        list_resp = requests.get(f"{BASE_URL}/api/admin/tenants", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        tenants = list_resp.json().get("tenants", [])
        
        if len(tenants) == 0:
            pytest.skip("No clients to test")
        
        tenant_id = tenants[0]["tenant_id"]
        response = requests.get(f"{BASE_URL}/api/admin/tenants/{tenant_id}", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Get single client failed: {response.text}"
        data = response.json()
        
        # Response has nested structure with 'tenant' key
        assert "tenant" in data, "Missing tenant object in response"
        assert data["tenant"]["tenant_id"] == tenant_id
        print(f"✓ Single client fetch working: {data['tenant']['name']}")
    
    def test_client_details_for_table(self, admin_token):
        """Test that client data includes fields needed for Client Details table"""
        response = requests.get(f"{BASE_URL}/api/admin/tenants", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        data = response.json()
        tenants = data.get("tenants", [])
        
        if len(tenants) == 0:
            pytest.skip("No clients to test")
        
        tenant = tenants[0]
        # Fields needed for Client Details table
        required_fields = ["name", "plan", "is_active"]
        for field in required_fields:
            assert field in tenant, f"Missing required field: {field}"
        
        # Optional but expected fields
        optional_fields = ["staff_count", "appointment_count", "owner_email"]
        for field in optional_fields:
            if field in tenant:
                print(f"  {field}: {tenant[field]}")
        
        print(f"✓ Client has all required fields for table display")


class TestTenantLogin:
    """Tenant (Business Owner) login tests"""
    
    def test_tenant_login_success(self):
        """Test tenant login at /login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TENANT_EMAIL,
            "password": TENANT_PASSWORD
        })
        assert response.status_code == 200, f"Tenant login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        print(f"✓ Tenant login successful")
        return data["token"]
    
    def test_tenant_login_invalid_credentials(self):
        """Test tenant login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TENANT_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid tenant credentials rejected correctly")


class TestTenantDashboard:
    """Tenant dashboard (Today view) tests"""
    
    @pytest.fixture
    def tenant_token(self):
        """Get tenant token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TENANT_EMAIL,
            "password": TENANT_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_today_appointments(self, tenant_token):
        """Test fetching today's appointments for dashboard"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/appointments", params={
            "start_date": today,
            "end_date": f"{today}T23:59:59"
        }, headers={
            "Authorization": f"Bearer {tenant_token}"
        })
        assert response.status_code == 200, f"Get appointments failed: {response.text}"
        data = response.json()
        assert "appointments" in data
        print(f"✓ Today's appointments: {len(data['appointments'])}")
    
    def test_get_pending_appointments(self, tenant_token):
        """Test fetching pending appointments for stats"""
        response = requests.get(f"{BASE_URL}/api/appointments", params={
            "status": "pending"
        }, headers={
            "Authorization": f"Bearer {tenant_token}"
        })
        assert response.status_code == 200, f"Get pending failed: {response.text}"
        data = response.json()
        assert "appointments" in data
        print(f"✓ Pending appointments: {len(data['appointments'])}")


class TestTeamPage:
    """Team page (Staff and Services) tests"""
    
    @pytest.fixture
    def tenant_token(self):
        """Get tenant token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TENANT_EMAIL,
            "password": TENANT_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_staff(self, tenant_token):
        """Test GET /staff returns staff list"""
        response = requests.get(f"{BASE_URL}/api/staff", headers={
            "Authorization": f"Bearer {tenant_token}"
        })
        assert response.status_code == 200, f"Get staff failed: {response.text}"
        data = response.json()
        assert "staff" in data
        print(f"✓ Staff members: {len(data['staff'])}")
    
    def test_get_services(self, tenant_token):
        """Test GET /services returns services list"""
        response = requests.get(f"{BASE_URL}/api/services", headers={
            "Authorization": f"Bearer {tenant_token}"
        })
        assert response.status_code == 200, f"Get services failed: {response.text}"
        data = response.json()
        assert "services" in data
        print(f"✓ Services: {len(data['services'])}")


class TestCalendarPage:
    """Calendar page tests"""
    
    @pytest.fixture
    def tenant_token(self):
        """Get tenant token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TENANT_EMAIL,
            "password": TENANT_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_week_appointments(self, tenant_token):
        """Test fetching week appointments for calendar"""
        from datetime import timedelta
        today = datetime.now()
        week_end = today + timedelta(days=7)
        
        response = requests.get(f"{BASE_URL}/api/appointments", params={
            "start_date": today.strftime("%Y-%m-%d"),
            "end_date": week_end.strftime("%Y-%m-%d") + "T23:59:59"
        }, headers={
            "Authorization": f"Bearer {tenant_token}"
        })
        assert response.status_code == 200, f"Get week appointments failed: {response.text}"
        data = response.json()
        assert "appointments" in data
        print(f"✓ Week appointments: {len(data['appointments'])}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
