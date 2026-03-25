import requests
import sys
import json
from datetime import datetime, timezone
import uuid

class BookSlotAPITester:
    def __init__(self, base_url="https://bookslot-preview.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tenant_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}")
                try:
                    return False, response.json()
                except:
                    return False, {"error": response.text}

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration"""
        timestamp = int(datetime.now().timestamp())
        test_user = {
            "name": f"Test User {timestamp}",
            "email": f"test.user.{timestamp}@example.com",
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user
        )
        
        if success and 'user' in response and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['user_id']
            return True, test_user
        return False, {}

    def test_user_login(self, email, password):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        
        if success and 'user' in response and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['user_id']
            return True
        return False

    def test_get_current_user(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success and 'user_id' in response

    def test_create_tenant(self):
        """Test tenant creation"""
        tenant_data = {
            "name": f"Test Business {int(datetime.now().timestamp())}",
            "industry": "salon",
            "email": f"business.{int(datetime.now().timestamp())}@example.com",
            "phone": "+353 1 234 5678",
            "address": "123 Test Street, Dublin"
        }
        
        success, response = self.run_test(
            "Create Tenant",
            "POST",
            "tenants",
            200,
            data=tenant_data
        )
        
        if success and 'tenant' in response:
            self.tenant_id = response['tenant']['tenant_id']
            return True
        return False

    def test_get_tenant(self):
        """Test get tenant"""
        success, response = self.run_test(
            "Get Tenant",
            "GET",
            "tenants/me",
            200
        )
        return success and response.get('tenant') is not None

    def test_complete_onboarding(self):
        """Test complete onboarding"""
        success, response = self.run_test(
            "Complete Onboarding",
            "POST",
            "tenants/me/complete-onboarding",
            200
        )
        return success

    def test_create_staff(self):
        """Test staff creation"""
        staff_data = {
            "name": "Test Staff Member",
            "email": f"staff.{int(datetime.now().timestamp())}@example.com",
            "title": "Senior Stylist",
            "color": "#E34A33"
        }
        
        success, response = self.run_test(
            "Create Staff",
            "POST",
            "staff",
            200,
            data=staff_data
        )
        
        if success and 'staff' in response:
            return True, response['staff']['staff_id']
        return False, None

    def test_get_staff(self):
        """Test get staff"""
        success, response = self.run_test(
            "Get Staff",
            "GET",
            "staff",
            200
        )
        return success and 'staff' in response

    def test_create_service(self):
        """Test service creation"""
        service_data = {
            "name": "Test Service",
            "description": "A test service",
            "duration": 60,
            "price": 100.0,
            "color": "#4F46E5"
        }
        
        success, response = self.run_test(
            "Create Service",
            "POST",
            "services",
            200,
            data=service_data
        )
        
        if success and 'service' in response:
            return True, response['service']['service_id']
        return False, None

    def test_get_services(self):
        """Test get services"""
        success, response = self.run_test(
            "Get Services",
            "GET",
            "services",
            200
        )
        return success and 'services' in response

    def test_create_client(self):
        """Test client creation"""
        client_data = {
            "name": "Test Client",
            "email": f"client.{int(datetime.now().timestamp())}@example.com",
            "phone": "+353 1 234 5678"
        }
        
        success, response = self.run_test(
            "Create Client",
            "POST",
            "clients",
            200,
            data=client_data
        )
        
        if success and 'client' in response:
            return True, response['client']['client_id']
        return False, None

    def test_get_clients(self):
        """Test get clients"""
        success, response = self.run_test(
            "Get Clients",
            "GET",
            "clients",
            200
        )
        return success and 'clients' in response

    def test_create_appointment(self, service_id, staff_id, client_id=None):
        """Test appointment creation"""
        start_time = datetime.now(timezone.utc).replace(hour=14, minute=0, second=0, microsecond=0)
        end_time = start_time.replace(hour=15)
        
        appt_data = {
            "service_id": service_id,
            "staff_id": staff_id,
            "client_id": client_id,
            "client_name": "Test Client",
            "client_email": "test.client@example.com",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "notes": "Test appointment"
        }
        
        success, response = self.run_test(
            "Create Appointment",
            "POST",
            "appointments",
            200,
            data=appt_data
        )
        
        if success and 'appointment' in response:
            return True, response['appointment']['appointment_id']
        return False, None

    def test_get_appointments(self):
        """Test get appointments"""
        success, response = self.run_test(
            "Get Appointments",
            "GET",
            "appointments",
            200
        )
        return success and 'appointments' in response

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "reports/dashboard",
            200
        )
        return success and 'stats' in response

    def test_public_booking_page(self, booking_slug):
        """Test public booking page"""
        success, response = self.run_test(
            "Public Booking Page",
            "GET",
            f"public/booking/{booking_slug}",
            200
        )
        return success and 'tenant' in response and 'services' in response

    def test_seed_demo_data(self):
        """Test seeding demo data"""
        success, response = self.run_test(
            "Seed Demo Data",
            "POST",
            "demo/seed",
            200
        )
        return success

    def run_full_test_suite(self):
        """Run complete test suite"""
        print("🚀 Starting BookSlot API Test Suite")
        print("=" * 50)
        
        # Test user registration and authentication
        reg_success, test_user = self.test_user_registration()
        if not reg_success:
            print("❌ Registration failed, stopping tests")
            return self.get_results()
        
        # Test authentication endpoints
        if not self.test_get_current_user():
            print("❌ Auth verification failed")
            return self.get_results()
        
        # Test tenant creation and onboarding
        if not self.test_create_tenant():
            print("❌ Tenant creation failed")
            return self.get_results()
        
        if not self.test_get_tenant():
            print("❌ Get tenant failed")
            return self.get_results()
        
        if not self.test_complete_onboarding():
            print("❌ Complete onboarding failed")
            return self.get_results()
        
        # Test staff management
        staff_success, staff_id = self.test_create_staff()
        if not staff_success:
            print("❌ Staff creation failed")
            return self.get_results()
        
        if not self.test_get_staff():
            print("❌ Get staff failed")
            return self.get_results()
        
        # Test service management
        service_success, service_id = self.test_create_service()
        if not service_success:
            print("❌ Service creation failed")
            return self.get_results()
        
        if not self.test_get_services():
            print("❌ Get services failed")
            return self.get_results()
        
        # Test client management
        client_success, client_id = self.test_create_client()
        if not client_success:
            print("❌ Client creation failed")
            return self.get_results()
        
        if not self.test_get_clients():
            print("❌ Get clients failed")
            return self.get_results()
        
        # Test appointment management
        if staff_id and service_id:
            appt_success, appt_id = self.test_create_appointment(service_id, staff_id, client_id)
            if not appt_success:
                print("❌ Appointment creation failed")
                return self.get_results()
            
            if not self.test_get_appointments():
                print("❌ Get appointments failed")
                return self.get_results()
        
        # Test dashboard and reporting
        if not self.test_dashboard_stats():
            print("❌ Dashboard stats failed")
            return self.get_results()
        
        # Test demo data seeding
        if not self.test_seed_demo_data():
            print("❌ Demo data seeding failed")
            return self.get_results()
        
        # Test public booking page (if tenant has booking slug)
        if hasattr(self, 'tenant_id'):
            # Get tenant info to check booking slug
            success, tenant_response = self.run_test(
                "Get Tenant for Booking Test",
                "GET",
                "tenants/me",
                200
            )
            if success and tenant_response.get('tenant', {}).get('booking_url_slug'):
                booking_slug = tenant_response['tenant']['booking_url_slug']
                if not self.test_public_booking_page(booking_slug):
                    print("❌ Public booking page failed")
        
        return self.get_results()

    def get_results(self):
        """Get test results summary"""
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed")
            return 1

def main():
    tester = BookSlotAPITester()
    return tester.run_full_test_suite()

if __name__ == "__main__":
    sys.exit(main())