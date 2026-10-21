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
  ToggleLeft, ToggleRight, Users, Calendar, Check, X 
} from 'lucide-react';

import { API } from '../../lib/api';

const PLAN_FEATURES = {
  starter: {
    name: "Starter",
    price: 29,
    features: ["Up to 2 staff", "Online booking", "Calendar", "Email reminders", "Reports"]
  },
  growth: {
    name: "Growth", 
    price: 79,
    features: ["Up to 8 staff", "Everything in Starter", "AI receptionist (chat, SMS, WhatsApp)"]
  },
  pro: {
    name: "Pro",
    price: 149,
    features: ["Unlimited staff", "Everything in Growth", "Intake forms", "Remove branding", "API & webhooks"]
  }
};

const AdminTenantsPage = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
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
    address: ''
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
  }, [search, planFilter]);

  const fetchTenants = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      const params = {};
      if (search) params.search = search;
      if (planFilter !== 'all') params.plan = planFilter;
      
      const response = await axios.get(`${API}/admin/tenants`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setTenants(response.data.tenants || []);
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

    setCreating(true);
    const token = localStorage.getItem('admin_token');
    
    try {
      await axios.post(`${API}/admin/tenants`, newTenant, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Tenant created successfully');
      setShowCreateDialog(false);
      setNewTenant({
        business_name: '',
        industry: 'salon',
        owner_name: '',
        owner_email: '',
        owner_password: '',
        plan: 'starter',
        phone: '',
        address: ''
      });
      fetchTenants();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create tenant');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (tenantId, currentStatus) => {
    const token = localStorage.getItem('admin_token');
    try {
      if (currentStatus) {
        await axios.delete(`${API}/admin/tenants/${tenantId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Tenant deactivated');
      } else {
        await axios.post(`${API}/admin/tenants/${tenantId}/activate`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Tenant activated');
      }
      fetchTenants();
    } catch (error) {
      toast.error('Failed to update tenant status');
    }
  };

  const planColors = {
    starter: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    growth: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    pro: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  };

  return (
    <SuperAdminLayout title="Tenants">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-[#121212] border-white/10 text-white placeholder:text-white/40"
            data-testid="search-tenants"
          />
        </div>
        <div className="flex gap-2">
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-32 bg-[#121212] border-white/10 text-white">
              <SelectValue placeholder="All Plans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="growth">Growth</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => setShowCreateDialog(true)} 
            className="bg-[#E34A33] hover:bg-[#c73d2a] text-white flex items-center gap-2"
            data-testid="create-tenant-btn"
          >
            <Plus className="w-4 h-4" />
            Create Tenant
          </Button>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-[#121212] border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-white/40 text-sm bg-white/5">
                <th className="p-4">Business</th>
                <th className="p-4">Plan</th>
                <th className="p-4">Staff</th>
                <th className="p-4">Clients</th>
                <th className="p-4">Appointments</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-white/40">Loading...</td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-white/40">
                    {search ? 'No tenants found' : 'No tenants yet'}
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant.tenant_id} className="border-t border-white/5 hover:bg-white/5" data-testid={`tenant-row-${tenant.tenant_id}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 flex items-center justify-center text-white font-medium">
                          {tenant.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-white">{tenant.name}</p>
                          <p className="text-xs text-white/40">{tenant.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 border ${planColors[tenant.plan]} capitalize`}>
                        {tenant.plan}
                      </span>
                    </td>
                    <td className="p-4 text-white/60 font-mono">{tenant.staff_count || 0}</td>
                    <td className="p-4 text-white/60 font-mono">{tenant.client_count || 0}</td>
                    <td className="p-4 text-white/60 font-mono">{tenant.appointment_count || 0}</td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleStatus(tenant.tenant_id, tenant.is_active)}
                        className={`flex items-center gap-2 text-xs ${tenant.is_active ? 'text-emerald-400' : 'text-red-400'}`}
                        data-testid={`toggle-status-${tenant.tenant_id}`}
                      >
                        {tenant.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        {tenant.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <Link 
                        to={`/admin/tenants/${tenant.tenant_id}`}
                        className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white"
                        data-testid={`view-tenant-${tenant.tenant_id}`}
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Link>
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
        <DialogContent className="sm:max-w-lg bg-[#121212] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Tenant</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto pr-2">
            {/* Plan Selection */}
            <div>
              <Label className="text-sm font-medium text-white/80">Select Plan *</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {Object.entries(PLAN_FEATURES).map(([key, plan]) => (
                  <button
                    key={key}
                    onClick={() => setNewTenant({ ...newTenant, plan: key })}
                    className={`p-4 border text-left transition-all ${
                      newTenant.plan === key 
                        ? 'border-[#E34A33] bg-[#E34A33]/10' 
                        : 'border-white/10 hover:border-white/30'
                    }`}
                    data-testid={`select-plan-${key}`}
                  >
                    <p className="font-semibold text-white capitalize">{plan.name}</p>
                    <p className="text-lg text-[#E34A33] font-mono">€{plan.price}/mo</p>
                    <ul className="mt-2 space-y-1">
                      {plan.features.slice(0, 3).map((f, i) => (
                        <li key={i} className="text-xs text-white/50 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <h4 className="text-sm font-medium text-white/80 mb-3">Business Details</h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-white/60">Business Name *</Label>
                  <Input
                    value={newTenant.business_name}
                    onChange={(e) => setNewTenant({ ...newTenant, business_name: e.target.value })}
                    placeholder="Acme Salon"
                    className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-business-name"
                  />
                </div>

                <div>
                  <Label className="text-sm text-white/60">Industry *</Label>
                  <Select 
                    value={newTenant.industry} 
                    onValueChange={(v) => setNewTenant({ ...newTenant, industry: v })}
                  >
                    <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white" data-testid="select-industry">
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
                    <Label className="text-sm text-white/60">Phone</Label>
                    <Input
                      value={newTenant.phone}
                      onChange={(e) => setNewTenant({ ...newTenant, phone: e.target.value })}
                      placeholder="+1 555 123 4567"
                      className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-white/60">Address</Label>
                    <Input
                      value={newTenant.address}
                      onChange={(e) => setNewTenant({ ...newTenant, address: e.target.value })}
                      placeholder="123 Main St"
                      className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <h4 className="text-sm font-medium text-white/80 mb-3">Owner Account</h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-white/60">Owner Name *</Label>
                  <Input
                    value={newTenant.owner_name}
                    onChange={(e) => setNewTenant({ ...newTenant, owner_name: e.target.value })}
                    placeholder="John Smith"
                    className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-owner-name"
                  />
                </div>

                <div>
                  <Label className="text-sm text-white/60">Owner Email *</Label>
                  <Input
                    type="email"
                    value={newTenant.owner_email}
                    onChange={(e) => setNewTenant({ ...newTenant, owner_email: e.target.value })}
                    placeholder="john@acmesalon.com"
                    className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-owner-email"
                  />
                </div>

                <div>
                  <Label className="text-sm text-white/60">Password *</Label>
                  <Input
                    type="password"
                    value={newTenant.owner_password}
                    onChange={(e) => setNewTenant({ ...newTenant, owner_password: e.target.value })}
                    placeholder="Min 8 characters"
                    className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-owner-password"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/10">
              <Button 
                variant="outline" 
                className="flex-1 border-white/10 text-white hover:bg-white/5" 
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-[#E34A33] hover:bg-[#c73d2a] text-white" 
                onClick={handleCreateTenant}
                disabled={creating}
                data-testid="submit-create-tenant"
              >
                {creating ? 'Creating...' : 'Create Tenant'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
};

export default AdminTenantsPage;
