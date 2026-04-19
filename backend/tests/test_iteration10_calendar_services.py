"""
Iteration 10 Tests: Week Time-Grid Calendar, Industry-Specific Services, Staff Avatar Filtering
Tests the new calendar features and 12 services per industry requirement
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CREDENTIALS = {
    "salon": {"email": "salon@bookslot.io", "password": "Demo123!"},
    "dentist": {"email": "dentist@bookslot.io", "password": "Demo123!"},
    "vet": {"email": "vet@bookslot.io", "password": "Demo123!"},
    "admin": {"email": "admin@bookslot.io", "password": "Admin123!"}
}

# Expected services per industry (12 each)
EXPECTED_SALON_SERVICES = [
    "Women's Cut & Blow Dry", "Men's Cut & Style", "Full Head Colour", 
    "Highlights (Half Head)", "Balayage / Ombre", "Blow Dry & Finish",
    "Deep Conditioning Treatment", "Bridal Hair Trial", "Keratin Smoothing",
    "Scalp Treatment", "Kids Cut (Under 12)", "Beard Trim & Shape"
]

EXPECTED_DENTIST_SERVICES = [
    "Routine Check-up & Exam", "Scale & Polish", "Composite Filling",
    "Root Canal Treatment", "Crown Fitting", "Professional Whitening",
    "Emergency Consultation", "Wisdom Tooth Extraction", "Dental X-Ray (Full Mouth)",
    "Invisalign Consultation", "Veneer Fitting (per tooth)", "Kids Dental Check-up"
]

EXPECTED_VET_SERVICES = [
    "Wellness Exam (Dog)", "Wellness Exam (Cat)", "Puppy Vaccination Pack",
    "Kitten Vaccination Pack", "Annual Booster (Dog)", "Annual Booster (Cat)",
    "Dental Cleaning", "Spay / Neuter Consultation", "X-Ray & Imaging",
    "Emergency Visit", "Microchip Implant", "Nail Trim & Ear Clean"
]


class TestAuthentication:
    """Test login for all tenant types"""
    
    def test_salon_login(self):
        """Salon owner can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["salon"])
        assert response.status_code == 200, f"Salon login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["email"] == "salon@bookslot.io"
        
    def test_dentist_login(self):
        """Dentist owner can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["dentist"])
        assert response.status_code == 200, f"Dentist login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["email"] == "dentist@bookslot.io"
        
    def test_vet_login(self):
        """Vet owner can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["vet"])
        assert response.status_code == 200, f"Vet login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["email"] == "vet@bookslot.io"
        
    def test_super_admin_login(self):
        """Super admin can login via /api/admin/login"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json=CREDENTIALS["admin"])
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data


class TestIndustrySpecificServices:
    """Test that each industry has exactly 12 specific services"""
    
    @pytest.fixture
    def salon_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["salon"])
        return response.json()["token"]
    
    @pytest.fixture
    def dentist_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["dentist"])
        return response.json()["token"]
    
    @pytest.fixture
    def vet_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["vet"])
        return response.json()["token"]
    
    def test_salon_has_12_services(self, salon_token):
        """Salon has exactly 12 industry-specific services"""
        response = requests.get(
            f"{BASE_URL}/api/services",
            headers={"Authorization": f"Bearer {salon_token}"}
        )
        assert response.status_code == 200
        services = response.json()["services"]
        assert len(services) == 12, f"Expected 12 salon services, got {len(services)}"
        
        service_names = [s["name"] for s in services]
        for expected in EXPECTED_SALON_SERVICES:
            assert expected in service_names, f"Missing salon service: {expected}"
    
    def test_dentist_has_12_services(self, dentist_token):
        """Dentist has exactly 12 industry-specific services"""
        response = requests.get(
            f"{BASE_URL}/api/services",
            headers={"Authorization": f"Bearer {dentist_token}"}
        )
        assert response.status_code == 200
        services = response.json()["services"]
        assert len(services) == 12, f"Expected 12 dentist services, got {len(services)}"
        
        service_names = [s["name"] for s in services]
        for expected in EXPECTED_DENTIST_SERVICES:
            assert expected in service_names, f"Missing dentist service: {expected}"
    
    def test_vet_has_12_services(self, vet_token):
        """Vet has exactly 12 industry-specific services"""
        response = requests.get(
            f"{BASE_URL}/api/services",
            headers={"Authorization": f"Bearer {vet_token}"}
        )
        assert response.status_code == 200
        services = response.json()["services"]
        assert len(services) == 12, f"Expected 12 vet services, got {len(services)}"
        
        service_names = [s["name"] for s in services]
        for expected in EXPECTED_VET_SERVICES:
            assert expected in service_names, f"Missing vet service: {expected}"


class TestStaffEndpoints:
    """Test staff endpoints for calendar staff avatar row"""
    
    @pytest.fixture
    def salon_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["salon"])
        return response.json()["token"]
    
    def test_get_staff_list(self, salon_token):
        """Can retrieve staff list for avatar row"""
        response = requests.get(
            f"{BASE_URL}/api/staff",
            headers={"Authorization": f"Bearer {salon_token}"}
        )
        assert response.status_code == 200
        staff = response.json()["staff"]
        assert len(staff) >= 3, f"Expected at least 3 staff, got {len(staff)}"
        
        # Verify staff have required fields for avatar display
        for s in staff:
            assert "staff_id" in s
            assert "name" in s
            assert s["name"], "Staff name should not be empty"


class TestAppointmentsForCalendar:
    """Test appointment endpoints for week time-grid calendar"""
    
    @pytest.fixture
    def salon_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["salon"])
        return response.json()["token"]
    
    def test_get_appointments_with_date_range(self, salon_token):
        """Can retrieve appointments for week view"""
        # Get appointments for current week
        today = datetime.now()
        start_date = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")
        end_date = (today + timedelta(days=6-today.weekday())).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/appointments",
            params={"start_date": start_date, "end_date": end_date},
            headers={"Authorization": f"Bearer {salon_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "appointments" in data
        
    def test_appointments_have_required_fields(self, salon_token):
        """Appointments have fields needed for calendar display"""
        response = requests.get(
            f"{BASE_URL}/api/appointments",
            params={"start_date": "2026-01-01", "end_date": "2026-12-31"},
            headers={"Authorization": f"Bearer {salon_token}"}
        )
        assert response.status_code == 200
        appointments = response.json()["appointments"]
        
        if appointments:
            appt = appointments[0]
            # Required fields for calendar block display
            assert "appointment_id" in appt
            assert "start_time" in appt
            assert "end_time" in appt
            assert "status" in appt
            assert "staff_id" in appt
            assert "client_name" in appt or "client_id" in appt
    
    def test_filter_appointments_by_status(self, salon_token):
        """Can filter appointments by pending status for approval section"""
        response = requests.get(
            f"{BASE_URL}/api/appointments",
            params={"status": "pending"},
            headers={"Authorization": f"Bearer {salon_token}"}
        )
        assert response.status_code == 200
        appointments = response.json()["appointments"]
        
        # All returned appointments should be pending
        for appt in appointments:
            assert appt["status"] == "pending", f"Expected pending, got {appt['status']}"


class TestAppointmentApproval:
    """Test approve/reject functionality for pending approvals section"""
    
    @pytest.fixture
    def salon_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["salon"])
        return response.json()["token"]
    
    def test_approve_endpoint_exists(self, salon_token):
        """Approve endpoint is accessible"""
        # Try to approve a non-existent appointment - should return 404, not 500
        response = requests.post(
            f"{BASE_URL}/api/appointments/fake_id/approve",
            headers={"Authorization": f"Bearer {salon_token}"}
        )
        # 404 means endpoint exists but appointment not found
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
    
    def test_reject_endpoint_exists(self, salon_token):
        """Reject endpoint is accessible"""
        response = requests.post(
            f"{BASE_URL}/api/appointments/fake_id/reject",
            headers={"Authorization": f"Bearer {salon_token}"}
        )
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"


class TestTenantThemes:
    """Test tenant data includes industry for theming"""
    
    @pytest.fixture
    def salon_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["salon"])
        return response.json()["token"]
    
    @pytest.fixture
    def dentist_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["dentist"])
        return response.json()["token"]
    
    @pytest.fixture
    def vet_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CREDENTIALS["vet"])
        return response.json()["token"]
    
    def test_salon_tenant_has_industry(self, salon_token):
        """Salon tenant has industry field for theming"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/me",
            headers={"Authorization": f"Bearer {salon_token}"}
        )
        assert response.status_code == 200
        tenant = response.json()["tenant"]
        assert tenant["industry"] == "salon"
    
    def test_dentist_tenant_has_industry(self, dentist_token):
        """Dentist tenant has industry field for theming"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/me",
            headers={"Authorization": f"Bearer {dentist_token}"}
        )
        assert response.status_code == 200
        tenant = response.json()["tenant"]
        assert tenant["industry"] == "dentist"
    
    def test_vet_tenant_has_industry(self, vet_token):
        """Vet tenant has industry field for theming"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/me",
            headers={"Authorization": f"Bearer {vet_token}"}
        )
        assert response.status_code == 200
        tenant = response.json()["tenant"]
        assert tenant["industry"] == "vet"


class TestSuperAdminDashboard:
    """Test super admin endpoints still work"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", json=CREDENTIALS["admin"])
        return response.json()["token"]
    
    def test_admin_can_list_tenants(self, admin_token):
        """Super admin can list all tenants"""
        response = requests.get(
            f"{BASE_URL}/api/admin/tenants",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        tenants = response.json()["tenants"]
        assert len(tenants) >= 3, "Should have at least 3 tenants (salon, dentist, vet)"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
