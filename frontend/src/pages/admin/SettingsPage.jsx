import React, { useState, useEffect, useRef } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth } from '../../App';
import { useTheme, themes } from '../../context/ThemeContext';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Checkbox } from '../../components/ui/checkbox';
import { toast } from 'sonner';
import {
  Building2, Globe, Clock, Shield, Bell, MessageSquare, Mail, Smartphone, Check, Palette, Upload, Puzzle, Plus,
  Trash2, Copy, Bot, Webhook, Image, Sparkles, KeyRound, AlertTriangle, Link as LinkIcon, Lock, Send, Eye, EyeOff,
  CreditCard, CheckCircle2, ExternalLink,
} from 'lucide-react';
import { API, errorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/utils';

const TIMEZONES = [
  'Europe/Dublin', 'Europe/London', 'Europe/Lisbon', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
  'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Stockholm', 'Europe/Warsaw', 'Europe/Athens', 'America/New_York',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Vancouver',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth', 'Pacific/Auckland',
  'Asia/Dubai', 'Asia/Singapore', 'Asia/Kolkata', 'Asia/Tokyo', 'Africa/Johannesburg',
];
const CURRENCIES = ['EUR', 'GBP', 'USD', 'AUD', 'CAD', 'NZD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'ZAR', 'INR', 'SGD'];
const WEBHOOK_EVENTS = [
  { value: 'booking.created', label: 'Booking created' },
  { value: 'booking.updated', label: 'Booking updated / moved' },
  { value: 'booking.cancelled', label: 'Booking cancelled' },
  { value: 'booking.completed', label: 'Booking completed' },
];

const Card = ({ icon: Icon, title, subtitle, children, right }) => (
  <div className="card-flat mb-6">
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-[#666666]" />
        </div>
        <div>
          <h3 className="font-semibold text-[#0A0A0A]">{title}</h3>
          {subtitle && <p className="text-sm text-[#666666]">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
    {children}
  </div>
);

const ToggleRow = ({ title, description, checked, onChange, testId, disabled }) => (
  <div className="flex items-center justify-between gap-4 py-3 border-b border-[#E5E5E5] last:border-0">
    <div>
      <p className="font-medium text-[#0A0A0A]">{title}</p>
      {description && <p className="text-sm text-[#666666]">{description}</p>}
    </div>
    <Switch checked={!!checked} onCheckedChange={onChange} data-testid={testId} disabled={disabled} />
  </div>
);

const SettingsPage = () => {
  const { tenant, user, updateTenant, refreshTenant, isManager, setSession } = useAuth();
  const { setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('tab') || 'general'; } catch (e) { return 'general'; }
  });
  const [pay, setPay] = useState(null); // payments status
  const [payBusy, setPayBusy] = useState(false);

  const loadPayments = async () => {
    try { setPay((await axios.get(`${API}/payments/status`)).data); } catch (e) { /* ignore */ }
  };
  useEffect(() => {
    if (!isManager) return;
    loadPayments();
    const params = new URLSearchParams(window.location.search);
    const result = params.get('stripe');
    if (result) {
      const msg = {
        connected: ['success', 'Stripe connected. You can now take deposits online.'],
        cancelled: ['info', 'Stripe connection cancelled.'],
        expired: ['error', 'That link expired. Please try connecting again.'],
        failed: ['error', 'Stripe could not be connected. Please try again.'],
        in_use: ['error', 'That Stripe account is already connected to another business.'],
      }[result];
      if (msg) toast[msg[0]](msg[1]);
      window.history.replaceState({}, '', '/settings?tab=payments');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connectStripe = async () => {
    setPayBusy(true);
    try {
      const r = await axios.post(`${API}/payments/stripe/connect`);
      window.location.assign(r.data.url);
    } catch (e) { toast.error(errorMessage(e, 'Could not start Stripe connection')); setPayBusy(false); }
  };
  const disconnectStripe = async () => {
    if (!window.confirm('Disconnect Stripe? Online deposits will stop. Deposits already paid stay in your Stripe account.')) return;
    setPayBusy(true);
    try { setPay((await axios.post(`${API}/payments/stripe/disconnect`)).data); toast.success('Stripe disconnected'); }
    catch (e) { toast.error(errorMessage(e, 'Could not disconnect')); } finally { setPayBusy(false); }
  };
  const savePaySettings = async (changes) => {
    try { setPay((await axios.put(`${API}/payments/settings`, changes)).data); toast.success('Saved'); }
    catch (e) { toast.error(errorMessage(e, 'Could not save')); }
  };
  const [saving, setSaving] = useState(false);
  const features = tenant?.features || {};

  const [formData, setFormData] = useState({
    name: tenant?.name || '', email: tenant?.email || '', phone: tenant?.phone || '', address: tenant?.address || '',
    description: tenant?.description || '', website: tenant?.website || '',
    timezone: tenant?.timezone || 'Europe/Dublin', currency: tenant?.currency || 'EUR',
    booking_url_slug: tenant?.booking_url_slug || '',
  });
  const [booking, setBooking] = useState(tenant?.settings || {});
  const [savingBooking, setSavingBooking] = useState(false);

  const [branding, setBranding] = useState({ primary_color: '#3730A3', secondary_color: '#0A0A0A', accent_color: '#4F46E5', show_powered_by: true, theme: 'default', ...(tenant?.branding || {}) });
  const [logoUrl, setLogoUrl] = useState(tenant?.logo_url || '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [notificationSettings, setNotificationSettings] = useState(null);
  const [integration, setIntegration] = useState(null);
  const [webhooks, setWebhooks] = useState([]);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ url: '', events: ['booking.created'] });
  const [revealed, setRevealed] = useState({});
  const [apiKey, setApiKey] = useState(null);
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm: '' });

  useEffect(() => {
    axios.get(`${API}/notifications/settings`).then((r) => setNotificationSettings(r.data)).catch(() => {});
    axios.get(`${API}/notifications/integration-status`).then((r) => setIntegration(r.data)).catch(() => {});
    if (isManager) axios.get(`${API}/webhooks`).then((r) => setWebhooks(r.data.webhooks || [])).catch(() => {});
  }, [isManager]);

  useEffect(() => {
    if (!tenant) return;
    setBooking(tenant.settings || {});
    setLogoUrl(tenant.logo_url || '');
  }, [tenant]);

  const bookingUrl = `${window.location.origin}/book/${tenant?.booking_url_slug || ''}`;
  const copy = (text, label = 'Copied') => navigator.clipboard?.writeText(text).then(() => toast.success(label), () => toast.error('Copy failed'));

  // ---------- General ----------
  const saveGeneral = async () => {
    setSaving(true);
    try {
      await updateTenant(formData);
      toast.success('Business details saved');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const saveBooking = async () => {
    setSavingBooking(true);
    try {
      await axios.put(`${API}/tenants/me/settings`, booking);
      await refreshTenant();
      toast.success('Booking settings saved');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save booking settings'));
    } finally {
      setSavingBooking(false);
    }
  };

  // ---------- Branding ----------
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) return toast.error('Please upload a JPG, PNG, GIF or WebP image');
    if (file.size > 5 * 1024 * 1024) return toast.error('File too large. Maximum 5MB.');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const response = await axios.post(`${API}/upload/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await updateTenant({ logo_url: response.data.url });
      setLogoUrl(response.data.url);
      toast.success('Logo updated');
    } catch (error) {
      toast.error(errorMessage(error, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    try {
      await updateTenant({ logo_url: null });
      setLogoUrl('');
      toast.success('Logo removed');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const saveBranding = async () => {
    try {
      await axios.put(`${API}/tenants/me/branding`, branding);
      await refreshTenant();
      setTheme(branding.theme || 'default');
      toast.success('Branding saved');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to update branding'));
    }
  };

  // ---------- Notifications ----------
  const updateNotificationSetting = async (key, value) => {
    try {
      await axios.put(`${API}/notifications/settings`, { [key]: value });
      setNotificationSettings((prev) => ({ ...prev, [key]: value }));
      toast.success('Saved');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to update setting'));
    }
  };

  const toggleSMSAddon = async () => {
    const enabling = !notificationSettings?.sms_addon_enabled;
    if (enabling && !window.confirm(`Enable the SMS add-on for ${formatMoney(notificationSettings?.sms_addon_price || 10, 'EUR')}/month?`)) return;
    try {
      await axios.post(`${API}/notifications/sms-addon/${enabling ? 'enable' : 'disable'}`);
      const r = await axios.get(`${API}/notifications/settings`);
      setNotificationSettings(r.data);
      toast.success(enabling ? 'SMS add-on enabled' : 'SMS add-on disabled');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to update SMS add-on'));
    }
  };

  // ---------- Integrations ----------
  const generateKey = async () => {
    if (tenant?.has_api_key && !window.confirm('Create a new key? The current key will stop working immediately.')) return;
    try {
      const r = await axios.post(`${API}/tenants/me/api-key`);
      setApiKey(r.data.api_key);
      await refreshTenant();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const revokeKey = async () => {
    if (!window.confirm('Revoke the API key? Anything using it will stop working.')) return;
    try {
      await axios.delete(`${API}/tenants/me/api-key`);
      setApiKey(null);
      await refreshTenant();
      toast.success('API key revoked');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const loadWebhooks = () => axios.get(`${API}/webhooks`).then((r) => setWebhooks(r.data.webhooks || [])).catch(() => {});

  const createWebhook = async () => {
    if (!newWebhook.url || newWebhook.events.length === 0) return toast.error('Enter a URL and choose at least one event');
    try {
      await axios.post(`${API}/webhooks`, newWebhook);
      toast.success('Webhook added');
      setShowWebhookDialog(false);
      setNewWebhook({ url: '', events: ['booking.created'] });
      loadWebhooks();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to create webhook'));
    }
  };

  const deleteWebhook = async (id) => {
    if (!window.confirm('Delete this webhook?')) return;
    try {
      await axios.delete(`${API}/webhooks/${id}`);
      toast.success('Webhook deleted');
      loadWebhooks();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const testWebhook = async (id) => {
    try {
      await axios.post(`${API}/webhooks/${id}/test`);
      toast.success('Test event sent - check your endpoint');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const toggleWebhook = async (hook) => {
    try {
      await axios.put(`${API}/webhooks/${hook.webhook_id}`, { is_active: !hook.is_active });
      loadWebhooks();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  // ---------- Account ----------
  const changePassword = async () => {
    if (passwords.new_password.length < 8) return toast.error('New password must be at least 8 characters');
    if (passwords.new_password !== passwords.confirm) return toast.error("New passwords don't match");
    try {
      const r = await axios.post(`${API}/auth/change-password`, passwords);
      await setSession(r.data);
      setPasswords({ current_password: '', new_password: '', confirm: '' });
      toast.success('Password changed. Other devices have been signed out.');
    } catch (e) { toast.error(errorMessage(e, 'Could not change password')); }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Building2, manager: true },
    { id: 'booking', label: 'Online booking', icon: Clock, manager: true },
    { id: 'branding', label: 'Branding', icon: Palette, manager: true },
    { id: 'notifications', label: 'Notifications', icon: Bell, manager: true },
    { id: 'payments', label: 'Payments', icon: CreditCard, manager: true },
    { id: 'integrations', label: 'Integrations', icon: Puzzle, manager: true },
    { id: 'account', label: 'My account', icon: Lock },
  ].filter((t) => !t.manager || isManager);
  const tab = tabs.some((t) => t.id === activeTab) ? activeTab : tabs[0].id;
  const planPrice = { starter: 29, growth: 79, pro: 149 }[tenant?.plan] || 0;

  return (
    <TenantLayout title="Settings">
      <div className="flex gap-1 mb-6 border-b border-[#E5E5E5] overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} data-testid={`tab-${id}`}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === id ? 'border-[#3730A3] text-[#3730A3]' : 'border-transparent text-[#666666] hover:text-[#0A0A0A]'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl">
        {/* ---------------- General ---------------- */}
        {tab === 'general' && (
          <>
            <Card icon={Building2} title="Business details" subtitle="Shown on your booking page and in client emails">
              <div className="space-y-4">
                {[['name', 'Business name'], ['email', 'Contact email'], ['phone', 'Phone'], ['address', 'Address'], ['website', 'Website']].map(([k, label]) => (
                  <div key={k}>
                    <Label className="text-sm font-medium">{label}</Label>
                    <Input value={formData[k] || ''} onChange={(e) => setFormData({ ...formData, [k]: e.target.value })} className="mt-1.5" data-testid={`setting-${k}`} />
                  </div>
                ))}
                <div>
                  <Label className="text-sm font-medium">Short description (booking page)</Label>
                  <textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} maxLength={500} className="mt-1.5 input-swiss resize-none" />
                </div>
              </div>
            </Card>

            <Card icon={Globe} title="Regional settings" subtitle="Appointment times always use this timezone">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Timezone</Label>
                  <select value={formData.timezone} onChange={(e) => setFormData({ ...formData, timezone: e.target.value })} className="mt-1.5 input-swiss" data-testid="setting-timezone">
                    {[...new Set([formData.timezone, ...TIMEZONES])].map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Currency</Label>
                  <select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="mt-1.5 input-swiss" data-testid="setting-currency">
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </Card>

            <Card icon={LinkIcon} title="Booking link" subtitle="The web address clients use to book you">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#666666] whitespace-nowrap">{window.location.host}/book/</span>
                <Input value={formData.booking_url_slug} onChange={(e) => setFormData({ ...formData, booking_url_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} data-testid="setting-slug" />
                <Button variant="outline" size="sm" onClick={() => copy(bookingUrl, 'Booking link copied')}><Copy className="w-4 h-4" /></Button>
              </div>
              <p className="text-xs text-[#666666] mt-2">Changing this breaks the old link - update it anywhere you've shared it.</p>
            </Card>

            <Card icon={Shield} title="Subscription" subtitle="Your current plan">
              <div className="flex items-center justify-between p-4 bg-[#FAFAFA] border border-[#E5E5E5]">
                <div>
                  <p className="font-semibold text-[#0A0A0A] capitalize">{tenant?.plan || 'starter'} plan</p>
                  <p className="text-sm text-[#666666]">
                    {formatMoney(planPrice, 'EUR')}/month{notificationSettings?.sms_addon_enabled ? ` + ${formatMoney(notificationSettings.sms_addon_price, 'EUR')}/month SMS` : ''}
                  </p>
                </div>
                <a href="/pricing" target="_blank" rel="noreferrer" className="text-sm underline text-[#666666]">Compare plans</a>
              </div>
            </Card>

            <Button onClick={saveGeneral} disabled={saving} className="btn-primary w-full" data-testid="save-settings">
              {saving ? 'Saving...' : 'Save settings'}
            </Button>
          </>
        )}

        {/* ---------------- Online booking ---------------- */}
        {tab === 'booking' && (
          <>
            <Card icon={Clock} title="Online booking rules" subtitle="Applies to your booking page, AI receptionist and API">
              <ToggleRow title="Accept online bookings" description="Turn off to pause your booking page" checked={booking.online_booking_enabled}
                onChange={(v) => setBooking({ ...booking, online_booking_enabled: v })} testId="setting-online-booking" />
              <ToggleRow title="Require email address" description="Needed to send confirmations and reminders" checked={booking.require_email}
                onChange={(v) => setBooking({ ...booking, require_email: v })} testId="setting-require-email" />
              <ToggleRow title="Require phone number" checked={booking.require_phone} onChange={(v) => setBooking({ ...booking, require_phone: v })} testId="setting-require-phone" />
              <ToggleRow title="Let clients cancel online" description="From the link in their confirmation email" checked={booking.allow_client_cancellation}
                onChange={(v) => setBooking({ ...booking, allow_client_cancellation: v })} testId="setting-allow-cancel" />
              <div className="grid sm:grid-cols-2 gap-4 pt-4">
                <div>
                  <Label className="text-sm font-medium">Minimum notice</Label>
                  <select value={booking.min_notice_minutes ?? 60} onChange={(e) => setBooking({ ...booking, min_notice_minutes: Number(e.target.value) })} className="mt-1.5 input-swiss" data-testid="setting-min-notice">
                    {[[0, 'None'], [30, '30 minutes'], [60, '1 hour'], [120, '2 hours'], [240, '4 hours'], [720, '12 hours'], [1440, '24 hours'], [2880, '48 hours']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Book up to</Label>
                  <select value={booking.max_advance_days ?? 90} onChange={(e) => setBooking({ ...booking, max_advance_days: Number(e.target.value) })} className="mt-1.5 input-swiss">
                    {[[14, '2 weeks ahead'], [30, '1 month ahead'], [60, '2 months ahead'], [90, '3 months ahead'], [180, '6 months ahead'], [365, '1 year ahead']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Start times every</Label>
                  <select value={booking.slot_interval_minutes ?? 30} onChange={(e) => setBooking({ ...booking, slot_interval_minutes: Number(e.target.value) })} className="mt-1.5 input-swiss" data-testid="setting-slot-interval">
                    {[10, 15, 20, 30, 45, 60].map((v) => <option key={v} value={v}>{v} minutes</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Online cancellation closes</Label>
                  <select value={booking.cancellation_notice_hours ?? 0} onChange={(e) => setBooking({ ...booking, cancellation_notice_hours: Number(e.target.value) })} className="mt-1.5 input-swiss">
                    {[[0, 'Any time before'], [2, '2 hours before'], [12, '12 hours before'], [24, '24 hours before'], [48, '48 hours before']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
            </Card>

            <Card icon={Check} title="Approval for long appointments" subtitle="Online requests this long or longer wait for you to approve them">
              <select value={booking.approval_threshold_minutes ?? 0} onChange={(e) => setBooking({ ...booking, approval_threshold_minutes: Number(e.target.value) })} className="input-swiss" data-testid="setting-approval">
                {[[0, 'Off - confirm all bookings automatically'], [60, '60 minutes or longer'], [90, '90 minutes or longer'], [120, '2 hours or longer'], [180, '3 hours or longer'], [240, '4 hours or longer']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <p className="text-xs text-[#666666] mt-2">Requests appear in your notifications and on the calendar with an orange outline.</p>
            </Card>

            <Button onClick={saveBooking} disabled={savingBooking} className="btn-primary w-full" data-testid="save-booking-settings">
              {savingBooking ? 'Saving...' : 'Save booking settings'}
            </Button>
          </>
        )}

        {/* ---------------- Branding ---------------- */}
        {tab === 'branding' && (
          <Card icon={Palette} title="Branding" subtitle="How your booking page looks">
            <div className="space-y-6" data-testid="branding-settings">
              <div>
                <Label className="text-sm font-medium flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4" /> Theme</Label>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.values(themes).map((t) => (
                    <button key={t.id} onClick={() => setBranding({ ...branding, theme: t.id })} data-testid={`theme-${t.id}`}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${branding.theme === t.id ? 'border-[#3730A3] ring-2 ring-[#3730A3]/20' : 'border-[#E5E5E5] hover:border-[#999]'}`}>
                      <div className="flex gap-1 mb-2">
                        {[t.colors.background, t.colors.accent, t.colors.text].map((col) => (
                          <div key={col} className="w-6 h-6 rounded-full border border-[#E5E5E5]" style={{ backgroundColor: col }} />
                        ))}
                      </div>
                      <p className="font-medium text-sm text-[#0A0A0A]">{t.name}</p>
                      <p className="text-xs text-[#666666]">{t.description}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#666666] mt-2">The theme is applied to your dashboard and your public booking page after you save.</p>
              </div>

              <div>
                <Label className="text-sm font-medium">Logo</Label>
                <div className="mt-1.5 flex items-start gap-4">
                  <div className="w-20 h-20 border border-[#E5E5E5] rounded flex items-center justify-center overflow-hidden bg-[#FAFAFA]">
                    {logoUrl ? <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" /> : <Image className="w-8 h-8 text-[#E5E5E5]" />}
                  </div>
                  <div className="flex-1">
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleFileUpload} className="hidden" />
                    <div className="flex gap-2 mb-2">
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} data-testid="upload-logo">
                        <Upload className="w-4 h-4 mr-2" />{uploading ? 'Uploading...' : 'Upload logo'}
                      </Button>
                      {logoUrl && <Button variant="ghost" onClick={removeLogo} className="text-red-500">Remove</Button>}
                    </div>
                    <p className="text-xs text-[#666666]">JPG, PNG, GIF or WebP, up to 5MB. Saved straight away.</p>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                {[['primary_color', 'Primary (emails)'], ['secondary_color', 'Secondary'], ['accent_color', 'Accent']].map(([k, label]) => (
                  <div key={k}>
                    <Label className="text-sm font-medium">{label}</Label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input type="color" value={branding[k]} onChange={(e) => setBranding({ ...branding, [k]: e.target.value })} className="w-10 h-10 rounded border border-[#E5E5E5] cursor-pointer" />
                      <Input value={branding[k]} onChange={(e) => setBranding({ ...branding, [k]: e.target.value })} className="flex-1 font-mono text-sm" />
                    </div>
                  </div>
                ))}
              </div>

              <ToggleRow title='Show "Powered by BookSlot"' description={features.white_label ? 'Shown on your booking page' : 'Removing this is part of the Pro plan'}
                checked={branding.show_powered_by} disabled={!features.white_label} onChange={(v) => setBranding({ ...branding, show_powered_by: v })} />

              <Button onClick={saveBranding} className="btn-primary w-full" data-testid="save-branding">Save branding</Button>
            </div>
          </Card>
        )}

        {/* ---------------- Notifications ---------------- */}
        {tab === 'notifications' && (
          <Card icon={Bell} title="Client notifications" subtitle="Confirmations, reminders and cancellations">
            {!notificationSettings ? (
              <div className="text-center py-4 text-[#666666]">Loading...</div>
            ) : (
              <div className="space-y-4" data-testid="notification-settings">
                {!notificationSettings.email_configured && (
                  <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Emails aren't being delivered yet: the platform's email provider (Resend) hasn't been set up. Messages are logged but not sent.
                  </div>
                )}
                <div className="flex items-center justify-between py-3 border-b border-[#E5E5E5]">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-[#666666]" />
                    <div>
                      <p className="font-medium text-[#0A0A0A]">Email confirmations & reminders</p>
                      <p className="text-sm text-[#666666]">Included in every plan</p>
                    </div>
                  </div>
                  <Switch checked={notificationSettings.email_reminders_enabled} onCheckedChange={(v) => updateNotificationSetting('email_reminders_enabled', v)} data-testid="email-reminders-toggle" />
                </div>

                <div className="flex items-center justify-between py-3 border-b border-[#E5E5E5]">
                  <div>
                    <p className="font-medium text-[#0A0A0A]">Reminder timing</p>
                    <p className="text-sm text-[#666666]">How long before the appointment</p>
                  </div>
                  <select value={notificationSettings.reminder_hours_before || 24} onChange={(e) => updateNotificationSetting('reminder_hours_before', parseInt(e.target.value, 10))} className="input-swiss !w-36">
                    {[1, 2, 4, 12, 24, 48, 72].map((h) => <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>)}
                  </select>
                </div>

                <div className="p-4 bg-[#FAFAFA] border border-[#E5E5E5]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-[#3730A3]" />
                      <div>
                        <p className="font-medium text-[#0A0A0A]">SMS add-on</p>
                        <p className="text-sm text-[#666666]">Text message confirmations & reminders</p>
                      </div>
                    </div>
                    <p className="font-semibold text-[#3730A3]">+{formatMoney(notificationSettings.sms_addon_price, 'EUR')}/mo</p>
                  </div>
                  {!notificationSettings.sms_configured && <p className="text-xs text-amber-700 mb-2">SMS sending isn't set up on the platform yet (Twilio).</p>}
                  {notificationSettings.sms_addon_enabled ? (
                    <div className="space-y-3">
                      <ToggleRow title="Send SMS confirmations & reminders" description="To clients who give a mobile number" checked={notificationSettings.sms_reminders_enabled}
                        onChange={(v) => updateNotificationSetting('sms_reminders_enabled', v)} />
                      <Button variant="outline" size="sm" onClick={toggleSMSAddon} className="text-red-500 border-red-200 hover:bg-red-50">Turn off SMS add-on</Button>
                    </div>
                  ) : (
                    <Button onClick={toggleSMSAddon} className="btn-primary w-full mt-2"><MessageSquare className="w-4 h-4 mr-2" />Enable SMS add-on</Button>
                  )}
                </div>
                <p className="text-xs text-[#666666]">Edit the wording of these messages under AI Receptionist → Message templates.</p>
              </div>
            )}
          </Card>
        )}

        {/* ---------------- Integrations ---------------- */}
        {tab === 'payments' && (
          <>
            <Card icon={CreditCard} title="Online deposits" subtitle="Clients pay a deposit when they book, straight into your own Stripe account">
              {!pay ? <p className="text-sm text-[#666666]">Loading...</p> : !pay.platform_ready ? (
                <p className="text-sm text-[#666666]" data-testid="payments-unavailable">Online payments aren't switched on for BookSlot yet. Your BookSlot provider can enable them.</p>
              ) : !pay.connected ? (
                <div data-testid="stripe-not-connected">
                  <ol className="text-sm text-[#666666] space-y-1.5 mb-5 list-decimal pl-5">
                    <li>Tap <span className="font-medium text-[#0A0A0A]">Connect Stripe</span>.</li>
                    <li>Log in to your existing Stripe account, or create one (about 5 minutes).</li>
                    <li>Tap <span className="font-medium text-[#0A0A0A]">Allow</span> and you'll come straight back here.</li>
                  </ol>
                  <Button onClick={connectStripe} disabled={payBusy} className="bg-[#635BFF] hover:bg-[#5249e6] text-white w-full sm:w-auto" data-testid="connect-stripe">
                    {payBusy ? 'Opening Stripe...' : 'Connect Stripe'}
                  </Button>
                  <p className="text-xs text-[#999] mt-3">Deposits go directly to you. BookSlot never holds your money, and you can disconnect at any time. Stripe charges its usual card fee.</p>
                </div>
              ) : (
                <div data-testid="stripe-connected">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border border-emerald-200 bg-emerald-50 mb-4">
                    <div className="flex items-center gap-2 text-emerald-800 text-sm"><CheckCircle2 className="w-4 h-4 shrink-0" /><span>Stripe connected <span className="text-emerald-700/70 whitespace-nowrap">({pay.account})</span></span></div>
                    <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-800 underline inline-flex items-center gap-1">Stripe dashboard <ExternalLink className="w-3 h-3" /></a>
                  </div>
                  <ToggleRow title="Take deposits online" description="Clients pay when they book any service with a deposit set (Services → edit → Require deposit). Their slot is held for 30 minutes while they pay."
                    checked={pay.settings.deposits_enabled} onChange={(v) => savePaySettings({ deposits_enabled: v })} testId="deposits-toggle" />
                  <div className="py-3 border-b border-[#E5E5E5]">
                    <p className="font-medium text-[#0A0A0A]">Refund if the client cancels</p>
                    <p className="text-sm text-[#666666] mb-2">If you cancel, the deposit is always refunded.</p>
                    <select className="input-swiss !w-auto" value={pay.settings.refund_hours} data-testid="refund-hours"
                      onChange={(e) => savePaySettings({ refund_hours: Number(e.target.value) })}>
                      {[[0, 'Always refund'], [12, 'At least 12 hours before'], [24, 'At least 24 hours before'], [48, 'At least 48 hours before'], [72, 'At least 3 days before'], [168, 'At least 7 days before'], [336, 'At least 14 days before']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="pt-4">
                    <Button variant="outline" onClick={disconnectStripe} disabled={payBusy} className="text-red-600 border-red-200 hover:bg-red-50" data-testid="disconnect-stripe">Disconnect Stripe</Button>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}

        {tab === 'integrations' && (
          <>
            <Card icon={Puzzle} title="Connected services" subtitle="Set up by the platform administrator">
              <div className="space-y-3">
                {[
                  { icon: Mail, name: 'Email delivery (Resend)', on: integration?.email?.configured },
                  { icon: Smartphone, name: 'SMS (Twilio)', on: integration?.sms?.configured },
                  { icon: Bot, name: 'AI receptionist', on: integration?.ai?.configured, extra: !features.ai_assistant ? 'Growth plan or higher' : null },
                  { icon: Globe, name: 'Online booking page', on: true },
                ].map(({ icon: Icon, name, on, extra }) => (
                  <div key={name} className="flex items-center justify-between p-3 border border-[#E5E5E5]">
                    <div className="flex items-center gap-3"><Icon className="w-5 h-5 text-[#666666]" /><span className="text-[#0A0A0A]">{name}</span></div>
                    <span className={`text-xs px-2 py-0.5 ${on && !extra ? 'bg-emerald-50 text-emerald-700' : 'bg-[#FAFAFA] text-[#666666]'}`}>
                      {extra || (on ? 'Active' : 'Not configured')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Label className="text-sm font-medium">Add booking to your own website</Label>
                <div className="flex gap-2 mt-1.5">
                  <code className="flex-1 text-xs p-2 bg-[#FAFAFA] border border-[#E5E5E5] overflow-x-auto whitespace-nowrap">{`<a href="${bookingUrl}">Book now</a>`}</code>
                  <Button variant="outline" size="sm" onClick={() => copy(`<a href="${bookingUrl}">Book now</a>`, 'Snippet copied')}><Copy className="w-4 h-4" /></Button>
                </div>
              </div>
            </Card>

            <Card icon={KeyRound} title="API access" subtitle="Connect phone bots, Zapier or your own systems">
              {!features.api_webhooks ? (
                <p className="text-sm text-[#666666]">API access and webhooks are part of the Pro plan.</p>
              ) : (
                <div className="space-y-3 text-sm">
                  {apiKey ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200">
                      <p className="text-emerald-800 mb-2 font-medium">Copy your new API key now - it won't be shown again.</p>
                      <div className="flex gap-2">
                        <code className="flex-1 p-2 bg-white border border-emerald-200 break-all" data-testid="api-key-value">{apiKey}</code>
                        <Button variant="outline" size="sm" onClick={() => copy(apiKey, 'API key copied')}><Copy className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[#666666]">{tenant?.has_api_key ? 'An API key is active. For security it can only be viewed when created.' : 'No API key yet.'}</p>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={generateKey} data-testid="generate-api-key">{tenant?.has_api_key ? 'Replace key' : 'Create API key'}</Button>
                    {tenant?.has_api_key && <Button variant="ghost" size="sm" className="text-red-500" onClick={revokeKey}>Revoke</Button>}
                  </div>
                  <div className="pt-3 border-t border-[#E5E5E5] text-[#666666]">
                    <p className="mb-1">Business ID: <code className="bg-[#FAFAFA] px-1">{tenant?.tenant_id}</code> <button onClick={() => copy(tenant?.tenant_id)} className="underline text-xs">copy</button></p>
                    <p className="mb-2">Send the key in an <code className="bg-[#FAFAFA] px-1">X-API-Key</code> header:</p>
                    <ul className="space-y-1 font-mono text-xs">
                      <li>GET /api/receptionist/{'{business_id}'}/info</li>
                      <li>GET /api/receptionist/{'{business_id}'}/availability?service_id=&date=YYYY-MM-DD</li>
                      <li>POST /api/receptionist/{'{business_id}'}/book</li>
                      <li>POST /api/receptionist/{'{business_id}'}/reschedule</li>
                      <li>POST /api/receptionist/{'{business_id}'}/cancel</li>
                      <li>POST /api/moltbot/{'{business_id}'}/chat</li>
                    </ul>
                  </div>
                </div>
              )}
            </Card>

            <Card icon={Webhook} title="Webhooks" subtitle="Get notified at your own URL when bookings change"
              right={features.api_webhooks && <Button onClick={() => setShowWebhookDialog(true)} className="btn-primary flex items-center gap-2" size="sm"><Plus className="w-4 h-4" />Add</Button>}>
              {!features.api_webhooks ? (
                <p className="text-sm text-[#666666]">Webhooks are part of the Pro plan.</p>
              ) : webhooks.length === 0 ? (
                <p className="py-4 text-center text-[#666666] text-sm">No webhooks yet</p>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((hook) => (
                    <div key={hook.webhook_id} className="p-4 bg-[#FAFAFA] border border-[#E5E5E5] space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-sm text-[#0A0A0A] break-all">{hook.url}</p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Switch checked={hook.is_active} onCheckedChange={() => toggleWebhook(hook)} />
                          <Button variant="ghost" size="sm" onClick={() => testWebhook(hook.webhook_id)} title="Send test"><Send className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteWebhook(hook.webhook_id)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {hook.events?.map((ev) => <span key={ev} className="text-xs bg-white px-2 py-0.5 border border-[#E5E5E5]">{ev}</span>)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#666666]">
                        Signing secret:
                        <code className="bg-white px-1 border border-[#E5E5E5]">{revealed[hook.webhook_id] ? hook.secret : '••••••••••••'}</code>
                        <button onClick={() => setRevealed({ ...revealed, [hook.webhook_id]: !revealed[hook.webhook_id] })}>
                          {revealed[hook.webhook_id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button onClick={() => copy(hook.secret, 'Secret copied')}><Copy className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-[#666666]">Each request has an <code>X-BookSlot-Signature: sha256=…</code> header: an HMAC-SHA256 of the raw body using the signing secret.</p>
                </div>
              )}
            </Card>

            <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Add webhook</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className="text-sm font-medium">URL</Label>
                    <Input value={newWebhook.url} onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })} placeholder="https://your-server.com/webhook" className="mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Events</Label>
                    <div className="space-y-2 mt-2">
                      {WEBHOOK_EVENTS.map((ev) => (
                        <label key={ev.value} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={newWebhook.events.includes(ev.value)} onCheckedChange={(checked) => setNewWebhook({
                            ...newWebhook, events: checked ? [...newWebhook.events, ev.value] : newWebhook.events.filter((x) => x !== ev.value),
                          })} />
                          <span className="text-sm text-[#0A0A0A]">{ev.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setShowWebhookDialog(false)}>Cancel</Button>
                    <Button className="flex-1 btn-primary" onClick={createWebhook}>Add webhook</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* ---------------- Account ---------------- */}
        {tab === 'account' && (
          <Card icon={Lock} title="My account" subtitle={user?.email}>
            <div className="space-y-4">
              <p className="text-sm text-[#666666]">Change your password. If you sign in with Google only, leave "current password" empty to set one.</p>
              <div>
                <Label className="text-sm font-medium">Current password</Label>
                <Input type="password" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} className="mt-1.5" autoComplete="current-password" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">New password</Label>
                  <Input type="password" value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} className="mt-1.5" autoComplete="new-password" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Confirm new password</Label>
                  <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} className="mt-1.5" autoComplete="new-password" />
                </div>
              </div>
              <Button className="btn-primary" onClick={changePassword} data-testid="change-password-btn">Change password</Button>
            </div>
          </Card>
        )}
      </div>
    </TenantLayout>
  );
};

export default SettingsPage;
