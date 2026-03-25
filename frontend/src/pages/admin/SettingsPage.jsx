import React, { useState, useEffect, useRef } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import { useTheme, themes } from '../../context/ThemeContext';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Checkbox } from '../../components/ui/checkbox';
import { toast } from 'sonner';
import { Building2, Globe, Clock, Shield, Bell, MessageSquare, Mail, Smartphone, Check, Palette, Upload, Eye, Puzzle, Plus, Trash2, Copy, Calendar, Bot, CreditCard, Webhook, Image, Sparkles } from 'lucide-react';

const SettingsPage = () => {
  const { tenant, token, updateTenant } = useAuth();
  const { currentTheme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(null);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [webhooks, setWebhooks] = useState([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(true);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ url: '', events: [] });
  const [branding, setBranding] = useState({
    primary_color: '#E34A33',
    secondary_color: '#0A0A0A',
    accent_color: '#4F46E5',
    show_powered_by: true,
    theme: 'default'
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

  const webhookEvents = [
    { value: 'booking.created', label: 'Booking Created' },
    { value: 'booking.updated', label: 'Booking Updated' },
    { value: 'booking.cancelled', label: 'Booking Cancelled' },
    { value: 'booking.completed', label: 'Booking Completed' }
  ];

  const integrations = [
    { name: 'Google Calendar', icon: Calendar, description: 'Sync appointments with Google Calendar', connected: false, plan: 'starter' },
    { name: 'AI Receptionist (Moltbot)', icon: Bot, description: 'AI-powered booking assistant', connected: true, plan: 'growth' },
    { name: 'Stripe Payments', icon: CreditCard, description: 'Accept online payments and deposits', connected: false, plan: 'starter' },
    { name: 'Website Widget', icon: Globe, description: 'Embed booking widget on your website', connected: true, plan: 'starter' }
  ];

  useEffect(() => {
    fetchNotificationSettings();
    fetchBranding();
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const response = await axios.get(`${API}/webhooks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWebhooks(response.data.webhooks || []);
    } catch (error) {
      console.error('Failed to load webhooks');
    } finally {
      setLoadingWebhooks(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhook.url || newWebhook.events.length === 0) {
      toast.error('Please enter URL and select at least one event');
      return;
    }
    try {
      await axios.post(`${API}/webhooks`, newWebhook, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Webhook created');
      setShowWebhookDialog(false);
      setNewWebhook({ url: '', events: [] });
      fetchWebhooks();
    } catch (error) {
      toast.error('Failed to create webhook');
    }
  };

  const handleDeleteWebhook = async (webhookId) => {
    if (!window.confirm('Delete this webhook?')) return;
    try {
      await axios.delete(`${API}/webhooks/${webhookId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Webhook deleted');
      fetchWebhooks();
    } catch (error) {
      toast.error('Failed to delete webhook');
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(`bks_${tenant?.tenant_id}_demo_key`);
    toast.success('API key copied');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, GIF, WebP)');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum 5MB allowed.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/upload/image`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // Update the logo URL with the uploaded file URL
      const logoUrl = `${API}/files/${response.data.file_id}`;
      setFormData(prev => ({ ...prev, logo_url: logoUrl }));
      toast.success('Logo uploaded successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
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

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Puzzle }
  ];

  return (
    <TenantLayout title="Settings">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#E5E5E5] overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#E34A33] text-[#E34A33]'
                  : 'border-transparent text-[#666666] hover:text-[#0A0A0A]'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="max-w-2xl">
        {/* General Tab */}
        {activeTab === 'general' && (
          <>
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

        {/* Save Button */}
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="btn-primary w-full"
          data-testid="save-settings"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
          </>
        )}

        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <div className="card-flat" data-testid="branding-settings">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                <Palette className="w-5 h-5 text-[#666666]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#0A0A0A]">Branding & Customization</h3>
                <p className="text-sm text-[#666666]">Customize colors and appearance for your booking pages</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Theme Selector */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4" />
                  Select Theme
                </Label>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.values(themes).map((themeOption) => (
                    <button
                      key={themeOption.id}
                      onClick={() => {
                        setTheme(themeOption.id);
                        setBranding({ ...branding, theme: themeOption.id });
                        toast.success(`Theme changed to ${themeOption.name}`);
                      }}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        currentTheme === themeOption.id
                          ? 'border-[#E34A33] ring-2 ring-[#E34A33]/20'
                          : 'border-[#E5E5E5] hover:border-[#999]'
                      }`}
                      data-testid={`theme-${themeOption.id}`}
                    >
                      {/* Theme preview colors */}
                      <div className="flex gap-1 mb-2">
                        <div 
                          className="w-6 h-6 rounded-full border border-white/20"
                          style={{ backgroundColor: themeOption.colors.background }}
                        />
                        <div 
                          className="w-6 h-6 rounded-full border border-white/20"
                          style={{ backgroundColor: themeOption.colors.accent }}
                        />
                        <div 
                          className="w-6 h-6 rounded-full border border-white/20"
                          style={{ backgroundColor: themeOption.colors.text }}
                        />
                      </div>
                      <p className="font-medium text-sm text-[#0A0A0A]">{themeOption.name}</p>
                      <p className="text-xs text-[#666666]">{themeOption.description}</p>
                      {themeOption.id === 'elite' && (
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                          ✨ Premium
                        </span>
                      )}
                      {currentTheme === themeOption.id && (
                        <span className="inline-block mt-1 ml-1 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                          Active
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Logo Upload */}
              <div>
                <Label className="text-sm font-medium">Business Logo</Label>
                <div className="mt-1.5 flex items-start gap-4">
                  <div className="w-20 h-20 border border-[#E5E5E5] rounded flex items-center justify-center overflow-hidden bg-[#FAFAFA]">
                    {formData.logo_url ? (
                      <img src={formData.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <Image className="w-8 h-8 text-[#E5E5E5]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="mb-2"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? 'Uploading...' : 'Upload Logo'}
                    </Button>
                    <p className="text-xs text-[#666666]">JPG, PNG, GIF, or WebP. Max 5MB.</p>
                  </div>
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
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="p-4 border border-[#E5E5E5] rounded">
                <p className="text-xs text-[#666666] mb-2">Preview</p>
                <div className="flex items-center gap-4">
                  <div className="px-4 py-2 rounded text-white text-sm font-medium" style={{ backgroundColor: branding.primary_color }}>Primary</div>
                  <div className="px-4 py-2 rounded text-white text-sm font-medium" style={{ backgroundColor: branding.secondary_color }}>Secondary</div>
                  <div className="px-4 py-2 rounded text-white text-sm font-medium" style={{ backgroundColor: branding.accent_color }}>Accent</div>
                </div>
              </div>

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
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="card-flat" data-testid="notification-settings">
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
                {/* Email Reminders */}
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
                    <p className="font-semibold text-[#E34A33]">+€10/month</p>
                  </div>
                  {notificationSettings?.sms_addon_enabled ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-green-600 text-sm">
                        <Check className="w-4 h-4" /> SMS Add-on Active
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-sm font-medium">Send SMS Reminders</p>
                          <p className="text-xs text-[#666666]">Clients receive SMS before appointments</p>
                        </div>
                        <Switch 
                          checked={notificationSettings?.sms_reminders_enabled}
                          onCheckedChange={(checked) => updateNotificationSetting('sms_reminders_enabled', checked)}
                        />
                      </div>
                      <Button variant="outline" size="sm" onClick={toggleSMSAddon} className="text-red-500 border-red-200 hover:bg-red-50">
                        Disable SMS Add-on
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={toggleSMSAddon} className="btn-primary w-full mt-2">
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
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <>
            {/* Available Integrations */}
            <div className="mb-8">
              <h2 className="font-semibold text-[#0A0A0A] mb-4">Available Integrations</h2>
              <div className="space-y-4">
                {integrations.map((integration, idx) => {
                  const Icon = integration.icon;
                  return (
                    <div key={idx} className="card-flat flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                          <Icon className="w-6 h-6 text-[#666666]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[#0A0A0A]">{integration.name}</h3>
                          <p className="text-sm text-[#666666] mb-2">{integration.description}</p>
                          <span className={`text-xs px-2 py-0.5 ${integration.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-[#FAFAFA] text-[#666666]'}`}>
                            {integration.connected ? 'Connected' : 'Not connected'}
                          </span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        {integration.connected ? 'Configure' : 'Connect'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* API Access */}
            <div className="card-flat mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                  <Puzzle className="w-5 h-5 text-[#666666]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0A0A0A]">API Access</h3>
                  <p className="text-sm text-[#666666]">
                    Use the API to integrate BookSlot with your own systems
                    {tenant?.plan !== 'pro' && ' (Pro plan required)'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-[#FAFAFA] border border-[#E5E5E5]">
                <code className="flex-1 text-sm font-mono text-[#666666] truncate">
                  bks_{tenant?.tenant_id?.slice(0, 8)}...demo_key
                </code>
                <Button variant="outline" size="sm" onClick={copyApiKey} className="flex items-center gap-2">
                  <Copy className="w-4 h-4" /> Copy
                </Button>
              </div>

              <div className="mt-4 text-sm">
                <p className="text-[#666666] mb-2">API Documentation:</p>
                <ul className="space-y-1 text-[#666666]">
                  <li>• <code className="text-xs bg-[#FAFAFA] px-1">GET /api/receptionist/{'{tenant_id}'}/info</code></li>
                  <li>• <code className="text-xs bg-[#FAFAFA] px-1">GET /api/receptionist/{'{tenant_id}'}/availability</code></li>
                  <li>• <code className="text-xs bg-[#FAFAFA] px-1">POST /api/receptionist/{'{tenant_id}'}/book</code></li>
                </ul>
              </div>
            </div>

            {/* Webhooks */}
            <div className="card-flat">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                    <Webhook className="w-5 h-5 text-[#666666]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0A0A0A]">Webhooks</h3>
                    <p className="text-sm text-[#666666]">Receive notifications when booking events occur</p>
                  </div>
                </div>
                <Button onClick={() => setShowWebhookDialog(true)} className="btn-primary flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Webhook
                </Button>
              </div>

              {loadingWebhooks ? (
                <div className="py-8 text-center text-[#666666]">Loading...</div>
              ) : webhooks.length === 0 ? (
                <div className="py-8 text-center text-[#666666]">No webhooks configured</div>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((webhook) => (
                    <div key={webhook.webhook_id} className="flex items-center justify-between p-4 bg-[#FAFAFA] border border-[#E5E5E5]">
                      <div>
                        <p className="font-mono text-sm text-[#0A0A0A] truncate max-w-md">{webhook.url}</p>
                        <div className="flex gap-2 mt-1">
                          {webhook.events?.map((event) => (
                            <span key={event} className="text-xs bg-white px-2 py-0.5 border border-[#E5E5E5]">{event}</span>
                          ))}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteWebhook(webhook.webhook_id)} className="text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Webhook Dialog */}
            <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Webhook</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className="text-sm font-medium">Webhook URL</Label>
                    <Input
                      value={newWebhook.url}
                      onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                      placeholder="https://your-server.com/webhook"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Events</Label>
                    <div className="space-y-2 mt-2">
                      {webhookEvents.map((event) => (
                        <label key={event.value} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={newWebhook.events.includes(event.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setNewWebhook({ ...newWebhook, events: [...newWebhook.events, event.value] });
                              } else {
                                setNewWebhook({ ...newWebhook, events: newWebhook.events.filter(e => e !== event.value) });
                              }
                            }}
                          />
                          <span className="text-sm text-[#0A0A0A]">{event.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setShowWebhookDialog(false)}>Cancel</Button>
                    <Button className="flex-1 btn-primary" onClick={handleCreateWebhook}>Create Webhook</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </TenantLayout>
  );
};

export default SettingsPage;
