import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import SuperAdminLayout from '../../components/SuperAdminLayout';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { 
  ArrowLeft, Building2, Users, Briefcase, Calendar, 
  Mail, Phone, MapPin, Globe, Check, X, UserCog, Save
} from 'lucide-react';

import { API } from '../../lib/api';

// What each plan really includes today (keep in sync with backend/core/plans.py)
const PLAN_FEATURES = {
  starter: {
    name: "Starter", price: 29, max_staff: 2,
    features: { online_booking: true, calendar: true, clients: true, email_reminders: true, reports: true, ai_assistant: false, custom_forms: false, white_label: false, api_webhooks: false }
  },
  growth: {
    name: "Growth", price: 79, max_staff: 8,
    features: { online_booking: true, calendar: true, clients: true, email_reminders: true, reports: true, ai_assistant: true, custom_forms: false, white_label: false, api_webhooks: false }
  },
  pro: {
    name: "Pro", price: 149, max_staff: 999,
    features: { online_booking: true, calendar: true, clients: true, email_reminders: true, reports: true, ai_assistant: true, custom_forms: true, white_label: true, api_webhooks: true }
  }
};

const featureLabels = {
  online_booking: "Online booking page",
  calendar: "Calendar & manual bookings",
  clients: "Client list & history",
  email_reminders: "Email confirmations & reminders",
  reports: "Reports & exports",
  ai_assistant: "AI receptionist (web chat, SMS, WhatsApp)",
  custom_forms: "Intake forms",
  white_label: "Remove BookSlot branding",
  api_webhooks: "API & webhooks"
};

const COMING_SOON = ["Online deposits", "Google Calendar sync", "Waitlist", "Packages", "Multi-location", "Resource booking"];

