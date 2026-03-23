import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Calendar, CalendarDays, Users, Briefcase, 
  Box, UserCircle, Settings, Webhook, LogOut, Menu, X, ChevronRight,
  MessageSquare, BarChart3
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/dashboard/inbox', label: 'Inbox', icon: MessageSquare, badge: true },
  { path: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { path: '/dashboard/appointments', label: 'Appointments', icon: CalendarDays },
  { path: '/dashboard/staff', label: 'Staff', icon: Users },
  { path: '/dashboard/services', label: 'Services', icon: Briefcase },
  { path: '/dashboard/resources', label: 'Resources', icon: Box },
  { path: '/dashboard/clients', label: 'Clients', icon: UserCircle },
  { path: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/dashboard/settings', label: 'Settings', icon: Settings },
  { path: '/dashboard/integrations', label: 'Integrations', icon: Webhook },
];

export const DashboardLayout = ({ children, title }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#E5E5E0] z-40 flex items-center justify-between px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-[#FAF9F6] rounded-lg"
          data-testid="mobile-menu-toggle"
        >
          <Menu className="w-6 h-6 text-[#1C1C1C]" />
        </button>
        <span className="font-bold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
          {user?.tenant?.name || 'TimeSlot Pro'}
        </span>
        <div className="w-8 h-8 rounded-full bg-[#2E473B]/10 flex items-center justify-center text-[#2E473B] font-medium">
          {user?.name?.charAt(0) || 'U'}
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
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-[#E5E5E0] z-50
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-[#E5E5E0]">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#2E473B] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
                TimeSlot Pro
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-[#FAF9F6] rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Business Info */}
          <div className="p-4 border-b border-[#E5E5E0]">
            <div className="text-sm text-[#6B6B6B]">Business</div>
            <div className="font-medium text-[#1C1C1C] truncate">
              {user?.tenant?.name || 'My Business'}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-[#2E473B]/10 text-[#2E473B] font-medium'
                      : 'text-[#6B6B6B] hover:bg-[#FAF9F6] hover:text-[#1C1C1C]'
                  }`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-[#E5E5E0]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#2E473B]/10 flex items-center justify-center text-[#2E473B] font-medium">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[#1C1C1C] truncate">{user?.name}</div>
                <div className="text-xs text-[#6B6B6B] truncate">{user?.email}</div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full justify-start rounded-xl border-[#E5E5E0]"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        {/* Page Header */}
        {title && (
          <div className="bg-white border-b border-[#E5E5E0] px-6 py-4">
            <h1 className="text-2xl font-bold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
              {title}
            </h1>
          </div>
        )}
        
        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
