import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth, API } from '../App';
import axios from 'axios';
import {
  Calendar,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  Home
} from 'lucide-react';
import { Button } from './ui/button';

const TenantLayout = ({ children, title }) => {
  const { user, tenant, logout, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  
  const urlPrefix = tenantSlug ? `/${tenantSlug}` : '';
  
  // Fetch pending appointments count
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await axios.get(`${API}/appointments?status=pending`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPendingCount(res.data.appointments?.length || 0);
      } catch (e) {}
    };
    if (token) fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => clearInterval(interval);
  }, [token]);
  
  // Simplified navigation - only essentials
  const navItems = [
    { path: `${urlPrefix}/dashboard`, label: 'Today', icon: Home },
    { path: `${urlPrefix}/calendar`, label: 'Calendar', icon: Calendar, badge: pendingCount > 0 ? pendingCount : null },
    { path: `${urlPrefix}/staff`, label: 'Team', icon: Users },
    { path: `${urlPrefix}/settings`, label: 'Settings', icon: Settings },
  ];
  
  // Apply custom branding
  useEffect(() => {
    if (tenant?.branding) {
      const { primary_color } = tenant.branding;
      const root = document.documentElement;
      if (primary_color) {
        root.style.setProperty('--brand-primary', primary_color);
      }
    }
  }, [tenant]);

  const getSidebarItemStyle = (isActive) => {
    if (isActive && tenant?.branding?.primary_color) {
      return { backgroundColor: tenant.branding.primary_color };
    }
    return {};
  };

  const handleLogout = () => {
    logout();
    navigate(tenantSlug ? `/${tenantSlug}/login` : '/login');
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-[#EAEAEA] z-50 flex items-center justify-between px-4">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2">
          <Menu className="w-5 h-5 text-[#0A0A0A]" />
        </button>
        <span className="font-semibold text-[#0A0A0A]">
          {tenant?.branding?.business_name || tenant?.name || 'BookSlot'}
        </span>
        <div className="w-9" />
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/20 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-56 bg-white border-r border-[#EAEAEA] z-50 transform transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-[#EAEAEA]">
          <span className="font-semibold text-[#0A0A0A] truncate">
            {tenant?.branding?.business_name || tenant?.name || 'BookSlot'}
          </span>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1">
            <X className="w-5 h-5 text-[#666]" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive 
                    ? 'bg-[#0A0A0A] text-white font-medium' 
                    : 'text-[#666] hover:text-[#0A0A0A] hover:bg-[#F5F5F5]'
                }`}
                style={isActive ? getSidebarItemStyle(isActive) : {}}
              >
                <Icon className="w-[18px] h-[18px]" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-[#EAEAEA]">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#F5F5F5] transition-colors"
            >
              <div className="w-8 h-8 bg-[#F0F0F0] rounded-full flex items-center justify-center text-sm font-medium text-[#666]">
                {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-[#0A0A0A] truncate">{user?.name || 'User'}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-[#999] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-[#EAEAEA] rounded-lg shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-56 min-h-screen pt-14 lg:pt-0">
        {/* Header */}
        <div className="sticky top-0 lg:top-0 bg-white/80 backdrop-blur-sm border-b border-[#EAEAEA] px-6 py-4 flex items-center justify-between z-30">
          <h1 className="text-lg font-semibold text-[#0A0A0A]">{title}</h1>
          
          {pendingCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate(`${urlPrefix}/calendar`)}
              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-2"
            >
              <Bell className="w-4 h-4" />
              <span className="text-sm">{pendingCount} pending</span>
            </Button>
          )}
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
