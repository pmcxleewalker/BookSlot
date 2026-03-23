import React, { useState } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { toast } from 'sonner';
import { Building2, Globe, Clock, Shield, Bell, Palette } from 'lucide-react';

const SettingsPage = () => {
  const { tenant, token, updateTenant } = useAuth();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: tenant?.name || '',
    email: tenant?.email || '',
    phone: tenant?.phone || '',
    address: tenant?.address || '',
    timezone: tenant?.timezone || 'Europe/Dublin',
    currency: tenant?.currency || 'EUR'
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateTenant(formData);
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const timezones = [
    'Europe/Dublin',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'America/New_York',
    'America/Los_Angeles',
    'Asia/Tokyo',
    'Australia/Sydney'
  ];

  const currencies = ['EUR', 'GBP', 'USD', 'AUD', 'CAD'];

  return (
    <TenantLayout title="Settings">
      <div className="max-w-2xl">
        {/* Business Details */}
        <div className="card-flat mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#666666]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0A0A0A]">Business Details</h3>
              <p className="text-sm text-[#666666]">Basic information about your business</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Business Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1.5"
                data-testid="setting-name"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1.5"
                data-testid="setting-email"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1.5"
                data-testid="setting-phone"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="mt-1.5"
                data-testid="setting-address"
              />
            </div>
          </div>
        </div>

        {/* Regional Settings */}
        <div className="card-flat mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
              <Globe className="w-5 h-5 text-[#666666]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0A0A0A]">Regional Settings</h3>
              <p className="text-sm text-[#666666]">Timezone and currency preferences</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Timezone</Label>
              <select
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="mt-1.5 input-swiss"
                data-testid="setting-timezone"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-sm font-medium">Currency</Label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="mt-1.5 input-swiss"
                data-testid="setting-currency"
              >
                {currencies.map((curr) => (
                  <option key={curr} value={curr}>{curr}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Booking Settings */}
        <div className="card-flat mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#666666]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0A0A0A]">Booking Settings</h3>
              <p className="text-sm text-[#666666]">Configure booking behavior</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-[#E5E5E5]">
              <div>
                <p className="font-medium text-[#0A0A0A]">Allow online booking</p>
                <p className="text-sm text-[#666666]">Let clients book through your booking page</p>
              </div>
              <Switch defaultChecked data-testid="setting-online-booking" />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-[#E5E5E5]">
              <div>
                <p className="font-medium text-[#0A0A0A]">Require email for booking</p>
                <p className="text-sm text-[#666666]">Clients must provide email to book</p>
              </div>
              <Switch defaultChecked data-testid="setting-require-email" />
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-[#0A0A0A]">Allow cancellations</p>
                <p className="text-sm text-[#666666]">Clients can cancel their own bookings</p>
              </div>
              <Switch defaultChecked data-testid="setting-allow-cancel" />
            </div>
          </div>
        </div>

        {/* Subscription Info */}
        <div className="card-flat mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#666666]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0A0A0A]">Subscription</h3>
              <p className="text-sm text-[#666666]">Your current plan</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#FAFAFA] border border-[#E5E5E5]">
            <div>
              <p className="font-semibold text-[#0A0A0A] capitalize">{tenant?.plan || 'Starter'} Plan</p>
              <p className="text-sm text-[#666666]">
                {tenant?.plan === 'starter' && '€29/month'}
                {tenant?.plan === 'growth' && '€79/month'}
                {tenant?.plan === 'pro' && '€149/month'}
              </p>
            </div>
            <Button variant="outline" size="sm">Upgrade</Button>
          </div>
        </div>

        {/* Save Button */}
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="btn-primary w-full"
          data-testid="save-settings"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </TenantLayout>
  );
};

export default SettingsPage;
