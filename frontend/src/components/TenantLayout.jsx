import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth, API } from '../App';
import { getTheme } from '../config/industryThemes';
import axios from 'axios';
import {
  Calendar, Users, Settings, LogOut, Menu, X,
  ChevronDown, Bell, Home, Sparkles, BarChart3, Star
} from 'lucide-react';

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
  const businessName = tenant?.branding?.business_name || tenant?.name || 'BookSlot';
  const brandPrimary = tenant?.branding?.primary_color || '#B8868B';
  const logoUrl = tenant?.logo_url;

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

  const handleLogout = () => { logout(); navigate(tenantSlug ? `/${tenantSlug}/login` : '/login'); };

  // Get greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="min-h-screen bg-[#FDFCFA]">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white/80 backdrop-blur-xl z-50 flex items-center justify-between px-5 border-b border-[#F0EBE6]">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-[#2C2A29]">
          <Menu className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <span className="font-['Cormorant_Garamond'] font-light text-lg text-[#2C2A29]">{businessName}</span>
        <div className="w-9" />
      </header>

      {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-[240px] bg-[#F7F3EE] z-50 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col`}>
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt={businessName} className="w-8 h-8 rounded-full object-cover border border-[#E5DFD9]" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: brandPrimary }}>
                <span className="text-white text-sm font-['Cormorant_Garamond'] font-light">{businessName.charAt(0)}</span>
              </div>
            )}
            <span className="font-['Cormorant_Garamond'] text-lg font-light text-[#2C2A29] tracking-tight">{businessName}</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-[#9E948F]"><X className="w-4 h-4" /></button>
        </div>

        {/* AI Status */}
        <div className="mx-4 mb-3 px-4 py-2.5 rounded-2xl bg-white/60 border border-[#F0EBE6]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" style={{ color: brandPrimary }} strokeWidth={1.5} />
            <span className="text-[11px] font-medium tracking-wide" style={{ color: brandPrimary }}>{theme.aiName} AI Active</span>
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#8FA68F]" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all duration-200 ${
                  isActive ? 'bg-white shadow-[0_2px_12px_rgb(0,0,0,0.04)] text-[#2C2A29] font-medium' : 'text-[#706B68] hover:bg-white/50 hover:text-[#2C2A29]'
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center text-white" style={{ backgroundColor: brandPrimary }}>{item.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Menu */}
        <div className="p-3 border-t border-[#E5DFD9]/50">
          <div className="relative">
            <button onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/50 transition-all"
            >
              <div className="w-9 h-9 rounded-full bg-[#E8C5C8] flex items-center justify-center text-sm font-medium text-[#2C2A29]">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-[#2C2A29] truncate">{user?.name || 'User'}</p>
                <p className="text-[11px] text-[#9E948F] truncate">Owner</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-[#9E948F] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-[#F0EBE6] rounded-2xl shadow-lg z-50 overflow-hidden">
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#B8868B] hover:bg-[#F7F3EE] transition-colors">
                    <LogOut className="w-4 h-4" strokeWidth={1.5} /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-[240px] min-h-screen pt-14 lg:pt-0">
        {/* Top Bar */}
        <div className="sticky top-0 lg:top-0 bg-white/80 backdrop-blur-xl border-b border-[#F0EBE6] px-6 lg:px-8 py-4 flex items-center justify-between z-30">
          <div>
            <p className="text-xs tracking-[0.2em] uppercase text-[#9E948F] font-medium">{title}</p>
            <h1 className="font-['Cormorant_Garamond'] text-2xl font-light text-[#2C2A29] tracking-tight mt-0.5">
              {title === 'Today' ? `${greeting}, ${user?.name?.split(' ')[0] || 'there'}` : title}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <button onClick={() => navigate(`${urlPrefix}/calendar`)} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors" style={{ backgroundColor: brandPrimary + '22', color: brandPrimary }} data-testid="pending-badge">
                <Bell className="w-4 h-4" strokeWidth={1.5} />
                {pendingCount} pending
              </button>
            )}
          </div>
        </div>

        <div className="px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default TenantLayout;
