import React, { useState, useEffect } from 'react';
import SuperAdminLayout from '../../components/SuperAdminLayout';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { 
  Plus, Search, Building2, Eye, Edit2, Trash2, 
  ToggleLeft, ToggleRight, Users, Calendar, Check, X, Sparkles
} from 'lucide-react';
import { Switch } from '../../components/ui/switch';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const PLAN_FEATURES = {
  starter: {
    name: "Starter",
    price: 99,
    features: ["1 location", "Up to 2 staff", "Online booking", "Drag-drop calendar", "Client management", "Basic reports"]
  },
  growth: {
    name: "Growth", 
    price: 149,
    features: ["1 location", "Up to 8 staff", "AI Receptionist", "Waitlist", "Packages", "Growth analytics", "Priority support"]
  },
  pro: {
    name: "Pro",
    price: 219,
    features: ["Multi-location", "Unlimited staff", "Advanced permissions", "Custom forms", "White-label", "Pro analytics", "Account manager"]
  },
  custom: {
    name: "Custom",
    price: null,
    features: ["Bespoke pricing", "Pick every feature", "Set own staff/location caps", "Built for enterprises"]
  }
};

// Every feature toggle available on a custom plan. Label + key must match backend PLAN_FEATURES shape.
const CUSTOM_FEATURE_TOGGLES = [
  { key: 'online_booking', label: 'Online Booking' },
  { key: 'reminders', label: 'Reminders (email/push)' },
  { key: 'deposits', label: 'Deposits' },
  { key: 'calendar_sync', label: 'Calendar Sync' },
  { key: 'basic_reports', label: 'Basic Reports' },
  { key: 'waitlist', label: 'Waitlist' },
  { key: 'packages', label: 'Packages' },
  { key: 'ai_assistant', label: 'AI Receptionist' },
  { key: 'sms_automations', label: 'SMS Automations' },
  { key: 'advanced_reports', label: 'Advanced Reports' },
  { key: 'multi_location', label: 'Multi-location' },
  { key: 'advanced_permissions', label: 'Advanced Permissions' },
  { key: 'resource_booking', label: 'Resource Booking' },
  { key: 'custom_forms', label: 'Custom Forms' },
  { key: 'white_label', label: 'White-label' },
  { key: 'api_webhooks', label: 'API & Webhooks' }
];

const DEFAULT_CUSTOM_FEATURES = {
  name: 'Custom',
  price: 199,
  max_staff: 10,
  max_locations: 1,
  online_booking: true,
  reminders: true,
  deposits: true,
  calendar_sync: true,
  basic_reports: true,
  waitlist: false,
  packages: false,
  ai_assistant: false,
  sms_automations: false,
  advanced_reports: false,
  multi_location: false,
  advanced_permissions: false,
  resource_booking: false,
  custom_forms: false,
  white_label: false,
  api_webhooks: false
};

