import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { toast } from 'sonner';
import {
  Building2, Palette, CalendarCog, BellRing, Save, Upload, Camera, Loader2, Check, Globe, Clock, CreditCard, ExternalLink, AlertCircle
} from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { THEME_PRESETS } from '../../config/themePresets';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const TABS = [
  { key: 'business', label: 'Business', icon: Building2 },
  { key: 'branding', label: 'Branding', icon: Palette },
  { key: 'booking', label: 'Booking Rules', icon: CalendarCog },
  { key: 'payments', label: 'Payments', icon: CreditCard },
  { key: 'notifications', label: 'Notifications', icon: BellRing },
];

const SettingsPage = () => {
  const { tenant, token, updateTenant } = useAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const { permission, isSubscribed, isSupported, subscribe, unsubscribe } = usePushNotifications(token);
  const [activeTab, setActiveTab] = useState('business');
  const [saving, setSaving] = useState(false);
  const exitToDashboard = () => navigate(tenantSlug ? `/${tenantSlug}/dashboard` : '/dashboard');

  // Business
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', timezone: 'Europe/Dublin', currency: 'EUR' });

  // Branding
  const [branding, setBranding] = useState({ business_name: '', primary_color: '#C4898E', secondary_color: '#2C2A29', accent_color: '#D4A373', theme_preset: 'default' });
  const [logoUrl, setLogoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const logoRef = useRef(null);

  // Booking rules
  const [rules, setRules] = useState({
    online_booking_enabled: true, approval_required: true,
    cancellation_window_hours: 24, reschedule_window_hours: 24,
    lead_time_hours: 1, buffer_minutes: 0, max_bookings_per_day: 0,
    require_phone: true, require_email: false, client_self_cancel: true,
  });
  const [vipThreshold, setVipThreshold] = useState(500);

  // Notifications
  const [reminderSettings, setReminderSettings] = useState({ push_enabled: false, reminder_hours: 24 });
  const [savingReminders, setSavingReminders] = useState(false);

  // Stripe Connect
  const [stripeStatus, setStripeStatus] = useState(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [depositsEnabled, setDepositsEnabled] = useState(true);
  const [searchParams] = (() => { try { return [new URLSearchParams(window.location.search)]; } catch { return [new URLSearchParams()]; } })();

  const fetchStripeStatus = async () => {
    try {
      const r = await axios.get(`${API}/tenants/me/stripe/status`, { headers: { Authorization: `Bearer ${token}` } });
      setStripeStatus(r.data);
    } catch {
      setStripeStatus({ connected: false, charges_enabled: false });
    }
  };

  const handleConnectStripe = async () => {
    setStripeLoading(true);
    try {
      const r = await axios.post(`${API}/tenants/me/stripe/connect-link`, { return_origin: window.location.origin }, { headers: { Authorization: `Bearer ${token}` } });
      window.location.href = r.data.url;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not generate Stripe onboarding link');
    } finally {
      setStripeLoading(false);
    }
  };

  useEffect(() => {
    if (tenant) {
      setFormData({ name: tenant.name || '', email: tenant.email || '', phone: tenant.phone || '', timezone: tenant.timezone || 'Europe/Dublin', currency: tenant.currency || 'EUR' });    }
    fetchBranding(); fetchBookingRules(); fetchReminderSettings(); fetchStripeStatus(); fetchVipThreshold(); fetchPaymentSettings();
  }, [tenant]);

  // Auto-pop Payments tab + show toast if user just returned from Stripe onboarding
  useEffect(() => {
    const stripeParam = searchParams.get('stripe');
    if (stripeParam === 'connected') {
      setActiveTab('payments');
      toast.success('Stripe connection saved — checking status…');
      fetchStripeStatus();
    } else if (stripeParam === 'refresh') {
      setActiveTab('payments');
      toast.info('Onboarding link expired — please reconnect.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBranding = async () => {
    try {
      const res = await axios.get(`${API}/tenants/me/branding`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.branding) setBranding(prev => ({ ...prev, ...res.data.branding }));
      if (res.data.logo_url) setLogoUrl(res.data.logo_url);
    } catch {}
  };

  const fetchBookingRules = async () => {
    try {
      const res = await axios.get(`${API}/tenants/me/booking-rules`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.booking_rules) setRules(prev => ({ ...prev, ...res.data.booking_rules }));
    } catch {}
  };

  const fetchReminderSettings = async () => {
    try {
      const res = await axios.get(`${API}/reminders/settings`, { headers: { Authorization: `Bearer ${token}` } });
      setReminderSettings(res.data.settings || { push_enabled: false, reminder_hours: 24 });
    } catch {}
  };

  const fetchVipThreshold = async () => {
    try {
      const r = await axios.get(`${API}/tenants/me/clv-settings`, { headers: { Authorization: `Bearer ${token}` } });
      setVipThreshold(r.data.vip_threshold_euros ?? 500);
    } catch {}
  };

  const fetchPaymentSettings = async () => {
    try {
      const r = await axios.get(`${API}/tenants/me/payment-settings`, { headers: { Authorization: `Bearer ${token}` } });
      setDepositsEnabled(r.data.deposits_enabled !== false);
    } catch {}
  };

  const handleToggleDeposits = async () => {
    const next = !depositsEnabled;
    setDepositsEnabled(next);
    try {
      await axios.put(`${API}/tenants/me/payment-settings`, { deposits_enabled: next }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(next ? 'Deposits turned ON' : 'Deposits turned OFF — all bookings are now free at booking time');
    } catch {
      setDepositsEnabled(!next);
      toast.error('Could not update');
    }
  };

  // Save handlers
  const handleSaveBusiness = async () => {
    setSaving(true);
    try { await updateTenant(formData); toast.success('Business details saved'); exitToDashboard(); } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const handleSaveBranding = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/tenants/me/branding`, branding, { headers: { Authorization: `Bearer ${token}` } });
      // Persist logo_url on the tenant doc AND refresh the in-memory tenant so the sidebar updates instantly
      await updateTenant({ logo_url: logoUrl || null });
      toast.success('Branding saved');
      exitToDashboard();
    } catch { toast.error('Failed to save branding'); } finally { setSaving(false); }
  };

  const handleSaveRules = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/tenants/me/booking-rules`, rules, { headers: { Authorization: `Bearer ${token}` } });
      // Persist VIP threshold separately
      await axios.put(`${API}/tenants/me/clv-settings`, { vip_threshold_euros: Number(vipThreshold) || 500 }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Booking rules saved');
      exitToDashboard();
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) { toast.error('PNG, JPEG, WebP, or SVG only'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await axios.post(`${API}/upload/image`, fd, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      setLogoUrl(`${BACKEND_URL}${res.data.url}`); toast.success('Logo uploaded');
    } catch { toast.error('Upload failed'); } finally { setUploading(false); }
  };

  const handleTogglePush = async () => {
    if (!reminderSettings.push_enabled) {
      const ok = await subscribe();
      if (ok) { await saveReminder({ push_enabled: true, reminder_hours: reminderSettings.reminder_hours }); toast.success('Push reminders enabled'); }
      else toast.error('Notifications blocked by browser');
    } else { await unsubscribe(); await saveReminder({ push_enabled: false, reminder_hours: reminderSettings.reminder_hours }); toast.success('Disabled'); }
  };

  const saveReminder = async (s) => {
    setSavingReminders(true);
    try { await axios.post(`${API}/reminders/settings`, s, { headers: { Authorization: `Bearer ${token}` } }); setReminderSettings(s); } catch {}
    finally { setSavingReminders(false); }
  };

  return (
    <TenantLayout title="Settings">
      <div className="max-w-4xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 p-1.5 bg-[#F7F3EE] rounded-full w-fit overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 text-sm rounded-full transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.key ? 'bg-white shadow-sm text-[#2C2A29] font-medium' : 'text-[#9E948F] hover:text-[#706B68]'
              }`} data-testid={`settings-tab-${tab.key}`}
            >
              <tab.icon className="w-4 h-4" strokeWidth={1.5} /> {tab.label}
            </button>
          ))}
        </div>

        {/* ========== BUSINESS DETAILS ========== */}
        {activeTab === 'business' && (
          <div className="space-y-6" data-testid="settings-business">
            <SectionCard title="Business Information" subtitle="Your salon's basic details">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FieldGroup label="Business Name"><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} data-testid="setting-name" /></FieldGroup>
                <FieldGroup label="Email"><Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></FieldGroup>
                <FieldGroup label="Phone"><Input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></FieldGroup>
                <FieldGroup label="Timezone">
                  <select value={formData.timezone} onChange={e => setFormData({ ...formData, timezone: e.target.value })} className="w-full h-11 px-4 text-sm bg-[#FAF8F6] rounded-xl border border-[#EDE8E3] focus:border-[#C4898E] focus:ring-1 focus:ring-[#C4898E] outline-none">
                    {['Europe/Dublin', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney'].map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </FieldGroup>
                <FieldGroup label="Currency">
                  <select value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })} className="w-full h-11 px-4 text-sm bg-[#FAF8F6] rounded-xl border border-[#EDE8E3] focus:border-[#C4898E] focus:ring-1 focus:ring-[#C4898E] outline-none">
                    {['EUR', 'GBP', 'USD', 'AUD', 'CAD'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FieldGroup>
              </div>
            </SectionCard>
            <SaveBar saving={saving} onSave={handleSaveBusiness} />
          </div>
        )}

        {/* ========== BRANDING ========== */}
        {activeTab === 'branding' && (
          <div className="space-y-6" data-testid="settings-branding">
            <SectionCard title="Theme Preset" subtitle="One-click looks crafted for premium salons. Pick a base — your colours and logo override it.">
              <div className="grid sm:grid-cols-2 gap-4">
                {Object.values(THEME_PRESETS).map((preset) => {
                  const active = branding.theme_preset === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => setBranding({
                        ...branding,
                        theme_preset: preset.key,
                        // Pull in preset colours when switching, so save reflects the chosen aesthetic
                        primary_color: preset.colors.primary,
                        secondary_color: preset.colors.secondary,
                        accent_color: preset.colors.accent,
                      })}
                      className={`relative text-left rounded-2xl p-5 transition-all border-2 ${active ? 'shadow-lg' : 'hover:-translate-y-0.5'}`}
                      style={{
                        background: preset.mode === 'dark' ? '#0A0A0A' : '#FAF8F6',
                        borderColor: active ? preset.colors.primary : 'transparent',
                        color: preset.mode === 'dark' ? '#F5EFE0' : '#2C2A29',
                      }}
                      data-testid={`theme-preset-${preset.key}`}
                    >
                      <div className="flex items-center gap-1.5 mb-3">
                        {preset.swatch.map((c, idx) => (
                          <span key={idx} className="w-5 h-5 rounded-full" style={{ background: c, border: '1px solid rgba(255,255,255,0.1)' }} />
                        ))}
                      </div>
                      <p
                        className="text-lg font-light mb-1"
                        style={{ fontFamily: preset.tokens.headingFont, letterSpacing: preset.mode === 'dark' ? '0.06em' : 0 }}
                      >
                        {preset.name}
                      </p>
                      <p className="text-xs opacity-80 leading-relaxed">{preset.description}</p>
                      {active && (
                        <span
                          className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: preset.colors.primary, color: preset.mode === 'dark' ? '#0A0A0A' : '#fff' }}
                        >
                          <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Brand Identity" subtitle="Customize your salon's look and feel — colors update buttons, badges, and accents across the app">
              <div className="flex items-start gap-6 mb-6">
                <div className="relative group cursor-pointer" onClick={() => logoRef.current?.click()}>
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-2xl object-cover border-2 border-[#EDE8E3] group-hover:border-[#C4898E] transition-colors" />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-[#E5DFD9] flex items-center justify-center bg-[#FAF8F6] group-hover:border-[#C4898E] transition-colors">
                      <Upload className="w-6 h-6 text-[#9E948F]" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#2C2A29] flex items-center justify-center text-white shadow-md">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  </div>
                  <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </div>
                <div>
                  <p className="font-medium text-[#2C2A29]">Logo</p>
                  <p className="text-sm text-[#9E948F]">Upload your salon logo (PNG, JPEG, SVG)</p>
                </div>
              </div>

              <FieldGroup label="Display Name">
                <Input value={branding.business_name} onChange={e => setBranding({ ...branding, business_name: e.target.value })} placeholder="Shown in sidebar and booking pages" />
              </FieldGroup>

              <div className="grid grid-cols-3 gap-4 mt-5">
                <ColorPicker label="Primary" value={branding.primary_color} onChange={v => setBranding({ ...branding, primary_color: v })} hint="Buttons, active states" />
                <ColorPicker label="Secondary" value={branding.secondary_color} onChange={v => setBranding({ ...branding, secondary_color: v })} hint="Headers, dark elements" />
                <ColorPicker label="Accent" value={branding.accent_color} onChange={v => setBranding({ ...branding, accent_color: v })} hint="Highlights, badges" />
              </div>

              {/* Live Preview */}
              <div className="mt-6 p-5 bg-[#FAF8F6] rounded-2xl border border-[#EDE8E3]">
                <p className="text-xs tracking-[0.15em] uppercase text-[#9E948F] font-medium mb-3">Live Preview</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button className="px-5 py-2.5 rounded-full text-white text-sm font-medium" style={{ backgroundColor: branding.primary_color }}>Book Now</button>
                  <button className="px-5 py-2.5 rounded-full text-white text-sm font-medium" style={{ backgroundColor: branding.secondary_color }}>View Calendar</button>
                  <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: branding.accent_color + '20', color: branding.accent_color }}>Confirmed</span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: branding.primary_color + '20', color: branding.primary_color }}>2 Pending</span>
                </div>
              </div>
            </SectionCard>
            <SaveBar saving={saving} onSave={handleSaveBranding} />
          </div>
        )}

        {/* ========== BOOKING RULES ========== */}
        {activeTab === 'booking' && (
          <div className="space-y-6" data-testid="settings-booking">
            <SectionCard title="Online Booking" subtitle="Control how clients book appointments">
              <ToggleRow label="Online Booking" desc="Allow clients to book through your public booking page" checked={rules.online_booking_enabled} onChange={v => setRules({ ...rules, online_booking_enabled: v })} testId="toggle-online-booking" />
              <ToggleRow label="Require Approval" desc="New bookings must be approved before they're confirmed" checked={rules.approval_required} onChange={v => setRules({ ...rules, approval_required: v })} testId="toggle-approval" />
              <ToggleRow label="Client Self-Cancellation" desc="Clients can cancel their own bookings online" checked={rules.client_self_cancel} onChange={v => setRules({ ...rules, client_self_cancel: v })} testId="toggle-self-cancel" />
            </SectionCard>

            <SectionCard title="Client Requirements" subtitle="What information clients must provide when booking">
              <ToggleRow label="Require Phone Number" desc="Clients must enter phone number to book" checked={rules.require_phone} onChange={v => setRules({ ...rules, require_phone: v })} testId="toggle-require-phone" />
              <ToggleRow label="Require Email" desc="Clients must enter email to book" checked={rules.require_email} onChange={v => setRules({ ...rules, require_email: v })} testId="toggle-require-email" />
            </SectionCard>

            <SectionCard title="Scheduling Rules" subtitle="Timing constraints for bookings and cancellations">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <NumberField label="Cancellation Window" value={rules.cancellation_window_hours} onChange={v => setRules({ ...rules, cancellation_window_hours: v })} unit="hours" hint="How far in advance clients can cancel" />
                <NumberField label="Reschedule Window" value={rules.reschedule_window_hours} onChange={v => setRules({ ...rules, reschedule_window_hours: v })} unit="hours" hint="How far in advance clients can reschedule" />
                <NumberField label="Lead Time" value={rules.lead_time_hours} onChange={v => setRules({ ...rules, lead_time_hours: v })} unit="hours" hint="Minimum time before earliest bookable slot" />
                <NumberField label="Buffer Between Bookings" value={rules.buffer_minutes} onChange={v => setRules({ ...rules, buffer_minutes: v })} unit="min" hint="Gap between consecutive appointments" />
              </div>
            </SectionCard>

            <SectionCard title="VIP Clients" subtitle="Auto-tag clients as VIP when their lifetime spend crosses this threshold. VIPs get a crown badge on the calendar and clients page.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <NumberField
                  label="VIP Threshold"
                  value={vipThreshold}
                  onChange={v => setVipThreshold(v)}
                  unit="EUR"
                  hint="Lifetime spend needed for an automatic VIP tag (default €500)"
                />
              </div>
            </SectionCard>
            <SaveBar saving={saving} onSave={handleSaveRules} />
          </div>
        )}

        {/* ========== PAYMENTS (Stripe Connect) ========== */}
        {activeTab === 'payments' && (
          <div className="space-y-6" data-testid="settings-payments">
            <SectionCard title="Deposits" subtitle="Master switch for deposit-required bookings. Turn this off and ALL services skip the deposit step — no Stripe checkout for clients.">
              <ToggleRow
                label="Require deposits for bookings"
                desc={depositsEnabled
                  ? 'On — services with a deposit will redirect clients to Stripe Checkout.'
                  : 'Off — all bookings are free at booking time, no Stripe checkout. Per-service deposit settings are kept but ignored until you flip this back on.'}
                checked={depositsEnabled}
                onChange={handleToggleDeposits}
                testId="toggle-deposits-enabled"
              />
              {!depositsEnabled && (
                <div className="mt-3 bg-[#FAF8F6] rounded-2xl p-4 flex items-start gap-3 border border-[#EDE8E3]">
                  <AlertCircle className="w-4 h-4 text-[#9E948F] mt-0.5 shrink-0" strokeWidth={1.5} />
                  <p className="text-xs text-[#706B68] leading-relaxed">
                    Tip: leave this off while you decide on Stripe. You can switch it back on any time — your per-service deposit amounts are saved.
                  </p>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Stripe Payments" subtitle="Connect your Stripe account to take card deposits at booking. Money lands directly in your bank — BookSlot only takes a small platform fee.">
              {!stripeStatus && (
                <div className="text-sm text-[#9E948F] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
              )}

              {stripeStatus && !stripeStatus.connected && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-[#FAF8F6] rounded-2xl border border-[#EDE8E3]">
                    <CreditCard className="w-5 h-5 text-[#9E948F] mt-0.5" strokeWidth={1.5} />
                    <div>
                      <p className="text-sm font-medium text-[#2C2A29]">Not connected yet</p>
                      <p className="text-xs text-[#9E948F] mt-0.5">Connecting takes ~2 minutes. You'll set up your Stripe account on Stripe's secure page, then be returned here.</p>
                    </div>
                  </div>
                  <button onClick={handleConnectStripe} disabled={stripeLoading} className="h-11 px-6 rounded-full bg-[#635BFF] text-white text-sm font-medium hover:bg-[#544DD1] transition-colors flex items-center gap-2 disabled:opacity-60" data-testid="connect-stripe-btn">
                    {stripeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" strokeWidth={1.5} />}
                    Connect with Stripe
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              )}

              {stripeStatus && stripeStatus.connected && stripeStatus.charges_enabled && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-[#F2F8F2] rounded-2xl border border-[#C8D5C8]" data-testid="stripe-connected-banner">
                    <div className="w-9 h-9 rounded-full bg-[#8FA68F]/20 flex items-center justify-center">
                      <Check className="w-4 h-4 text-[#5F7A5F]" strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#2C2A29]">Stripe connected and ready</p>
                      <p className="text-xs text-[#706B68]">Account: <code className="font-mono text-[11px]">{stripeStatus.account_id}</code></p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[#FAF8F6] rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider text-[#9E948F]">Payouts</p>
                      <p className="text-sm font-medium text-[#2C2A29] mt-0.5">{stripeStatus.payouts_enabled ? 'Enabled' : 'Pending verification'}</p>
                    </div>
                    <div className="p-3 bg-[#FAF8F6] rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider text-[#9E948F]">Platform fee</p>
                      <p className="text-sm font-medium text-[#2C2A29] mt-0.5">€{((stripeStatus.platform_fee_cents || 50) / 100).toFixed(2)} per booking</p>
                    </div>
                  </div>
                  <button onClick={handleConnectStripe} disabled={stripeLoading} className="text-xs text-[#9E948F] hover:text-[#2C2A29] flex items-center gap-1.5">
                    <ExternalLink className="w-3 h-3" /> Manage account on Stripe
                  </button>
                </div>
              )}

              {stripeStatus && stripeStatus.connected && !stripeStatus.charges_enabled && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-[#FFF8E8] rounded-2xl border border-[#F5D88A]" data-testid="stripe-incomplete-banner">
                    <AlertCircle className="w-5 h-5 text-[#A06A1B] mt-0.5" strokeWidth={1.5} />
                    <div>
                      <p className="text-sm font-medium text-[#2C2A29]">Onboarding incomplete</p>
                      <p className="text-xs text-[#A06A1B] mt-0.5">{stripeStatus.details_submitted ? "Stripe is reviewing your details. We'll enable payments here as soon as Stripe approves." : 'Finish your Stripe onboarding to start taking deposits.'}</p>
                    </div>
                  </div>
                  <button onClick={handleConnectStripe} disabled={stripeLoading} className="h-11 px-6 rounded-full bg-[#635BFF] text-white text-sm font-medium hover:bg-[#544DD1] transition-colors flex items-center gap-2 disabled:opacity-60">
                    {stripeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" strokeWidth={1.5} />}
                    Continue Stripe setup
                  </button>
                </div>
              )}
            </SectionCard>

            <SectionCard title="How it works" subtitle="Plain English — no surprises">
              <div className="space-y-3 text-sm text-[#706B68]">
                <p>• Each service can require a deposit (set in Services tab). Clients pay it on Stripe Checkout when booking.</p>
                <p>• Money lands directly in <span className="font-medium text-[#2C2A29]">your</span> Stripe account — Stripe pays out to your bank on a 2-day rolling schedule.</p>
                <p>• BookSlot takes <span className="font-medium text-[#2C2A29]">€{((stripeStatus?.platform_fee_cents || 50) / 100).toFixed(2)} per booking</span> as a platform fee. That's it.</p>
                <p>• Plus Stripe's standard processing fee (~1.5% + €0.25 in EU) — same as anywhere else.</p>
                <p>• You can refund any deposit straight from the calendar — funds go back to the customer's card.</p>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ========== NOTIFICATIONS ========== */}
        {activeTab === 'notifications' && (
          <div className="space-y-6" data-testid="settings-notifications">
            <SectionCard title="Push Notifications" subtitle="Send automatic reminders to clients before their appointments">
              {!isSupported ? (
                <div className="bg-[#FAF8F6] rounded-2xl p-4 text-sm text-[#9E948F] border border-[#EDE8E3]">
                  Push notifications are not supported in this browser. Use Chrome, Edge, or Firefox.
                </div>
              ) : (
                <>
                  <ToggleRow label="Enable Push Reminders" desc={isSubscribed ? 'Active on this device' : 'Send appointment reminders via push notification'}
                    checked={reminderSettings.push_enabled} onChange={handleTogglePush} testId="toggle-push-reminders" />
                  {reminderSettings.push_enabled && (
                    <>
                      <div className="flex items-center justify-between py-4 border-t border-[#EDE8E3]">
                        <div><p className="text-sm font-medium text-[#2C2A29]">Remind Before</p><p className="text-xs text-[#9E948F]">How long before the appointment</p></div>
                        <select value={reminderSettings.reminder_hours} onChange={e => saveReminder({ ...reminderSettings, reminder_hours: parseInt(e.target.value) })}
                          className="h-10 px-4 text-sm bg-[#FAF8F6] rounded-xl border border-[#EDE8E3]" data-testid="push-reminder-hours">
                          {[1, 2, 4, 12, 24, 48].map(h => <option key={h} value={h}>{h} hour{h !== 1 ? 's' : ''}</option>)}
                        </select>
                      </div>
                      <div className="bg-[#8FA68F]/10 rounded-2xl p-4 flex items-start gap-3 border border-[#8FA68F]/20">
                        <Check className="w-4 h-4 text-[#8FA68F] mt-0.5 shrink-0" strokeWidth={2} />
                        <div><p className="text-sm font-medium text-[#2C2A29]">Reminders Active</p><p className="text-xs text-[#706B68]">Clients will receive a push notification {reminderSettings.reminder_hours}h before their appointment</p></div>
                      </div>
                    </>
                  )}
                  {permission === 'denied' && <div className="bg-[#D4A373]/10 rounded-2xl p-4 text-sm text-[#D4A373] border border-[#D4A373]/20">Notifications blocked. Allow in browser settings.</div>}
                </>
              )}
            </SectionCard>
          </div>
        )}
      </div>
    </TenantLayout>
  );
};

/* ========== REUSABLE COMPONENTS ========== */

const SectionCard = ({ title, subtitle, children }) => (
  <div className="bg-white rounded-3xl p-7 shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-[#F0EBE6]/60">
    <div className="mb-6">
      <h3 className="font-['Cormorant_Garamond'] text-xl text-[#2C2A29]">{title}</h3>
      {subtitle && <p className="text-sm text-[#9E948F] mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const FieldGroup = ({ label, children }) => (
  <div>
    <Label className="text-xs tracking-[0.1em] uppercase text-[#9E948F] font-medium">{label}</Label>
    <div className="mt-1.5 [&>input]:h-11 [&>input]:rounded-xl [&>input]:bg-[#FAF8F6] [&>input]:border-[#EDE8E3] [&>input]:focus:border-[#C4898E] [&>input]:focus:ring-1 [&>input]:focus:ring-[#C4898E]">{children}</div>
  </div>
);

const ToggleRow = ({ label, desc, checked, onChange, testId }) => (
  <div className="flex items-center justify-between py-4 border-b border-[#F0EBE6] last:border-0">
    <div><p className="text-sm font-medium text-[#2C2A29]">{label}</p>{desc && <p className="text-xs text-[#9E948F] mt-0.5">{desc}</p>}</div>
    <Switch checked={checked} onCheckedChange={onChange} data-testid={testId} />
  </div>
);

const NumberField = ({ label, value, onChange, unit, hint }) => (
  <div>
    <Label className="text-xs tracking-[0.1em] uppercase text-[#9E948F] font-medium">{label}</Label>
    <div className="mt-1.5 flex items-center gap-2">
      <Input type="number" value={value} onChange={e => onChange(parseInt(e.target.value) || 0)} className="h-11 rounded-xl bg-[#FAF8F6] border-[#EDE8E3] flex-1" />
      <span className="text-xs text-[#9E948F] min-w-[36px]">{unit}</span>
    </div>
    {hint && <p className="text-[11px] text-[#9E948F] mt-1">{hint}</p>}
  </div>
);

const ColorPicker = ({ label, value, onChange, hint }) => (
  <div>
    <Label className="text-xs tracking-[0.1em] uppercase text-[#9E948F] font-medium">{label}</Label>
    <div className="mt-1.5 flex items-center gap-2 bg-[#FAF8F6] rounded-xl border border-[#EDE8E3] px-3 py-2">
      <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent" />
      <input type="text" value={value} onChange={e => onChange(e.target.value)} className="flex-1 text-sm bg-transparent border-0 outline-none text-[#2C2A29] font-mono" />
    </div>
    {hint && <p className="text-[11px] text-[#9E948F] mt-1">{hint}</p>}
  </div>
);

const SaveBar = ({ saving, onSave }) => (
  <div className="flex justify-end">
    <Button onClick={onSave} disabled={saving} className="h-11 px-8 rounded-full bg-[#2C2A29] text-white hover:bg-[#4A4745] disabled:opacity-50 transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]" data-testid="save-settings-btn">
      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" strokeWidth={1.5} />}
      {saving ? 'Saving...' : 'Save Changes'}
    </Button>
  </div>
);

export default SettingsPage;
