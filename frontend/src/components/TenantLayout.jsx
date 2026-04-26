import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth, API } from '../App';
import { getTheme } from '../config/industryThemes';
import { resolveTheme } from '../config/themePresets';
import GoldLeafDecor from './GoldLeafDecor';
import axios from 'axios';
import {
  Calendar, Users, Settings, LogOut, Menu, X,
  ChevronDown, Bell, Home, Sparkles, BarChart3
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
  const industryTheme = getTheme(tenant?.industry);
  const themeData = resolveTheme(tenant);
  const { tokens, colors, isDark } = themeData;
  const businessName = tenant?.branding?.business_name || tenant?.name || 'BookSlot';
  const brandPrimary = colors.primary;
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

  const isStaffRole = user?.role === 'staff';

  const allNavItems = [
    { path: `${urlPrefix}/dashboard`, label: 'Today', icon: Home },
    { path: `${urlPrefix}/calendar`, label: 'Calendar', icon: Calendar, badge: pendingCount > 0 ? pendingCount : null },
    { path: `${urlPrefix}/staff`, label: 'Team', icon: Users, ownerOnly: true },
    { path: `${urlPrefix}/reports`, label: 'Reports', icon: BarChart3, ownerOnly: true },
    { path: `${urlPrefix}/settings`, label: 'Settings', icon: Settings, ownerOnly: true },
  ];
  const navItems = allNavItems.filter(i => !i.ownerOnly || !isStaffRole);

  const handleLogout = () => { logout(); navigate(tenantSlug ? `/${tenantSlug}/login` : '/login'); };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // Compose theme-aware classes
  const navItemActiveBg = isDark ? 'rgba(212,175,55,0.10)' : '#FFFFFF';
  const navItemActiveBorder = isDark ? `1px solid ${brandPrimary}55` : 'none';

  return (
    <div
      className="min-h-screen"
      data-theme={themeData.presetKey}
      style={{ background: tokens.shellBg, color: tokens.textPrimary, fontFamily: tokens.bodyFont }}
    >
      {/* Mobile Header */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 h-14 backdrop-blur-xl z-50 flex items-center justify-between px-5 border-b"
        style={{ background: tokens.topbarBg, borderColor: tokens.topbarBorder }}
      >
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2" style={{ color: tokens.textPrimary }}>
          <Menu className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <span className="font-light text-lg" style={{ fontFamily: tokens.headingFont, color: tokens.textPrimary, letterSpacing: isDark ? '0.05em' : 0 }}>
          {businessName}
        </span>
        <div className="w-9" />
      </header>

      {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-[240px] z-50 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col border-r`}
        style={{ background: tokens.sidebarBg, borderColor: tokens.sidebarBorder }}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt={businessName} className="w-8 h-8 rounded-full object-cover" style={{ border: `1px solid ${tokens.sidebarBorder}` }} />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: isDark ? 'transparent' : brandPrimary, border: isDark ? `1px solid ${brandPrimary}` : 'none' }}
              >
                <span
                  className="text-sm font-light"
                  style={{ fontFamily: tokens.headingFont, color: isDark ? brandPrimary : '#fff' }}
                >
                  {businessName.charAt(0)}
                </span>
              </div>
            )}
            <span
              className="text-lg font-light tracking-tight"
              style={{ fontFamily: tokens.headingFont, color: tokens.textPrimary, letterSpacing: isDark ? '0.08em' : 0 }}
            >
              {businessName}
            </span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1" style={{ color: tokens.textMuted }}><X className="w-4 h-4" /></button>
        </div>

        {/* AI Status */}
        <div
          className="mx-4 mb-3 px-4 py-2.5 rounded-2xl border"
          style={{
            background: isDark ? 'rgba(212,175,55,0.06)' : 'rgba(255,255,255,0.6)',
            borderColor: isDark ? 'rgba(212,175,55,0.2)' : tokens.topbarBorder,
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" style={{ color: brandPrimary }} strokeWidth={1.5} />
            <span className="text-[11px] font-medium tracking-wide" style={{ color: brandPrimary }}>{industryTheme.aiName} AI Active</span>
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all duration-200"
                style={{
                  background: isActive ? navItemActiveBg : 'transparent',
                  border: isActive ? navItemActiveBorder : '1px solid transparent',
                  color: isActive ? tokens.textPrimary : tokens.textSecondary,
                  fontWeight: isActive ? 500 : 400,
                  boxShadow: isActive && !isDark ? '0 2px 12px rgba(0,0,0,0.04)' : 'none',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = tokens.textPrimary; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = tokens.textSecondary; }}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center" style={{ backgroundColor: brandPrimary, color: isDark ? '#0A0A0A' : '#fff' }}>{item.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Menu */}
        <div className="p-3 border-t" style={{ borderColor: tokens.sidebarBorder + '88' }}>
          <div className="relative">
            <button onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
              style={{ background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.5)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium"
                style={{
                  background: isDark ? 'rgba(212,175,55,0.15)' : '#E8C5C8',
                  color: isDark ? brandPrimary : tokens.textPrimary,
                  border: isDark ? `1px solid ${brandPrimary}55` : 'none',
                }}
              >
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: tokens.textPrimary }}>{user?.name || 'User'}</p>
                <p className="text-[11px] truncate capitalize" style={{ color: tokens.textMuted }}>{user?.role || 'Owner'}</p>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} style={{ color: tokens.textMuted }} />
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div
                  className="absolute bottom-full left-0 right-0 mb-1 rounded-2xl shadow-lg z-50 overflow-hidden border"
                  style={{ background: tokens.surface, borderColor: tokens.surfaceBorder }}
                >
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                    style={{ color: brandPrimary }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(212,175,55,0.08)' : tokens.surfaceMuted; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <LogOut className="w-4 h-4" strokeWidth={1.5} /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Subtle gold-leaf flourish at sidebar bottom */}
        {isDark && (
          <div className="px-6 pb-4 pt-1 opacity-60">
            <GoldLeafDecor variant="divider" className="w-full h-3" />
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="lg:ml-[240px] min-h-screen pt-14 lg:pt-0">
        {/* Top Bar */}
        <div
          className="sticky top-0 lg:top-0 backdrop-blur-xl border-b px-6 lg:px-8 py-4 flex items-center justify-between z-30"
          style={{ background: tokens.topbarBg, borderColor: tokens.topbarBorder }}
        >
          <div>
            <p className="text-xs tracking-[0.2em] uppercase font-medium" style={{ color: tokens.textMuted }}>{title}</p>
            <h1
              className="text-2xl font-light tracking-tight mt-0.5"
              style={{ fontFamily: tokens.headingFont, color: tokens.textPrimary, letterSpacing: isDark ? '0.04em' : 0 }}
            >
              {title === 'Today' ? `${greeting}, ${user?.name?.split(' ')[0] || 'there'}` : title}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <button
                onClick={() => navigate(`${urlPrefix}/calendar`)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors"
                style={{ backgroundColor: brandPrimary + '22', color: brandPrimary }}
                data-testid="pending-badge"
              >
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
