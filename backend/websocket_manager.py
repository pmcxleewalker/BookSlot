"""
WebSocket Manager for TimeSlot Pro
Handles real-time notifications for booking events, inbox messages, etc.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket, WebSocketDisconnect
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ConnectionInfo:
    """Information about a WebSocket connection"""
    websocket: WebSocket
    user_id: str
    tenant_id: Optional[str]
    connected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class WebSocketManager:
    """
    Manages WebSocket connections for real-time notifications.
    Supports:
    - Per-user connections (for staff dashboard)
    - Per-tenant broadcast (for all staff in a business)
    - Event-based routing
    """
    
    def __init__(self):
        # user_id -> set of ConnectionInfo
        self._user_connections: Dict[str, Set[ConnectionInfo]] = {}
        # tenant_id -> set of user_ids
        self._tenant_users: Dict[str, Set[str]] = {}
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
    
    async def connect(
        self,
        websocket: WebSocket,
        user_id: str,
        tenant_id: Optional[str] = None
    ) -> ConnectionInfo:
        """Accept and register a new WebSocket connection"""
        await websocket.accept()
        
        conn = ConnectionInfo(
            websocket=websocket,
            user_id=user_id,
            tenant_id=tenant_id
        )
        
        async with self._lock:
            # Add to user connections
            if user_id not in self._user_connections:
                self._user_connections[user_id] = set()
            self._user_connections[user_id].add(conn)
            
            # Add to tenant users mapping
            if tenant_id:
                if tenant_id not in self._tenant_users:
                    self._tenant_users[tenant_id] = set()
                self._tenant_users[tenant_id].add(user_id)
        
        logger.info(f"WebSocket connected: user={user_id}, tenant={tenant_id}")
        
        # Send connection acknowledgment
        await self._send_to_connection(conn, {
            "type": "connection_ack",
            "user_id": user_id,
            "tenant_id": tenant_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return conn
    
    async def disconnect(self, conn: ConnectionInfo):
        """Remove a WebSocket connection"""
        async with self._lock:
            user_id = conn.user_id
            tenant_id = conn.tenant_id
            
            # Remove from user connections
            if user_id in self._user_connections:
                self._user_connections[user_id].discard(conn)
                if not self._user_connections[user_id]:
                    del self._user_connections[user_id]
                    
                    # Remove from tenant users if no more connections
                    if tenant_id and tenant_id in self._tenant_users:
                        self._tenant_users[tenant_id].discard(user_id)
                        if not self._tenant_users[tenant_id]:
                            del self._tenant_users[tenant_id]
        
        logger.info(f"WebSocket disconnected: user={conn.user_id}")
    
    async def _send_to_connection(self, conn: ConnectionInfo, data: Dict[str, Any]) -> bool:
        """Send data to a specific connection"""
        try:
            await conn.websocket.send_json(data)
            return True
        except Exception as e:
            logger.error(f"Error sending to WebSocket: {e}")
            return False
    
    async def send_to_user(self, user_id: str, event_type: str, data: Dict[str, Any]):
        """Send a message to all connections of a specific user"""
        message = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        async with self._lock:
            connections = self._user_connections.get(user_id, set()).copy()
        
        failed_conns = []
        for conn in connections:
            success = await self._send_to_connection(conn, message)
            if not success:
                failed_conns.append(conn)
        
        # Clean up failed connections
        for conn in failed_conns:
            await self.disconnect(conn)
    
    async def broadcast_to_tenant(self, tenant_id: str, event_type: str, data: Dict[str, Any]):
        """Broadcast a message to all users in a tenant"""
        message = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        async with self._lock:
            user_ids = self._tenant_users.get(tenant_id, set()).copy()
        
        for user_id in user_ids:
            async with self._lock:
                connections = self._user_connections.get(user_id, set()).copy()
            
            for conn in connections:
                await self._send_to_connection(conn, message)
    
    async def notify_booking_created(self, tenant_id: str, appointment: Dict[str, Any]):
        """Notify tenant staff about a new booking"""
        await self.broadcast_to_tenant(tenant_id, "booking.created", {
            "appointment_id": appointment.get("appointment_id"),
            "client_name": appointment.get("client_name"),
            "service_id": appointment.get("service_id"),
            "staff_id": appointment.get("staff_id"),
            "start_time": appointment.get("start_time"),
            "source": appointment.get("source", "online")
        })
    
    async def notify_booking_updated(self, tenant_id: str, appointment: Dict[str, Any], action: str):
        """Notify tenant staff about booking updates"""
        await self.broadcast_to_tenant(tenant_id, f"booking.{action}", {
            "appointment_id": appointment.get("appointment_id"),
            "client_name": appointment.get("client_name"),
            "status": appointment.get("status"),
            "start_time": appointment.get("start_time"),
            "action": action
        })
    
    async def notify_new_conversation(self, tenant_id: str, conversation: Dict[str, Any]):
        """Notify staff about a new AI receptionist conversation"""
        await self.broadcast_to_tenant(tenant_id, "conversation.new", {
            "conversation_id": conversation.get("conversation_id"),
            "client_name": conversation.get("client_name"),
            "channel": conversation.get("channel"),
            "status": conversation.get("status")
        })
    
    async def notify_message_received(self, tenant_id: str, message: Dict[str, Any]):
        """Notify staff about a new message in a conversation"""
        await self.broadcast_to_tenant(tenant_id, "message.received", {
            "conversation_id": message.get("conversation_id"),
            "message_id": message.get("message_id"),
            "content": message.get("content"),
            "sender_type": message.get("sender_type")
        })
    
    async def notify_handoff_requested(self, tenant_id: str, conversation: Dict[str, Any]):
        """Notify staff that human handoff was requested"""
        await self.broadcast_to_tenant(tenant_id, "handoff.requested", {
            "conversation_id": conversation.get("conversation_id"),
            "client_name": conversation.get("client_name"),
            "reason": conversation.get("handoff_reason"),
            "priority": conversation.get("priority", "normal")
        })
    
    def get_connection_count(self) -> int:
        """Get total number of active connections"""
        return sum(len(conns) for conns in self._user_connections.values())
    
    def get_tenant_connection_count(self, tenant_id: str) -> int:
        """Get number of connections for a specific tenant"""
        user_ids = self._tenant_users.get(tenant_id, set())
        return sum(
            len(self._user_connections.get(uid, set()))
            for uid in user_ids
        )


# Global WebSocket manager instance
ws_manager = WebSocketManager()