const AdminTenantDetailPage = () => {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [owner, setOwner] = useState(null);
  const [stats, setStats] = useState(null);
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    plan: '',
    is_active: true,
    sms_number: '',
    whatsapp_number: '',
    sms_addon_enabled: false
  });

  useEffect(() => {
    fetchTenantDetails();
  }, [tenantId]);

  const fetchTenantDetails = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      const response = await axios.get(`${API}/admin/tenants/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data;
      setTenant(data.tenant);
      setOwner(data.owner);
      setStats(data.stats);
      setFeatures(data.features);
      setFormData({
        name: data.tenant.name,
        email: data.tenant.email,
        phone: data.tenant.phone || '',
        address: data.tenant.address || '',
        plan: data.tenant.plan,
        is_active: data.tenant.is_active,
        sms_number: data.tenant.sms_number || '',
        whatsapp_number: data.tenant.whatsapp_number || '',
        sms_addon_enabled: !!data.tenant.sms_addon_enabled
      });
    } catch (error) {
      toast.error('Failed to load tenant details');
      navigate('/admin/tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem('admin_token');
    
    try {
      const response = await axios.put(`${API}/admin/tenants/${tenantId}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTenant(response.data.tenant);
      setFeatures(response.data.features);
      setEditMode(false);
      
      if (response.data.plan_changed) {
        toast.success('Plan updated! Features have been adjusted.');
      } else {
        toast.success('Tenant updated successfully');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update tenant');
    } finally {
      setSaving(false);
    }
  };

  const handleImpersonate = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      const response = await axios.post(`${API}/admin/impersonate/${owner.user_id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Same tab: Safari blocks new tabs opened after a network request.
      // The admin login is kept, so /admin still works afterwards.
      localStorage.setItem('token', response.data.token);
      window.location.assign('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not open the owner view');
    }
  };

  if (loading) {
    return (
      <SuperAdminLayout title="Tenant Details">
        <div className="text-white/60">Loading...</div>
      </SuperAdminLayout>
    );
  }

  const currentPlanFeatures = PLAN_FEATURES[formData.plan]?.features || {};

  return (
    <SuperAdminLayout title="Tenant Details">
      <div className="mb-6">
        <Link to="/admin/tenants" className="flex items-center gap-2 text-white/60 hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Tenants
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Business Details Card */}
          <div className="bg-[#121212] border border-white/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/10 flex items-center justify-center text-white text-xl font-semibold">
                  {tenant?.name?.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{tenant?.name}</h2>
                  <p className="text-sm text-white/40 capitalize">{tenant?.industry}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {!editMode ? (
                  <Button 
                    variant="outline" 
                    className="border-white/10 text-white hover:bg-white/5"
                    onClick={() => setEditMode(true)}
                    data-testid="edit-tenant-btn"
                  >
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      className="border-white/10 text-white hover:bg-white/5"
                      onClick={() => setEditMode(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      className="bg-[#E34A33] hover:bg-[#c73d2a] text-white flex items-center gap-2"
                      onClick={handleSave}
                      disabled={saving}
                      data-testid="save-tenant-btn"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {editMode ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-white/60">Business Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-white/60">Email</Label>
                    <Input
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1 bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-white/60">Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="mt-1 bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-white/60">Address</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="mt-1 bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="pt-2 border-t border-white/10">
                  <p className="text-sm text-white/80 font-medium mb-2">Text messages &amp; AI receptionist (Twilio)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-white/60">SMS number</Label>
                      <Input
                        value={formData.sms_number}
                        placeholder="+353 ..."
                        onChange={(e) => setFormData({ ...formData, sms_number: e.target.value })}
                        className="mt-1 bg-white/5 border-white/10 text-white"
                        data-testid="sms-number"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-white/60">WhatsApp number</Label>
                      <Input
                        value={formData.whatsapp_number}
                        placeholder="+353 ..."
                        onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                        className="mt-1 bg-white/5 border-white/10 text-white"
                        data-testid="whatsapp-number"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 mt-3 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={formData.sms_addon_enabled}
                      onChange={(e) => setFormData({ ...formData, sms_addon_enabled: e.target.checked })}
                      data-testid="sms-addon"
                    />
                    SMS add-on on (text confirmations &amp; reminders)
                  </label>
                  <p className="text-xs text-white/40 mt-1">Clients who text or WhatsApp these numbers get the AI receptionist (Growth plan or higher).</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-white/60">
                  <Mail className="w-4 h-4" />
                  {tenant?.email}
                </div>
                {tenant?.phone && (
                  <div className="flex items-center gap-3 text-white/60">
                    <Phone className="w-4 h-4" />
                    {tenant.phone}
                  </div>
                )}
                {tenant?.address && (
                  <div className="flex items-center gap-3 text-white/60">
                    <MapPin className="w-4 h-4" />
                    {tenant.address}
                  </div>
                )}
                <div className="flex items-center gap-3 text-white/60 flex-wrap">
                  <Phone className="w-4 h-4" />
                  <span className="text-white/40">SMS / WhatsApp numbers:</span>
                  {tenant?.sms_number && <span>SMS {tenant.sms_number}</span>}
                  {tenant?.whatsapp_number && <span>WhatsApp {tenant.whatsapp_number}</span>}
                  {!tenant?.sms_number && !tenant?.whatsapp_number && <span className="text-white/40">not set yet (click Edit)</span>}
                </div>
                <div className="flex items-center gap-3 text-white/60">
                  <Globe className="w-4 h-4" />
                  <span className="text-white/40">Booking URL:</span>
                  <code className="text-xs bg-white/5 px-2 py-1">/book/{tenant?.booking_url_slug}</code>
                </div>
              </div>
            )}
          </div>

          {/* Plan & Features Card */}
          <div className="bg-[#121212] border border-white/10 p-6">
            <h3 className="font-semibold text-white mb-4">Plan & Features</h3>
            
            {editMode ? (
              <div className="mb-6">
                <Label className="text-sm text-white/60">Select Plan</Label>
                <Select 
                  value={formData.plan} 
                  onValueChange={(v) => setFormData({ ...formData, plan: v })}
                >
                  <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white" data-testid="select-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter (€29/mo)</SelectItem>
                    <SelectItem value="growth">Growth (€79/mo)</SelectItem>
                    <SelectItem value="pro">Pro (€149/mo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex items-center gap-3 mb-6">
                <span className={`text-lg px-3 py-1 capitalize font-semibold ${
                  tenant?.plan === 'pro' ? 'bg-amber-500/20 text-amber-400' :
                  tenant?.plan === 'growth' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-500/20 text-gray-300'
                }`}>
                  {tenant?.plan}
                </span>
                <span className="text-white/40">€{PLAN_FEATURES[tenant?.plan]?.price}/month</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {Object.entries(featureLabels).map(([key, label]) => {
                const enabled = currentPlanFeatures[key];
                return (
                  <div 
                    key={key} 
                    className={`flex items-center gap-2 p-3 border ${enabled ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}
                  >
                    {enabled ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <X className="w-4 h-4 text-white/30" />
                    )}
                    <span className={enabled ? 'text-white' : 'text-white/40'}>{label}</span>
                  </div>
                );
              })}
            </div>

            <div className={`mt-3 flex items-center gap-2 p-3 border ${tenant?.sms_addon_enabled ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
              {tenant?.sms_addon_enabled ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-white/30" />}
              <span className={tenant?.sms_addon_enabled ? 'text-white' : 'text-white/40'}>Text (SMS) confirmations & reminders — add-on, switch on under Edit</span>
            </div>

            <p className="mt-4 text-xs text-white/40">Coming soon (not in any plan yet): {COMING_SOON.join(' · ')}</p>

            <div className="mt-4 p-3 bg-white/5 border border-white/10">
              <p className="text-sm text-white/60">
                Staff Limit: <span className="text-white font-mono">{PLAN_FEATURES[formData.plan]?.max_staff === 999 ? 'Unlimited' : PLAN_FEATURES[formData.plan]?.max_staff}</span>
                <span className="text-white/40 ml-2">(Currently using: {stats?.staff_count || 0})</span>
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <div className="bg-[#121212] border border-white/10 p-6">
            <h3 className="font-semibold text-white mb-4">Statistics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/60">
                  <Users className="w-4 h-4" />
                  Staff
                </div>
                <span className="text-white font-mono">{stats?.staff_count || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/60">
                  <Briefcase className="w-4 h-4" />
                  Services
                </div>
                <span className="text-white font-mono">{stats?.services_count || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/60">
                  <Users className="w-4 h-4" />
                  Clients
                </div>
                <span className="text-white font-mono">{stats?.client_count || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/60">
                  <Calendar className="w-4 h-4" />
                  Total Appointments
                </div>
                <span className="text-white font-mono">{stats?.total_appointments || 0}</span>
              </div>
            </div>
          </div>

          {/* Owner Info */}
          {owner && (
            <div className="bg-[#121212] border border-white/10 p-6">
              <h3 className="font-semibold text-white mb-4">Owner Account</h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white font-medium">
                  {owner.name?.charAt(0)}
                </div>
                <div>
                  <p className="text-white">{owner.name}</p>
                  <p className="text-sm text-white/40">{owner.email}</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full border-white/10 text-white hover:bg-white/5 flex items-center justify-center gap-2"
                onClick={handleImpersonate}
                data-testid="impersonate-btn"
              >
                <UserCog className="w-4 h-4" />
                View as Owner
              </Button>
            </div>
          )}

          {/* Status */}
          <div className="bg-[#121212] border border-white/10 p-6">
            <h3 className="font-semibold text-white mb-4">Status</h3>
            <div className={`p-3 text-center ${tenant?.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {tenant?.is_active ? 'Active' : 'Inactive'}
            </div>
            <p className="text-xs text-white/40 mt-2">
              Created: {new Date(tenant?.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
};

export default AdminTenantDetailPage;
