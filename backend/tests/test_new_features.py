"""
Test suite for BookSlot new features:
1. Web Push Notifications (VAPID key, subscribe/unsubscribe)
2. Notifications system (fetch, mark read)
3. Smart booking suggestions
4. File upload for logos
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bookslot-preview.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "demo@bookslot.io"
TEST_PASSWORD = "Demo123!"


class TestVAPIDPublicKey:
    """Test VAPID public key endpoint for web push notifications"""
    
    def test_get_vapid_public_key(self):
        """GET /api/push/vapid-public-key should return public key"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-public-key")
        assert response.status_code == 200
        data = response.json()
        assert "publicKey" in data
        assert isinstance(data["publicKey"], str)
        assert len(data["publicKey"]) > 50  # VAPID keys are long
        print(f"SUCCESS: VAPID public key returned: {data['publicKey'][:30]}...")


class TestAuthentication:
    """Test login and get auth token"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print(f"SUCCESS: Logged in as {TEST_EMAIL}")
        return data["token"]
    
    def test_login_success(self, auth_token):
        """Test login returns valid token"""
        assert auth_token is not None
        assert len(auth_token) > 10
        print("SUCCESS: Auth token obtained")


class TestNotificationsSystem:
    """Test notifications endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_notifications(self, auth_token):
        """GET /api/notifications should return notifications list"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        assert "unread_count" in data
        assert isinstance(data["notifications"], list)
        assert isinstance(data["unread_count"], int)
        print(f"SUCCESS: Got {len(data['notifications'])} notifications, {data['unread_count']} unread")
    
    def test_get_notifications_unread_only(self, auth_token):
        """GET /api/notifications?unread_only=true should filter unread"""
        response = requests.get(
            f"{BASE_URL}/api/notifications?unread_only=true",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        # All returned should be unread
        for notif in data["notifications"]:
            assert notif.get("read") == False or notif.get("read") is None
        print(f"SUCCESS: Got {len(data['notifications'])} unread notifications")
    
    def test_mark_all_notifications_read(self, auth_token):
        """POST /api/notifications/read-all should mark all as read"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/read-all",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("SUCCESS: Marked all notifications as read")
    
    def test_notifications_unauthenticated(self):
        """GET /api/notifications without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 401
        print("SUCCESS: Unauthenticated request correctly rejected")


class TestPushSubscription:
    """Test web push subscription endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_subscribe_to_push(self, auth_token):
        """POST /api/push/subscribe should create subscription"""
        subscription_data = {
            "endpoint": "https://test-push-endpoint.example.com/test123",
            "keys": {
                "p256dh": "test_p256dh_key",
                "auth": "test_auth_key"
            }
        }
        response = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json=subscription_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "subscription_id" in data
        print(f"SUCCESS: Push subscription created: {data['subscription_id']}")
    
    def test_unsubscribe_from_push(self, auth_token):
        """DELETE /api/push/unsubscribe should remove subscription"""
        response = requests.delete(
            f"{BASE_URL}/api/push/unsubscribe",
            json={"endpoint": "https://test-push-endpoint.example.com/test123"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("SUCCESS: Push subscription removed")


class TestSmartBooking:
    """Test smart booking availability endpoint"""
    
    def test_smart_availability_invalid_slug(self):
        """GET /api/public/booking/{slug}/smart-availability with invalid slug"""
        response = requests.get(
            f"{BASE_URL}/api/public/booking/invalid-slug-12345/smart-availability",
            params={"service_id": "test_service"}
        )
        assert response.status_code == 404
        print("SUCCESS: Invalid slug correctly returns 404")


class TestFileUpload:
    """Test file upload endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_upload_invalid_file_type(self, auth_token):
        """POST /api/upload/image with invalid file type should fail"""
        # Create a fake text file
        files = {
            'file': ('test.txt', b'This is not an image', 'text/plain')
        }
        response = requests.post(
            f"{BASE_URL}/api/upload/image",
            files=files,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "Invalid file type" in data.get("detail", "")
        print("SUCCESS: Invalid file type correctly rejected")


class TestMessageTemplates:
    """Test message templates endpoints (moved to AI Receptionist)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_message_templates(self, auth_token):
        """GET /api/messages/templates should return templates"""
        response = requests.get(
            f"{BASE_URL}/api/messages/templates",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "templates" in data
        assert isinstance(data["templates"], list)
        print(f"SUCCESS: Got {len(data['templates'])} message templates")


class TestBrandingSettings:
    """Test branding settings endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_branding(self, auth_token):
        """GET /api/tenants/me/branding should return branding settings"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/me/branding",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "branding" in data
        branding = data["branding"]
        assert "primary_color" in branding
        assert "secondary_color" in branding
        assert "accent_color" in branding
        print(f"SUCCESS: Got branding settings - primary: {branding['primary_color']}")
    
    def test_update_branding(self, auth_token):
        """PUT /api/tenants/me/branding should update branding"""
        new_branding = {
            "primary_color": "#E34A33",
            "secondary_color": "#0A0A0A",
            "accent_color": "#4F46E5",
            "show_powered_by": True
        }
        response = requests.put(
            f"{BASE_URL}/api/tenants/me/branding",
            json=new_branding,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "branding" in data
        print("SUCCESS: Branding updated")


class TestAppointmentsCalendar:
    """Test appointments endpoints (now part of Calendar)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_appointments(self, auth_token):
        """GET /api/appointments should return appointments list"""
        response = requests.get(
            f"{BASE_URL}/api/appointments",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "appointments" in data
        assert isinstance(data["appointments"], list)
        print(f"SUCCESS: Got {len(data['appointments'])} appointments")
    
    def test_get_pending_approvals(self, auth_token):
        """GET /api/appointments/pending-approval should return pending list"""
        response = requests.get(
            f"{BASE_URL}/api/appointments/pending-approval",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "appointments" in data
        print(f"SUCCESS: Got {len(data['appointments'])} pending approvals")


class TestWebhooks:
    """Test webhooks endpoints (now in Settings > Integrations)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_webhooks(self, auth_token):
        """GET /api/webhooks should return webhooks list"""
        response = requests.get(
            f"{BASE_URL}/api/webhooks",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "webhooks" in data
        assert isinstance(data["webhooks"], list)
        print(f"SUCCESS: Got {len(data['webhooks'])} webhooks")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
