"""
Test Suite for TimeSlot Pro Security Hardening
Tests for:
- Stage 1: Input validation (password min 8 chars, service duration max 480)
- Stage 1: Demo accounts endpoint security
- Stage 2: Booking race condition / conflict detection
- Stage 3: Plan enforcement (webhooks, API keys, staff limits, monthly bookings)
- General: Health check and login flow
"""
import pytest
import requests
import os
import time
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefixes for cleanup
TEST_PREFIX = "TEST_SECURITY_"

# Session management to avoid rate limiting
_session_cache = {}


def get_demo_session():
    """Get or create a session for demo account with rate limit handling"""
    cache_key = "demo_session"
    if cache_key in _session_cache:
        return _session_cache[cache_key]
    
    for attempt in range(3):
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "owner@luxe-hair-studio.demo", "password": "demo123"}
        )
        if login_resp.status_code == 200:
            _session_cache[cache_key] = login_resp.cookies
            return login_resp.cookies
        elif login_resp.status_code == 429:
            # Rate limited, wait and retry
            retry_after = login_resp.json().get("detail", {}).get("retry_after", 60)
            print(f"Rate limited, waiting {retry_after}s...")
            time.sleep(min(retry_after + 1, 30))
        else:
            break
    
    pytest.skip(f"Could not login: {login_resp.status_code} - {login_resp.text}")


class TestHealthAndBasics:
    """Basic health check and connectivity tests"""
    
    def test_health_check(self):
        """Test /api/health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print("✓ Health check passed")
    
    def test_api_root(self):
        """Test /api/ root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "TimeSlot Pro" in data.get("message", "")
        print("✓ API root endpoint passed")


class TestDemoAccountLogin:
    """Test demo account login flow"""
    
    def test_demo_account_login_success(self):
        """Test login with demo account credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "owner@luxe-hair-studio.demo", "password": "demo123"}
        )
        if response.status_code == 429:
            pytest.skip("Rate limited")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "session_token" in data
        assert data["email"] == "owner@luxe-hair-studio.demo"
        assert data["tenant_id"] is not None
        print(f"✓ Demo account login successful - tenant_id: {data['tenant_id']}")
    
    def test_demo_account_login_wrong_password(self):
        """Test login with wrong password fails"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "owner@luxe-hair-studio.demo", "password": "wrongpassword"}
        )
        if response.status_code == 429:
            pytest.skip("Rate limited")
        assert response.status_code == 401
        print("✓ Wrong password correctly rejected")


