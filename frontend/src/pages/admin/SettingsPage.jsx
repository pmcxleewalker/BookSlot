import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { toast } from 'sonner';
import { Building2, Globe, Clock, Shield, Bell, MessageSquare, Mail, Smartphone, Check, Palette, Upload, Eye, BellRing } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const SettingsPage = () => {
  const { tenant, token, updateTenant } = useAuth();
  const { permission, isSubscribed, isSupported, subscribe, unsubscribe } = usePushNotifications(token);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(null);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [reminderSettings, setReminderSettings] = useState({ push_enabled: false, reminder_hours: 24 });
  const [savingReminders, setSavingReminders] = useState(false);
  const [branding, setBranding] = useState({
    business_name: '',
    primary_color: '#E34A33',
    secondary_color: '#0A0A0A',
    accent_color: '#4F46E5',
    show_powered_by: true
  });
  const [formData, setFormData] = useState({
    name: tenant?.name || '',
    email: tenant?.email || '',
    phone: tenant?.phone || '',
    address: tenant?.address || '',
    timezone: tenant?.timezone || 'Europe/Dublin',
    currency: tenant?.currency || 'EUR',
    logo_url: tenant?.logo_url || ''
  });
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    fetchNotificationSettings();
    fetchBranding();
    fetchReminderSettings();
  }, []);

  const fetchReminderSettings = async () => {
    try {
      const res = await axios.get(`${API}/reminders/settings`, { headers: { Authorization: `Bearer ${token}` } });
      setReminderSettings(res.data.settings || { push_enabled: false, reminder_hours: 24 });
    } catch { /* ignore */ }
  };

  const handleTogglePush = async () => {
    if (!reminderSettings.push_enabled) {
      const ok = await subscribe();
      if (ok) {
        await saveReminderSettings({ push_enabled: true, reminder_hours: reminderSettings.reminder_hours });
        toast.success('Push reminders enabled');
      } else {
        toast.error('Push notifications were blocked. Please allow in browser settings.');
      }
    } else {
      await unsubscribe();
      await saveReminderSettings({ push_enabled: false, reminder_hours: reminderSettings.reminder_hours });
      toast.success('Push reminders disabled');
    }
  };

  const handleReminderHoursChange = async (hours) => {
    await saveReminderSettings({ ...reminderSettings, reminder_hours: hours });
  };

  const saveReminderSettings = async (settings) => {
    setSavingReminders(true);
    try {
      await axios.post(`${API}/reminders/settings`, settings, { headers: { Authorization: `Bearer ${token}` } });
      setReminderSettings(settings);
    } catch { toast.error('Failed to save reminder settings'); }
    finally { setSavingReminders(false); }
  };

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

  const fetchBranding = async () => {
    try {
      const response = await axios.get(`${API}/tenants/me/branding`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.branding) {
        setBranding(response.data.branding);
      }
      if (response.data.logo_url) {
        setFormData(prev => ({ ...prev, logo_url: response.data.logo_url }));
      }
    } catch (error) {
      console.error('Failed to load branding');
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

  const saveBranding = async () => {
    try {
      await axios.put(`${API}/tenants/me/branding`, branding, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Branding updated');
    } catch (error) {
      toast.error('Failed to update branding');
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

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PNG, JPEG, WebP, or SVG image');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    
    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      
      const response = await axios.post(`${API}/upload/image`, formDataUpload, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.url) {
        setFormData(prev => ({ ...prev, logo_url: response.data.url }));
        toast.success('Logo uploaded successfully!');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload image');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

        {/* Branding & Customization */}
        <div className="card-flat mb-6" data-testid="branding-settings">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
              <Palette className="w-5 h-5 text-[#666666]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0A0A0A]">Branding & Customization</h3>
              <p className="text-sm text-[#666666]">Customize colors and appearance</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Custom Business Name */}
            <div>
              <Label className="text-sm font-medium">Display Name</Label>
              <Input
                value={branding.business_name}
                onChange={(e) => setBranding({ ...branding, business_name: e.target.value })}
                placeholder={tenant?.name || 'Your Business Name'}
                className="mt-1.5"
              />
              <p className="text-xs text-[#666666] mt-1">Custom name shown in the sidebar (leave empty to use account name)</p>
            </div>

            {/* Logo Upload */}
            <div>
              <Label className="text-sm font-medium">Business Logo</Label>
              <div className="mt-2 space-y-3">
                {/* Upload Button */}
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2"
                    data-testid="upload-logo-btn"
                  >
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                  
                  {formData.logo_url && (
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 border border-[#E5E5E5] rounded flex items-center justify-center overflow-hidden bg-white">
                        <img src={formData.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData({ ...formData, logo_url: '' })}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Or use URL */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <span className="text-[#666666] text-xs">or URL:</span>
                  </div>
                  <Input
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://your-logo-url.com/logo.png"
                    className="pl-16"
                    data-testid="logo-url-input"
                  />
                </div>
                <p className="text-xs text-[#666666]">Upload an image (PNG, JPEG, WebP, SVG) or enter a URL. Max 5MB.</p>
              </div>
            </div>

            {/* Color Pickers */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Primary Color</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="color"
                    value={branding.primary_color}
                    onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                    className="w-10 h-10 rounded border border-[#E5E5E5] cursor-pointer"
                  />
                  <Input
                    value={branding.primary_color}
                    onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                    className="flex-1 font-mono text-sm"
                    placeholder="#E34A33"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Secondary Color</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="color"
                    value={branding.secondary_color}
                    onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                    className="w-10 h-10 rounded border border-[#E5E5E5] cursor-pointer"
                  />
                  <Input
                    value={branding.secondary_color}
                    onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                    className="flex-1 font-mono text-sm"
                    placeholder="#0A0A0A"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Accent Color</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="color"
                    value={branding.accent_color}
                    onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                    className="w-10 h-10 rounded border border-[#E5E5E5] cursor-pointer"
                  />
                  <Input
                    value={branding.accent_color}
                    onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                    className="flex-1 font-mono text-sm"
                    placeholder="#4F46E5"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 border border-[#E5E5E5] rounded">
              <p className="text-xs text-[#666666] mb-2">Preview</p>
              <div className="flex items-center gap-4">
                <div 
                  className="px-4 py-2 rounded text-white text-sm font-medium"
                  style={{ backgroundColor: branding.primary_color }}
                >
                  Primary Button
                </div>
                <div 
                  className="px-4 py-2 rounded text-white text-sm font-medium"
                  style={{ backgroundColor: branding.secondary_color }}
                >
                  Secondary
                </div>
                <div 
                  className="px-4 py-2 rounded text-white text-sm font-medium"
                  style={{ backgroundColor: branding.accent_color }}
                >
                  Accent
                </div>
              </div>
            </div>

            {/* Powered by BookSlot */}
            <div className="flex items-center justify-between py-3 border-t border-[#E5E5E5]">
              <div>
                <p className="font-medium text-[#0A0A0A]">Show "Powered by BookSlot"</p>
                <p className="text-sm text-[#666666]">Display branding on public booking pages</p>
              </div>
              <Switch
                checked={branding.show_powered_by}
                onCheckedChange={(checked) => setBranding({ ...branding, show_powered_by: checked })}
              />
            </div>

            <Button onClick={saveBranding} className="btn-primary w-full">
              Save Branding
            </Button>
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

        {/* Push Notification Reminders */}
        <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden" data-testid="push-reminders-section">
          <div className="flex items-center gap-3 p-6 pb-4">
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
              <BellRing className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0A0A0A]">Push Notification Reminders</h3>
              <p className="text-sm text-[#666666]">Send automatic reminders before appointments</p>
            </div>
          </div>
          <div className="px-6 pb-6 space-y-4">
            {!isSupported ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                Push notifications are not supported in this browser. Try Chrome, Edge, or Firefox on desktop.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-[#0A0A0A]">Enable Push Reminders</p>
                    <p className="text-sm text-[#666666]">
                      {isSubscribed ? 'Notifications active on this device' : 'Send appointment reminders via push notification'}
                    </p>
                  </div>
                  <Switch
                    checked={reminderSettings.push_enabled}
                    onCheckedChange={handleTogglePush}
                    disabled={savingReminders}
                    data-testid="toggle-push-reminders"
                  />
                </div>

                {reminderSettings.push_enabled && (
                  <>
                    <div className="flex items-center justify-between py-2 border-t border-[#E5E5E5]">
                      <div>
                        <p className="font-medium text-[#0A0A0A]">Remind Before</p>
                        <p className="text-sm text-[#666666]">How long before the appointment</p>
                      </div>
                      <select
                        value={reminderSettings.reminder_hours}
                        onChange={(e) => handleReminderHoursChange(parseInt(e.target.value))}
                        className="border border-[#E5E5E5] rounded-lg px-3 py-2 text-sm bg-white"
                        data-testid="push-reminder-hours"
                      >
                        <option value={1}>1 hour</option>
                        <option value={2}>2 hours</option>
                        <option value={4}>4 hours</option>
                        <option value={12}>12 hours</option>
                        <option value={24}>24 hours (1 day)</option>
                        <option value={48}>48 hours (2 days)</option>
                      </select>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">Reminders are active</p>
                        <p className="text-emerald-600 text-xs mt-0.5">
                          Clients who have subscribed via your booking page will receive a push notification {reminderSettings.reminder_hours} hour{reminderSettings.reminder_hours !== 1 ? 's' : ''} before their appointment.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {permission === 'denied' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                    Notifications are blocked on this device. Go to browser settings to allow notifications for this site.
                  </div>
                )}
              </>
            )}
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
