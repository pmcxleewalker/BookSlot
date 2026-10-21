import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from 'sonner';

// Pages - Public
import LandingPage from './pages/public/LandingPage';
import FeaturesPage from './pages/public/FeaturesPage';
import LoginPage from './pages/public/LoginPage';
import SignupPage from './pages/public/SignupPage';
import ForgotPasswordPage from './pages/public/ForgotPasswordPage';
import ResetPasswordPage from './pages/public/ResetPasswordPage';
import PublicBookingPage from './pages/public/PublicBookingPage';
import ManageBookingPage from './pages/public/ManageBookingPage';

// Pages - Business dashboard
import DashboardPage from './pages/admin/DashboardPage';
import CalendarPage from './pages/admin/CalendarPage';
import StaffPage from './pages/admin/StaffPage';
import ServicesPage from './pages/admin/ServicesPage';
import ClientsPage from './pages/admin/ClientsPage';
import FormsPage from './pages/admin/FormsPage';
import ReportsPage from './pages/admin/ReportsPage';
import SettingsPage from './pages/admin/SettingsPage';
import OnboardingPage from './pages/admin/OnboardingPage';
import MoltbotPage from './pages/admin/MoltbotPage';

// Pages - Super Admin
import AdminLoginPage from './pages/superadmin/AdminLoginPage';
import AdminDashboardPage from './pages/superadmin/AdminDashboardPage';
import AdminTenantsPage from './pages/superadmin/AdminTenantsPage';
import AdminTenantDetailPage from './pages/superadmin/AdminTenantDetailPage';

import EliteBorder from './components/EliteBorder';
import { ThemeProvider } from './context/ThemeContext';
import { API, BACKEND_URL } from './lib/api';

axios.defaults.withCredentials = true;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const readToken = () => {
  try { return localStorage.getItem('token'); } catch (e) { return null; }
};
const writeToken = (token) => {
  try {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  } catch (e) { /* storage unavailable */ }
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setTokenState] = useState(readToken());

  const setToken = useCallback((newToken) => {
    writeToken(newToken);
    if (newToken) axios.defaults.headers.common.Authorization = `Bearer ${newToken}`;
    else delete axios.defaults.headers.common.Authorization;
    setTokenState(newToken);
  }, []);

  // keep the default header in sync on first load
  if (token && axios.defaults.headers.common.Authorization !== `Bearer ${token}`) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  const loadTenant = useCallback(async () => {
    const res = await axios.get(`${API}/tenants/me`);
    setTenant(res.data.tenant);
    return res.data.tenant;
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
      if (response.data.tenant_id) await loadTenant();
      else setTenant(null);
    } catch (error) {
      setUser(null);
      setTenant(null);
      if (error?.response?.status === 401) setToken(null);
    } finally {
      setLoading(false);
    }
  }, [loadTenant, setToken]);

  useEffect(() => { checkAuth(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // If the session expires while the app is open, send the user back to login
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (r) => r,
      (error) => {
        const url = error?.config?.url || '';
        if (error?.response?.status === 401 && user && !url.includes('/auth/') && !url.includes('/admin/')) {
          setToken(null);
          setUser(null);
          setTenant(null);
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, [user, setToken]);

  const startSession = async (data) => {
    setToken(data.token);
    // re-read /auth/me so permissions are included
    const me = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${data.token}` } });
    setUser(me.data);
    if (me.data.tenant_id) await loadTenant();
    else setTenant(null);
    return me.data;
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    return startSession(response.data);
  };

  const register = async (name, email, password) => {
    const response = await axios.post(`${API}/auth/register`, { name, email, password });
    return startSession(response.data);
  };

  const googleLogin = async (credential) => {
    const response = await axios.post(`${API}/auth/google`, { credential });
    return startSession(response.data);
  };

  const logout = async () => {
    try { await axios.post(`${API}/auth/logout`); } catch (e) { /* ignore */ }
    setToken(null);
    setUser(null);
    setTenant(null);
  };

  const createTenant = async (tenantData) => {
    const response = await axios.post(`${API}/tenants`, tenantData);
    await checkAuth();
    return response.data.tenant;
  };

  const updateTenant = async (updates) => {
    const response = await axios.put(`${API}/tenants/me`, updates);
    setTenant(response.data.tenant);
    return response.data.tenant;
  };

  const can = (perm) => !!(user?.is_manager || user?.permissions?.[perm]);

  const value = {
    user, tenant, token, loading, login, register, googleLogin, logout, createTenant, updateTenant,
    checkAuth, refreshTenant: loadTenant, setSession: startSession,
    isAuthenticated: !!user, isManager: !!user?.is_manager, can,
    currency: tenant?.currency || 'EUR',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const FullPageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="w-8 h-8 border-2 border-[#121212] border-t-transparent rounded-full animate-spin" />
  </div>
);

const NoAccess = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] p-6">
    <div className="text-center max-w-sm">
      <h1 className="text-xl font-semibold text-[#0A0A0A] mb-2">No access</h1>
      <p className="text-[#666666] mb-4">You don't have permission to view this page. Ask the business owner if you need access.</p>
      <a href="/calendar" className="text-[#E34A33] hover:underline">Go to calendar</a>
    </div>
  </div>
);

// Protected Route: requires login (and optionally a permission)
const ProtectedRoute = ({ children, perm, manager }) => {
  const { user, loading, tenant, can, isManager } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!tenant && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  if (tenant?.onboarding_completed && location.pathname === '/onboarding') return <Navigate to="/dashboard" replace />;
  if (manager && !isManager) return <NoAccess />;
  if (perm && !can(perm)) return <NoAccess />;
  return children;
};

const AppRouter = () => (
  <Routes>
    {/* Public */}
    <Route path="/" element={<LandingPage />} />
    <Route path="/features" element={<FeaturesPage />} />
    <Route path="/pricing" element={<Navigate to="/" replace />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/book/:slug" element={<PublicBookingPage />} />
    <Route path="/booking/:confirmationCode" element={<ManageBookingPage />} />

    {/* Business dashboard */}
    <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
    <Route path="/staff" element={<ProtectedRoute><StaffPage /></ProtectedRoute>} />
    <Route path="/services" element={<ProtectedRoute><ServicesPage /></ProtectedRoute>} />
    <Route path="/clients" element={<ProtectedRoute perm="can_manage_customers"><ClientsPage /></ProtectedRoute>} />
    <Route path="/forms" element={<ProtectedRoute manager><FormsPage /></ProtectedRoute>} />
    <Route path="/reports" element={<ProtectedRoute perm="can_view_reports"><ReportsPage /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    <Route path="/moltbot" element={<ProtectedRoute><MoltbotPage /></ProtectedRoute>} />

    {/* Old links */}
    <Route path="/appointments" element={<Navigate to="/calendar" replace />} />
    <Route path="/resources" element={<Navigate to="/settings" replace />} />
    <Route path="/messages" element={<Navigate to="/moltbot" replace />} />
    <Route path="/integrations" element={<Navigate to="/settings" replace />} />

    {/* Super Admin */}
    <Route path="/admin" element={<AdminLoginPage />} />
    <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
    <Route path="/admin/tenants" element={<AdminTenantsPage />} />
    <Route path="/admin/tenants/:tenantId" element={<AdminTenantDetailPage />} />

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider initialTheme="default">
          <Toaster position="top-right" richColors closeButton />
          <EliteBorder />
          <AppRouter />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
export { API, BACKEND_URL };
