import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  LayoutDashboard, Building2, Users, Settings, LogOut, 
  Menu, X, Shield, ChevronDown 
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const navItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/tenants', label: 'Tenants', icon: Building2 },
];

const AdminLayout = ({ children, title }) => {
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
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#121212] border-b border-white/10 z-40 flex items-center justify-between px-4">
        <button onClick={() => setSidebarOpen(true)} className="p-2 text-white">
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#E34A33]" />
          Admin
        </span>
        <div className="w-10" />
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/70 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-[#121212] border-r border-white/10 z-50 transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
          <Link to="/admin/dashboard" className="font-semibold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#E34A33]" />
            Super Admin
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors ${
                  isActive 
                    ? 'bg-[#E34A33] text-white' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Admin User */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-md transition-colors"
            >
              <div className="w-8 h-8 bg-[#E34A33] rounded-full flex items-center justify-center text-white text-sm font-medium">
                {admin?.name?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-white truncate">{admin?.name}</p>
                <p className="text-xs text-white/40 truncate">{admin?.email}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-md overflow-hidden">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 text-[#E34A33]"
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
        <div className="bg-[#121212] border-b border-white/10 px-6 py-4">
          <h1 className="text-xl font-semibold text-white">{title}</h1>
        </div>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
