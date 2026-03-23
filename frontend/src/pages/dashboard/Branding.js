import React, { useState, useEffect } from 'react';
import { Save, Palette, Image, Type, Eye } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { brandingAPI } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

const fontOptions = [
  { value: 'Inter', label: 'Inter (Default)' },
  { value: 'Outfit', label: 'Outfit' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
];

export default function Branding() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState(null);
  const [businessName, setBusinessName] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    try {
      const data = await brandingAPI.get();
      setBranding(data.branding);
      setBusinessName(data.name);
    } catch (error) {
      console.error('Failed to load branding:', error);
      toast.error('Failed to load branding settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await brandingAPI.update(branding);
      toast.success('Branding saved successfully');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateBranding = (key, value) => {
    setBranding(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <DashboardLayout title="Branding">
        <div className="max-w-4xl mx-auto animate-pulse space-y-6">
          <div className="bg-white rounded-2xl border border-[#E5E5E0] p-6 h-64" />
          <div className="bg-white rounded-2xl border border-[#E5E5E0] p-6 h-48" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Branding">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Live Preview */}
        <div className="bg-white rounded-2xl border border-[#E5E5E0] overflow-hidden">
          <div className="p-5 border-b border-[#E5E5E0] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2E473B]/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-[#2E473B]" />
              </div>
              <div>
                <h2 className="font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
                  Live Preview
                </h2>
                <p className="text-sm text-[#6B6B6B]">See how your booking page will look</p>
              </div>
            </div>
          </div>
          <div 
            className="p-8"
            style={{ backgroundColor: branding?.background_color || '#FAF9F6' }}
          >
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-6" style={{ fontFamily: branding?.font_family || 'Inter' }}>
              <div className="text-center mb-6">
                <div 
                  className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white text-xl font-bold"
                  style={{ backgroundColor: branding?.primary_color || '#2E473B' }}
                >
                  {businessName?.charAt(0) || 'B'}
                </div>
                <h3 
                  className="text-xl font-bold"
                  style={{ color: branding?.text_color || '#1C1C1C' }}
                >
                  {businessName || 'Your Business'}
                </h3>
              </div>
              <button
                className="w-full py-3 rounded-xl text-white font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: branding?.primary_color || '#2E473B' }}
              >
                Book Appointment
              </button>
              <div className="mt-4 flex gap-2">
                <div 
                  className="flex-1 h-10 rounded-lg"
                  style={{ backgroundColor: branding?.secondary_color || '#C26A58' }}
                />
                <div 
                  className="flex-1 h-10 rounded-lg"
                  style={{ backgroundColor: branding?.accent_color || '#E6B861' }}
                />
              </div>
              {branding?.show_powered_by && (
                <p className="text-center text-xs text-[#6B6B6B] mt-4">
                  Powered by TimeSlot Pro
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Colors */}
        <div className="bg-white rounded-2xl border border-[#E5E5E0] overflow-hidden">
          <div className="p-5 border-b border-[#E5E5E0]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C26A58]/10 flex items-center justify-center">
                <Palette className="w-5 h-5 text-[#C26A58]" />
              </div>
              <div>
                <h2 className="font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
                  Colors
                </h2>
                <p className="text-sm text-[#6B6B6B]">Customize your brand colors</p>
              </div>
            </div>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { key: 'primary_color', label: 'Primary Color', desc: 'Buttons, headers' },
              { key: 'secondary_color', label: 'Secondary Color', desc: 'Accents, highlights' },
              { key: 'accent_color', label: 'Accent Color', desc: 'Special elements' },
              { key: 'background_color', label: 'Background', desc: 'Page background' },
              { key: 'text_color', label: 'Text Color', desc: 'Main text' },
            ].map(({ key, label, desc }) => (
              <div key={key}>
                <Label className="text-[#1C1C1C] text-sm">{label}</Label>
                <p className="text-xs text-[#6B6B6B] mb-2">{desc}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={branding?.[key] || '#000000'}
                    onChange={(e) => updateBranding(key, e.target.value)}
                    className="w-12 h-10 rounded-lg cursor-pointer border border-[#E5E5E0]"
                  />
                  <Input
                    value={branding?.[key] || ''}
                    onChange={(e) => updateBranding(key, e.target.value)}
                    placeholder="#000000"
                    className="flex-1 rounded-xl font-mono text-sm"
                    data-testid={`branding-${key}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div className="bg-white rounded-2xl border border-[#E5E5E0] overflow-hidden">
          <div className="p-5 border-b border-[#E5E5E0]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3E6653]/10 flex items-center justify-center">
                <Type className="w-5 h-5 text-[#3E6653]" />
              </div>
              <div>
                <h2 className="font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
                  Typography
                </h2>
                <p className="text-sm text-[#6B6B6B]">Choose your font style</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <Label className="text-[#1C1C1C]">Font Family</Label>
            <select
              value={branding?.font_family || 'Inter'}
              onChange={(e) => updateBranding('font_family', e.target.value)}
              className="w-full mt-1 h-10 px-3 rounded-xl border border-[#E5E5E0] bg-white"
              data-testid="branding-font"
            >
              {fontOptions.map(font => (
                <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Options */}
        <div className="bg-white rounded-2xl border border-[#E5E5E0] overflow-hidden">
          <div className="p-5 border-b border-[#E5E5E0]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E6B861]/10 flex items-center justify-center">
                <Image className="w-5 h-5 text-[#E6B861]" />
              </div>
              <div>
                <h2 className="font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
                  Options
                </h2>
                <p className="text-sm text-[#6B6B6B]">Additional branding options</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[#1C1C1C]">Show "Powered by TimeSlot Pro"</p>
                <p className="text-sm text-[#6B6B6B]">Display attribution on booking page</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={branding?.show_powered_by ?? true}
                  onChange={(e) => updateBranding('show_powered_by', e.target.checked)}
                  className="sr-only peer"
                  data-testid="branding-powered-by"
                />
                <div className="w-11 h-6 bg-[#E5E5E0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2E473B]"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white px-8"
            data-testid="save-branding-btn"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Branding
              </>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
