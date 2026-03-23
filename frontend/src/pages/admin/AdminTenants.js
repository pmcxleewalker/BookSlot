import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Building2, Search, Filter, Plus, ChevronRight, 
  Users, Calendar, MoreVertical, ExternalLink
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AdminTenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadTenants();
  }, [search, filterPlan, filterIndustry]);

  const loadTenants = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filterPlan) params.append('plan', filterPlan);
      if (filterIndustry) params.append('industry', filterIndustry);

      const sessionToken = localStorage.getItem('admin_session_token');
      const response = await fetch(`${API_URL}/api/admin/tenants?${params}`, {
        credentials: 'include',
        headers: {
          'X-Admin-Token': sessionToken || ''
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants);
      } else {
        toast.error('Failed to load tenants');
      }
    } catch (error) {
      console.error('Failed to load tenants:', error);
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const getPlanBadgeColor = (plan) => {
    switch (plan) {
      case 'pro': return 'bg-emerald-500/20 text-emerald-400';
      case 'growth': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <AdminLayout title="Manage Tenants">
      <div className="space-y-6">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <Input
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl"
              data-testid="admin-search-tenants"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
            >
              <option value="">All Plans</option>
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="pro">Pro</option>
            </select>
            <select
              value={filterIndustry}
              onChange={(e) => setFilterIndustry(e.target.value)}
              className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
            >
              <option value="">All Industries</option>
              <option value="salon">Salon</option>
              <option value="clinic">Clinic</option>
              <option value="dentist">Dentist</option>
              <option value="doctor">Doctor</option>
              <option value="consultant">Consultant</option>
              <option value="other">Other</option>
            </select>
            <Link to="/admin/tenants/new">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                Add Tenant
              </Button>
            </Link>
          </div>
        </div>

        {/* Tenants Table */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-12 h-12 rounded-xl bg-slate-700" />
                  <div className="flex-1">
                    <div className="h-4 w-40 bg-slate-700 rounded mb-2" />
                    <div className="h-3 w-24 bg-slate-700 rounded" />
                  </div>
                  <div className="h-6 w-16 bg-slate-700 rounded-full" />
                </div>
              ))}
            </div>
          ) : tenants.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No tenants found</h3>
              <p className="text-slate-400 mb-6">
                {search ? 'Try adjusting your search or filters' : 'Get started by adding your first tenant'}
              </p>
              <Link to="/admin/tenants/new">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Tenant
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Tenant</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Industry</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Plan</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Staff</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Appointments</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-right p-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {tenants.map((tenant) => (
                    <tr 
                      key={tenant.tenant_id} 
                      className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/tenants/${tenant.tenant_id}`)}
                      data-testid={`tenant-row-${tenant.tenant_id}`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-medium">
                            {tenant.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-white">{tenant.name}</p>
                            <p className="text-xs text-slate-400">{tenant.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-slate-300 capitalize">{tenant.industry}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getPlanBadgeColor(tenant.subscription?.plan)}`}>
                          {tenant.subscription?.plan || 'none'}
                          {tenant.subscription?.is_trial && ' (trial)'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Users className="w-4 h-4 text-slate-500" />
                          <span className="text-sm">{tenant.staff_count || 0}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <span className="text-sm">{tenant.total_appointments || 0}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          tenant.is_active 
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {tenant.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`${window.location.origin}/book/${tenant.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"
                            title="View booking page"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <ChevronRight className="w-5 h-5 text-slate-500" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
