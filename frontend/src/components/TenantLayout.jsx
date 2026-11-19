import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../App';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard, Calendar, Users, Briefcase, UserCircle, FileText, BarChart3, Settings,
  LogOut, X, ChevronDown, Bot, HelpCircle, ExternalLink, Plus, Copy, Menu, Home,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import HelpPanel from './HelpSystem';

// `perm` hides an item from team members without that permission; `manager` = owner/admin only
const navGroups = [
  { label: 'Your day', items: [
    { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { path: '/calendar', label: 'Calendar', icon: Calendar },
  ] },
  { label: 'Your business', items: [
    { path: '/clients', label: 'Clients', icon: UserCircle, perm: 'can_manage_customers' },
    { path: '/services', label: 'Services', icon: Briefcase },
    { path: '/staff', label: 'Team', icon: Users },
  ] },
  { label: 'Grow', items: [
    { path: '/moltbot', label: 'AI Receptionist', icon: Bot, manager: true },
    { path: '/forms', label: 'Forms', icon: FileText, manager: true },
    { path: '/reports', label: 'Reports', icon: BarChart3, perm: 'can_view_reports' },
  ] },
  { label: '', items: [
    { path: '/settings', label: 'Settings', icon: Settings },
  ] },
];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const TenantLayout = ({ children, title, subtitle, actions }) => {
  const { user, tenant, logout, can, isManager } = useAuth();
  const allowed = (i) => (!i.manager || isManager) && (!i.perm || can(i.perm));
  const groups = navGroups.map((g) => ({ ...g, items: g.items.filter(allowed) })).filter((g) => g.items.length);
  const bookingUrl = tenant?.booking_url_slug ? `${window.location.origin}/book/${tenant.booking_url_slug}` : null;
  const { currentTheme, setTheme, theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Load the business's theme from its branding settings
  useEffect(() => {
    setTheme(tenant?.branding?.theme || 'default');
  }, [tenant, setTheme]);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    setTheme('default');
    await logout();
    navigate('/');
  };

  const copyLink = () => {
    if (!bookingUrl) return;
    navigator.clipboard?.writeText(bookingUrl).then(
      () => toast.success('Booking link copied'),
      () => toast.error('Could not copy the link'),
    );
  };

  const isDark = ['elite', 'modern'].includes(currentTheme);
  const accent = isDark ? theme.colors.accent : '#4F46E5';
  const shellBg = isDark ? 'bg-[#0A0A0A]' : 'app-bg';
  const panel = isDark ? 'bg-[#141414] border-[#2A2A2A]' : 'bg-white/90 backdrop-blur border-[#ECEAF5]';
  const textMain = isDark ? 'text-white' : 'text-[#1E1B3A]';
  const textSoft = isDark ? 'text-[#B8B8B8]' : 'text-[#6B6890]';
  const firstName = (user?.name || '').split(' ')[0];
  const isActive = (path) => location.pathname === path;
  const adminViewing = (() => { try { return !!localStorage.getItem('admin_token'); } catch (e) { return false; } })();

  const navLink = (item, compact = false) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Link key={item.path} to={item.path} data-testid={`nav-${item.label.toLowerCase()}`}
        className={`group relative flex items-center gap-3 rounded-xl px-3 ${compact ? 'py-2' : 'py-2.5'} text-[15px] transition-all duration-150 ${
          active
            ? (isDark ? 'bg-[#1F1F1F] font-semibold' : 'bg-indigo-50 text-[#4338CA] font-semibold')
            : (isDark ? 'text-[#B8B8B8] hover:bg-[#1A1A1A]' : 'text-[#5B5880] hover:bg-[#F3F2FB] hover:text-[#1E1B3A]')
        }`}
        style={active && isDark ? { color: accent } : undefined}>
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full" style={{ backgroundColor: accent }} />}
        <Icon className="w-[18px] h-[18px] shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  };

  const sidebarBody = (
    <>
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 flex items-center gap-3">
        {tenant?.logo_url ? (
          <img src={tenant.logo_url} alt={tenant?.name} className="h-11 w-11 rounded-xl object-contain bg-white border border-[#ECEAF5]" />
        ) : (
          <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-500/20"
            style={{ background: isDark ? accent : 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
            {(tenant?.name || 'B').charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <Link to="/dashboard" className={`block font-bold truncate ${textMain}`}>{tenant?.name || 'BookSlot'}</Link>
          <p className={`text-xs ${textSoft}`}>Booking app</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.label && <p className={`px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-[#777]' : 'text-[#9A97B0]'}`}>{g.label}</p>}
            <div className="space-y-0.5">{g.items.map((i) => navLink(i))}</div>
          </div>
        ))}
      </nav>

      {/* Share booking page */}
      {bookingUrl && (
        <div className="px-3 pb-3">
          <div className={`rounded-2xl p-4 ${isDark ? 'bg-[#1A1A1A]' : 'bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100'}`}>
            <p className={`text-sm font-semibold ${textMain}`}>Your booking page</p>
            <p className={`text-xs mt-0.5 mb-3 ${textSoft}`}>Share it anywhere clients find you.</p>
            <div className="flex gap-2">
              <button onClick={copyLink} data-testid="nav-copy-link"
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold ${isDark ? 'bg-[#2A2A2A] text-white' : 'bg-white text-[#4338CA] shadow-sm hover:shadow'}`}>
                <Copy className="w-3.5 h-3.5" /> Copy link
              </button>
              <a href={bookingUrl} target="_blank" rel="noreferrer" data-testid="nav-booking-page" aria-label="Open booking page"
                className={`inline-flex items-center justify-center rounded-lg px-3 ${isDark ? 'bg-[#2A2A2A] text-white' : 'bg-white text-[#4338CA] shadow-sm hover:shadow'}`}>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* User */}
      <div className={`relative px-3 pb-4 pt-2 border-t ${isDark ? 'border-[#2A2A2A]' : 'border-[#ECEAF5]'}`}>
        <button onClick={() => setUserMenuOpen(!userMenuOpen)} data-testid="user-menu-button"
          className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-[#1A1A1A]' : 'hover:bg-[#F3F2FB]'}`}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ background: isDark ? accent : 'linear-gradient(135deg,#F472B6,#8B5CF6)' }}>
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className={`text-sm font-semibold truncate ${textMain}`}>{user?.name}</p>
            <p className={`text-xs truncate ${textSoft}`}>{user?.email}</p>
          </div>
          <ChevronDown className={`w-4 h-4 ${textSoft} transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
        </button>
        {userMenuOpen && (
          <div className={`absolute bottom-full left-3 right-3 mb-1 rounded-xl border shadow-xl overflow-hidden ${isDark ? 'bg-[#141414] border-[#2A2A2A]' : 'bg-white border-[#ECEAF5]'}`}>
            <button onClick={() => { setUserMenuOpen(false); setHelpOpen(true); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm ${textMain} ${isDark ? 'hover:bg-[#1A1A1A]' : 'hover:bg-[#F7F6FC]'}`}>
              <HelpCircle className="w-4 h-4" /> Help & guides
            </button>
            <button onClick={handleLogout} data-testid="logout-button"
              className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-rose-600 ${isDark ? 'hover:bg-[#1A1A1A]' : 'hover:bg-rose-50'}`}>
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );

  // Phone bottom tabs: the essentials, with a big "new booking" button in the middle
  const tabs = [
    { path: '/dashboard', label: 'Home', icon: Home },
    { path: '/calendar', label: 'Calendar', icon: Calendar },
    null,
    can('can_manage_customers') ? { path: '/clients', label: 'Clients', icon: UserCircle } : { path: '/services', label: 'Services', icon: Briefcase },
  ];

  return (
    <div className={`min-h-screen ${shellBg}`}>
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex fixed inset-y-0 left-0 w-[264px] flex-col border-r z-30 ${panel}`}>
        {sidebarBody}
      </aside>

      {/* Phone drawer ("More") */}
      {drawerOpen && <div className="lg:hidden fixed inset-0 bg-[#1E1B3A]/40 backdrop-blur-sm z-40" onClick={() => setDrawerOpen(false)} />}
      <aside className={`lg:hidden fixed inset-y-0 left-0 w-[86%] max-w-[320px] flex flex-col z-50 shadow-2xl transition-transform duration-300 ${
        isDark ? 'bg-[#141414]' : 'bg-white'} ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setDrawerOpen(false)} aria-label="Close menu"
          className={`absolute right-3 top-6 p-2 rounded-full ${textSoft} ${isDark ? 'hover:bg-[#1A1A1A]' : 'hover:bg-[#F3F2FB]'}`}>
          <X className="w-5 h-5" />
        </button>
        {sidebarBody}
      </aside>

      <main className="lg:pl-[264px] min-h-screen">
        {adminViewing && (
          <div className="bg-amber-100 text-amber-900 text-sm px-6 py-2 flex items-center justify-between" data-testid="admin-viewing-bar">
            <span>You're viewing this business as its owner (platform admin).</span>
            <a href="/admin/tenants" onClick={() => { try { localStorage.removeItem('token'); } catch (e) { /* ignore */ } }}
              className="underline font-medium">Back to admin</a>
          </div>
        )}

        {/* Top bar */}
        <header className={`sticky top-0 z-20 border-b ${panel}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 lg:h-20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setDrawerOpen(true)} className={`lg:hidden -ml-1 p-2 rounded-xl ${textMain}`} aria-label="Open menu" data-testid="mobile-menu-button">
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className={`text-lg lg:text-2xl font-bold truncate ${textMain}`} style={isDark ? { color: accent } : undefined} data-testid="page-title">
                  {title}
                </h1>
                <p className={`hidden lg:block text-sm ${textSoft}`}>
                  {subtitle || `${greeting()}${firstName ? `, ${firstName}` : ''}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {actions}
              <Link to="/calendar?new=1" data-testid="topbar-new-booking"
                className="hidden lg:inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 hover:shadow-md transition-all"
                style={{ background: isDark ? accent : 'linear-gradient(135deg,#6366F1,#7C3AED)' }}>
                <Plus className="w-4 h-4" /> New booking
              </Link>
              <NotificationBell />
              <button onClick={() => setHelpOpen(true)} title="Help" data-testid="help-button"
                className={`hidden lg:inline-flex p-2.5 rounded-xl transition-colors ${isDark ? 'hover:bg-[#1A1A1A]' : 'hover:bg-[#F3F2FB]'}`}>
                <HelpCircle className={`w-5 h-5 ${textSoft}`} />
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-8 pb-28 lg:pb-10 animate-fade-in">
          {children}
        </div>
      </main>

      {/* Phone bottom tab bar */}
      <nav className={`lg:hidden fixed bottom-0 inset-x-0 z-30 border-t safe-bottom pt-2 ${panel}`} aria-label="Main">
        <div className="grid grid-cols-5 items-end max-w-md mx-auto px-2">
          {tabs.map((t, i) => t === null ? (
            <div key="new" className="flex justify-center">
              <Link to="/calendar?new=1" aria-label="New booking" data-testid="tab-new-booking"
                className="tap -mt-7 h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/40 active:scale-95 transition-transform"
                style={{ background: isDark ? accent : 'linear-gradient(135deg,#6366F1,#7C3AED)' }}>
                <Plus className="w-6 h-6" />
              </Link>
            </div>
          ) : (
            <Link key={t.path} to={t.path} className={`tap flex flex-col items-center gap-1 py-1 text-[11px] font-semibold ${isActive(t.path) ? '' : textSoft}`}
              style={isActive(t.path) ? { color: accent } : undefined}>
              <t.icon className="w-[22px] h-[22px]" />
              {t.label}
            </Link>
          ))}
          <button onClick={() => setDrawerOpen(true)} className={`tap flex flex-col items-center gap-1 py-1 text-[11px] font-semibold ${textSoft}`}>
            <Menu className="w-[22px] h-[22px]" />
            More
          </button>
        </div>
      </nav>

      <HelpPanel isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
};

export default TenantLayout;
