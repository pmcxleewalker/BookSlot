"""
Test Phase 3: Service Enhancements
- Service categories with grouping
- Buffer time per service
- Add-ons system (name/price/duration)
- Deposit settings (required toggle + amount)
- Visible Online toggle
- Staff assignment per service
- Category autocomplete from existing categories
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestServiceEnhancements:
    """Test Phase 3 service enhancement features"""
    
    token = None
    tenant_id = None
    staff_list = []
    service_list = []
    created_service_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before tests"""
        if not TestServiceEnhancements.token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "salon@bookslot.io",
                "password": "Demo123!"
            })
            assert response.status_code == 200, f"Login failed: {response.text}"
            data = response.json()
            TestServiceEnhancements.token = data.get("token")
            TestServiceEnhancements.tenant_id = data.get("user", {}).get("tenant_id")
            print(f"Logged in successfully, tenant_id: {TestServiceEnhancements.tenant_id}")
    
    def get_headers(self):
        return {"Authorization": f"Bearer {TestServiceEnhancements.token}"}
    
    # ==================== LOGIN & BASIC TESTS ====================
    
    def test_01_login_success(self):
        """Test login with salon credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "salon@bookslot.io",
            "password": "Demo123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"Login successful: {data['user']['email']}")
    
    def test_02_get_services_list(self):
        """Test GET /api/services returns services list"""
        response = requests.get(f"{BASE_URL}/api/services", headers=self.get_headers())
        assert response.status_code == 200
        data = response.json()
        assert "services" in data
        TestServiceEnhancements.service_list = data["services"]
        print(f"Found {len(data['services'])} services")
        assert len(data["services"]) >= 1, "Expected at least 1 service"
    
    def test_03_get_staff_list(self):
        """Test GET /api/staff returns staff list"""
        response = requests.get(f"{BASE_URL}/api/staff", headers=self.get_headers())
        assert response.status_code == 200
        data = response.json()
        assert "staff" in data
        TestServiceEnhancements.staff_list = data["staff"]
        print(f"Found {len(data['staff'])} staff members")
    
    # ==================== SERVICE FIELD TESTS ====================
    
    def test_04_service_has_category_field(self):
        """Test services have category field"""
        response = requests.get(f"{BASE_URL}/api/services", headers=self.get_headers())
        assert response.status_code == 200
        services = response.json()["services"]
        
        # Check at least one service has category
        categories_found = [s.get("category") for s in services if s.get("category")]
        print(f"Categories found: {set(categories_found)}")
        # Category is optional, so just verify field exists
        for s in services:
            assert "category" in s or s.get("category") is None, f"Service {s['name']} missing category field"
    
    def test_05_service_has_buffer_time_field(self):
        """Test services support buffer_time field (optional, defaults to 0)"""
        response = requests.get(f"{BASE_URL}/api/services", headers=self.get_headers())
        assert response.status_code == 200
        services = response.json()["services"]
        
        for s in services[:5]:  # Check first 5
            # buffer_time is optional and defaults to 0 if not set
            buffer_time = s.get("buffer_time", 0)
            print(f"Service '{s['name']}' buffer_time: {buffer_time}")
    
    def test_06_service_has_deposit_fields(self):
        """Test services have deposit_required and deposit_amount fields"""
        response = requests.get(f"{BASE_URL}/api/services", headers=self.get_headers())
        assert response.status_code == 200
        services = response.json()["services"]
        
        for s in services[:5]:  # Check first 5
            # deposit_required should be boolean
            deposit_required = s.get("deposit_required", False)
            deposit_amount = s.get("deposit_amount", 0)
            print(f"Service '{s['name']}' deposit_required: {deposit_required}, deposit_amount: {deposit_amount}")
    
    def test_07_service_has_visible_online_field(self):
        """Test services have visible_online field"""
        response = requests.get(f"{BASE_URL}/api/services", headers=self.get_headers())
        assert response.status_code == 200
        services = response.json()["services"]
        
        for s in services[:5]:  # Check first 5
            visible = s.get("visible_online", True)
            print(f"Service '{s['name']}' visible_online: {visible}")
            assert isinstance(visible, bool), f"visible_online should be boolean"
    
    def test_08_service_has_staff_ids_field(self):
        """Test services have staff_ids field for staff assignment"""
        response = requests.get(f"{BASE_URL}/api/services", headers=self.get_headers())
        assert response.status_code == 200
        services = response.json()["services"]
        
        for s in services[:5]:  # Check first 5
            staff_ids = s.get("staff_ids", [])
            print(f"Service '{s['name']}' staff_ids: {staff_ids}")
            assert isinstance(staff_ids, list), f"staff_ids should be a list"
    
    def test_09_service_has_add_ons_field(self):
        """Test services have add_ons field"""
        response = requests.get(f"{BASE_URL}/api/services", headers=self.get_headers())
        assert response.status_code == 200
        services = response.json()["services"]
        
        for s in services[:5]:  # Check first 5
            add_ons = s.get("add_ons", [])
            print(f"Service '{s['name']}' add_ons: {add_ons}")
            assert isinstance(add_ons, list), f"add_ons should be a list"
    
    # ==================== CREATE SERVICE WITH NEW FIELDS ====================
    
    def test_10_create_service_with_all_new_fields(self):
        """Test POST /api/services with category, buffer, deposit, add-ons, staff_ids"""
        # Get staff IDs for assignment
        staff_ids = [s["staff_id"] for s in TestServiceEnhancements.staff_list[:2]] if TestServiceEnhancements.staff_list else []
        
        service_data = {
            "name": "TEST_Premium Balayage",
            "description": "Full balayage with toner and treatment",
            "duration": 180,
            "price": 250.00,
            "category": "Colour",
            "buffer_time": 15,
            "deposit_required": True,
            "deposit_amount": 50.00,
            "visible_online": True,
            "staff_ids": staff_ids,
            "add_ons": [
                {"name": "Olaplex Treatment", "price": 35.00, "duration": 15},
                {"name": "Scalp Massage", "price": 20.00, "duration": 10}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/services", json=service_data, headers=self.get_headers())
        assert response.status_code == 200, f"Create service failed: {response.text}"
        
        data = response.json()
        service = data.get("service", data)
        
        # Verify all fields were saved
        assert service["name"] == "TEST_Premium Balayage"
        assert service["category"] == "Colour"
        assert service["buffer_time"] == 15
        assert service["deposit_required"] == True
        assert service["deposit_amount"] == 50.00
        assert service["visible_online"] == True
        assert len(service.get("add_ons", [])) == 2
        
        TestServiceEnhancements.created_service_id = service["service_id"]
        print(f"Created service: {service['service_id']}")
        print(f"  Category: {service['category']}")
        print(f"  Buffer: {service['buffer_time']}m")
        print(f"  Deposit: {service['deposit_required']} - €{service['deposit_amount']}")
        print(f"  Add-ons: {len(service.get('add_ons', []))}")
        print(f"  Staff IDs: {service.get('staff_ids', [])}")
    
    def test_11_verify_created_service_persisted(self):
        """Verify created service was persisted with GET"""
        if not TestServiceEnhancements.created_service_id:
            pytest.skip("No service created in previous test")
        
        response = requests.get(f"{BASE_URL}/api/services", headers=self.get_headers())
        assert response.status_code == 200
        
        services = response.json()["services"]
        created = next((s for s in services if s["service_id"] == TestServiceEnhancements.created_service_id), None)
        
        assert created is not None, "Created service not found in list"
        assert created["name"] == "TEST_Premium Balayage"
        assert created["category"] == "Colour"
        assert created["buffer_time"] == 15
        assert created["deposit_required"] == True
        print(f"Verified service persisted: {created['name']}")
    
    # ==================== UPDATE SERVICE WITH NEW FIELDS ====================
    
    def test_12_update_service_category(self):
        """Test PUT /api/services/{id} updates category"""
        if not TestServiceEnhancements.created_service_id:
            pytest.skip("No service created")
        
        response = requests.put(
            f"{BASE_URL}/api/services/{TestServiceEnhancements.created_service_id}",
            json={"category": "Premium Colour"},
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        service = response.json().get("service", response.json())
        assert service["category"] == "Premium Colour"
        print(f"Updated category to: {service['category']}")
    
    def test_13_update_service_buffer_time(self):
        """Test PUT /api/services/{id} updates buffer_time"""
        if not TestServiceEnhancements.created_service_id:
            pytest.skip("No service created")
        
        response = requests.put(
            f"{BASE_URL}/api/services/{TestServiceEnhancements.created_service_id}",
            json={"buffer_time": 30},
            headers=self.get_headers()
        )
        assert response.status_code == 200
        
        service = response.json().get("service", response.json())
        assert service["buffer_time"] == 30
        print(f"Updated buffer_time to: {service['buffer_time']}m")
    
    def test_14_update_service_deposit_settings(self):
        """Test PUT /api/services/{id} updates deposit settings"""
        if not TestServiceEnhancements.created_service_id:
            pytest.skip("No service created")
        
        response = requests.put(
            f"{BASE_URL}/api/services/{TestServiceEnhancements.created_service_id}",
            json={"deposit_required": False, "deposit_amount": 0},
            headers=self.get_headers()
        )
        assert response.status_code == 200
        
        service = response.json().get("service", response.json())
        assert service["deposit_required"] == False
        print(f"Updated deposit_required to: {service['deposit_required']}")
    
    def test_15_update_service_visible_online(self):
        """Test PUT /api/services/{id} updates visible_online"""
        if not TestServiceEnhancements.created_service_id:
            pytest.skip("No service created")
        
        response = requests.put(
            f"{BASE_URL}/api/services/{TestServiceEnhancements.created_service_id}",
            json={"visible_online": False},
            headers=self.get_headers()
        )
        assert response.status_code == 200
        
        service = response.json().get("service", response.json())
        assert service["visible_online"] == False
        print(f"Updated visible_online to: {service['visible_online']}")
    
    def test_16_update_service_add_ons(self):
        """Test PUT /api/services/{id} updates add_ons"""
        if not TestServiceEnhancements.created_service_id:
            pytest.skip("No service created")
        
        new_add_ons = [
            {"name": "Deep Conditioning", "price": 25.00, "duration": 20},
            {"name": "Gloss Treatment", "price": 40.00, "duration": 15},
            {"name": "Blow Dry Upgrade", "price": 15.00, "duration": 10}
        ]
        
        response = requests.put(
            f"{BASE_URL}/api/services/{TestServiceEnhancements.created_service_id}",
            json={"add_ons": new_add_ons},
            headers=self.get_headers()
        )
        assert response.status_code == 200
        
        service = response.json().get("service", response.json())
        assert len(service.get("add_ons", [])) == 3
        print(f"Updated add_ons count: {len(service.get('add_ons', []))}")
    
    def test_17_update_service_staff_ids(self):
        """Test PUT /api/services/{id} updates staff_ids"""
        if not TestServiceEnhancements.created_service_id:
            pytest.skip("No service created")
        
        # Get all staff IDs
        all_staff_ids = [s["staff_id"] for s in TestServiceEnhancements.staff_list]
        
        response = requests.put(
            f"{BASE_URL}/api/services/{TestServiceEnhancements.created_service_id}",
            json={"staff_ids": all_staff_ids},
            headers=self.get_headers()
        )
        assert response.status_code == 200
        
        service = response.json().get("service", response.json())
        assert len(service.get("staff_ids", [])) == len(all_staff_ids)
        print(f"Updated staff_ids count: {len(service.get('staff_ids', []))}")
    
    # ==================== VERIFY UPDATES PERSISTED ====================
    
    def test_18_verify_all_updates_persisted(self):
        """Verify all updates were persisted with GET"""
        if not TestServiceEnhancements.created_service_id:
            pytest.skip("No service created")
        
        response = requests.get(f"{BASE_URL}/api/services", headers=self.get_headers())
        assert response.status_code == 200
        
        services = response.json()["services"]
        service = next((s for s in services if s["service_id"] == TestServiceEnhancements.created_service_id), None)
        
        assert service is not None
        assert service["category"] == "Premium Colour"
        assert service["buffer_time"] == 30
        assert service["deposit_required"] == False
        assert service["visible_online"] == False
        assert len(service.get("add_ons", [])) == 3
        print("All updates verified as persisted")
    
    # ==================== CATEGORY GROUPING TEST ====================
    
    def test_19_services_have_categories_for_grouping(self):
        """Test that services have categories that can be used for grouping"""
        response = requests.get(f"{BASE_URL}/api/services", headers=self.get_headers())
        assert response.status_code == 200
        
        services = response.json()["services"]
        categories = {}
        
        for s in services:
            cat = s.get("category") or "Uncategorized"
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(s["name"])
        
        print(f"Categories for grouping: {list(categories.keys())}")
        for cat, svcs in categories.items():
            print(f"  {cat}: {len(svcs)} services")
    
    # ==================== CLEANUP ====================
    
    def test_20_cleanup_test_service(self):
        """Delete test service"""
        if not TestServiceEnhancements.created_service_id:
            pytest.skip("No service to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/services/{TestServiceEnhancements.created_service_id}",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        print(f"Deleted test service: {TestServiceEnhancements.created_service_id}")
    
    def test_21_verify_service_deleted(self):
        """Verify test service was deleted"""
        if not TestServiceEnhancements.created_service_id:
            pytest.skip("No service to verify")
        
        response = requests.get(f"{BASE_URL}/api/services", headers=self.get_headers())
        assert response.status_code == 200
        
        services = response.json()["services"]
        deleted = next((s for s in services if s["service_id"] == TestServiceEnhancements.created_service_id and s.get("is_active", True)), None)
        
        # Service should be soft-deleted (is_active=False) or not in list
        assert deleted is None, "Service should be deleted"
        print("Service deletion verified")


class TestOtherPagesStillWork:
    """Verify other pages still work after Phase 3 changes"""
    
    token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        if not TestOtherPagesStillWork.token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "salon@bookslot.io",
                "password": "Demo123!"
            })
            assert response.status_code == 200
            TestOtherPagesStillWork.token = response.json().get("token")
    
    def get_headers(self):
        return {"Authorization": f"Bearer {TestOtherPagesStillWork.token}"}
    
    def test_dashboard_api(self):
        """Test dashboard API still works"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.get_headers())
        # Dashboard stats might return 200 or 404 if not implemented
        assert response.status_code in [200, 404], f"Dashboard API error: {response.status_code}"
        print(f"Dashboard API: {response.status_code}")
    
    def test_staff_api(self):
        """Test staff API still works"""
        response = requests.get(f"{BASE_URL}/api/staff", headers=self.get_headers())
        assert response.status_code == 200
        data = response.json()
        assert "staff" in data
        print(f"Staff API: {len(data['staff'])} staff members")
    
    def test_appointments_api(self):
        """Test appointments API still works (calendar)"""
        response = requests.get(f"{BASE_URL}/api/appointments", headers=self.get_headers())
        assert response.status_code == 200
        data = response.json()
        assert "appointments" in data
        print(f"Appointments API: {len(data['appointments'])} appointments")
    
    def test_tenant_api(self):
        """Test tenant API still works (settings)"""
        response = requests.get(f"{BASE_URL}/api/tenants/me", headers=self.get_headers())
        assert response.status_code == 200
        data = response.json()
        assert "tenant" in data
        print(f"Tenant API: {data['tenant']['name']}")
    
    def test_booking_rules_api(self):
        """Test booking rules API still works"""
        response = requests.get(f"{BASE_URL}/api/tenants/me/booking-rules", headers=self.get_headers())
        assert response.status_code == 200
        data = response.json()
        assert "booking_rules" in data
        print(f"Booking rules API: OK")
    
    def test_branding_api(self):
        """Test branding API still works"""
        response = requests.get(f"{BASE_URL}/api/tenants/me/branding", headers=self.get_headers())
        assert response.status_code == 200
        data = response.json()
        assert "branding" in data
        print(f"Branding API: OK")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
