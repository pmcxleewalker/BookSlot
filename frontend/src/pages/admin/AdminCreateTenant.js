import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, User, Mail, Phone, Globe, ArrowLeft, Check } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const industries = [
  { value: 'salon', label: 'Salon / Spa' },
  { value: 'clinic', label: 'Medical Clinic' },
  { value: 'dentist', label: 'Dental Practice' },
  { value: 'doctor', label: 'Doctor / Physician' },
  { value: 'vet', label: 'Veterinary' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'other', label: 'Other' },
];

const plans = [
  { value: 'starter', label: 'Starter (€29/mo)', description: '2 staff, 1 location' },
  { value: 'growth', label: 'Growth (€79/mo)', description: '8 staff, AI features' },
  { value: 'pro', label: 'Pro (€149/mo)', description: '50 staff, multi-location' },
];

export default function AdminCreateTenant() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    industry: 'salon',
    email: '',
    phone: '',
    owner_name: '',
    owner_email: '',
    owner_password: '',
    plan: 'starter',
    timezone: 'Europe/London',
    currency: 'EUR'
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const sessionToken = localStorage.getItem('admin_session_token');
      const response = await fetch(`${API_URL}/api/admin/tenants`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Token': sessionToken || ''
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create tenant');
      }

      const data = await response.json();
      setResult(data);
      toast.success('Tenant created successfully!');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <AdminLayout title="Tenant Created">
        <div className="max-w-2xl mx-auto">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Outfit' }}>
              Tenant Created Successfully!
            </h2>
            <p className="text-slate-400 mb-6">
              Share these credentials with the tenant owner
            </p>

            <div className="bg-slate-900 rounded-xl p-6 text-left space-y-4 mb-6">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Booking URL</p>
                <p className="text-white font-mono text-sm break-all">
                  {window.location.origin}/book/{result.slug}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Owner Email</p>
                <p className="text-white">{result.owner_email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Owner Password</p>
                <p className="text-emerald-400 font-mono">{result.owner_password}</p>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  const text = `Welcome to TimeSlot Pro!\n\nBooking URL: ${window.location.origin}/book/${result.slug}\n\nLogin: ${window.location.origin}/login\nEmail: ${result.owner_email}\nPassword: ${result.owner_password}`;
                  navigator.clipboard.writeText(text);
                  toast.success('Credentials copied to clipboard');
                }}
                className="rounded-xl border-slate-600 text-slate-300 hover:text-white"
              >
                Copy Credentials
              </Button>
              <Button
                onClick={() => navigate(`/admin/tenants/${result.tenant_id}`)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
              >
                View Tenant
              </Button>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Add New Tenant">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/admin/tenants')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tenants
        </button>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business Info */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-white" style={{ fontFamily: 'Outfit' }}>
                    Business Information
                  </h2>
                  <p className="text-sm text-slate-400">Basic details about the business</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label className="text-slate-300">Business Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., Elite Hair Salon"
                  className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                  required
                  data-testid="tenant-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Industry</Label>
                  <select
                    value={formData.industry}
                    onChange={(e) => handleChange('industry', e.target.value)}
                    className="w-full mt-1 h-10 px-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white"
                    data-testid="tenant-industry"
                  >
                    {industries.map(ind => (
                      <option key={ind.value} value={ind.value}>{ind.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-slate-300">Plan</Label>
                  <select
                    value={formData.plan}
                    onChange={(e) => handleChange('plan', e.target.value)}
                    className="w-full mt-1 h-10 px-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white"
                    data-testid="tenant-plan"
                  >
                    {plans.map(plan => (
                      <option key={plan.value} value={plan.value}>{plan.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Business Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="info@business.com"
                    className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                    required
                    data-testid="tenant-email"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Business Phone</Label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+1 234 567 8900"
                    className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                    data-testid="tenant-phone"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Owner Account */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-white" style={{ fontFamily: 'Outfit' }}>
                    Owner Account
                  </h2>
                  <p className="text-sm text-slate-400">Login credentials for the business owner</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label className="text-slate-300">Owner Name</Label>
                <Input
                  value={formData.owner_name}
                  onChange={(e) => handleChange('owner_name', e.target.value)}
                  placeholder="John Smith"
                  className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                  required
                  data-testid="owner-name"
                />
              </div>
              <div>
                <Label className="text-slate-300">Owner Email (Login)</Label>
                <Input
                  type="email"
                  value={formData.owner_email}
                  onChange={(e) => handleChange('owner_email', e.target.value)}
                  placeholder="owner@email.com"
                  className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                  required
                  data-testid="owner-email"
                />
              </div>
              <div>
                <Label className="text-slate-300">Password (optional)</Label>
                <Input
                  type="text"
                  value={formData.owner_password}
                  onChange={(e) => handleChange('owner_password', e.target.value)}
                  placeholder="Leave empty to auto-generate"
                  className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                  data-testid="owner-password"
                />
                <p className="text-xs text-slate-500 mt-1">If left empty, a secure password will be generated</p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/tenants')}
              className="rounded-xl border-slate-600 text-slate-300 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl min-w-[140px]"
              data-testid="create-tenant-btn"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Create Tenant'
              )}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
