import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard, Users, LogOut,
  Menu, X, ChevronDown, Search, Bell
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const navItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/tenants', label: 'Clients', icon: Users },
];

const SuperAdminLayout = ({ children, title }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin');
      return;
    }
    try {
      const response = await axios.get(`${API}/admin/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdmin(response.data);
    } catch (error) {
      localStorage.removeItem('admin_token');
      navigate('/admin');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      await axios.post(`${API}/admin/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {}
    localStorage.removeItem('admin_token');
    navigate('/admin');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1f2e] flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#1a1f2e] z-40 flex items-center justify-between px-4">
        <button onClick={() => setSidebarOpen(true)} className="p-2 text-white">
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-semibold text-white text-sm">BookSlot</span>
        <div className="w-9" />
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Dark Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-60 bg-[#1a1f2e] z-50 transform transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Admin Profile */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
              {admin?.name?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{admin?.name || 'Admin'}</p>
              <p className="text-white/40 text-xs truncate">{admin?.email}</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="px-5 mb-2">
          <div className="border-t border-white/10" />
        </div>

        {/* Navigation */}
        <nav className="px-3 space-y-1">
          <p className="px-3 py-2 text-[10px] uppercase tracking-widest text-white/30 font-semibold">Main</p>
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
                    ? 'bg-blue-500/20 text-blue-400 font-medium border-l-2 border-blue-400'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                data-testid={`admin-nav-${item.label.toLowerCase()}`}
              >
                <Icon className="w-[18px] h-[18px]" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sign Out */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/5 transition-colors text-sm"
            data-testid="admin-logout"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-60 min-h-screen pt-14 lg:pt-0">
        {/* Top Bar */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-[#e5e7eb] px-6 py-3 flex items-center justify-between z-30">
          <h1 className="text-lg font-semibold text-[#1a1f2e]" data-testid="admin-page-title">{title}</h1>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default SuperAdminLayout;
