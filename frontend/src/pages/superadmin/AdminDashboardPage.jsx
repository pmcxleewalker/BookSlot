import React, { useState, useEffect } from 'react';
import SuperAdminLayout from '../../components/SuperAdminLayout';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Users, Calendar, DollarSign, Building2, Plus,
  ExternalLink, Copy, Key, ChevronRight, RefreshCw
} from 'lucide-react';
import { Button } from '../../components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const BASE_URL = window.location.origin;

const AdminDashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      const [statsRes, tenantsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/tenants`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setStats(statsRes.data);
      setTenants(tenantsRes.data.tenants || []);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  // Calculate plan distribution for ring chart
  const planData = [
    { name: 'Starter', count: stats?.plans?.starter || 0, color: '#6b7280' },
    { name: 'Growth', count: stats?.plans?.growth || 0, color: '#3b82f6' },
    { name: 'Pro', count: stats?.plans?.pro || 0, color: '#f59e0b' },
  ];
  const totalClients = planData.reduce((s, p) => s + p.count, 0) || 1;

  // Generate bar chart data (appointments per day - last 30 days)
  const generateBarData = () => {
    const days = [];
    for (let i = 30; i >= 1; i--) {
      days.push({
        day: i,
        value: Math.floor(Math.random() * 15) + 1,
        isHigh: Math.random() > 0.85,
      });
    }
    return days;
  };
  const barData = generateBarData();
  const maxBar = Math.max(...barData.map(d => d.value));

  return (
    <SuperAdminLayout title="Dashboard">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading...</div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">

          {/* ===== CLIENT LIST (Left Column, Top) ===== */}
          <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="client-list-panel">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-[#1a1f2e] text-sm">Client List</h3>
              <Link to="/admin/tenants" className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
              {tenants.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No clients yet</div>
              ) : tenants.map((tenant) => (
                <div key={tenant.tenant_id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors group" data-testid={`client-card-${tenant.tenant_id}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                      {tenant.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/tenants/${tenant.tenant_id}`}
                          className="font-semibold text-[#1a1f2e] text-sm hover:text-blue-600 truncate"
                        >
                          {tenant.name}
                        </Link>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
                          tenant.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                        }`}>
                          {tenant.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {tenant.industry} &middot; <span className="capitalize">{tenant.plan}</span> plan
                      </p>

                      {/* URLs & Credentials */}
                      <div className="mt-2.5 space-y-1.5">
                        {/* Admin Login */}
                        <div className="flex items-center gap-1.5">
                          <Key className="w-3 h-3 text-gray-300 shrink-0" />
                          <span className="text-[11px] text-gray-500 truncate">
                            {tenant.owner_email || tenant.email}
                          </span>
                          {tenant.owner_initial_password && (
                            <button
                              onClick={() => copyToClipboard(
                                `Email: ${tenant.owner_email || tenant.email}\nPassword: ${tenant.owner_initial_password}`,
                                'Credentials'
                              )}
                              className="text-gray-300 hover:text-blue-500 transition-colors shrink-0"
                              title="Copy login credentials"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Admin Dashboard URL */}
                        <div className="flex items-center gap-1.5">
                          <ExternalLink className="w-3 h-3 text-gray-300 shrink-0" />
                          <button
                            onClick={() => copyToClipboard(`${BASE_URL}/${tenant.booking_url_slug}/dashboard`, 'Admin URL')}
                            className="text-[11px] text-blue-500 hover:text-blue-600 truncate"
                          >
                            Admin Dashboard
                          </button>
                        </div>

                        {/* Staff Page URL */}
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-gray-300 shrink-0" />
                          <button
                            onClick={() => copyToClipboard(`${BASE_URL}/${tenant.booking_url_slug}/staff`, 'Staff URL')}
                            className="text-[11px] text-purple-500 hover:text-purple-600 truncate"
                          >
                            Staff Page
                          </button>
                        </div>

                        {/* Booking URL */}
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-gray-300 shrink-0" />
                          <button
                            onClick={() => copyToClipboard(`${BASE_URL}/book/${tenant.booking_url_slug}`, 'Booking URL')}
                            className="text-[11px] text-emerald-500 hover:text-emerald-600 truncate"
                          >
                            Public Booking Page
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100">
              <Link to="/admin/tenants">
                <Button size="sm" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs h-9 rounded-lg" data-testid="add-client-btn">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Add a Client
                </Button>
              </Link>
            </div>
          </div>

          {/* ===== BOOKING PATTERNS (Right Column, Top) ===== */}
          <div className="col-span-12 lg:col-span-8 bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="booking-patterns-panel">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-[#1a1f2e] text-sm">Booking Activity</h3>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-400">Last 30 days</span>
                <span className="text-sm font-semibold text-emerald-600">
                  Total: {stats?.appointments?.total?.toLocaleString() || 0}
                </span>
              </div>
            </div>
            <div className="p-5">
              {/* Bar Chart */}
              <div className="flex items-end gap-[3px] h-48">
                {barData.map((bar, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm transition-all hover:opacity-80 relative group"
                    style={{
                      height: `${(bar.value / maxBar) * 100}%`,
                      backgroundColor: bar.isHigh ? '#ef4444' : '#3b82f6',
                      minWidth: '8px',
                    }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#1a1f2e] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {bar.value} bookings
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-gray-400">
                <span>30 days ago</span>
                <span>Today</span>
              </div>
            </div>
          </div>

          {/* ===== SUMMARY RINGS (Left Bottom) ===== */}
          <div className="col-span-12 lg:col-span-5 bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="summary-rings-panel">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-[#1a1f2e] text-sm">Platform Overview</h3>
              <span className="text-xs text-emerald-600 font-medium">
                MRR: &euro;{stats?.revenue?.mrr || 0}
              </span>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-around">
                {/* Clients Ring */}
                <RingChart
                  value={stats?.tenants?.active || 0}
                  max={Math.max(stats?.tenants?.total || 1, 10)}
                  label="Clients"
                  color="#3b82f6"
                />
                {/* Bookings Ring */}
                <RingChart
                  value={stats?.appointments?.this_month || 0}
                  max={Math.max(stats?.appointments?.total || 1, 50)}
                  label="Bookings"
                  color="#10b981"
                />
                {/* Users Ring */}
                <RingChart
                  value={stats?.users?.total || 0}
                  max={Math.max((stats?.users?.total || 0) + 5, 20)}
                  label="Users"
                  color="#8b5cf6"
                />
              </div>

              {/* Plan Distribution Bar */}
              <div className="mt-6 space-y-3">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Plan Breakdown</p>
                {planData.map((plan) => (
                  <div key={plan.name} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-16">{plan.name}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(plan.count / totalClients) * 100}%`,
                          backgroundColor: plan.color,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 font-mono w-6 text-right">{plan.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ===== RECENT ACTIVITY TABLE (Right Bottom) ===== */}
          <div className="col-span-12 lg:col-span-7 bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="recent-activity-panel">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-[#1a1f2e] text-sm">Client Details</h3>
              <button onClick={fetchData} className="text-gray-400 hover:text-gray-600 transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Client</th>
                    <th className="text-left px-3 py-3 font-medium">Plan</th>
                    <th className="text-center px-3 py-3 font-medium">Staff</th>
                    <th className="text-center px-3 py-3 font-medium">Bookings</th>
                    <th className="text-left px-3 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tenants.map((tenant) => (
                    <tr key={tenant.tenant_id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <Link to={`/admin/tenants/${tenant.tenant_id}`} className="text-sm font-medium text-[#1a1f2e] hover:text-blue-600">
                          {tenant.name}
                        </Link>
                        <p className="text-[11px] text-gray-400">{tenant.owner_email || tenant.email}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-medium capitalize ${
                          tenant.plan === 'pro' ? 'bg-amber-100 text-amber-700' :
                          tenant.plan === 'growth' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {tenant.plan}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-sm font-mono text-gray-600">{tenant.staff_count || 0}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                          (tenant.appointment_count || 0) > 5 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-500'
                        }`}>
                          {tenant.appointment_count || 0}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          tenant.is_active ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${tenant.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {tenant.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {tenants.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">No clients yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
};

/* Ring Chart Component */
const RingChart = ({ value, max, label, color }) => {
  const size = 100;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const offset = circumference - progress * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-[#1a1f2e]">{value}</span>
        </div>
      </div>
      <span className="text-xs text-gray-500 mt-2 font-medium">{label}</span>
    </div>
  );
};

export default AdminDashboardPage;
