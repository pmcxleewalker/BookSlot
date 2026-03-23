import React, { useState, useEffect } from 'react';
import { Save, Building2, Globe, Clock } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { settingsAPI, subscriptionAPI } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import BusinessHoursSettings from './BusinessHoursSettings';

const timezones = [
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'America/New_York', label: 'New York (EST)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
];

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [business, setBusiness] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const { refreshUser } = useAuth();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [settingsData, subData] = await Promise.all([
        settingsAPI.getBusiness(),
        subscriptionAPI.get()
      ]);
      setBusiness(settingsData.business);
      setSubscription(subData);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsAPI.updateBusiness(business);
      await refreshUser();
      toast.success('Settings saved');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpgrade = async (plan) => {
    try {
      await subscriptionAPI.upgrade(plan);
      toast.success(`Upgraded to ${plan} plan`);
      loadSettings();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Settings">
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E5E5E0] p-6 animate-pulse">
              <div className="h-6 w-32 bg-[#E5E5E0] rounded mb-4" />
              <div className="space-y-3">
                <div className="h-10 bg-[#E5E5E0] rounded" />
                <div className="h-10 bg-[#E5E5E0] rounded" />
              </div>
            </div>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Settings">
      <div className="space-y-6 max-w-3xl">
        {/* Business Settings */}
        <form onSubmit={handleSave}>
          <div className="bg-white rounded-2xl border border-[#E5E5E0] overflow-hidden">
            <div className="p-6 border-b border-[#E5E5E0]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2E473B]/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-[#2E473B]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
                    Business Information
                  </h2>
                  <p className="text-sm text-[#6B6B6B]">Basic details about your business</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <Label htmlFor="name">Business Name</Label>
                <Input
                  id="name"
                  value={business?.name || ''}
                  onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                  className="mt-1 rounded-xl"
                  data-testid="settings-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={business?.email || ''}
                    onChange={(e) => setBusiness({ ...business, email: e.target.value })}
                    className="mt-1 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={business?.phone || ''}
                    onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                    className="mt-1 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={business?.address || ''}
                  onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                  className="mt-1 rounded-xl"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={business?.city || ''}
                    onChange={(e) => setBusiness({ ...business, city: e.target.value })}
                    className="mt-1 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={business?.country || ''}
                    onChange={(e) => setBusiness({ ...business, country: e.target.value })}
                    className="mt-1 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  value={business?.timezone || 'Europe/London'}
                  onChange={(e) => setBusiness({ ...business, timezone: e.target.value })}
                  className="w-full mt-1 h-10 rounded-xl border border-[#E5E5E0] px-3 bg-white"
                >
                  {timezones.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={business?.website || ''}
                  onChange={(e) => setBusiness({ ...business, website: e.target.value })}
                  placeholder="https://yourbusiness.com"
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>
            <div className="p-6 bg-[#FAF9F6] border-t border-[#E5E5E0]">
              <Button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
                data-testid="save-settings-btn"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

        {/* Business Hours */}
        <div className="bg-white rounded-2xl border border-[#E5E5E0] overflow-hidden p-6">
          <BusinessHoursSettings />
        </div>

        {/* Subscription */}
        <div className="bg-white rounded-2xl border border-[#E5E5E0] overflow-hidden">
          <div className="p-6 border-b border-[#E5E5E0]">
            <h2 className="text-lg font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
              Subscription
            </h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium text-[#1C1C1C] capitalize">{subscription?.plan} Plan</p>
                <p className="text-sm text-[#6B6B6B]">€{subscription?.price_monthly}/month</p>
              </div>
              {subscription?.is_trial && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-[#E6B861]/20 text-[#E6B861]">
                  Trial
                </span>
              )}
            </div>
            <div className="space-y-2 text-sm text-[#6B6B6B]">
              <p>• Up to {subscription?.max_staff} staff members</p>
              <p>• {subscription?.max_locations} location{subscription?.max_locations > 1 ? 's' : ''}</p>
            </div>
            {subscription?.plan !== 'pro' && (
              <div className="mt-6 pt-6 border-t border-[#E5E5E0]">
                <p className="text-sm text-[#6B6B6B] mb-3">Upgrade for more features</p>
                <div className="flex gap-2">
                  {subscription?.plan === 'starter' && (
                    <Button
                      onClick={() => handleUpgrade('growth')}
                      variant="outline"
                      className="rounded-xl"
                    >
                      Upgrade to Growth
                    </Button>
                  )}
                  <Button
                    onClick={() => handleUpgrade('pro')}
                    className="rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
                  >
                    Upgrade to Pro
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Booking Page URL */}
        <div className="bg-white rounded-2xl border border-[#E5E5E0] overflow-hidden">
          <div className="p-6 border-b border-[#E5E5E0]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2E473B]/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-[#2E473B]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
                  Online Booking
                </h2>
                <p className="text-sm text-[#6B6B6B]">Share this link with your clients</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="bg-[#FAF9F6] rounded-xl p-4 font-mono text-sm text-[#2E473B] break-all">
              {window.location.origin}/book/{business?.slug}
            </div>
            <Button
              variant="outline"
              className="mt-4 rounded-xl"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/book/${business?.slug}`);
                toast.success('Link copied!');
              }}
            >
              Copy Link
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
