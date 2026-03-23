import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

const WS_RECONNECT_INTERVAL = 3000;
const WS_MAX_RETRIES = 5;

export const useWebSocket = (onMessage) => {
  const { sessionToken, isAuthenticated } = useAuth();
  const wsRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  const connect = useCallback(() => {
    if (!sessionToken || !isAuthenticated) return;

    // Build WebSocket URL from current hostname
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected, authenticating...');
        // Send authentication
        wsRef.current.send(JSON.stringify({
          session_token: sessionToken
        }));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          // Handle connection acknowledgment
          if (data.type === 'connection_ack') {
            console.log('WebSocket authenticated successfully');
            setIsConnected(true);
            reconnectAttempts.current = 0;
          }

          // Handle errors
          if (data.type === 'error') {
            console.error('WebSocket error:', data.message);
            setIsConnected(false);
          }

          // Handle booking notifications
          if (data.type === 'booking.created') {
            toast.success(`New booking from ${data.data?.client_name || 'a client'}`, {
              description: 'View in calendar',
            });
          }

          if (data.type === 'booking.cancelled') {
            toast.info(`Booking cancelled`, {
              description: data.data?.client_name,
            });
          }

          // Handle conversation notifications
          if (data.type === 'conversation.new') {
            toast.info(`New conversation started`, {
              description: data.data?.client_name || 'Anonymous',
            });
          }

          if (data.type === 'handoff.requested') {
            toast.warning(`Human handoff requested`, {
              description: `${data.data?.client_name || 'A customer'} needs assistance`,
              duration: 10000,
            });
          }

          // Call custom handler
          if (onMessage) {
            onMessage(data);
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);

        // Attempt reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttempts.current < WS_MAX_RETRIES) {
          reconnectAttempts.current++;
          console.log(`Reconnecting... attempt ${reconnectAttempts.current}`);
          reconnectTimeout.current = setTimeout(connect, WS_RECONNECT_INTERVAL);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
  }, [sessionToken, isAuthenticated, onMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User initiated disconnect');
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendPing = useCallback(() => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, [isConnected]);

  useEffect(() => {
    connect();

    // Setup ping interval for keepalive
    const pingInterval = setInterval(sendPing, 30000);

    return () => {
      clearInterval(pingInterval);
      disconnect();
    };
  }, [connect, disconnect, sendPing]);

  return {
    isConnected,
    lastMessage,
    disconnect,
    reconnect: connect
  };
};

export default useWebSocket;
