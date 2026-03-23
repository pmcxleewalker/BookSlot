#!/usr/bin/env python3
"""
Backend API Testing for TimeSlot Pro
Tests all API endpoints for functionality and integration
"""
import requests
import sys
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

class TimeSlotProAPITester:
    def __init__(self, base_url: str = "https://timeslot-pro-launch.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = None
        self.user_data = None
        self.tenant_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, headers: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
            
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - {name}")
            else:
                print(f"❌ FAILED - {name} - Expected {expected_status}, got {response.status_code}")
                if response.text:
                    print(f"   Response: {response.text[:200]}")
                self.failed_tests.append(f"{name}: Expected {expected_status}, got {response.status_code}")

            try:
                response_data = response.json() if response.text else {}
            except:
                response_data = {"raw_response": response.text}
                
            return success, response_data

        except Exception as e:
            print(f"❌ FAILED - {name} - Error: {str(e)}")
            self.failed_tests.append(f"{name}: {str(e)}")
            return False, {}

    def test_health_check(self) -> bool:
        """Test API health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET", 
            "health",
            200
        )
        return success

    def test_user_registration(self, name: str, email: str, password: str) -> bool:
        """Test user registration"""
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "name": name,
                "email": email, 
                "password": password
            }
        )
        
        if success and 'session_token' in response:
            self.session_token = response['session_token']
            self.user_data = response
            print(f"   Registered user: {response.get('email')}")
            
        return success

    def test_user_login(self, email: str, password: str) -> bool:
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login", 
            200,
            data={
                "email": email,
                "password": password
            }
        )
        
        if success and 'session_token' in response:
            self.session_token = response['session_token']
            self.user_data = response
            print(f"   Logged in user: {response.get('email')}")
            
        return success

    def test_get_current_user(self) -> bool:
        """Test get current user endpoint"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        if success:
            self.user_data = response
            
        return success

    def test_create_business(self, business_data: Dict) -> bool:
        """Test business creation during onboarding"""
        success, response = self.run_test(
            "Create Business",
            "POST",
            "onboarding/create-business",
            200,
            data=business_data
        )
        
        if success:
            self.tenant_data = response
            print(f"   Created business: {response.get('slug')}")
            
        return success

    def test_get_industry_template(self, industry: str) -> bool:
        """Test getting industry template"""
        success, response = self.run_test(
            f"Get Industry Template - {industry}",
            "GET",
            f"onboarding/industry-templates/{industry}",
            200
        )
        return success

    def test_apply_template(self, services: list) -> bool:
        """Test applying industry template services"""
        success, response = self.run_test(
            "Apply Industry Template",
            "POST",
            "onboarding/apply-template",
            200,
            data={"services": services}
        )
        return success

    def test_staff_management(self) -> bool:
        """Test staff CRUD operations"""
        # List staff
        success1, staff_list = self.run_test(
            "List Staff",
            "GET",
            "staff",
            200
        )
        
        # Create staff
        staff_data = {
            "name": "Test Staff Member",
            "email": "staff@test.com",
            "phone": "+1234567890",
            "title": "Stylist",
            "color": "#FF5733"
        }
        
        success2, created_staff = self.run_test(
            "Create Staff",
            "POST", 
            "staff",
            200,
            data=staff_data
        )
        
        staff_id = None
        if success2 and 'staff_id' in created_staff:
            staff_id = created_staff['staff_id']
            
            # Get staff details
            success3, staff_details = self.run_test(
                "Get Staff Details",
                "GET",
                f"staff/{staff_id}",
                200
            )
            
            # Update staff
            success4, _ = self.run_test(
                "Update Staff",
                "PUT",
                f"staff/{staff_id}",
                200,
                data={"title": "Senior Stylist"}
            )
            
            return success1 and success2 and success3 and success4
            
        return success1 and success2

    def test_services_management(self) -> bool:
        """Test services CRUD operations"""
        # List services
        success1, services_list = self.run_test(
            "List Services",
            "GET",
            "services",
            200
        )
        
        # Create service
        service_data = {
            "name": "Test Haircut",
            "description": "Basic haircut service",
            "duration": 30,
            "price": 35.0,
            "color": "#2E473B"
        }
        
        success2, created_service = self.run_test(
            "Create Service",
            "POST",
            "services", 
            200,
            data=service_data
        )
        
        service_id = None
        if success2 and 'service_id' in created_service:
            service_id = created_service['service_id']
            
            # Get service details
            success3, service_details = self.run_test(
                "Get Service Details",
                "GET",
                f"services/{service_id}",
                200
            )
            
            # Update service
            success4, _ = self.run_test(
                "Update Service",
                "PUT",
                f"services/{service_id}",
                200,
                data={"price": 40.0}
            )
            
            return success1 and success2 and success3 and success4
            
        return success1 and success2

    def test_appointments_management(self) -> bool:
        """Test appointments CRUD operations"""
        # List appointments
        success1, appointments_list = self.run_test(
            "List Appointments",
            "GET",
            "appointments",
            200
        )
        
        # Get staff and services for appointment creation
        _, staff_list = self.run_test("Get Staff for Appointment", "GET", "staff", 200)
        _, services_list = self.run_test("Get Services for Appointment", "GET", "services", 200)
        
        if not staff_list or not services_list:
            print("⚠️  No staff or services available for appointment test")
            return success1
            
        staff_id = staff_list[0]['staff_id'] if staff_list else None
        service_id = services_list[0]['service_id'] if services_list else None
        
        if not staff_id or not service_id:
            print("⚠️  Missing staff_id or service_id for appointment test")
            return success1
            
        # Create appointment
        appointment_data = {
            "staff_id": staff_id,
            "service_id": service_id,
            "start_time": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "client_name": "Test Client",
            "client_email": "client@test.com",
            "client_phone": "+1234567890",
            "notes": "Test appointment"
        }
        
        success2, created_appointment = self.run_test(
            "Create Appointment",
            "POST",
            "appointments",
            200,
            data=appointment_data
        )
        
        appointment_id = None
        if success2 and 'appointment_id' in created_appointment:
            appointment_id = created_appointment['appointment_id']
            
            # Get appointment details
            success3, appointment_details = self.run_test(
                "Get Appointment Details",
                "GET",
                f"appointments/{appointment_id}",
                200
            )
            
            return success1 and success2 and success3
            
        return success1 and success2

    def test_dashboard_endpoints(self) -> bool:
        """Test dashboard related endpoints"""
        success1, stats = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        success2, upcoming = self.run_test(
            "Get Upcoming Appointments",
            "GET",
            "dashboard/upcoming",
            200
        )
        
        return success1 and success2

    def test_public_endpoints(self) -> bool:
        """Test public booking endpoints"""
        if not self.tenant_data or not self.tenant_data.get('slug'):
            print("⚠️  No tenant slug available for public endpoint tests")
            return False
            
        tenant_slug = self.tenant_data['slug']
        
        # Test public services
        success1, public_services = self.run_test(
            "Get Public Services",
            "GET",
            f"public/{tenant_slug}/services",
            200
        )
        
        # Test public staff
        success2, public_staff = self.run_test(
            "Get Public Staff",
            "GET",
            f"public/{tenant_slug}/staff",
            200
        )
        
        return success1 and success2

    def test_settings_endpoints(self) -> bool:
        """Test settings endpoints"""
        success1, business_settings = self.run_test(
            "Get Business Settings",
            "GET",
            "settings/business",
            200
        )
        
        success2, subscription = self.run_test(
            "Get Subscription",
            "GET",
            "subscription",
            200
        )
        
        return success1 and success2

    def test_integrations_endpoints(self) -> bool:
        """Test integrations endpoints"""
        success1, webhooks = self.run_test(
            "List Webhooks",
            "GET",
            "webhooks",
            200
        )
        
        success2, api_keys = self.run_test(
            "List API Keys",
            "GET",
            "api-keys",
            200
        )
        
        success3, webhook_events = self.run_test(
            "List Webhook Events",
            "GET",
            "webhooks/events",
            200
        )
        
        return success1 and success2 and success3

    def run_all_tests(self) -> bool:
        """Run comprehensive API test suite"""
        print("🚀 Starting TimeSlot Pro API Test Suite")
        print(f"   Base URL: {self.base_url}")
        print("=" * 60)
        
        # Generate test data
        timestamp = datetime.now().strftime("%H%M%S")
        test_email = f"test_{timestamp}@example.com"
        test_password = "TestPass123!"
        test_name = f"Test User {timestamp}"
        
        # Test sequence
        tests = [
            ("Health Check", self.test_health_check),
            ("User Registration", lambda: self.test_user_registration(test_name, test_email, test_password)),
            ("Get Current User", self.test_get_current_user),
            ("Create Business", lambda: self.test_create_business({
                "name": f"Test Business {timestamp}",
                "industry": "salon",
                "email": test_email,
                "phone": "+1234567890",
                "timezone": "Europe/London"
            })),
            ("Industry Template", lambda: self.test_get_industry_template("salon")),
            ("Apply Template", lambda: self.test_apply_template([
                {"name": "Haircut", "duration": 30, "price": 35},
                {"name": "Hair Color", "duration": 90, "price": 85}
            ])),
            ("Staff Management", self.test_staff_management),
            ("Services Management", self.test_services_management),
            ("Appointments Management", self.test_appointments_management),
            ("Dashboard Endpoints", self.test_dashboard_endpoints),
            ("Public Endpoints", self.test_public_endpoints),
            ("Settings Endpoints", self.test_settings_endpoints),
            ("Integrations Endpoints", self.test_integrations_endpoints),
        ]
        
        for test_name, test_func in tests:
            print(f"\n📋 Running {test_name} Tests...")
            try:
                success = test_func()
                if not success:
                    print(f"⚠️  Some {test_name} tests failed")
            except Exception as e:
                print(f"❌ {test_name} test suite failed: {str(e)}")
                self.failed_tests.append(f"{test_name}: {str(e)}")
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for failure in self.failed_tests:
                print(f"   • {failure}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = TimeSlotProAPITester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Test suite crashed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())