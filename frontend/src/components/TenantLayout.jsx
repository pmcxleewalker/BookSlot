import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { useTheme, themes } from '../context/ThemeContext';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Briefcase,
  UserCircle,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bot,
  HelpCircle
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import HelpPanel from './HelpSystem';

// Streamlined navigation - merged Appointments into Calendar, removed Resources, moved Messages to AI Receptionist, moved Integrations to Settings
const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/calendar', label: 'Calendar', icon: Calendar },
  { path: '/staff', label: 'Staff', icon: Users },
  { path: '/services', label: 'Services', icon: Briefcase },
  { path: '/clients', label: 'Clients', icon: UserCircle },
  { path: '/forms', label: 'Forms', icon: FileText },
  { path: '/moltbot', label: 'AI Receptionist', icon: Bot },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const TenantLayout = ({ children, title }) => {
  const { user, tenant, logout } = useAuth();
  const { currentTheme, setTheme, theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Load tenant's theme from their branding settings
  useEffect(() => {
    if (tenant?.branding?.theme) {
      setTheme(tenant.branding.theme);
    } else {
      setTheme('default');
    }
  }, [tenant, setTheme]);

  const handleLogout = async () => {
    setTheme('default'); // Reset theme on logout
    await logout();
    navigate('/');
  };

  // Theme-specific classes
  const isElite = currentTheme === 'elite';
  const isDark = ['elite', 'modern'].includes(currentTheme);
  const bgMain = isDark ? 'bg-[#0A0A0A]' : 'bg-[#FAFAFA]';
  const bgCard = isDark ? 'bg-[#141414]' : 'bg-white';
  const borderColor = isDark ? 'border-[#2A2A2A]' : 'border-[#E5E5E5]';
  const textPrimary = isDark ? 'text-white' : 'text-[#0A0A0A]';
  const textSecondary = isDark ? 'text-[#B8B8B8]' : 'text-[#666666]';
  const accentColor = theme.colors.accent;

  // Get logo URL from theme or tenant branding
  const logoUrl = theme.logoUrl || tenant?.branding?.logo_url || tenant?.logo_url;

  return (
    <div className={`min-h-screen ${bgMain}`}>
      {/* Mobile Header */}
      <header className={`lg:hidden fixed top-0 left-0 right-0 h-16 ${bgCard} border-b ${borderColor} z-40 flex items-center justify-between px-4`}>
        <button
          onClick={() => setSidebarOpen(true)}
          className={`p-2 hover:bg-opacity-80 rounded-md`}
          data-testid="mobile-menu-button"
        >
          <Menu className={`w-6 h-6 ${textPrimary}`} />
        </button>
        <Link to="/dashboard" className={`font-semibold text-lg ${isElite ? 'text-[#D4AF37]' : textPrimary}`}>
          {tenant?.name || 'BookSlot'}
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
        </div>
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
        className={`fixed top-0 left-0 h-full w-64 ${bgCard} border-r ${borderColor} z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className={`h-20 flex items-center justify-between px-4 border-b ${borderColor}`}>
          <Link to="/dashboard" className="flex items-center gap-3">
            {logoUrl ? (
              <>
                <img src={logoUrl} alt={tenant?.name} className="h-12 w-auto" />
                {isDark && (
                  <span className="text-sm font-medium" style={{ color: accentColor, fontFamily: "'Playfair Display', serif" }}>
                    {tenant?.name}
                  </span>
                )}
              </>
            ) : (
              <span className={`font-semibold text-lg ${textPrimary}`}>
                {tenant?.name || 'BookSlot'}
              </span>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className={`lg:hidden p-1 hover:opacity-80 rounded ${textSecondary}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-9rem)]">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors duration-200 ${
                  isActive 
                    ? isDark 
                      ? `bg-[#1A1A1A] font-medium` 
                      : 'bg-[#FAFAFA] text-[#0A0A0A] font-medium'
                    : isDark
                      ? 'text-[#B8B8B8] hover:bg-[#1A1A1A]'
                      : 'text-[#666666] hover:text-[#0A0A0A] hover:bg-[#FAFAFA]'
                }`}
                style={isActive && isDark ? { color: accentColor } : (isDark && !isActive ? {} : {})}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className="w-5 h-5" style={isActive && isDark ? { color: accentColor } : {}} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className={`absolute bottom-0 left-0 right-0 p-4 border-t ${borderColor} ${bgCard}`}>
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`w-full flex items-center gap-3 p-2 rounded-md transition-colors ${isDark ? 'hover:bg-[#1A1A1A]' : 'hover:bg-[#FAFAFA]'}`}
              data-testid="user-menu-button"
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                style={{ backgroundColor: isDark ? accentColor : '#121212', color: isDark ? '#0A0A0A' : '#FFFFFF' }}
              >
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 text-left">
                <p className={`text-sm font-medium truncate ${textPrimary}`}>{user?.name}</p>
                <p className={`text-xs truncate ${textSecondary}`}>{user?.email}</p>
              </div>
              <ChevronDown className={`w-4 h-4 ${textSecondary} transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className={`absolute bottom-full left-0 right-0 mb-2 ${bgCard} border ${borderColor} rounded-md shadow-lg overflow-hidden`}>
                <button
                  onClick={handleLogout}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors`}
                  style={{ color: isDark ? accentColor : '#E34A33' }}
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
      <main className={`lg:ml-64 min-h-screen pt-16 lg:pt-0 ${bgMain}`}>
        {/* Page Header */}
        <div className={`${bgCard} border-b ${borderColor} px-6 py-4 flex items-center justify-between`}>
          <h1 
            className={`text-xl font-semibold`} 
            style={{ color: isDark ? accentColor : '#0A0A0A', fontFamily: isDark ? "'Playfair Display', serif" : 'inherit' }} 
            data-testid="page-title"
          >
            {title}
          </h1>
          <div className="hidden lg:flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setHelpOpen(true)}
              className={`p-2 rounded-md transition-colors ${isDark ? 'hover:bg-[#1A1A1A]' : 'hover:bg-[#FAFAFA]'}`}
              data-testid="help-button"
              title="Help"
            >
              <HelpCircle className={`w-5 h-5 ${textSecondary}`} />
            </button>
          </div>
        </div>

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>

      {/* Help Panel */}
      <HelpPanel isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
};

export default TenantLayout;
