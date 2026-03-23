"""
Test Staff Schedule and Holidays Management APIs
Tests for:
- Staff schedule editing (PUT /api/staff/{staff_id}/schedule)
- Holiday CRUD operations (GET/POST/PUT/DELETE /api/holidays)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "finaltest1774305517@example.com"
TEST_PASSWORD = "Password123!"


class TestStaffScheduleAndHolidays:
    """Test staff schedule and holidays management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        login_data = login_response.json()
        self.tenant_id = login_data.get("tenant_id")
        self.user_id = login_data.get("user_id")
        
        # Store session cookie
        if "session_token" in login_data:
            self.session.cookies.set("session_token", login_data["session_token"])
        
        print(f"Logged in as {TEST_EMAIL}, tenant_id: {self.tenant_id}")
        yield
    
    # ==================
    # Staff Schedule Tests
    # ==================
    
    def test_get_staff_list(self):
        """Test getting staff list to find a staff member for schedule testing"""
        response = self.session.get(f"{BASE_URL}/api/staff")
        assert response.status_code == 200, f"Failed to get staff: {response.text}"
        
        staff_list = response.json()
        assert isinstance(staff_list, list), "Staff list should be an array"
        print(f"Found {len(staff_list)} staff members")
        
        if len(staff_list) > 0:
            print(f"First staff: {staff_list[0].get('name')} (ID: {staff_list[0].get('staff_id')})")
        
        return staff_list
    
    def test_get_staff_with_schedule(self):
        """Test getting individual staff member with schedule"""
        # First get staff list
        staff_list = self.test_get_staff_list()
        if not staff_list:
            pytest.skip("No staff members found")
        
        staff_id = staff_list[0].get("staff_id")
        response = self.session.get(f"{BASE_URL}/api/staff/{staff_id}")
        
        assert response.status_code == 200, f"Failed to get staff: {response.text}"
        
        staff_data = response.json()
        assert "staff_id" in staff_data, "Response should contain staff_id"
        assert "name" in staff_data, "Response should contain name"
        
        # Check if schedule is included
        if "schedule" in staff_data:
            print(f"Staff has schedule data: {staff_data['schedule']}")
        else:
            print("Staff has no schedule data yet (expected for new staff)")
        
        return staff_data
    
    def test_update_staff_schedule(self):
        """Test updating staff working hours (PUT /api/staff/{staff_id}/schedule)"""
        # Get staff list
        staff_list = self.test_get_staff_list()
        if not staff_list:
            pytest.skip("No staff members found")
        
        staff_id = staff_list[0].get("staff_id")
        
        # Create schedule with all 7 days
        working_hours = [
            {"day_of_week": 0, "start_time": "09:00", "end_time": "17:00", "is_working": True},  # Monday
            {"day_of_week": 1, "start_time": "09:00", "end_time": "17:00", "is_working": True},  # Tuesday
            {"day_of_week": 2, "start_time": "10:00", "end_time": "18:00", "is_working": True},  # Wednesday
            {"day_of_week": 3, "start_time": "09:00", "end_time": "17:00", "is_working": True},  # Thursday
            {"day_of_week": 4, "start_time": "09:00", "end_time": "16:00", "is_working": True},  # Friday
            {"day_of_week": 5, "start_time": "10:00", "end_time": "14:00", "is_working": False}, # Saturday
            {"day_of_week": 6, "start_time": "10:00", "end_time": "14:00", "is_working": False}, # Sunday
        ]
        
        response = self.session.put(
            f"{BASE_URL}/api/staff/{staff_id}/schedule",
            json={"working_hours": working_hours}
        )
        
        assert response.status_code == 200, f"Failed to update schedule: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        assert data["message"] == "Schedule updated", f"Unexpected message: {data['message']}"
        
        print(f"Successfully updated schedule for staff {staff_id}")
        
        # Verify by getting staff again
        verify_response = self.session.get(f"{BASE_URL}/api/staff/{staff_id}")
        assert verify_response.status_code == 200
        
        staff_data = verify_response.json()
        if "schedule" in staff_data and staff_data["schedule"]:
            schedule = staff_data["schedule"]
            if "working_hours" in schedule:
                print(f"Verified schedule has {len(schedule['working_hours'])} days")
        
        return True
    
    # ==================
    # Holiday Tests
    # ==================
    
    def test_list_holidays(self):
        """Test listing holidays (GET /api/holidays)"""
        current_year = datetime.now().year
        response = self.session.get(f"{BASE_URL}/api/holidays?year={current_year}")
        
        assert response.status_code == 200, f"Failed to list holidays: {response.text}"
        
        holidays = response.json()
        assert isinstance(holidays, list), "Holidays should be an array"
        print(f"Found {len(holidays)} holidays for {current_year}")
        
        return holidays
    
    def test_create_holiday(self):
        """Test creating a holiday (POST /api/holidays)"""
        # Create a test holiday for next month
        next_month = datetime.now() + timedelta(days=45)
        test_date = next_month.strftime("%Y-%m-%d")
        
        holiday_data = {
            "date": test_date,
            "name": "TEST_Holiday_Closure",
            "is_closed": True,
            "open_time": None,
            "close_time": None
        }
        
        response = self.session.post(f"{BASE_URL}/api/holidays", json=holiday_data)
        
        # Could be 200 or 400 if holiday already exists
        if response.status_code == 400 and "already exists" in response.text:
            print(f"Holiday already exists for {test_date}, skipping creation")
            return None
        
        assert response.status_code == 200, f"Failed to create holiday: {response.text}"
        
        data = response.json()
        assert "holiday_id" in data, "Response should contain holiday_id"
        assert "message" in data, "Response should contain message"
        
        print(f"Created holiday: {data['holiday_id']} for {test_date}")
        
        return data["holiday_id"]
    
    def test_create_holiday_with_special_hours(self):
        """Test creating a holiday with special hours (not fully closed)"""
        # Create a test holiday for 2 months from now
        future_date = datetime.now() + timedelta(days=75)
        test_date = future_date.strftime("%Y-%m-%d")
        
        holiday_data = {
            "date": test_date,
            "name": "TEST_Special_Hours_Day",
            "is_closed": False,
            "open_time": "10:00",
            "close_time": "14:00"
        }
        
        response = self.session.post(f"{BASE_URL}/api/holidays", json=holiday_data)
        
        if response.status_code == 400 and "already exists" in response.text:
            print(f"Holiday already exists for {test_date}, skipping")
            return None
        
        assert response.status_code == 200, f"Failed to create holiday: {response.text}"
        
        data = response.json()
        print(f"Created special hours holiday: {data['holiday_id']}")
        
        return data["holiday_id"]
    
    def test_update_holiday(self):
        """Test updating a holiday (PUT /api/holidays/{holiday_id})"""
        # First create a holiday
        holiday_id = self.test_create_holiday()
        if not holiday_id:
            # Try to find an existing test holiday
            holidays = self.test_list_holidays()
            test_holidays = [h for h in holidays if h.get("name", "").startswith("TEST_")]
            if not test_holidays:
                pytest.skip("No test holiday to update")
            holiday_id = test_holidays[0]["holiday_id"]
        
        # Update the holiday
        update_data = {
            "date": (datetime.now() + timedelta(days=50)).strftime("%Y-%m-%d"),
            "name": "TEST_Updated_Holiday",
            "is_closed": False,
            "open_time": "11:00",
            "close_time": "15:00"
        }
        
        response = self.session.put(f"{BASE_URL}/api/holidays/{holiday_id}", json=update_data)
        
        assert response.status_code == 200, f"Failed to update holiday: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        print(f"Updated holiday {holiday_id}")
        
        return True
    
    def test_delete_holiday(self):
        """Test deleting a holiday (DELETE /api/holidays/{holiday_id})"""
        # First list holidays to find test ones
        holidays = self.test_list_holidays()
        test_holidays = [h for h in holidays if h.get("name", "").startswith("TEST_")]
        
        if not test_holidays:
            # Create one to delete
            holiday_id = self.test_create_holiday()
            if not holiday_id:
                pytest.skip("Could not create holiday to delete")
        else:
            holiday_id = test_holidays[0]["holiday_id"]
        
        response = self.session.delete(f"{BASE_URL}/api/holidays/{holiday_id}")
        
        assert response.status_code == 200, f"Failed to delete holiday: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        print(f"Deleted holiday {holiday_id}")
        
        # Verify deletion
        holidays_after = self.test_list_holidays()
        deleted_ids = [h["holiday_id"] for h in holidays_after]
        assert holiday_id not in deleted_ids, "Holiday should be deleted"
        
        return True
    
    def test_holiday_validation_invalid_date(self):
        """Test that invalid date format is rejected"""
        holiday_data = {
            "date": "invalid-date",
            "name": "TEST_Invalid",
            "is_closed": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/holidays", json=holiday_data)
        
        assert response.status_code == 400, f"Should reject invalid date: {response.text}"
        print("Invalid date correctly rejected")
        
        return True
    
    # ==================
    # Business Hours Tests (for reference in schedule modal)
    # ==================
    
    def test_get_business_hours(self):
        """Test getting business hours (used by staff schedule modal)"""
        response = self.session.get(f"{BASE_URL}/api/settings/business-hours")
        
        assert response.status_code == 200, f"Failed to get business hours: {response.text}"
        
        data = response.json()
        assert "business_hours" in data, "Response should contain business_hours"
        
        business_hours = data["business_hours"]
        print(f"Business hours: {list(business_hours.keys())}")
        
        return business_hours
    
    # ==================
    # Cleanup
    # ==================
    
    def test_cleanup_test_holidays(self):
        """Cleanup any remaining test holidays"""
        holidays = self.test_list_holidays()
        test_holidays = [h for h in holidays if h.get("name", "").startswith("TEST_")]
        
        deleted_count = 0
        for holiday in test_holidays:
            response = self.session.delete(f"{BASE_URL}/api/holidays/{holiday['holiday_id']}")
            if response.status_code == 200:
                deleted_count += 1
        
        print(f"Cleaned up {deleted_count} test holidays")
        return True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
