import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, X, Calendar, UserX, Clock, AlertCircle } from 'lucide-react';
import { useAuth, API } from '../App';
import axios from 'axios';
import { format, parseISO } from 'date-fns';

const NotificationBell = () => {
  const { token, tenant } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API}/notifications?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.post(`${API}/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => 
        n.notification_id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(`${API}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_booking':
        return <Calendar className="w-4 h-4 text-green-500" />;
      case 'booking_cancelled':
        return <UserX className="w-4 h-4 text-red-500" />;
      case 'approval_needed':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'booking_approved':
        return <Check className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-[#666666]" />;
    }
  };

  const formatTime = (timestamp) => {
    try {
      const date = parseISO(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return format(date, 'MMM d');
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-[#FAFAFA] rounded-md transition-colors"
        data-testid="notification-bell"
      >
        <Bell className="w-5 h-5 text-[#666666]" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-[#E34A33] text-white text-xs font-bold rounded-full flex items-center justify-center transform translate-x-1 -translate-y-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#E5E5E5] rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5] bg-[#FAFAFA]">
            <h3 className="font-semibold text-[#0A0A0A]">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-[#E34A33] hover:underline flex items-center gap-1"
                data-testid="mark-all-read"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-[#666666]">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.notification_id}
                  className={`px-4 py-3 border-b border-[#E5E5E5] last:border-0 hover:bg-[#FAFAFA] transition-colors cursor-pointer ${
                    !notif.read ? 'bg-blue-50/50' : ''
                  }`}
                  onClick={() => !notif.read && markAsRead(notif.notification_id)}
                  data-testid={`notification-${notif.notification_id}`}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!notif.read ? 'font-medium text-[#0A0A0A]' : 'text-[#666666]'}`}>
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="w-2 h-2 bg-[#E34A33] rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-[#666666] mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-xs text-[#999999] mt-1">
                        {formatTime(notif.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-[#E5E5E5] bg-[#FAFAFA]">
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-[#666666] hover:text-[#0A0A0A] w-full text-center"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
