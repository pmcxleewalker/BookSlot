import React, { useState, useEffect } from 'react';
import SuperAdminLayout from '../../components/SuperAdminLayout';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Building2, Users, Calendar, DollarSign, TrendingUp, ArrowRight } from 'lucide-react';

import { API } from '../../lib/api';

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
      color: 'bg-emerald-500/20 text-emerald-400',
      sub: `${stats?.tenants?.new_this_month || 0} new this month`
    },
    { 
      label: 'Monthly Revenue', 
      value: `€${stats?.revenue?.mrr || 0}`, 
      icon: DollarSign,
      color: 'bg-amber-500/20 text-amber-400',
      sub: 'MRR'
    },
    { 
      label: 'Total Users', 
      value: stats?.users?.total || 0, 
      icon: Users,
      color: 'bg-blue-500/20 text-blue-400',
      sub: 'Across all tenants'
    },
    { 
      label: 'Appointments', 
      value: stats?.appointments?.this_month || 0, 
      icon: Calendar,
      color: 'bg-purple-500/20 text-purple-400',
      sub: 'This month'
    },
  ];

  const planColors = {
    starter: 'bg-gray-500/20 text-gray-300',
    growth: 'bg-blue-500/20 text-blue-400',
    pro: 'bg-amber-500/20 text-amber-400'
  };

  return (
    <SuperAdminLayout title="Dashboard">
      {loading ? (
        <div className="text-white/60">Loading...</div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div key={idx} className="bg-[#121212] border border-white/10 p-6" data-testid={`admin-stat-${idx}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 ${stat.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-semibold text-white font-mono">{stat.value}</p>
                  <p className="text-sm text-white/60">{stat.label}</p>
                  <p className="text-xs text-white/40 mt-1">{stat.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Plan Distribution */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-[#121212] border border-white/10 p-6">
              <h3 className="font-semibold text-white mb-4">Plan Distribution</h3>
              <div className="space-y-4">
                {['starter', 'growth', 'pro'].map((plan) => {
                  const count = stats?.plans?.[plan] || 0;
                  const total = stats?.tenants?.active || 1;
                  const percentage = Math.round((count / total) * 100);
                  return (
                    <div key={plan}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/80 capitalize">{plan}</span>
                        <span className="text-white/60">{count} tenants</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
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

            <div className="bg-[#121212] border border-white/10 p-6">
              <h3 className="font-semibold text-white mb-4">Revenue Breakdown</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-white/60">Starter (€29/mo)</span>
                  <span className="text-white font-mono">€{(stats?.plans?.starter || 0) * 29}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-white/60">Growth (€79/mo)</span>
                  <span className="text-white font-mono">€{(stats?.plans?.growth || 0) * 79}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-white/60">Pro (€149/mo)</span>
                  <span className="text-white font-mono">€{(stats?.plans?.pro || 0) * 149}</span>
                </div>
                <div className="flex items-center justify-between py-2 pt-3">
                  <span className="text-white font-semibold">Total MRR</span>
                  <span className="text-[#E34A33] font-mono text-xl font-semibold">€{stats?.revenue?.mrr || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Tenants */}
          <div className="bg-[#121212] border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Recent Tenants</h3>
              <Link to="/admin/tenants" className="text-sm text-white/60 hover:text-white flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-white/40 text-sm">
                    <th className="pb-3">Business</th>
                    <th className="pb-3">Plan</th>
                    <th className="pb-3">Staff</th>
                    <th className="pb-3">Clients</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTenants.map((tenant) => (
                    <tr key={tenant.tenant_id} className="border-t border-white/5">
                      <td className="py-3">
                        <Link to={`/admin/tenants/${tenant.tenant_id}`} className="text-white hover:text-[#E34A33]">
                          {tenant.name}
                        </Link>
                        <p className="text-xs text-white/40">{tenant.email}</p>
                      </td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 ${planColors[tenant.plan]} capitalize`}>
                          {tenant.plan}
                        </span>
                      </td>
                      <td className="py-3 text-white/60 font-mono">{tenant.staff_count || 0}</td>
                      <td className="py-3 text-white/60 font-mono">{tenant.client_count || 0}</td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 ${tenant.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
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
