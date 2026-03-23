import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Building2, ArrowLeft, Users, Calendar, DollarSign, 
  ExternalLink, Mail, Phone, MapPin, Globe, Edit, 
  Ban, CheckCircle, Trash2, Settings
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AdminTenantDetail() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    loadTenant();
  }, [tenantId]);

  const loadTenant = async () => {
    try {
      const sessionToken = localStorage.getItem('admin_session_token');
      const response = await fetch(`${API_URL}/api/admin/tenants/${tenantId}`, {
        credentials: 'include',
        headers: {
          'X-Admin-Token': sessionToken || ''
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTenant(data);
        setEditData({
          name: data.tenant?.name,
          email: data.tenant?.email,
          phone: data.tenant?.phone,
          address: data.tenant?.address,
          city: data.tenant?.city,
          country: data.tenant?.country
        });
      } else {
        toast.error('Failed to load tenant');
        navigate('/admin/tenants');
      }
    } catch (error) {
      console.error('Failed to load tenant:', error);
      toast.error('Failed to load tenant');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    try {
      const sessionToken = localStorage.getItem('admin_session_token');
      const response = await fetch(`${API_URL}/api/admin/tenants/${tenantId}/suspend`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-Admin-Token': sessionToken || ''
        }
      });
      
      if (response.ok) {
        toast.success('Tenant suspended');
        loadTenant();
      } else {
        toast.error('Failed to suspend tenant');
      }
    } catch (error) {
      toast.error('Failed to suspend tenant');
    }
  };

  const handleActivate = async () => {
    try {
      const sessionToken = localStorage.getItem('admin_session_token');
      const response = await fetch(`${API_URL}/api/admin/tenants/${tenantId}/activate`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-Admin-Token': sessionToken || ''
        }
      });
      
      if (response.ok) {
        toast.success('Tenant activated');
        loadTenant();
      } else {
        toast.error('Failed to activate tenant');
      }
    } catch (error) {
      toast.error('Failed to activate tenant');
    }
  };

  const handleUpdatePlan = async (newPlan) => {
    try {
      const sessionToken = localStorage.getItem('admin_session_token');
      const response = await fetch(`${API_URL}/api/admin/tenants/${tenantId}/subscription`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Token': sessionToken || ''
        },
        credentials: 'include',
        body: JSON.stringify({ plan: newPlan })
      });
      
      if (response.ok) {
        toast.success(`Plan updated to ${newPlan}`);
        loadTenant();
      } else {
        toast.error('Failed to update plan');
      }
    } catch (error) {
      toast.error('Failed to update plan');
    }
  };

  const handleDelete = async () => {
    try {
      const sessionToken = localStorage.getItem('admin_session_token');
      const response = await fetch(`${API_URL}/api/admin/tenants/${tenantId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'X-Admin-Token': sessionToken || ''
        }
      });
      
      if (response.ok) {
        toast.success('Tenant deleted');
        navigate('/admin/tenants');
      } else {
        toast.error('Failed to delete tenant');
      }
    } catch (error) {
      toast.error('Failed to delete tenant');
    }
  };

  const handleSaveEdit = async () => {
    try {
      const sessionToken = localStorage.getItem('admin_session_token');
      const response = await fetch(`${API_URL}/api/admin/tenants/${tenantId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Token': sessionToken || ''
        },
        credentials: 'include',
        body: JSON.stringify(editData)
      });
      
      if (response.ok) {
        toast.success('Tenant updated');
        setEditMode(false);
        loadTenant();
      } else {
        toast.error('Failed to update tenant');
      }
    } catch (error) {
      toast.error('Failed to update tenant');
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Loading...">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-32 bg-slate-700 rounded" />
          <div className="bg-slate-800 rounded-2xl h-64" />
        </div>
      </AdminLayout>
    );
  }

  if (!tenant) return null;

  const { tenant: t, subscription, owner, stats } = tenant;

  return (
    <AdminLayout title={t.name}>
      <div className="space-y-6">
        {/* Back & Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/admin/tenants')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tenants
          </button>
          <div className="flex gap-2">
            <a
              href={`${window.location.origin}/book/${t.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Booking Page
            </a>
            {t.is_active ? (
              <Button
                variant="outline"
                onClick={handleSuspend}
                className="rounded-xl border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
              >
                <Ban className="w-4 h-4 mr-2" />
                Suspend
              </Button>
            ) : (
              <Button
                onClick={handleActivate}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Activate
              </Button>
            )}
          </div>
        </div>

        {/* Status Banner */}
        {!t.is_active && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
            <Ban className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-medium">This tenant is currently suspended</span>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Business Details */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700">
              <div className="p-5 border-b border-slate-700 flex items-center justify-between">
                <h2 className="font-semibold text-white" style={{ fontFamily: 'Outfit' }}>
                  Business Details
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                  className="text-slate-400 hover:text-white"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  {editMode ? 'Cancel' : 'Edit'}
                </Button>
              </div>
              <div className="p-5">
                {editMode ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-slate-300">Business Name</Label>
                      <Input
                        value={editData.name || ''}
                        onChange={(e) => setEditData({...editData, name: e.target.value})}
                        className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-300">Email</Label>
                        <Input
                          value={editData.email || ''}
                          onChange={(e) => setEditData({...editData, email: e.target.value})}
                          className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Phone</Label>
                        <Input
                          value={editData.phone || ''}
                          onChange={(e) => setEditData({...editData, phone: e.target.value})}
                          className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-300">Address</Label>
                      <Input
                        value={editData.address || ''}
                        onChange={(e) => setEditData({...editData, address: e.target.value})}
                        className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-300">City</Label>
                        <Input
                          value={editData.city || ''}
                          onChange={(e) => setEditData({...editData, city: e.target.value})}
                          className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Country</Label>
                        <Input
                          value={editData.country || ''}
                          onChange={(e) => setEditData({...editData, country: e.target.value})}
                          className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleSaveEdit}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                    >
                      Save Changes
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-2xl font-bold">
                        {t.name?.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">{t.name}</h3>
                        <p className="text-slate-400 capitalize">{t.industry}</p>
                        <p className="text-xs text-slate-500 mt-1">ID: {t.tenant_id}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700/50">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Mail className="w-4 h-4 text-slate-500" />
                        {t.email || '-'}
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <Phone className="w-4 h-4 text-slate-500" />
                        {t.phone || '-'}
                      </div>
                      <div className="flex items-center gap-2 text-slate-300 col-span-2">
                        <MapPin className="w-4 h-4 text-slate-500" />
                        {[t.address, t.city, t.country].filter(Boolean).join(', ') || '-'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Staff', value: stats?.staff_count || 0, icon: Users, color: 'text-blue-400' },
                { label: 'Services', value: stats?.services_count || 0, icon: Settings, color: 'text-purple-400' },
                { label: 'Clients', value: stats?.clients_count || 0, icon: Users, color: 'text-emerald-400' },
                { label: 'Appointments', value: stats?.appointments_count || 0, icon: Calendar, color: 'text-amber-400' },
              ].map((stat, i) => (
                <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                  <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-slate-400">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Owner Info */}
            {owner && (
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
                <h3 className="font-semibold text-white mb-4" style={{ fontFamily: 'Outfit' }}>Owner Account</h3>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 font-medium">
                    {owner.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-white">{owner.name}</p>
                    <p className="text-sm text-slate-400">{owner.email}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Subscription */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
              <h3 className="font-semibold text-white mb-4" style={{ fontFamily: 'Outfit' }}>Subscription</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Current Plan</span>
                  <span className="text-white font-medium capitalize">{subscription?.plan}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Price</span>
                  <span className="text-white">€{subscription?.price_monthly}/mo</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Max Staff</span>
                  <span className="text-white">{subscription?.max_staff}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Max Locations</span>
                  <span className="text-white">{subscription?.max_locations}</span>
                </div>
                {subscription?.is_trial && (
                  <div className="bg-amber-500/10 text-amber-400 text-sm rounded-lg px-3 py-2 text-center">
                    Trial Period
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Change Plan</p>
                <div className="flex flex-wrap gap-2">
                  {['starter', 'growth', 'pro'].map(plan => (
                    <button
                      key={plan}
                      onClick={() => handleUpdatePlan(plan)}
                      disabled={subscription?.plan === plan}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        subscription?.plan === plan
                          ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {plan}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Revenue */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
              <h3 className="font-semibold text-white mb-4" style={{ fontFamily: 'Outfit' }}>Revenue</h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">€{(stats?.total_revenue || 0).toLocaleString()}</p>
                  <p className="text-sm text-slate-400">Total Revenue</p>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
              <h3 className="font-semibold text-red-400 mb-3" style={{ fontFamily: 'Outfit' }}>Danger Zone</h3>
              <p className="text-sm text-slate-400 mb-4">
                Permanently delete this tenant and all associated data. This action cannot be undone.
              </p>
              {showDeleteConfirm ? (
                <div className="space-y-3">
                  <p className="text-sm text-red-400">Are you sure? Type the business name to confirm:</p>
                  <Input
                    placeholder={t.name}
                    className="bg-slate-900/50 border-red-500/30 text-white rounded-xl"
                    id="delete-confirm"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 rounded-xl border-slate-600 text-slate-300"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        const input = document.getElementById('delete-confirm');
                        if (input.value === t.name) {
                          handleDelete();
                        } else {
                          toast.error('Name does not match');
                        }
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl"
                    >
                      Delete Forever
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="outline"
                  className="w-full rounded-xl border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Tenant
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
