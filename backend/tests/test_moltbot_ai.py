"""
Moltbot AI Conversation System Tests
Tests for AI receptionist functionality including:
- GET /api/moltbot/status - LLM configuration status
- POST /api/moltbot/{tenant_id}/chat - AI conversation handling
- GET /api/moltbot/{tenant_id}/conversations - List conversations
- GET /api/moltbot/{tenant_id}/conversations/{id} - Get specific conversation
- POST /api/moltbot/{tenant_id}/conversations/{id}/close - Close conversation
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TENANT_ID = "tenant_126e958c4b6b"
API_KEY = "test-api-key"


class TestMoltbotStatus:
    """Test Moltbot status endpoint"""
    
    def test_get_moltbot_status(self):
        """GET /api/moltbot/status - Check LLM configuration status"""
        response = requests.get(f"{BASE_URL}/api/moltbot/status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "enabled" in data, "Response should contain 'enabled' field"
        assert "llm_available" in data, "Response should contain 'llm_available' field"
        assert "llm_configured" in data, "Response should contain 'llm_configured' field"
        assert "features" in data, "Response should contain 'features' field"
        
        # Verify features structure
        features = data["features"]
        assert "chat" in features, "Features should contain 'chat'"
        assert "sms_webhook" in features, "Features should contain 'sms_webhook'"
        assert "email_webhook" in features, "Features should contain 'email_webhook'"
        
        print(f"Moltbot Status: enabled={data['enabled']}, llm_configured={data['llm_configured']}")


class TestMoltbotChat:
    """Test Moltbot chat endpoint"""
    
    def test_chat_simple_greeting(self):
        """POST /api/moltbot/{tenant_id}/chat - Simple greeting message"""
        response = requests.post(
            f"{BASE_URL}/api/moltbot/{TENANT_ID}/chat?api_key={API_KEY}",
            json={
                "message": "Hello, I'd like to book an appointment",
                "client_identifier": "test-user-greeting",
                "channel": "chat"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data, "Response should contain 'response' field"
        assert "conversation_id" in data, "Response should contain 'conversation_id' field"
        assert data["conversation_id"] is not None, "conversation_id should not be None"
        
        print(f"AI Response: {data['response'][:100]}...")
        print(f"Conversation ID: {data['conversation_id']}")
    
    def test_chat_booking_intent(self):
        """POST /api/moltbot/{tenant_id}/chat - Booking intent with service"""
        response = requests.post(
            f"{BASE_URL}/api/moltbot/{TENANT_ID}/chat?api_key={API_KEY}",
            json={
                "message": "I want to book a haircut for tomorrow at 2pm",
                "client_identifier": "test-user-booking",
                "channel": "chat"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        assert "conversation_id" in data
        
        # Check if intent was detected
        if "intent" in data:
            print(f"Detected intent: {data['intent']}")
        
        print(f"AI Response: {data['response'][:150]}...")
    
    def test_chat_cancel_intent(self):
        """POST /api/moltbot/{tenant_id}/chat - Cancel intent with confirmation code"""
        response = requests.post(
            f"{BASE_URL}/api/moltbot/{TENANT_ID}/chat?api_key={API_KEY}",
            json={
                "message": "I need to cancel my appointment. My confirmation code is appt_test123",
                "client_identifier": "test-user-cancel",
                "channel": "chat"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        assert "conversation_id" in data
        
        print(f"AI Response: {data['response'][:150]}...")
    
    def test_chat_missing_message(self):
        """POST /api/moltbot/{tenant_id}/chat - Missing message should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/moltbot/{TENANT_ID}/chat?api_key={API_KEY}",
            json={
                "client_identifier": "test-user",
                "channel": "chat"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_chat_invalid_tenant(self):
        """POST /api/moltbot/{tenant_id}/chat - Invalid tenant should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/moltbot/invalid_tenant_xyz/chat?api_key={API_KEY}",
            json={
                "message": "Hello",
                "client_identifier": "test-user",
                "channel": "chat"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestMoltbotConversations:
    """Test Moltbot conversation management endpoints"""
    
    def test_list_conversations(self):
        """GET /api/moltbot/{tenant_id}/conversations - List all conversations"""
        response = requests.get(
            f"{BASE_URL}/api/moltbot/{TENANT_ID}/conversations?api_key={API_KEY}&limit=50"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "conversations" in data, "Response should contain 'conversations' field"
        assert isinstance(data["conversations"], list), "conversations should be a list"
        
        print(f"Found {len(data['conversations'])} conversations")
        
        # Verify conversation structure if any exist
        if data["conversations"]:
            conv = data["conversations"][0]
            assert "conversation_id" in conv, "Conversation should have conversation_id"
            assert "tenant_id" in conv, "Conversation should have tenant_id"
            assert "client_identifier" in conv, "Conversation should have client_identifier"
            assert "status" in conv, "Conversation should have status"
            assert "messages" in conv, "Conversation should have messages"
    
    def test_list_conversations_with_status_filter(self):
        """GET /api/moltbot/{tenant_id}/conversations - Filter by status"""
        response = requests.get(
            f"{BASE_URL}/api/moltbot/{TENANT_ID}/conversations?api_key={API_KEY}&status=active"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "conversations" in data
        
        # All returned conversations should have active status
        for conv in data["conversations"]:
            assert conv["status"] == "active", f"Expected active status, got {conv['status']}"
        
        print(f"Found {len(data['conversations'])} active conversations")
    
    def test_get_specific_conversation(self):
        """GET /api/moltbot/{tenant_id}/conversations/{id} - Get specific conversation"""
        # First create a conversation
        chat_response = requests.post(
            f"{BASE_URL}/api/moltbot/{TENANT_ID}/chat?api_key={API_KEY}",
            json={
                "message": "Test message for specific conversation",
                "client_identifier": "test-specific-conv",
                "channel": "chat"
            }
        )
        
        assert chat_response.status_code == 200
        conversation_id = chat_response.json()["conversation_id"]
        
        # Now get the specific conversation
        response = requests.get(
            f"{BASE_URL}/api/moltbot/{TENANT_ID}/conversations/{conversation_id}?api_key={API_KEY}"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["conversation_id"] == conversation_id
        assert data["tenant_id"] == TENANT_ID
        assert "messages" in data
        assert len(data["messages"]) >= 2, "Should have at least user message and AI response"
        
        print(f"Conversation has {len(data['messages'])} messages")
    
    def test_get_nonexistent_conversation(self):
        """GET /api/moltbot/{tenant_id}/conversations/{id} - Nonexistent conversation returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/moltbot/{TENANT_ID}/conversations/conv_nonexistent123?api_key={API_KEY}"
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestMoltbotConversationClose:
    """Test closing Moltbot conversations"""
    
    def test_close_conversation(self):
        """POST /api/moltbot/{tenant_id}/conversations/{id}/close - Close a conversation"""
        # First create a conversation
        chat_response = requests.post(
            f"{BASE_URL}/api/moltbot/{TENANT_ID}/chat?api_key={API_KEY}",
            json={
                "message": "Test message for closing",
                "client_identifier": "test-close-conv",
                "channel": "chat"
            }
        )
        
        assert chat_response.status_code == 200
        conversation_id = chat_response.json()["conversation_id"]
        
        # Close the conversation
        response = requests.post(
            f"{BASE_URL}/api/moltbot/{TENANT_ID}/conversations/{conversation_id}/close?api_key={API_KEY}"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert data["message"] == "Conversation closed"
        
        # Verify conversation is now completed
        verify_response = requests.get(
            f"{BASE_URL}/api/moltbot/{TENANT_ID}/conversations/{conversation_id}?api_key={API_KEY}"
        )
        
        assert verify_response.status_code == 200
        assert verify_response.json()["status"] == "completed"
        
        print(f"Successfully closed conversation {conversation_id}")
    
    def test_close_nonexistent_conversation(self):
        """POST /api/moltbot/{tenant_id}/conversations/{id}/close - Nonexistent returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/moltbot/{TENANT_ID}/conversations/conv_nonexistent456/close?api_key={API_KEY}"
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestMoltbotBookingAction:
    """Test Moltbot booking action execution"""
    
    def test_booking_flow_with_details(self):
        """Test complete booking flow with service, date, time, and contact info"""
        # Start conversation with booking intent
        response1 = requests.post(
            f"{BASE_URL}/api/moltbot/{TENANT_ID}/chat?api_key={API_KEY}",
            json={
                "message": "I want to book a haircut for January 20, 2026 at 10:00 AM. My name is Test User and my email is test@example.com",
                "client_identifier": "test-booking-flow",
                "channel": "chat"
            }
        )
        
        assert response1.status_code == 200
        data = response1.json()
        
        print(f"Booking flow response: {data['response'][:200]}...")
        
        # Check if action was taken
        if data.get("action_taken"):
            print(f"Action taken: {data['action_taken']}")
            if data["action_taken"].get("success"):
                print(f"Booking successful! Confirmation: {data['action_taken'].get('confirmation_code')}")


class TestMoltbotCancelAction:
    """Test Moltbot cancel action execution"""
    
    def test_cancel_with_confirmation_code(self):
        """Test cancel flow with confirmation code"""
        # First, let's get an existing appointment to cancel
        # For testing, we'll just test the intent recognition
        response = requests.post(
            f"{BASE_URL}/api/moltbot/{TENANT_ID}/chat?api_key={API_KEY}",
            json={
                "message": "I need to cancel my appointment. The confirmation code is appt_abc123xyz",
                "client_identifier": "test-cancel-flow",
                "channel": "chat"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"Cancel flow response: {data['response'][:200]}...")
        
        # Check context extraction
        if data.get("context"):
            print(f"Extracted context: {data['context']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
