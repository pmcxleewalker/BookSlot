"""
Test Suite for TimeSlot Pro Phase 1 Features:
- Super Admin / Franchise Control Center APIs
- Tenant Branding APIs
- Public Booking Page with Branding
"""
import pytest
import requests
import os
import time
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://booking-dash-7.preview.emergentagent.com')

# Test credentials from requirements
SUPER_ADMIN_SECRET = "timeslot_franchise_2024"
SUPER_ADMIN_EMAIL = "admin@timeslotpro.com"
SUPER_ADMIN_PASSWORD = "Admin123!"

# Generate unique test identifiers
TEST_ID = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))


class TestHealthCheck:
    """Basic health check to ensure API is running"""
    
    def test_api_health(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("API health check passed")


class TestSuperAdminRegistration:
    """Test Super Admin registration at /admin/setup"""
    
    def test_register_super_admin_invalid_secret(self):
        """Should reject registration with invalid admin secret"""
        response = requests.post(f"{BASE_URL}/api/admin/auth/register", json={
            "email": f"test_admin_{TEST_ID}@test.com",
            "password": "TestPass123!",
            "name": "Test Admin",
            "admin_secret": "wrong_secret"
        })
        assert response.status_code == 403
        data = response.json()
        assert "Invalid admin secret" in data.get("detail", "")
        print("Invalid secret rejection test passed")
    
    def test_register_super_admin_success(self):
        """Should successfully register super admin with valid secret"""
        response = requests.post(f"{BASE_URL}/api/admin/auth/register", json={
            "email": f"test_admin_{TEST_ID}@test.com",
            "password": "TestPass123!",
            "name": f"Test Admin {TEST_ID}",
            "admin_secret": SUPER_ADMIN_SECRET
        })
        assert response.status_code == 200
        data = response.json()
        assert "admin_id" in data
        assert data["message"] == "Super admin created"
        print(f"Super admin registration passed: {data['admin_id']}")
    
    def test_register_duplicate_email(self):
        """Should reject duplicate email registration"""
        response = requests.post(f"{BASE_URL}/api/admin/auth/register", json={
            "email": f"test_admin_{TEST_ID}@test.com",
            "password": "TestPass123!",
            "name": "Test Admin Duplicate",
            "admin_secret": SUPER_ADMIN_SECRET
        })
        assert response.status_code == 400
        data = response.json()
        assert "already registered" in data.get("detail", "").lower()
        print("Duplicate email rejection test passed")


class TestSuperAdminLogin:
    """Test Super Admin login at /admin/login"""
    
    def test_login_invalid_credentials(self):
        """Should reject invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/admin/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("Invalid credentials rejection test passed")
    
    def test_login_success(self):
        """Should successfully login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/admin/auth/login", json={
            "email": f"test_admin_{TEST_ID}@test.com",
            "password": "TestPass123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "admin_id" in data
        assert "session_token" in data
        assert "email" in data
        assert "name" in data
        print(f"Super admin login passed: {data['email']}")
        return data["session_token"]


class TestAdminDashboardStats:
    """Test Admin Dashboard stats endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/admin/auth/login", json={
            "email": f"test_admin_{TEST_ID}@test.com",
            "password": "TestPass123!"
        })
        if response.status_code == 200:
            return response.json()["session_token"]
        pytest.skip("Admin login failed")
    
    def test_stats_without_auth(self):
        """Should reject unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 401
        print("Unauthenticated stats rejection test passed")
    
    def test_stats_with_auth(self, admin_token):
        """Should return dashboard stats with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"X-Admin-Token": admin_token}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected fields
        assert "total_tenants" in data
        assert "active_tenants" in data
        assert "trial_tenants" in data
        assert "total_appointments" in data
        assert "total_revenue" in data
        assert "tenants_by_plan" in data
        assert "tenants_by_industry" in data
        assert "recent_signups" in data
        
        # Verify data types
        assert isinstance(data["total_tenants"], int)
        assert isinstance(data["active_tenants"], int)
        assert isinstance(data["total_revenue"], (int, float))
        assert isinstance(data["tenants_by_plan"], dict)
        assert isinstance(data["tenants_by_industry"], dict)
        assert isinstance(data["recent_signups"], list)
        
        print(f"Dashboard stats passed: {data['total_tenants']} tenants, €{data['total_revenue']} revenue")


class TestAdminTenantManagement:
    """Test Admin Tenant CRUD operations"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/admin/auth/login", json={
            "email": f"test_admin_{TEST_ID}@test.com",
            "password": "TestPass123!"
        })
        if response.status_code == 200:
            return response.json()["session_token"]
        pytest.skip("Admin login failed")
    
    def test_list_tenants_without_auth(self):
        """Should reject unauthenticated tenant list request"""
        response = requests.get(f"{BASE_URL}/api/admin/tenants")
        assert response.status_code == 401
        print("Unauthenticated tenant list rejection test passed")
    
    def test_list_tenants_with_auth(self, admin_token):
        """Should return tenant list with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/admin/tenants",
            headers={"X-Admin-Token": admin_token}
        )
        assert response.status_code == 200
        data = response.json()
        assert "tenants" in data
        assert "total" in data
        assert isinstance(data["tenants"], list)
        print(f"Tenant list passed: {data['total']} tenants")
    
    def test_list_tenants_with_search(self, admin_token):
        """Should filter tenants by search query"""
        response = requests.get(
            f"{BASE_URL}/api/admin/tenants?search=test",
            headers={"X-Admin-Token": admin_token}
        )
        assert response.status_code == 200
        data = response.json()
        assert "tenants" in data
        print(f"Tenant search passed: {len(data['tenants'])} results")
    
    def test_create_tenant(self, admin_token):
        """Should create a new tenant with owner account"""
        tenant_data = {
            "name": f"TEST_Tenant_{TEST_ID}",
            "industry": "salon",
            "email": f"test_tenant_{TEST_ID}@business.com",
            "phone": "+1234567890",
            "owner_name": f"Owner {TEST_ID}",
            "owner_email": f"test_owner_{TEST_ID}@email.com",
            "owner_password": "OwnerPass123!",
            "plan": "starter",
            "timezone": "Europe/London",
            "currency": "EUR"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/tenants",
            headers={
                "X-Admin-Token": admin_token,
                "Content-Type": "application/json"
            },
            json=tenant_data
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response
        assert "tenant_id" in data
        assert "slug" in data
        assert "owner_email" in data
        assert "booking_url" in data
        
        print(f"Tenant creation passed: {data['tenant_id']}, slug: {data['slug']}")
        return data["tenant_id"]
    
    def test_get_tenant_detail(self, admin_token):
        """Should get detailed tenant information"""
        # First create a tenant
        tenant_data = {
            "name": f"TEST_Detail_{TEST_ID}",
            "industry": "dentist",
            "email": f"test_detail_{TEST_ID}@business.com",
            "owner_name": f"Detail Owner {TEST_ID}",
            "owner_email": f"test_detail_owner_{TEST_ID}@email.com",
            "plan": "growth"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/admin/tenants",
            headers={"X-Admin-Token": admin_token, "Content-Type": "application/json"},
            json=tenant_data
        )
        assert create_response.status_code == 200
        tenant_id = create_response.json()["tenant_id"]
        
        # Get tenant detail
        response = requests.get(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}",
            headers={"X-Admin-Token": admin_token}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "tenant" in data
        assert "subscription" in data
        assert "owner" in data
        assert "stats" in data
        
        # Verify tenant data
        assert data["tenant"]["name"] == tenant_data["name"]
        assert data["tenant"]["industry"] == tenant_data["industry"]
        
        # Verify subscription
        assert data["subscription"]["plan"] == "growth"
        
        # Verify stats structure
        assert "staff_count" in data["stats"]
        assert "services_count" in data["stats"]
        assert "clients_count" in data["stats"]
        assert "appointments_count" in data["stats"]
        
        print(f"Tenant detail passed: {data['tenant']['name']}")
        return tenant_id
    
    def test_update_tenant(self, admin_token):
        """Should update tenant details"""
        # Create tenant first
        create_response = requests.post(
            f"{BASE_URL}/api/admin/tenants",
            headers={"X-Admin-Token": admin_token, "Content-Type": "application/json"},
            json={
                "name": f"TEST_Update_{TEST_ID}",
                "industry": "clinic",
                "email": f"test_update_{TEST_ID}@business.com",
                "owner_name": f"Update Owner {TEST_ID}",
                "owner_email": f"test_update_owner_{TEST_ID}@email.com"
            }
        )
        tenant_id = create_response.json()["tenant_id"]
        
        # Update tenant
        update_data = {
            "name": f"TEST_Updated_{TEST_ID}",
            "phone": "+9876543210",
            "address": "123 Test Street",
            "city": "Test City"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}",
            headers={"X-Admin-Token": admin_token, "Content-Type": "application/json"},
            json=update_data
        )
        assert response.status_code == 200
        
        # Verify update
        get_response = requests.get(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}",
            headers={"X-Admin-Token": admin_token}
        )
        data = get_response.json()
        assert data["tenant"]["name"] == update_data["name"]
        assert data["tenant"]["phone"] == update_data["phone"]
        
        print(f"Tenant update passed: {data['tenant']['name']}")
    
    def test_suspend_and_activate_tenant(self, admin_token):
        """Should suspend and activate tenant"""
        # Create tenant
        create_response = requests.post(
            f"{BASE_URL}/api/admin/tenants",
            headers={"X-Admin-Token": admin_token, "Content-Type": "application/json"},
            json={
                "name": f"TEST_Suspend_{TEST_ID}",
                "industry": "salon",
                "email": f"test_suspend_{TEST_ID}@business.com",
                "owner_name": f"Suspend Owner {TEST_ID}",
                "owner_email": f"test_suspend_owner_{TEST_ID}@email.com"
            }
        )
        tenant_id = create_response.json()["tenant_id"]
        
        # Suspend tenant
        suspend_response = requests.post(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}/suspend",
            headers={"X-Admin-Token": admin_token}
        )
        assert suspend_response.status_code == 200
        
        # Verify suspended
        get_response = requests.get(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}",
            headers={"X-Admin-Token": admin_token}
        )
        assert get_response.json()["tenant"]["is_active"] == False
        print("Tenant suspension passed")
        
        # Activate tenant
        activate_response = requests.post(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}/activate",
            headers={"X-Admin-Token": admin_token}
        )
        assert activate_response.status_code == 200
        
        # Verify activated
        get_response = requests.get(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}",
            headers={"X-Admin-Token": admin_token}
        )
        assert get_response.json()["tenant"]["is_active"] == True
        print("Tenant activation passed")
    
    def test_change_tenant_plan(self, admin_token):
        """Should change tenant subscription plan"""
        # Create tenant with starter plan
        create_response = requests.post(
            f"{BASE_URL}/api/admin/tenants",
            headers={"X-Admin-Token": admin_token, "Content-Type": "application/json"},
            json={
                "name": f"TEST_Plan_{TEST_ID}",
                "industry": "consultant",
                "email": f"test_plan_{TEST_ID}@business.com",
                "owner_name": f"Plan Owner {TEST_ID}",
                "owner_email": f"test_plan_owner_{TEST_ID}@email.com",
                "plan": "starter"
            }
        )
        tenant_id = create_response.json()["tenant_id"]
        
        # Change to pro plan
        response = requests.put(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}/subscription",
            headers={"X-Admin-Token": admin_token, "Content-Type": "application/json"},
            json={"plan": "pro"}
        )
        assert response.status_code == 200
        
        # Verify plan change
        get_response = requests.get(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}",
            headers={"X-Admin-Token": admin_token}
        )
        assert get_response.json()["subscription"]["plan"] == "pro"
        print("Tenant plan change passed")
    
    def test_delete_tenant(self, admin_token):
        """Should delete tenant and all associated data"""
        # Create tenant
        create_response = requests.post(
            f"{BASE_URL}/api/admin/tenants",
            headers={"X-Admin-Token": admin_token, "Content-Type": "application/json"},
            json={
                "name": f"TEST_Delete_{TEST_ID}",
                "industry": "other",
                "email": f"test_delete_{TEST_ID}@business.com",
                "owner_name": f"Delete Owner {TEST_ID}",
                "owner_email": f"test_delete_owner_{TEST_ID}@email.com"
            }
        )
        tenant_id = create_response.json()["tenant_id"]
        
        # Delete tenant
        response = requests.delete(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}",
            headers={"X-Admin-Token": admin_token}
        )
        assert response.status_code == 200
        
        # Verify deleted
        get_response = requests.get(
            f"{BASE_URL}/api/admin/tenants/{tenant_id}",
            headers={"X-Admin-Token": admin_token}
        )
        assert get_response.status_code == 404
        print("Tenant deletion passed")


class TestTenantBranding:
    """Test Tenant Branding APIs"""
    
    @pytest.fixture
    def tenant_session(self):
        """Create a tenant and get owner session"""
        unique_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        
        # First register admin if not exists
        requests.post(f"{BASE_URL}/api/admin/auth/register", json={
            "email": f"branding_admin_{unique_id}@test.com",
            "password": "TestPass123!",
            "name": "Branding Admin",
            "admin_secret": SUPER_ADMIN_SECRET
        })
        
        # Login as admin
        admin_login = requests.post(f"{BASE_URL}/api/admin/auth/login", json={
            "email": f"branding_admin_{unique_id}@test.com",
            "password": "TestPass123!"
        })
        if admin_login.status_code != 200:
            pytest.skip("Admin login failed")
        admin_token = admin_login.json()["session_token"]
        
        # Create tenant
        tenant_response = requests.post(
            f"{BASE_URL}/api/admin/tenants",
            headers={"X-Admin-Token": admin_token, "Content-Type": "application/json"},
            json={
                "name": f"TEST_Branding_{unique_id}",
                "industry": "salon",
                "email": f"test_branding_{unique_id}@business.com",
                "owner_name": f"Branding Owner {unique_id}",
                "owner_email": f"test_branding_owner_{unique_id}@email.com",
                "owner_password": "BrandingPass123!"
            }
        )
        if tenant_response.status_code != 200:
            pytest.skip(f"Tenant creation failed: {tenant_response.text}")
        tenant_data = tenant_response.json()
        
        # Login as tenant owner
        owner_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": f"test_branding_owner_{unique_id}@email.com",
            "password": "BrandingPass123!"
        })
        
        if owner_login.status_code != 200:
            pytest.skip("Tenant owner login failed")
        
        return {
            "session_token": owner_login.json()["session_token"],
            "tenant_slug": tenant_data["slug"],
            "tenant_id": tenant_data["tenant_id"]
        }
    
    def test_get_branding_settings(self, tenant_session):
        """Should get branding settings"""
        response = requests.get(
            f"{BASE_URL}/api/settings/branding",
            cookies={"session_token": tenant_session["session_token"]}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "branding" in data
        assert "name" in data
        
        # Verify default branding values
        branding = data["branding"]
        assert "primary_color" in branding
        assert "secondary_color" in branding
        assert "accent_color" in branding
        assert "background_color" in branding
        assert "text_color" in branding
        assert "font_family" in branding
        
        print(f"Get branding passed: {data['name']}")
    
    def test_update_branding_settings(self, tenant_session):
        """Should update branding settings"""
        new_branding = {
            "primary_color": "#FF5733",
            "secondary_color": "#33FF57",
            "accent_color": "#3357FF",
            "background_color": "#FFFFFF",
            "text_color": "#000000",
            "font_family": "Poppins",
            "show_powered_by": False
        }
        
        response = requests.put(
            f"{BASE_URL}/api/settings/branding",
            cookies={"session_token": tenant_session["session_token"]},
            json=new_branding
        )
        assert response.status_code == 200
        
        # Verify update
        get_response = requests.get(
            f"{BASE_URL}/api/settings/branding",
            cookies={"session_token": tenant_session["session_token"]}
        )
        data = get_response.json()
        
        assert data["branding"]["primary_color"] == new_branding["primary_color"]
        assert data["branding"]["font_family"] == new_branding["font_family"]
        assert data["branding"]["show_powered_by"] == False
        
        print("Update branding passed")
    
    def test_invalid_color_format(self, tenant_session):
        """Should reject invalid color format"""
        response = requests.put(
            f"{BASE_URL}/api/settings/branding",
            cookies={"session_token": tenant_session["session_token"]},
            json={"primary_color": "invalid_color"}
        )
        assert response.status_code == 400
        print("Invalid color format rejection passed")


class TestPublicBookingWithBranding:
    """Test Public Booking Page with Tenant Branding"""
    
    @pytest.fixture
    def tenant_with_branding(self):
        """Create tenant with custom branding"""
        unique_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        
        # Register admin
        requests.post(f"{BASE_URL}/api/admin/auth/register", json={
            "email": f"public_admin_{unique_id}@test.com",
            "password": "TestPass123!",
            "name": "Public Admin",
            "admin_secret": SUPER_ADMIN_SECRET
        })
        
        # Login as admin
        admin_login = requests.post(f"{BASE_URL}/api/admin/auth/login", json={
            "email": f"public_admin_{unique_id}@test.com",
            "password": "TestPass123!"
        })
        if admin_login.status_code != 200:
            pytest.skip("Admin login failed")
        admin_token = admin_login.json()["session_token"]
        
        # Create tenant
        tenant_response = requests.post(
            f"{BASE_URL}/api/admin/tenants",
            headers={"X-Admin-Token": admin_token, "Content-Type": "application/json"},
            json={
                "name": f"TEST_Public_{unique_id}",
                "industry": "dentist",
                "email": f"test_public_{unique_id}@business.com",
                "owner_name": f"Public Owner {unique_id}",
                "owner_email": f"test_public_owner_{unique_id}@email.com",
                "owner_password": "PublicPass123!"
            }
        )
        if tenant_response.status_code != 200:
            pytest.skip(f"Tenant creation failed: {tenant_response.text}")
        tenant_data = tenant_response.json()
        
        # Login as owner and set branding
        owner_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": f"test_public_owner_{unique_id}@email.com",
            "password": "PublicPass123!"
        })
        
        if owner_login.status_code == 200:
            requests.put(
                f"{BASE_URL}/api/settings/branding",
                cookies={"session_token": owner_login.json()["session_token"]},
                json={
                    "primary_color": "#123456",
                    "secondary_color": "#654321",
                    "font_family": "Outfit"
                }
            )
        
        return tenant_data["slug"]
    
    def test_public_services_with_branding(self, tenant_with_branding):
        """Should return services with tenant branding"""
        response = requests.get(f"{BASE_URL}/api/public/{tenant_with_branding}/services")
        assert response.status_code == 200
        data = response.json()
        
        # Verify tenant info with branding
        assert "tenant" in data
        assert "services" in data
        
        tenant = data["tenant"]
        assert "name" in tenant
        assert "branding" in tenant
        
        # Verify branding is included
        branding = tenant["branding"]
        assert "primary_color" in branding
        assert "secondary_color" in branding
        assert "font_family" in branding
        
        print(f"Public services with branding passed: {tenant['name']}")
    
    def test_public_staff_endpoint(self, tenant_with_branding):
        """Should return staff for public booking"""
        response = requests.get(f"{BASE_URL}/api/public/{tenant_with_branding}/staff")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Public staff endpoint passed: {len(data)} staff members")
    
    def test_nonexistent_tenant_slug(self):
        """Should return 404 for nonexistent tenant"""
        response = requests.get(f"{BASE_URL}/api/public/nonexistent-tenant-slug-12345/services")
        assert response.status_code == 404
        print("Nonexistent tenant 404 test passed")


class TestAdminAuthMe:
    """Test Admin auth/me endpoint"""
    
    def test_auth_me_without_token(self):
        """Should reject request without token"""
        response = requests.get(f"{BASE_URL}/api/admin/auth/me")
        assert response.status_code == 401
        print("Auth me without token rejection passed")
    
    def test_auth_me_with_valid_token(self):
        """Should return admin info with valid token"""
        # Register and login
        requests.post(f"{BASE_URL}/api/admin/auth/register", json={
            "email": f"authme_admin_{TEST_ID}@test.com",
            "password": "TestPass123!",
            "name": "AuthMe Admin",
            "admin_secret": SUPER_ADMIN_SECRET
        })
        
        login_response = requests.post(f"{BASE_URL}/api/admin/auth/login", json={
            "email": f"authme_admin_{TEST_ID}@test.com",
            "password": "TestPass123!"
        })
        token = login_response.json()["session_token"]
        
        # Test auth/me
        response = requests.get(
            f"{BASE_URL}/api/admin/auth/me",
            headers={"X-Admin-Token": token}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "admin_id" in data
        assert "email" in data
        assert "name" in data
        assert data["email"] == f"authme_admin_{TEST_ID}@test.com"
        
        print(f"Auth me passed: {data['email']}")


class TestAdminLogout:
    """Test Admin logout endpoint"""
    
    def test_logout(self):
        """Should successfully logout"""
        # Register and login
        requests.post(f"{BASE_URL}/api/admin/auth/register", json={
            "email": f"logout_admin_{TEST_ID}@test.com",
            "password": "TestPass123!",
            "name": "Logout Admin",
            "admin_secret": SUPER_ADMIN_SECRET
        })
        
        login_response = requests.post(f"{BASE_URL}/api/admin/auth/login", json={
            "email": f"logout_admin_{TEST_ID}@test.com",
            "password": "TestPass123!"
        })
        token = login_response.json()["session_token"]
        
        # Logout
        response = requests.post(
            f"{BASE_URL}/api/admin/auth/logout",
            cookies={"admin_session_token": token}
        )
        assert response.status_code == 200
        
        # Verify token is invalidated
        me_response = requests.get(
            f"{BASE_URL}/api/admin/auth/me",
            headers={"X-Admin-Token": token}
        )
        # Token should be invalid after logout
        assert me_response.status_code == 401
        
        print("Admin logout passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
