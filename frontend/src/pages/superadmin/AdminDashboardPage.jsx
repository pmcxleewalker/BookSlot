import React, { useState, useEffect } from 'react';
import SuperAdminLayout from '../../components/SuperAdminLayout';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Building2, Users, Calendar, DollarSign, TrendingUp, ArrowRight } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const AdminDashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [recentTenants, setRecentTenants] = useState([]);
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
      setRecentTenants(tenantsRes.data.tenants.slice(0, 5));
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { 
      label: 'Active Tenants', 
      value: stats?.tenants?.active || 0, 
      icon: Building2,
      color: 'bg-emerald-100 text-emerald-600',
      sub: `${stats?.tenants?.new_this_month || 0} new this month`
    },
    { 
      label: 'Monthly Revenue', 
      value: `€${stats?.revenue?.mrr || 0}`, 
      icon: DollarSign,
      color: 'bg-amber-100 text-amber-600',
      sub: 'MRR'
    },
    { 
      label: 'Total Users', 
      value: stats?.users?.total || 0, 
      icon: Users,
      color: 'bg-blue-100 text-blue-600',
      sub: 'Across all tenants'
    },
    { 
      label: 'Appointments', 
      value: stats?.appointments?.this_month || 0, 
      icon: Calendar,
      color: 'bg-purple-100 text-purple-600',
      sub: 'This month'
    },
  ];

  const planColors = {
    starter: 'bg-gray-100 text-gray-600',
    growth: 'bg-blue-100 text-blue-600',
    pro: 'bg-amber-100 text-amber-600'
  };

  return (
    <SuperAdminLayout title="Dashboard">
      {loading ? (
        <div className="text-[#666666]">Loading...</div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div key={idx} className="bg-white border border-[#E5E5E5] p-6 rounded-lg" data-testid={`admin-stat-${idx}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 ${stat.color} flex items-center justify-center rounded-lg`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-semibold text-[#0A0A0A] font-mono">{stat.value}</p>
                  <p className="text-sm text-[#666666]">{stat.label}</p>
                  <p className="text-xs text-[#999999] mt-1">{stat.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Plan Distribution */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-[#E5E5E5] p-6 rounded-lg">
              <h3 className="font-semibold text-[#0A0A0A] mb-4">Plan Distribution</h3>
              <div className="space-y-4">
                {['starter', 'growth', 'pro'].map((plan) => {
                  const count = stats?.plans?.[plan] || 0;
                  const total = stats?.tenants?.active || 1;
                  const percentage = Math.round((count / total) * 100);
                  return (
                    <div key={plan}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[#0A0A0A] capitalize">{plan}</span>
                        <span className="text-[#666666]">{count} tenants</span>
                      </div>
                      <div className="h-2 bg-[#E5E5E5] rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${plan === 'starter' ? 'bg-gray-500' : plan === 'growth' ? 'bg-blue-500' : 'bg-amber-500'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-[#E5E5E5] p-6 rounded-lg">
              <h3 className="font-semibold text-[#0A0A0A] mb-4">Revenue Breakdown</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-[#E5E5E5]">
                  <span className="text-[#666666]">Starter (€99/mo)</span>
                  <span className="text-[#0A0A0A] font-mono">€{(stats?.plans?.starter || 0) * 99}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#E5E5E5]">
                  <span className="text-[#666666]">Growth (€149/mo)</span>
                  <span className="text-[#0A0A0A] font-mono">€{(stats?.plans?.growth || 0) * 149}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#E5E5E5]">
                  <span className="text-[#666666]">Pro (€219/mo)</span>
                  <span className="text-[#0A0A0A] font-mono">€{(stats?.plans?.pro || 0) * 219}</span>
                </div>
                <div className="flex items-center justify-between py-2 pt-3">
                  <span className="text-[#0A0A0A] font-semibold">Total MRR</span>
                  <span className="text-[#E34A33] font-mono text-xl font-semibold">€{stats?.revenue?.mrr || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Tenants */}
          <div className="bg-white border border-[#E5E5E5] p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#0A0A0A]">Recent Tenants</h3>
              <Link to="/admin/tenants" className="text-sm text-[#666666] hover:text-[#0A0A0A] flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[#999999] text-sm">
                    <th className="pb-3">Business</th>
                    <th className="pb-3">Plan</th>
                    <th className="pb-3">Staff</th>
                    <th className="pb-3">Clients</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTenants.map((tenant) => (
                    <tr key={tenant.tenant_id} className="border-t border-[#E5E5E5]">
                      <td className="py-3">
                        <Link to={`/admin/tenants/${tenant.tenant_id}`} className="text-[#0A0A0A] hover:text-[#E34A33]">
                          {tenant.name}
                        </Link>
                        <p className="text-xs text-[#999999]">{tenant.email}</p>
                      </td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 rounded ${planColors[tenant.plan]} capitalize`}>
                          {tenant.plan}
                        </span>
                      </td>
                      <td className="py-3 text-[#666666] font-mono">{tenant.staff_count || 0}</td>
                      <td className="py-3 text-[#666666] font-mono">{tenant.client_count || 0}</td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 rounded ${tenant.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                          {tenant.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </SuperAdminLayout>
  );
};

export default AdminDashboardPage;