class TestInputValidation:
    """Stage 1: Input validation tests"""
    
    def test_register_password_too_short(self):
        """Test that password < 8 chars is rejected on /api/auth/register"""
        unique_email = f"{TEST_PREFIX}short_pwd_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "name": "Test User",
                "password": "short"  # Only 5 chars, should fail
            }
        )
        if response.status_code == 429:
            pytest.skip("Rate limited")
        # Should return 422 (validation error) for password too short
        assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"
        data = response.json()
        # Check that error mentions password or min_length
        error_str = str(data).lower()
        assert "password" in error_str or "min" in error_str or "length" in error_str or "8" in error_str, \
            f"Error should mention password validation: {data}"
        print("✓ Password < 8 chars correctly rejected")
    
    def test_register_password_exactly_8_chars(self):
        """Test that password with exactly 8 chars is accepted"""
        unique_email = f"{TEST_PREFIX}exact8_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "name": "Test User",
                "password": "exactly8"  # Exactly 8 chars
            }
        )
        if response.status_code == 429:
            pytest.skip("Rate limited")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user_id" in data
        print("✓ Password with exactly 8 chars accepted")
    
    def test_register_password_7_chars_rejected(self):
        """Test that password with 7 chars is rejected"""
        unique_email = f"{TEST_PREFIX}7chars_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "name": "Test User",
                "password": "7chars!"  # 7 chars
            }
        )
        if response.status_code == 429:
            pytest.skip("Rate limited")
        assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"
        print("✓ Password with 7 chars correctly rejected")
    
    def test_service_duration_max_480(self):
        """Test that service duration > 480 minutes is rejected"""
        cookies = get_demo_session()
        
        # Try to create service with duration > 480
        response = requests.post(
            f"{BASE_URL}/api/services",
            json={
                "name": f"{TEST_PREFIX}Long Service",
                "duration": 500,  # > 480, should fail
                "price": 100
            },
            cookies=cookies
        )
        assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"
        print("✓ Service duration > 480 correctly rejected")
    
    def test_service_duration_exactly_480_accepted(self):
        """Test that service duration of exactly 480 minutes is accepted"""
        cookies = get_demo_session()
        
        response = requests.post(
            f"{BASE_URL}/api/services",
            json={
                "name": f"{TEST_PREFIX}8Hour Service {uuid.uuid4().hex[:6]}",
                "duration": 480,  # Exactly 480 (8 hours)
                "price": 200
            },
            cookies=cookies
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "service_id" in data
        print("✓ Service duration of 480 minutes accepted")
    
    def test_service_duration_min_5(self):
        """Test that service duration < 5 minutes is rejected"""
        cookies = get_demo_session()
        
        response = requests.post(
            f"{BASE_URL}/api/services",
            json={
                "name": f"{TEST_PREFIX}Too Short Service",
                "duration": 3,  # < 5, should fail
                "price": 10
            },
            cookies=cookies
        )
        assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"
        print("✓ Service duration < 5 minutes correctly rejected")


class TestDemoAccountsSecurity:
    """Stage 1: Demo accounts endpoint security tests"""
    
    def test_demo_accounts_accessible_in_preview(self):
        """Test that /api/admin/demo-accounts is accessible in preview environment"""
        response = requests.get(f"{BASE_URL}/api/admin/demo-accounts")
        # In preview environment, should be accessible
        assert response.status_code == 200, f"Expected 200 in preview env, got {response.status_code}: {response.text}"
        data = response.json()
        assert "demo_accounts" in data
        print(f"✓ Demo accounts endpoint accessible in preview - found {len(data['demo_accounts'])} accounts")
    
    def test_demo_accounts_returns_expected_structure(self):
        """Test that demo accounts have expected structure"""
        response = requests.get(f"{BASE_URL}/api/admin/demo-accounts")
        assert response.status_code == 200
        data = response.json()
        
        if data["demo_accounts"]:
            account = data["demo_accounts"][0]
            assert "business_name" in account
            assert "email" in account
            assert "password" in account
            assert account["password"] == "demo123"
            print("✓ Demo accounts have correct structure")


class TestBookingConflictDetection:
    """Stage 2: Booking race condition / conflict detection tests"""
    
    def test_double_booking_same_slot_rejected(self):
        """Test that booking the same slot twice is rejected"""
        cookies = get_demo_session()
        
        # Get a staff member
        staff_resp = requests.get(f"{BASE_URL}/api/staff", cookies=cookies)
        assert staff_resp.status_code == 200
        staff_list = staff_resp.json()
        assert len(staff_list) > 0, "Need at least one staff member"
        staff_id = staff_list[0]["staff_id"]
        
        # Get a service
        services_resp = requests.get(f"{BASE_URL}/api/services", cookies=cookies)
        assert services_resp.status_code == 200
        services = services_resp.json()
        assert len(services) > 0, "Need at least one service"
        service_id = services[0]["service_id"]
        
        # Use a unique future date/time to avoid conflicts with existing bookings
        # Use a random minute offset to make it unique
        random_offset = int(uuid.uuid4().hex[:4], 16) % 60
        future_date = datetime.now() + timedelta(days=60 + random_offset)
        start_time = future_date.replace(hour=10, minute=0, second=0, microsecond=0)
        
        booking_data = {
            "staff_id": staff_id,
            "service_id": service_id,
            "start_time": start_time.isoformat(),
            "client_name": f"{TEST_PREFIX}Client 1 {uuid.uuid4().hex[:6]}",
            "client_email": f"{TEST_PREFIX}client1_{uuid.uuid4().hex[:6]}@test.com"
        }
        
        # First booking should succeed
        resp1 = requests.post(
            f"{BASE_URL}/api/appointments",
            json=booking_data,
            cookies=cookies
        )
        assert resp1.status_code == 200, f"First booking failed: {resp1.text}"
        first_apt = resp1.json()
        print(f"✓ First booking created: {first_apt['appointment_id']}")
        
        # Second booking at same time should fail
        booking_data["client_name"] = f"{TEST_PREFIX}Client 2 {uuid.uuid4().hex[:6]}"
        booking_data["client_email"] = f"{TEST_PREFIX}client2_{uuid.uuid4().hex[:6]}@test.com"
        
        resp2 = requests.post(
            f"{BASE_URL}/api/appointments",
            json=booking_data,
            cookies=cookies
        )
        assert resp2.status_code == 400, f"Expected 400 for double booking, got {resp2.status_code}: {resp2.text}"
        error_data = resp2.json()
        assert "not available" in error_data.get("detail", "").lower() or "conflict" in error_data.get("detail", "").lower(), \
            f"Error should mention slot not available: {error_data}"
        print("✓ Double booking correctly rejected")
    
    def test_overlapping_booking_rejected(self):
        """Test that overlapping bookings are rejected"""
        cookies = get_demo_session()
        
        # Get a staff member
        staff_resp = requests.get(f"{BASE_URL}/api/staff", cookies=cookies)
        staff_list = staff_resp.json()
        staff_id = staff_list[0]["staff_id"]
        
        # Get a service
        services_resp = requests.get(f"{BASE_URL}/api/services", cookies=cookies)
        services = services_resp.json()
        service_id = services[0]["service_id"]
        service_duration = services[0].get("duration", 30)
        
        # Use a unique future date
        random_offset = int(uuid.uuid4().hex[:4], 16) % 60
        future_date = datetime.now() + timedelta(days=90 + random_offset)
        start_time = future_date.replace(hour=14, minute=0, second=0, microsecond=0)
        
        # First booking at 14:00
        booking1 = {
            "staff_id": staff_id,
            "service_id": service_id,
            "start_time": start_time.isoformat(),
            "client_name": f"{TEST_PREFIX}Overlap Client 1 {uuid.uuid4().hex[:6]}",
            "client_email": f"{TEST_PREFIX}overlap1_{uuid.uuid4().hex[:6]}@test.com"
        }
        
        resp1 = requests.post(
            f"{BASE_URL}/api/appointments",
            json=booking1,
            cookies=cookies
        )
        assert resp1.status_code == 200, f"First booking failed: {resp1.text}"
        
        # Second booking at 14:15 (overlaps with first if duration > 15 min)
        overlap_time = start_time + timedelta(minutes=15)
        booking2 = {
            "staff_id": staff_id,
            "service_id": service_id,
            "start_time": overlap_time.isoformat(),
            "client_name": f"{TEST_PREFIX}Overlap Client 2 {uuid.uuid4().hex[:6]}",
            "client_email": f"{TEST_PREFIX}overlap2_{uuid.uuid4().hex[:6]}@test.com"
        }
        
        resp2 = requests.post(
            f"{BASE_URL}/api/appointments",
            json=booking2,
            cookies=cookies
        )
        
        # If service duration > 15 min, this should fail
        if service_duration > 15:
            assert resp2.status_code == 400, f"Expected 400 for overlapping booking, got {resp2.status_code}"
            print("✓ Overlapping booking correctly rejected")
        else:
            print(f"⚠ Service duration ({service_duration}min) <= 15min, overlap test skipped")


class TestPlanEnforcement:
    """Stage 3: Plan enforcement tests"""
    
    def _create_starter_account(self):
        """Helper to create a fresh Starter plan account"""
        unique_id = uuid.uuid4().hex[:8]
        email = f"{TEST_PREFIX}starter_{unique_id}@test.com"
        
        # Register new user
        for attempt in range(3):
            reg_resp = requests.post(
                f"{BASE_URL}/api/auth/register",
                json={
                    "email": email,
                    "name": f"Starter Test User {unique_id}",
                    "password": "testpass123"
                }
            )
            if reg_resp.status_code == 200:
                break
            elif reg_resp.status_code == 429:
                retry_after = reg_resp.json().get("detail", {}).get("retry_after", 30)
                print(f"Rate limited on registration, waiting {retry_after}s...")
                time.sleep(min(retry_after + 1, 30))
            else:
                pytest.fail(f"Registration failed: {reg_resp.text}")
        
        assert reg_resp.status_code == 200, f"Registration failed: {reg_resp.text}"
        cookies = reg_resp.cookies
        
        # Create business (gets Starter plan by default)
        biz_resp = requests.post(
            f"{BASE_URL}/api/onboarding/create-business",
            json={
                "name": f"Starter Test Business {unique_id}",
                "industry": "salon",
                "email": email,
                "timezone": "Europe/London",
                "currency": "EUR"
            },
            cookies=cookies
        )
        assert biz_resp.status_code == 200, f"Business creation failed: {biz_resp.text}"
        
        return cookies, email, biz_resp.json()["tenant_id"]
    
    def test_starter_cannot_create_webhooks(self):
        """Test that Starter plan cannot create webhooks (0 limit)"""
        cookies, email, tenant_id = self._create_starter_account()
        
        # Try to create a webhook
        response = requests.post(
            f"{BASE_URL}/api/webhooks",
            json={
                "url": "https://example.com/webhook",
                "events": ["booking.created"]
            },
            cookies=cookies
        )
        
        # Should fail with 403 (feature not available or limit reached)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "upgrade" in data.get("detail", "").lower() or "limit" in data.get("detail", "").lower(), \
            f"Error should mention upgrade or limit: {data}"
        print("✓ Starter plan correctly blocked from creating webhooks")
    
    def test_starter_cannot_create_api_keys(self):
        """Test that Starter plan cannot create API keys (0 limit)"""
        cookies, email, tenant_id = self._create_starter_account()
        
        # Try to create an API key
        response = requests.post(
            f"{BASE_URL}/api/api-keys",
            json={"name": "Test API Key"},
            cookies=cookies
        )
        
        # Should fail with 403
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "upgrade" in data.get("detail", "").lower() or "limit" in data.get("detail", "").lower(), \
            f"Error should mention upgrade or limit: {data}"
        print("✓ Starter plan correctly blocked from creating API keys")
    
    def test_starter_staff_limit_2(self):
        """Test that Starter plan can only have 2 staff members"""
        cookies, email, tenant_id = self._create_starter_account()
        
        # Note: Business creation already creates 1 staff member (the owner)
        # So we should be able to add 1 more, but not 2 more
        
        # Add first additional staff (should succeed - total 2)
        staff1_resp = requests.post(
            f"{BASE_URL}/api/staff",
            json={
                "name": f"{TEST_PREFIX}Staff Member 1",
                "email": f"{TEST_PREFIX}staff1_{uuid.uuid4().hex[:6]}@test.com"
            },
            cookies=cookies
        )
        assert staff1_resp.status_code == 200, f"First staff creation failed: {staff1_resp.text}"
        print("✓ First additional staff member created (total: 2)")
        
        # Try to add second additional staff (should fail - would be 3rd)
        staff2_resp = requests.post(
            f"{BASE_URL}/api/staff",
            json={
                "name": f"{TEST_PREFIX}Staff Member 2",
                "email": f"{TEST_PREFIX}staff2_{uuid.uuid4().hex[:6]}@test.com"
            },
            cookies=cookies
        )
        assert staff2_resp.status_code == 403, f"Expected 403 for 3rd staff, got {staff2_resp.status_code}: {staff2_resp.text}"
        data = staff2_resp.json()
        assert "limit" in data.get("detail", "").lower() or "upgrade" in data.get("detail", "").lower(), \
            f"Error should mention limit: {data}"
        print("✓ Starter plan correctly limited to 2 staff members")
    
    def test_growth_plan_cannot_create_webhooks(self):
        """Test that Growth plan CANNOT create webhooks (Pro feature only)"""
        cookies = get_demo_session()
        
        # Check subscription to confirm it's Growth plan
        sub_resp = requests.get(f"{BASE_URL}/api/subscription", cookies=cookies)
        if sub_resp.status_code == 200:
            sub_data = sub_resp.json()
            print(f"Demo account plan: {sub_data.get('plan', 'unknown')}")
        
        # Try to create a webhook
        response = requests.post(
            f"{BASE_URL}/api/webhooks",
            json={
                "url": f"https://example.com/webhook/{uuid.uuid4().hex[:8]}",
                "events": ["booking.created"]
            },
            cookies=cookies
        )
        
        # Growth plan should NOT be able to create webhooks (Pro feature)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "upgrade" in data.get("detail", "").lower()
        print(f"✓ Growth plan correctly blocked from creating webhooks (Pro feature)")
    
    def test_growth_plan_cannot_create_api_keys(self):
        """Test that Growth plan CANNOT create API keys (Pro feature only)"""
        cookies = get_demo_session()
        
        response = requests.post(
            f"{BASE_URL}/api/api-keys",
            json={"name": f"Test API Key {uuid.uuid4().hex[:6]}"},
            cookies=cookies
        )
        
        # Growth plan should NOT be able to create API keys (Pro feature)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "upgrade" in data.get("detail", "").lower()
        print(f"✓ Growth plan correctly blocked from creating API keys (Pro feature)")


class TestSubscriptionUsage:
    """Test subscription usage endpoint"""
    
    def test_get_subscription_usage(self):
        """Test /api/subscription/usage returns usage data"""
        cookies = get_demo_session()
        
        response = requests.get(f"{BASE_URL}/api/subscription/usage", cookies=cookies)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plan" in data
        assert "usage" in data
        assert "staff" in data["usage"]
        assert "current" in data["usage"]["staff"]
        assert "max" in data["usage"]["staff"]
        print(f"✓ Subscription usage endpoint works - Plan: {data['plan']}, Staff: {data['usage']['staff']['current']}/{data['usage']['staff']['max']}")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
