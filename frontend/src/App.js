import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Toaster, toast } from 'sonner';

// Pages - Public
import LandingPage from './pages/public/LandingPage';
import FeaturesPage from './pages/public/FeaturesPage';
import PricingPage from './pages/public/PricingPage';
import LoginPage from './pages/public/LoginPage';
import SignupPage from './pages/public/SignupPage';
import PublicBookingPage from './pages/public/PublicBookingPage';
import ManageBookingPage from './pages/public/ManageBookingPage';
import TenantLoginPage from './pages/public/TenantLoginPage';

// Pages - Admin
import DashboardPage from './pages/admin/DashboardPage';
import CalendarPage from './pages/admin/CalendarPage';
import StaffPage from './pages/admin/StaffPage';
import ServicesPage from './pages/admin/ServicesPage';
import ClientsPage from './pages/admin/ClientsPage';
import ReportsPage from './pages/admin/ReportsPage';
import SettingsPage from './pages/admin/SettingsPage';
import OnboardingPage from './pages/admin/OnboardingPage';
import MoltbotPage from './pages/admin/MoltbotPage';

// Pages - Super Admin
import AdminLoginPage from './pages/superadmin/AdminLoginPage';
import AdminDashboardPage from './pages/superadmin/AdminDashboardPage';
import AdminTenantsPage from './pages/superadmin/AdminTenantsPage';
import AdminTenantDetailPage from './pages/superadmin/AdminTenantDetailPage';

// Components
import AuthCallback from './components/auth/AuthCallback';
import AIReceptionistWidget from './components/AIReceptionistWidget';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Configure axios defaults
axios.defaults.withCredentials = true;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const checkAuth = useCallback(async () => {
    // CRITICAL: Skip auth check if returning from OAuth callback
    // AuthCallback will handle authentication in that case
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/auth/me`, { headers });
      setUser(response.data);
      
      // Fetch tenant if user has one
      if (response.data.tenant_id) {
        const tenantRes = await axios.get(`${API}/tenants/me`, { headers });
        setTenant(tenantRes.data.tenant);
      }
    } catch (error) {
      setUser(null);
      setTenant(null);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { user: userData, token: newToken } = response.data;
    setUser(userData);
    setToken(newToken);
    localStorage.setItem('token', newToken);
    
    if (userData.tenant_id) {
      const tenantRes = await axios.get(`${API}/tenants/me`, {
        headers: { Authorization: `Bearer ${newToken}` }
      });
      setTenant(tenantRes.data.tenant);
    }
    
    return userData;
  };

  const register = async (name, email, password) => {
    const response = await axios.post(`${API}/auth/register`, { name, email, password });
    const { user: userData, token: newToken } = response.data;
    setUser(userData);
    setToken(newToken);
    localStorage.setItem('token', newToken);
    return userData;
  };

  const googleAuth = async (sessionId) => {
    const response = await axios.post(`${API}/auth/session`, { session_id: sessionId });
    const { user: userData, token: newToken } = response.data;
    setUser(userData);
    setToken(newToken);
    localStorage.setItem('token', newToken);
    
    if (userData.tenant_id) {
      const tenantRes = await axios.get(`${API}/tenants/me`, {
        headers: { Authorization: `Bearer ${newToken}` }
      });
      setTenant(tenantRes.data.tenant);
    }
    
    return userData;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
    } catch (e) {
      // Ignore logout errors
    }
    setUser(null);
    setTenant(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  const createTenant = async (tenantData) => {
    const response = await axios.post(`${API}/tenants`, tenantData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setTenant(response.data.tenant);
    
    // Refresh user to get tenant_id
    await checkAuth();
    
    return response.data.tenant;
  };

  const updateTenant = async (updates) => {
    const response = await axios.put(`${API}/tenants/me`, updates, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setTenant(response.data.tenant);
    return response.data.tenant;
  };

  const value = {
    user,
    tenant,
    token,
    loading,
    login,
    register,
    googleAuth,
    logout,
    createTenant,
    updateTenant,
    checkAuth,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading, tenant } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-[#666666]">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect to onboarding if no tenant and not already on onboarding
  if (!tenant && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Redirect from onboarding if tenant exists and onboarding complete
  if (tenant?.onboarding_completed && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Tenant-scoped protected route - validates user belongs to the tenant in URL
const TenantScopedRoute = ({ children }) => {
  const { user, loading, tenant } = useAuth();
  const location = useLocation();
  const { tenantSlug } = useParams();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-[#666666]">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/${tenantSlug}/login`} state={{ from: location }} replace />;
  }

  // Verify user belongs to this tenant
  if (tenant?.booking_url_slug !== tenantSlug) {
    return <Navigate to={`/${tenantSlug}/login`} replace />;
  }

  return children;
};

// App Router Component
const AppRouter = () => {
  const location = useLocation();

  // Handle OAuth callback - check URL fragment synchronously during render
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/book/:slug" element={<PublicBookingPage />} />
      <Route path="/booking/:confirmationCode" element={<ManageBookingPage />} />

      {/* Protected Admin Routes */}
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute><StaffPage /></ProtectedRoute>} />
      <Route path="/services" element={<ProtectedRoute><ServicesPage /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/moltbot" element={<ProtectedRoute><MoltbotPage /></ProtectedRoute>} />

      {/* Tenant-Scoped Routes - Independent franchise URLs */}
      <Route path="/:tenantSlug/login" element={<TenantLoginPage />} />
      <Route path="/:tenantSlug/dashboard" element={<TenantScopedRoute><DashboardPage /></TenantScopedRoute>} />
      <Route path="/:tenantSlug/calendar" element={<TenantScopedRoute><CalendarPage /></TenantScopedRoute>} />
      <Route path="/:tenantSlug/staff" element={<TenantScopedRoute><StaffPage /></TenantScopedRoute>} />
      <Route path="/:tenantSlug/services" element={<TenantScopedRoute><ServicesPage /></TenantScopedRoute>} />
      <Route path="/:tenantSlug/clients" element={<TenantScopedRoute><ClientsPage /></TenantScopedRoute>} />
      <Route path="/:tenantSlug/reports" element={<TenantScopedRoute><ReportsPage /></TenantScopedRoute>} />
      <Route path="/:tenantSlug/settings" element={<TenantScopedRoute><SettingsPage /></TenantScopedRoute>} />
      <Route path="/:tenantSlug/moltbot" element={<TenantScopedRoute><MoltbotPage /></TenantScopedRoute>} />

      {/* Super Admin Routes */}
      <Route path="/admin" element={<AdminLoginPage />} />
      <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
      <Route path="/admin/tenants" element={<AdminTenantsPage />} />
      <Route path="/admin/tenants/:tenantId" element={<AdminTenantDetailPage />} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors closeButton />
        <AppRouter />
        <AIReceptionistWidget />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
export { API, BACKEND_URL };
