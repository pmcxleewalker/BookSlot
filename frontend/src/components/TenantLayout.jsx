import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth, API } from '../App';
import axios from 'axios';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Briefcase,
  UserCircle,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bot,
  Bell,
  HelpCircle,
  Clock
} from 'lucide-react';
import { Button } from './ui/button';

const TenantLayout = ({ children, title }) => {
  const { user, tenant, logout, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  
  // Determine URL prefix based on whether we're on tenant-scoped routes
  const urlPrefix = tenantSlug ? `/${tenantSlug}` : '';
  
  // Fetch pending appointments count
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await axios.get(`${API}/appointments?status=pending`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPendingCount(res.data.appointments?.length || 0);
      } catch (e) {
        // Ignore errors
      }
    };
    if (token) fetchPending();
    const interval = setInterval(fetchPending, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [token]);
  
  const navItems = [
    { path: `${urlPrefix}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
    { path: `${urlPrefix}/calendar`, label: 'Calendar', icon: Calendar, badge: pendingCount > 0 ? pendingCount : null },
    { path: `${urlPrefix}/staff`, label: 'Staff', icon: Users },
    { path: `${urlPrefix}/services`, label: 'Services', icon: Briefcase },
    { path: `${urlPrefix}/clients`, label: 'Clients', icon: UserCircle },
    { path: `${urlPrefix}/moltbot`, label: 'AI Receptionist', icon: Bot },
    { path: `${urlPrefix}/reports`, label: 'Reports', icon: BarChart3 },
    { path: `${urlPrefix}/settings`, label: 'Settings', icon: Settings },
  ];
  
  // Apply custom branding from tenant settings
  useEffect(() => {
    if (tenant?.branding) {
      const { primary_color, secondary_color, accent_color } = tenant.branding;
      const root = document.documentElement;
      
      if (primary_color) {
        root.style.setProperty('--brand-primary', primary_color);
      }
      if (secondary_color) {
        root.style.setProperty('--brand-secondary', secondary_color);
      }
      if (accent_color) {
        root.style.setProperty('--brand-accent', accent_color);
      }
    }
    
    // Cleanup on unmount
    return () => {
      const root = document.documentElement;
      root.style.removeProperty('--brand-primary');
      root.style.removeProperty('--brand-secondary');
      root.style.removeProperty('--brand-accent');
    };
  }, [tenant?.branding]);

  // Get branding color for active state
  const primaryColor = tenant?.branding?.primary_color || '#121212';

  const handleLogout = async () => {
    await logout();
    if (tenantSlug) {
      navigate(`/${tenantSlug}/login`);
    } else {
      navigate('/');
    }
  };

  // Style for sidebar items
  const getSidebarItemStyle = (isActive) => {
    if (isActive) {
      return {
        backgroundColor: primaryColor,
        color: '#FFFFFF'
      };
    }
    return {};
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#E5E5E5] z-40 flex items-center justify-between px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-[#FAFAFA] rounded-md"
          data-testid="mobile-menu-button"
        >
          <Menu className="w-6 h-6 text-[#0A0A0A]" />
        </button>
        <Link to={`${urlPrefix}/dashboard`} className="font-semibold text-lg" style={{ color: primaryColor }}>
          {tenant?.branding?.business_name || tenant?.name || 'BookSlot'}
        </Link>
        <div className="w-10" />
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-[#E5E5E5] z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#E5E5E5]">
          <Link to={`${urlPrefix}/dashboard`} className="font-semibold text-lg" style={{ color: primaryColor }}>
            {tenant?.branding?.business_name || tenant?.name || 'BookSlot'}
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 hover:bg-[#FAFAFA] rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-8rem)]">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors ${
                  isActive 
                    ? 'text-white' 
                    : 'text-[#666666] hover:text-[#0A0A0A] hover:bg-[#FAFAFA]'
                }`}
                style={getSidebarItemStyle(isActive)}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="bg-amber-500 text-white text-xs rounded-full px-2 py-0.5 font-medium">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#E5E5E5] bg-white">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 p-2 hover:bg-[#FAFAFA] rounded-md transition-colors"
              data-testid="user-menu-button"
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                style={{ backgroundColor: primaryColor }}
              >
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-[#0A0A0A] truncate">{user?.name}</p>
                <p className="text-xs text-[#666666] truncate">{user?.email}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-[#666666] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-[#E5E5E5] rounded-md shadow-lg overflow-hidden">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#FAFAFA] transition-colors"
                  style={{ color: primaryColor }}
                  data-testid="logout-button"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-medium">Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        {/* Page Header */}
        <div className="bg-white border-b border-[#E5E5E5] px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[#0A0A0A]" data-testid="page-title">{title}</h1>
          
          {/* Header Actions */}
          <div className="flex items-center gap-2">
            {/* Help Button */}
            <div className="relative">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowHelp(!showHelp)}
                className="text-[#666666] hover:text-[#0A0A0A]"
                data-testid="help-button"
              >
                <HelpCircle className="w-5 h-5" />
              </Button>
              
              {showHelp && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowHelp(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#E5E5E5] rounded-lg shadow-lg z-50 p-4" data-testid="help-panel">
                    <h3 className="font-semibold text-[#0A0A0A] mb-3">Quick Help</h3>
                    <div className="space-y-3 text-sm">
                      <div className="p-3 bg-[#FAFAFA] rounded-md">
                        <p className="font-medium text-[#0A0A0A]">📅 Calendar</p>
                        <p className="text-[#666666] mt-1">Drag appointments to reschedule. Click any slot to create a new booking.</p>
                      </div>
                      <div className="p-3 bg-[#FAFAFA] rounded-md">
                        <p className="font-medium text-[#0A0A0A]">✅ Approvals</p>
                        <p className="text-[#666666] mt-1">Online bookings need approval. Check the Calendar page for pending requests.</p>
                      </div>
                      <div className="p-3 bg-[#FAFAFA] rounded-md">
                        <p className="font-medium text-[#0A0A0A]">🤖 AI Receptionist</p>
                        <p className="text-[#666666] mt-1">Moltbot handles customer messages 24/7. View conversations in AI Receptionist.</p>
                      </div>
                      <div className="p-3 bg-[#FAFAFA] rounded-md">
                        <p className="font-medium text-[#0A0A0A]">⚙️ Settings</p>
                        <p className="text-[#666666] mt-1">Customize branding, notifications, and booking preferences.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Notification Bell */}
            <div className="relative">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (pendingCount > 0) navigate(`${urlPrefix}/calendar`);
                }}
                className="text-[#666666] hover:text-[#0A0A0A] relative"
                data-testid="notification-bell"
              >
                <Bell className="w-5 h-5" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </Button>
              
              {showNotifications && pendingCount > 0 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#E5E5E5] rounded-lg shadow-lg z-50 p-4" data-testid="notifications-panel">
                    <h3 className="font-semibold text-[#0A0A0A] mb-2">Pending Approvals</h3>
                    <p className="text-sm text-[#666666] mb-3">
                      You have {pendingCount} booking{pendingCount > 1 ? 's' : ''} waiting for approval.
                    </p>
                    <Button 
                      className="w-full btn-primary text-sm" 
                      size="sm"
                      onClick={() => {
                        setShowNotifications(false);
                        navigate(`${urlPrefix}/calendar`);
                      }}
                    >
                      View in Calendar
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default TenantLayout;