const AdminTenantsPage = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // New tenant form
  const [newTenant, setNewTenant] = useState({
    business_name: '',
    industry: 'salon',
    owner_name: '',
    owner_email: '',
    owner_password: '',
    plan: 'starter',
    phone: '',
    address: '',
    custom_features: { ...DEFAULT_CUSTOM_FEATURES }
  });

  const industries = [
    { value: 'salon', label: 'Salon / Spa' },
    { value: 'clinic', label: 'Medical Clinic' },
    { value: 'dentist', label: 'Dentist' },
    { value: 'doctor', label: 'Doctor / GP' },
    { value: 'vet', label: 'Veterinary' },
    { value: 'consultant', label: 'Consultant' },
    { value: 'other', label: 'Other' },
  ];

  useEffect(() => {
    fetchTenants();
  }, [search, planFilter, statusFilter, sortBy]);

  const fetchTenants = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      const params = {};
      if (search) params.search = search;
      if (planFilter !== 'all') params.plan = planFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      
      const response = await axios.get(`${API}/admin/tenants`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let filteredTenants = response.data.tenants || [];
      
      // Client-side status filtering if not supported by API
      if (statusFilter === 'active') {
        filteredTenants = filteredTenants.filter(t => t.is_active);
      } else if (statusFilter === 'inactive') {
        filteredTenants = filteredTenants.filter(t => !t.is_active);
      }
      
      // Sort tenants
      filteredTenants.sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'plan') return a.plan.localeCompare(b.plan);
        if (sortBy === 'staff') return (b.staff_count || 0) - (a.staff_count || 0);
        return new Date(b.created_at) - new Date(a.created_at);
      });
      
      setTenants(filteredTenants);
    } catch (error) {
      console.error('Failed to load tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    if (!newTenant.business_name || !newTenant.owner_email || !newTenant.owner_password) {
      toast.error('Please fill all required fields');
      return;
    }

    // Custom plan validation
    if (newTenant.plan === 'custom') {
      const cf = newTenant.custom_features || {};
      if (!cf.price || cf.price < 0) { toast.error('Enter a valid monthly price for the custom plan'); return; }
      if (!cf.max_staff || cf.max_staff < 1) { toast.error('Max staff must be at least 1'); return; }
      if (!cf.max_locations || cf.max_locations < 1) { toast.error('Max locations must be at least 1'); return; }
    }

    setCreating(true);
    const token = localStorage.getItem('admin_token');
    
    try {
      const payload = {
        business_name: newTenant.business_name,
        industry: newTenant.industry,
        owner_name: newTenant.owner_name,
        owner_email: newTenant.owner_email,
        owner_password: newTenant.owner_password,
        plan: newTenant.plan,
        phone: newTenant.phone,
        address: newTenant.address
      };
      if (newTenant.plan === 'custom') {
        payload.custom_features = newTenant.custom_features;
      }
      await axios.post(`${API}/admin/tenants`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Client created successfully');
      setShowCreateDialog(false);
      setNewTenant({
        business_name: '',
        industry: 'salon',
        owner_name: '',
        owner_email: '',
        owner_password: '',
        plan: 'starter',
        phone: '',
        address: '',
        custom_features: { ...DEFAULT_CUSTOM_FEATURES }
      });
      fetchTenants();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add client');
    } finally {
      setCreating(false);
    }
  };

  const updateCustomFeature = (key, value) => {
    setNewTenant(prev => ({ ...prev, custom_features: { ...prev.custom_features, [key]: value } }));
  };

  const handleToggleStatus = async (tenantId, currentStatus) => {
    const token = localStorage.getItem('admin_token');
    try {
      if (currentStatus) {
        await axios.post(`${API}/admin/tenants/${tenantId}/deactivate`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Tenant deactivated');
      } else {
        await axios.post(`${API}/admin/tenants/${tenantId}/activate`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Client activated');
      }
      fetchTenants();
    } catch (error) {
      toast.error('Failed to update client status');
    }
  };

  const handleDeleteTenant = async (tenantId, tenantName) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${tenantName}"? This action cannot be undone.`)) {
      return;
    }
    const token = localStorage.getItem('admin_token');
    try {
      await axios.post(`${API}/admin/tenants/${tenantId}/terminate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Client deleted permanently');
      fetchTenants();
    } catch (error) {
      toast.error('Failed to delete client');
    }
  };

  const planColors = {
    starter: 'bg-gray-100 text-gray-600 border-gray-200',
    growth: 'bg-blue-100 text-blue-600 border-blue-200',
    pro: 'bg-amber-100 text-amber-600 border-amber-200',
    custom: 'bg-purple-100 text-purple-600 border-purple-200'
  };

  return (
    <SuperAdminLayout title="Clients">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-[#E5E5E5] rounded-lg p-4">
          <p className="text-sm text-[#666666]">Total Clients</p>
          <p className="text-2xl font-semibold text-[#0A0A0A]">{tenants.length}</p>
        </div>
        <div className="bg-white border border-[#E5E5E5] rounded-lg p-4">
          <p className="text-sm text-[#666666]">Active</p>
          <p className="text-2xl font-semibold text-emerald-600">{tenants.filter(t => t.is_active).length}</p>
        </div>
        <div className="bg-white border border-[#E5E5E5] rounded-lg p-4">
          <p className="text-sm text-[#666666]">Inactive</p>
          <p className="text-2xl font-semibold text-red-600">{tenants.filter(t => !t.is_active).length}</p>
        </div>
        <div className="bg-white border border-[#E5E5E5] rounded-lg p-4">
          <p className="text-sm text-[#666666]">Total Staff</p>
          <p className="text-2xl font-semibold text-[#0A0A0A]">{tenants.reduce((sum, t) => sum + (t.staff_count || 0), 0)}</p>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
          <Input
            placeholder="Search by name, email, or industry..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#999999]"
            data-testid="search-tenants"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-32 bg-white border-[#E5E5E5] text-[#0A0A0A]">
              <SelectValue placeholder="All Plans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="growth">Growth</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 bg-white border-[#E5E5E5] text-[#0A0A0A]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-36 bg-white border-[#E5E5E5] text-[#0A0A0A]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Newest First</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
              <SelectItem value="plan">Plan</SelectItem>
              <SelectItem value="staff">Staff Count</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => setShowCreateDialog(true)} 
            className="bg-[#0A0A0A] hover:bg-[#333333] text-white flex items-center gap-2"
            data-testid="create-tenant-btn"
          >
            <Plus className="w-4 h-4" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[#999999] text-sm bg-[#FAFAFA]">
                <th className="p-4">Client</th>
                <th className="p-4">Plan</th>
                <th className="p-4">URLs</th>
                <th className="p-4">Staff</th>
                <th className="p-4">Clients</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#999999]">Loading...</td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#999999]">
                    {search ? 'No clients found' : 'No clients yet'}
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant.tenant_id} className="border-t border-[#E5E5E5] hover:bg-[#FAFAFA]" data-testid={`tenant-row-${tenant.tenant_id}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#0A0A0A] rounded-lg flex items-center justify-center text-white font-medium">
                          {tenant.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-[#0A0A0A]">{tenant.name}</p>
                          <p className="text-xs text-[#999999]">{tenant.industry}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded border ${planColors[tenant.plan]} capitalize`}>
                        {tenant.plan}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/${tenant.booking_url_slug}/login`);
                            toast.success('Login URL copied!');
                          }}
                          className="text-xs text-blue-600 hover:underline block"
                        >
                          Copy Login URL
                        </button>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/book/${tenant.booking_url_slug}`);
                            toast.success('Booking URL copied!');
                          }}
                          className="text-xs text-emerald-600 hover:underline block"
                        >
                          Copy Booking URL
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-[#666666] font-mono">{tenant.staff_count || 0}</td>
                    <td className="p-4 text-[#666666] font-mono">{tenant.client_count || 0}</td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleStatus(tenant.tenant_id, tenant.is_active)}
                        className={`flex items-center gap-2 text-xs ${tenant.is_active ? 'text-emerald-600' : 'text-red-600'}`}
                        data-testid={`toggle-status-${tenant.tenant_id}`}
                      >
                        {tenant.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        {tenant.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link 
                          to={`/admin/tenants/${tenant.tenant_id}`}
                          className="inline-flex items-center gap-1 text-sm text-[#666666] hover:text-[#0A0A0A]"
                          data-testid={`view-tenant-${tenant.tenant_id}`}
                        >
                          <Eye className="w-4 h-4" />
                          Manage
                        </Link>
                        <button
                          onClick={() => handleDeleteTenant(tenant.tenant_id, tenant.name)}
                          className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
                          data-testid={`delete-tenant-${tenant.tenant_id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Tenant Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-2xl bg-white border-[#E5E5E5] text-[#0A0A0A]">
          <DialogHeader>
            <DialogTitle className="text-[#0A0A0A]">Add New Client</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto pr-2">
            {/* Plan Selection */}
            <div>
              <Label className="text-sm font-medium text-[#0A0A0A]">Select Plan *</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                {Object.entries(PLAN_FEATURES).map(([key, plan]) => (
                  <button
                    key={key}
                    onClick={() => setNewTenant({ ...newTenant, plan: key })}
                    className={`p-4 border rounded-lg text-left transition-all ${
                      newTenant.plan === key 
                        ? 'border-[#0A0A0A] bg-[#0A0A0A]/5' 
                        : 'border-[#E5E5E5] hover:border-[#999999]'
                    } ${key === 'custom' ? 'relative overflow-hidden' : ''}`}
                    data-testid={`select-plan-${key}`}
                  >
                    {key === 'custom' && (
                      <Sparkles className="absolute top-2 right-2 w-3.5 h-3.5 text-purple-500" />
                    )}
                    <p className="font-semibold text-[#0A0A0A] capitalize">{plan.name}</p>
                    <p className="text-lg text-[#0A0A0A] font-mono">
                      {key === 'custom'
                        ? (newTenant.plan === 'custom' ? `€${newTenant.custom_features?.price || '—'}/mo` : 'Your price')
                        : `€${plan.price}/mo`}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {plan.features.slice(0, 3).map((f, i) => (
                        <li key={i} className="text-xs text-[#666666] flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Plan Configurator */}
            {newTenant.plan === 'custom' && (
              <div className="border border-purple-200 bg-purple-50/40 rounded-lg p-4 space-y-5" data-testid="custom-plan-configurator">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <h4 className="text-sm font-semibold text-[#0A0A0A]">Custom Plan Parameters</h4>
                </div>

                {/* Pricing & Limits */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-[#666666]">Price €/mo *</Label>
                    <Input
                      type="number"
                      min={0}
                      value={newTenant.custom_features?.price ?? ''}
                      onChange={(e) => updateCustomFeature('price', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="mt-1 bg-white border-[#E5E5E5] text-[#0A0A0A]"
                      data-testid="custom-price"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[#666666]">Max Staff *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newTenant.custom_features?.max_staff ?? ''}
                      onChange={(e) => updateCustomFeature('max_staff', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="mt-1 bg-white border-[#E5E5E5] text-[#0A0A0A]"
                      data-testid="custom-max-staff"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[#666666]">Max Locations *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newTenant.custom_features?.max_locations ?? ''}
                      onChange={(e) => updateCustomFeature('max_locations', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="mt-1 bg-white border-[#E5E5E5] text-[#0A0A0A]"
                      data-testid="custom-max-locations"
                    />
                  </div>
                </div>

                {/* Feature toggles */}
                <div>
                  <Label className="text-xs text-[#666666] uppercase tracking-wider">Features</Label>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                    {CUSTOM_FEATURE_TOGGLES.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between bg-white border border-[#E5E5E5] rounded-md px-3 py-2">
                        <span className="text-xs text-[#0A0A0A]">{label}</span>
                        <Switch
                          checked={!!newTenant.custom_features?.[key]}
                          onCheckedChange={(v) => updateCustomFeature(key, v)}
                          data-testid={`custom-toggle-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-[#E5E5E5] pt-4">
              <h4 className="text-sm font-medium text-[#0A0A0A] mb-3">Business Details</h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-[#666666]">Business Name *</Label>
                  <Input
                    value={newTenant.business_name}
                    onChange={(e) => setNewTenant({ ...newTenant, business_name: e.target.value })}
                    placeholder="Acme Salon"
                    className="mt-1 bg-white border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#999999]"
                    data-testid="input-business-name"
                  />
                </div>

                <div>
                  <Label className="text-sm text-[#666666]">Industry *</Label>
                  <Select 
                    value={newTenant.industry} 
                    onValueChange={(v) => setNewTenant({ ...newTenant, industry: v })}
                  >
                    <SelectTrigger className="mt-1 bg-white border-[#E5E5E5] text-[#0A0A0A]" data-testid="select-industry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {industries.map((ind) => (
                        <SelectItem key={ind.value} value={ind.value}>{ind.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm text-[#666666]">Phone</Label>
                    <Input
                      value={newTenant.phone}
                      onChange={(e) => setNewTenant({ ...newTenant, phone: e.target.value })}
                      placeholder="+1 555 123 4567"
                      className="mt-1 bg-white border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#999999]"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-[#666666]">Address</Label>
                    <Input
                      value={newTenant.address}
                      onChange={(e) => setNewTenant({ ...newTenant, address: e.target.value })}
                      placeholder="123 Main St"
                      className="mt-1 bg-white border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#999999]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[#E5E5E5] pt-4">
              <h4 className="text-sm font-medium text-[#0A0A0A] mb-3">Owner Account</h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-[#666666]">Owner Name *</Label>
                  <Input
                    value={newTenant.owner_name}
                    onChange={(e) => setNewTenant({ ...newTenant, owner_name: e.target.value })}
                    placeholder="John Smith"
                    className="mt-1 bg-white border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#999999]"
                    data-testid="input-owner-name"
                  />
                </div>

                <div>
                  <Label className="text-sm text-[#666666]">Owner Email *</Label>
                  <Input
                    type="email"
                    value={newTenant.owner_email}
                    onChange={(e) => setNewTenant({ ...newTenant, owner_email: e.target.value })}
                    placeholder="john@acmesalon.com"
                    className="mt-1 bg-white border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#999999]"
                    data-testid="input-owner-email"
                  />
                </div>

                <div>
                  <Label className="text-sm text-[#666666]">Password *</Label>
                  <Input
                    type="password"
                    value={newTenant.owner_password}
                    onChange={(e) => setNewTenant({ ...newTenant, owner_password: e.target.value })}
                    placeholder="Min 8 characters"
                    className="mt-1 bg-white border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#999999]"
                    data-testid="input-owner-password"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-[#E5E5E5]">
              <Button 
                variant="outline" 
                className="flex-1 border-[#E5E5E5] text-[#0A0A0A] hover:bg-[#FAFAFA]" 
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-[#0A0A0A] hover:bg-[#333333] text-white" 
                onClick={handleCreateTenant}
                disabled={creating}
                data-testid="submit-create-tenant"
              >
                {creating ? 'Creating...' : 'Add Client'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
};

export default AdminTenantsPage;
