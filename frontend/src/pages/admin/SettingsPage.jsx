import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { toast } from 'sonner';
import { Building2, Globe, Clock, Shield, Bell, MessageSquare, Mail, Smartphone, Check } from 'lucide-react';

const SettingsPage = () => {
  const { tenant, token, updateTenant } = useAuth();
  const [saving, setSaving] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(null);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [formData, setFormData] = useState({
    name: tenant?.name || '',
    email: tenant?.email || '',
    phone: tenant?.phone || '',
    address: tenant?.address || '',
    timezone: tenant?.timezone || 'Europe/Dublin',
    currency: tenant?.currency || 'EUR'
  });

  useEffect(() => {
    fetchNotificationSettings();
  }, []);

  const fetchNotificationSettings = async () => {
    try {
      const response = await axios.get(`${API}/notifications/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotificationSettings(response.data);
    } catch (error) {
      console.error('Failed to load notification settings');
    } finally {
      setLoadingNotifications(false);
    }
  };

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

  const toggleSMSAddon = async () => {
    try {
      if (notificationSettings?.sms_addon_enabled) {
        await axios.post(`${API}/notifications/sms-addon/disable`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('SMS add-on disabled');
      } else {
        await axios.post(`${API}/notifications/sms-addon/enable`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('SMS add-on enabled! +€10/month added to your subscription.');
      }
      fetchNotificationSettings();
    } catch (error) {
      toast.error('Failed to update SMS add-on');
    }
  };

  const updateNotificationSetting = async (key, value) => {
    try {
      await axios.put(`${API}/notifications/settings`, { [key]: value }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotificationSettings(prev => ({ ...prev, [key]: value }));
      toast.success('Setting updated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update setting');
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
                {notificationSettings?.sms_addon_enabled && ' + €10/month SMS'}
              </p>
            </div>
            <Button variant="outline" size="sm">Upgrade</Button>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="card-flat mb-6" data-testid="notification-settings">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#666666]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0A0A0A]">Notifications & Reminders</h3>
              <p className="text-sm text-[#666666]">Configure how clients receive notifications</p>
            </div>
          </div>

          {loadingNotifications ? (
            <div className="text-center py-4 text-[#666666]">Loading...</div>
          ) : (
            <div className="space-y-4">
              {/* Email Reminders - Free */}
              <div className="flex items-center justify-between py-3 border-b border-[#E5E5E5]">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-[#666666]" />
                  <div>
                    <p className="font-medium text-[#0A0A0A]">Email Reminders</p>
                    <p className="text-sm text-[#666666]">Send booking confirmations and reminders via email</p>
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-green-100 text-green-700">FREE - Included</span>
                  </div>
                </div>
                <Switch 
                  checked={notificationSettings?.email_reminders_enabled}
                  onCheckedChange={(checked) => updateNotificationSetting('email_reminders_enabled', checked)}
                  data-testid="toggle-email-reminders"
                />
              </div>

              {/* SMS Add-on */}
              <div className="p-4 bg-[#FAFAFA] border border-[#E5E5E5]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-[#E34A33]" />
                    <div>
                      <p className="font-medium text-[#0A0A0A]">SMS Notifications Add-on</p>
                      <p className="text-sm text-[#666666]">Send SMS reminders to clients</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#E34A33]">+€{notificationSettings?.sms_addon_price || 10}/month</p>
                  </div>
                </div>

                {notificationSettings?.sms_addon_enabled ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <Check className="w-4 h-4" />
                      SMS Add-on Active
                    </div>
                    
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium text-[#0A0A0A]">Send SMS Reminders</p>
                        <p className="text-xs text-[#666666]">Clients receive SMS before appointments</p>
                      </div>
                      <Switch 
                        checked={notificationSettings?.sms_reminders_enabled}
                        onCheckedChange={(checked) => updateNotificationSetting('sms_reminders_enabled', checked)}
                        data-testid="toggle-sms-reminders"
                      />
                    </div>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={toggleSMSAddon}
                      className="text-red-500 border-red-200 hover:bg-red-50"
                    >
                      Disable SMS Add-on
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={toggleSMSAddon}
                    className="btn-primary w-full mt-2"
                    data-testid="enable-sms-addon"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Enable SMS Add-on (+€10/month)
                  </Button>
                )}
              </div>

              {/* Reminder Timing */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-[#0A0A0A]">Reminder Timing</p>
                  <p className="text-sm text-[#666666]">How many hours before appointment to send reminder</p>
                </div>
                <select
                  value={notificationSettings?.reminder_hours_before || 24}
                  onChange={(e) => updateNotificationSetting('reminder_hours_before', parseInt(e.target.value))}
                  className="input-swiss w-32"
                  data-testid="reminder-hours"
                >
                  <option value={1}>1 hour</option>
                  <option value={2}>2 hours</option>
                  <option value={4}>4 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                </select>
              </div>
            </div>
          )}
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
