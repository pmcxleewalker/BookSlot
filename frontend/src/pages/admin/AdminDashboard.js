import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, Users, Calendar, TrendingUp, DollarSign, 
  AlertCircle, ArrowRight, PlusCircle, Activity
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const sessionToken = localStorage.getItem('admin_session_token');
      const response = await fetch(`${API_URL}/api/admin/stats`, {
        credentials: 'include',
        headers: {
          'X-Admin-Token': sessionToken || ''
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        toast.error('Failed to load stats');
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const statCards = stats ? [
    { 
      label: 'Total Tenants', 
      value: stats.total_tenants, 
      icon: Building2, 
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-500/10',
      textColor: 'text-emerald-400'
    },
    { 
      label: 'Active Tenants', 
      value: stats.active_tenants, 
      icon: Users, 
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-400'
    },
    { 
      label: 'Total Appointments', 
      value: stats.total_appointments.toLocaleString(), 
      icon: Calendar, 
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-500/10',
      textColor: 'text-amber-400'
    },
    { 
      label: 'Total Revenue', 
      value: `€${stats.total_revenue.toLocaleString()}`, 
      icon: DollarSign, 
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/10',
      textColor: 'text-purple-400'
    },
  ] : [];

  return (
    <AdminLayout title="Dashboard Overview">
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/tenants/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl" data-testid="admin-add-tenant-btn">
              <PlusCircle className="w-4 h-4 mr-2" />
              Add New Tenant
            </Button>
          </Link>
          <Link to="/admin/tenants">
            <Button variant="outline" className="rounded-xl border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700">
              <Building2 className="w-4 h-4 mr-2" />
              View All Tenants
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-slate-800 rounded-2xl border border-slate-700 p-6 animate-pulse">
                <div className="w-12 h-12 rounded-xl bg-slate-700 mb-4" />
                <div className="h-8 w-20 bg-slate-700 rounded mb-2" />
                <div className="h-4 w-28 bg-slate-700 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat, index) => (
              <div 
                key={index}
                className="bg-slate-800 rounded-2xl border border-slate-700 p-6 hover:border-slate-600 transition-colors"
                data-testid={`admin-stat-${index}`}
              >
                <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center mb-4`}>
                  <stat.icon className={`w-6 h-6 ${stat.textColor}`} />
                </div>
                <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Signups */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700">
            <div className="p-5 border-b border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-white" style={{ fontFamily: 'Outfit' }}>
                Recent Signups
              </h2>
              <Link to="/admin/tenants" className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="p-5">
              {loading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-10 h-10 rounded-xl bg-slate-700" />
                      <div className="flex-1">
                        <div className="h-4 w-32 bg-slate-700 rounded mb-2" />
                        <div className="h-3 w-24 bg-slate-700 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : stats?.recent_signups?.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No tenants yet</p>
                  <Link to="/admin/tenants/new">
                    <Button variant="outline" className="mt-4 rounded-xl border-slate-600">
                      Add First Tenant
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats?.recent_signups?.map((tenant) => (
                    <Link
                      key={tenant.tenant_id}
                      to={`/admin/tenants/${tenant.tenant_id}`}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-700/50 transition-colors"
                      data-testid={`recent-tenant-${tenant.tenant_id}`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-medium text-sm">
                        {tenant.name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{tenant.name}</p>
                        <p className="text-xs text-slate-400 capitalize">{tenant.industry}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        tenant.is_active 
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {tenant.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Distribution Cards */}
          <div className="space-y-6">
            {/* By Plan */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
              <h2 className="font-semibold text-white mb-4" style={{ fontFamily: 'Outfit' }}>
                Tenants by Plan
              </h2>
              {loading ? (
                <div className="space-y-3 animate-pulse">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-3 flex-1 bg-slate-700 rounded" />
                      <div className="h-4 w-8 bg-slate-700 rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {['starter', 'growth', 'pro'].map((plan) => {
                    const count = stats?.tenants_by_plan?.[plan] || 0;
                    const total = stats?.total_tenants || 1;
                    const percentage = Math.round((count / total) * 100);
                    const colors = {
                      starter: 'bg-slate-500',
                      growth: 'bg-blue-500',
                      pro: 'bg-emerald-500'
                    };
                    return (
                      <div key={plan} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-300 capitalize">{plan}</span>
                          <span className="text-white font-medium">{count}</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${colors[plan]} rounded-full transition-all`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* By Industry */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
              <h2 className="font-semibold text-white mb-4" style={{ fontFamily: 'Outfit' }}>
                Tenants by Industry
              </h2>
              {loading ? (
                <div className="grid grid-cols-2 gap-2 animate-pulse">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-10 bg-slate-700 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(stats?.tenants_by_industry || {}).map(([industry, count]) => (
                    <div 
                      key={industry}
                      className="bg-slate-700/50 rounded-xl px-3 py-2 flex items-center justify-between"
                    >
                      <span className="text-sm text-slate-300 capitalize">{industry}</span>
                      <span className="text-white font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Trial Alert */}
            {stats?.trial_tenants > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-400">Trial Accounts</p>
                  <p className="text-sm text-amber-300/70 mt-0.5">
                    {stats.trial_tenants} tenant{stats.trial_tenants > 1 ? 's' : ''} on trial period
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
