import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import {
  LayoutDashboard,
  Calendar,
  Clock,
  Users,
  Briefcase,
  Box,
  UserCircle,
  FileText,
  Mail,
  BarChart3,
  Settings,
  Puzzle,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bot
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/calendar', label: 'Calendar', icon: Calendar },
  { path: '/appointments', label: 'Appointments', icon: Clock },
  { path: '/staff', label: 'Staff', icon: Users },
  { path: '/services', label: 'Services', icon: Briefcase },
  { path: '/resources', label: 'Resources', icon: Box },
  { path: '/clients', label: 'Clients', icon: UserCircle },
  { path: '/forms', label: 'Forms', icon: FileText },
  { path: '/messages', label: 'Messages', icon: Mail },
  { path: '/moltbot', label: 'AI Receptionist', icon: Bot },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/integrations', label: 'Integrations', icon: Puzzle },
];

const TenantLayout = ({ children, title }) => {
  const { user, tenant, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
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
        <Link to="/dashboard" className="font-semibold text-lg text-[#0A0A0A]">
          {tenant?.name || 'BookSlot'}
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
          <Link to="/dashboard" className="font-semibold text-lg text-[#0A0A0A]">
            {tenant?.name || 'BookSlot'}
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
                className={isActive ? 'sidebar-item-active' : 'sidebar-item'}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
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
              <div className="w-8 h-8 bg-[#121212] rounded-full flex items-center justify-center text-white text-sm font-medium">
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
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#FAFAFA] transition-colors text-[#E34A33]"
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
        <div className="bg-white border-b border-[#E5E5E5] px-6 py-4">
          <h1 className="text-xl font-semibold text-[#0A0A0A]" data-testid="page-title">{title}</h1>
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
