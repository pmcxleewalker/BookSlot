import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { useTheme } from '../context/ThemeContext';
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

// Elite by Caitlin logo
const ELITE_LOGO = 'https://customer-assets.emergentagent.com/job_b51cdde9-aca8-4bc9-8629-803189777585/artifacts/nyi83tyj_image.png';

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
  const { currentTheme, theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Theme-specific classes
  const isElite = currentTheme === 'elite';
  const bgMain = isElite ? 'bg-[#0A0A0A]' : 'bg-[#FAFAFA]';
  const bgCard = isElite ? 'bg-[#141414]' : 'bg-white';
  const borderColor = isElite ? 'border-[#2A2A2A]' : 'border-[#E5E5E5]';
  const textPrimary = isElite ? 'text-white' : 'text-[#0A0A0A]';
  const textSecondary = isElite ? 'text-[#B8B8B8]' : 'text-[#666666]';
  const accentColor = isElite ? 'text-[#D4AF37]' : 'text-[#E34A33]';

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
            {isElite ? (
              <>
                <img src={ELITE_LOGO} alt="Elite by Caitlin" className="h-12 w-auto" />
                <span className="text-[#D4AF37] text-sm font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Elite by Caitlin
                </span>
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
                    ? isElite 
                      ? 'bg-[#1A1A1A] text-[#D4AF37] font-medium' 
                      : 'bg-[#FAFAFA] text-[#0A0A0A] font-medium'
                    : isElite
                      ? 'text-[#B8B8B8] hover:text-[#D4AF37] hover:bg-[#1A1A1A]'
                      : 'text-[#666666] hover:text-[#0A0A0A] hover:bg-[#FAFAFA]'
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className="w-5 h-5" />
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
              className={`w-full flex items-center gap-3 p-2 rounded-md transition-colors ${isElite ? 'hover:bg-[#1A1A1A]' : 'hover:bg-[#FAFAFA]'}`}
              data-testid="user-menu-button"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${isElite ? 'bg-[#D4AF37] text-[#0A0A0A]' : 'bg-[#121212] text-white'}`}>
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
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isElite ? 'hover:bg-[#1A1A1A] text-[#D4AF37]' : 'hover:bg-[#FAFAFA] text-[#E34A33]'}`}
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
          <h1 className={`text-xl font-semibold ${isElite ? 'text-[#D4AF37]' : textPrimary}`} style={isElite ? { fontFamily: "'Playfair Display', serif" } : {}} data-testid="page-title">{title}</h1>
          <div className="hidden lg:flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setHelpOpen(true)}
              className={`p-2 rounded-md transition-colors ${isElite ? 'hover:bg-[#1A1A1A]' : 'hover:bg-[#FAFAFA]'}`}
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
