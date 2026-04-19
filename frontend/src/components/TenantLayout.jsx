import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth, API } from '../App';
import { getTheme } from '../config/industryThemes';
import axios from 'axios';
import {
  Calendar, Users, Settings, LogOut, Menu, X,
  ChevronDown, Bell, Home, Sparkles, BarChart3
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
  const theme = getTheme(tenant?.industry);

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

  const navItems = [
    { path: `${urlPrefix}/dashboard`, label: 'Today', icon: Home },
    { path: `${urlPrefix}/calendar`, label: 'Calendar', icon: Calendar, badge: pendingCount > 0 ? pendingCount : null },
    { path: `${urlPrefix}/staff`, label: 'Team', icon: Users },
    { path: `${urlPrefix}/reports`, label: 'Reports', icon: BarChart3 },
    { path: `${urlPrefix}/settings`, label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate(tenantSlug ? `/${tenantSlug}/login` : '/login');
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Mobile Header */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 h-14 z-50 flex items-center justify-between px-4"
        style={{ backgroundColor: theme.sidebar }}
      >
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-white/80">
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-semibold text-white text-sm">
          {tenant?.branding?.business_name || tenant?.name || 'BookSlot'}
        </span>
        <div className="w-9" />
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-56 z-50 transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ backgroundColor: theme.sidebar }}
      >
        {/* Logo / Business Name */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
            >
              {(tenant?.branding?.business_name || tenant?.name || 'B').charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-white text-sm truncate">
              {tenant?.branding?.business_name || tenant?.name || 'BookSlot'}
            </span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-white/40 hover:text-white/70">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Status Indicator */}
        <div className="mx-3 mt-3 mb-2 px-3 py-2 rounded-lg" style={{ backgroundColor: theme.sidebarActive }}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" style={{ color: theme.sidebarTextActive }} />
            <span className="text-[11px] font-medium" style={{ color: theme.sidebarTextActive }}>
              {theme.aiName} AI Active
            </span>
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 mt-1 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
                style={{
                  backgroundColor: isActive ? theme.sidebarActive : 'transparent',
                  color: isActive ? theme.sidebarTextActive : theme.sidebarText,
                  fontWeight: isActive ? 600 : 400,
                }}
                onMouseEnter={(e) => { if (!isActive) e.target.style.backgroundColor = theme.sidebarHover; }}
                onMouseLeave={(e) => { if (!isActive) e.target.style.backgroundColor = 'transparent'; }}
              >
                <Icon className="w-[18px] h-[18px]" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span
                    className="text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center text-white"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/10">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
              style={{ color: theme.sidebarText }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.sidebarHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white shrink-0"
                style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
              >
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">{user?.name || 'User'}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
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
        <div className="sticky top-0 lg:top-0 bg-white/80 backdrop-blur-md border-b border-gray-200/60 px-6 py-3 flex items-center justify-between z-30">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${theme.badge}`}>
              {theme.name}
            </span>
          </div>

          {pendingCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`${urlPrefix}/calendar`)}
              className="gap-2 hover:bg-amber-50"
              style={{ color: theme.primary }}
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
