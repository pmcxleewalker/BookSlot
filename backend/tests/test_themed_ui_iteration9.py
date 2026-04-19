"""
Test Suite for Iteration 9: Vibrant Industry-Themed UI
Tests: Login, Dashboard themes, Calendar, Team page, Services, Appointments
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SALON_CREDS = {"email": "salon@bookslot.io", "password": "Demo123!"}
DENTIST_CREDS = {"email": "dentist@bookslot.io", "password": "Demo123!"}
VET_CREDS = {"email": "vet@bookslot.io", "password": "Demo123!"}
ADMIN_CREDS = {"email": "admin@bookslot.io", "password": "Admin123!"}


class TestTenantLogin:
    """Test login for all industry tenants"""
    
    def test_salon_login(self):
        """Salon tenant login returns token and user info"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SALON_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "salon@bookslot.io"
        print(f"PASS: Salon login successful - user: {data['user']['name']}")
    
    def test_dentist_login(self):
        """Dentist tenant login returns token and user info"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DENTIST_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "dentist@bookslot.io"
        print(f"PASS: Dentist login successful - user: {data['user']['name']}")
    
    def test_vet_login(self):
        """Vet tenant login returns token and user info"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VET_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "vet@bookslot.io"
        print(f"PASS: Vet login successful - user: {data['user']['name']}")


class TestTenantIndustryThemes:
    """Test tenant industry configuration"""
    
    @pytest.fixture
    def salon_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SALON_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def dentist_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DENTIST_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def vet_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VET_CREDS)
        return response.json()["token"]
    
    def test_salon_industry_is_salon(self, salon_token):
        """Salon tenant has industry=salon"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/me",
            headers={"Authorization": f"Bearer {salon_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tenant"]["industry"] == "salon"
        assert data["tenant"]["name"] == "Bella Hair Studio"
        print(f"PASS: Salon industry verified - {data['tenant']['name']}")
    
    def test_dentist_industry_is_dentist(self, dentist_token):
        """Dentist tenant has industry=dentist"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/me",
            headers={"Authorization": f"Bearer {dentist_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tenant"]["industry"] == "dentist"
        assert data["tenant"]["name"] == "Bright Smile Dental"
        print(f"PASS: Dentist industry verified - {data['tenant']['name']}")
    
    def test_vet_industry_is_vet(self, vet_token):
        """Vet tenant has industry=vet"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/me",
            headers={"Authorization": f"Bearer {vet_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tenant"]["industry"] == "vet"
        assert data["tenant"]["name"] == "Happy Paws Vet Clinic"
        print(f"PASS: Vet industry verified - {data['tenant']['name']}")


class TestStaffEndpoints:
    """Test staff CRUD for each tenant"""
    
    @pytest.fixture
    def salon_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SALON_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def dentist_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DENTIST_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def vet_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VET_CREDS)
        return response.json()["token"]
    
    def test_salon_has_3_staff(self, salon_token):
        """Salon has 3 staff members (Stylists)"""
        response = requests.get(
            f"{BASE_URL}/api/staff",
            headers={"Authorization": f"Bearer {salon_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["staff"]) == 3
        staff_names = [s["name"] for s in data["staff"]]
        assert "Sarah Mitchell" in staff_names
        print(f"PASS: Salon has 3 staff - {staff_names}")
    
    def test_dentist_has_3_staff(self, dentist_token):
        """Dentist has 3 staff members (Practitioners)"""
        response = requests.get(
            f"{BASE_URL}/api/staff",
            headers={"Authorization": f"Bearer {dentist_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["staff"]) == 3
        staff_names = [s["name"] for s in data["staff"]]
        assert "Dr. James Chen" in staff_names
        print(f"PASS: Dentist has 3 staff - {staff_names}")
    
    def test_vet_has_3_staff(self, vet_token):
        """Vet has 3 staff members (Vets)"""
        response = requests.get(
            f"{BASE_URL}/api/staff",
            headers={"Authorization": f"Bearer {vet_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["staff"]) == 3
        staff_names = [s["name"] for s in data["staff"]]
        assert "Dr. Amy Brooks" in staff_names
        print(f"PASS: Vet has 3 staff - {staff_names}")


class TestServicesEndpoints:
    """Test services for each tenant"""
    
    @pytest.fixture
    def salon_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SALON_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def dentist_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DENTIST_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def vet_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VET_CREDS)
        return response.json()["token"]
    
    def test_salon_has_7_services(self, salon_token):
        """Salon has 7 services with duration and price"""
        response = requests.get(
            f"{BASE_URL}/api/services",
            headers={"Authorization": f"Bearer {salon_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["services"]) == 7
        # Check service has duration and price
        service = data["services"][0]
        assert "duration" in service
        assert "price" in service
        print(f"PASS: Salon has 7 services with duration/price")
    
    def test_dentist_has_7_services(self, dentist_token):
        """Dentist has 7 services (Procedures)"""
        response = requests.get(
            f"{BASE_URL}/api/services",
            headers={"Authorization": f"Bearer {dentist_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["services"]) == 7
        print(f"PASS: Dentist has 7 services")
    
    def test_vet_has_7_services(self, vet_token):
        """Vet has 7 services"""
        response = requests.get(
            f"{BASE_URL}/api/services",
            headers={"Authorization": f"Bearer {vet_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["services"]) == 7
        print(f"PASS: Vet has 7 services")


class TestAppointmentsEndpoints:
    """Test appointments for each tenant"""
    
    @pytest.fixture
    def salon_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SALON_CREDS)
        return response.json()["token"]
    
    def test_salon_has_appointments_today(self, salon_token):
        """Salon has appointments for today"""
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/appointments",
            params={"start_date": today, "end_date": f"{today}T23:59:59"},
            headers={"Authorization": f"Bearer {salon_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "appointments" in data
        assert len(data["appointments"]) >= 1
        print(f"PASS: Salon has {len(data['appointments'])} appointments today")
    
    def test_salon_has_pending_appointments(self, salon_token):
        """Salon has pending appointments for approval"""
        response = requests.get(
            f"{BASE_URL}/api/appointments",
            params={"status": "pending"},
            headers={"Authorization": f"Bearer {salon_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "appointments" in data
        print(f"PASS: Salon has {len(data['appointments'])} pending appointments")


class TestSuperAdminLogin:
    """Test super admin login"""
    
    def test_admin_login(self):
        """Super admin login returns token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json=ADMIN_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "admin" in data
        assert data["admin"]["email"] == "admin@bookslot.io"
        print(f"PASS: Super admin login successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
