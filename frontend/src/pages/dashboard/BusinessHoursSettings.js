import React, { useState, useEffect } from 'react';
import { Clock, Save, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const TIME_OPTIONS = [];
for (let h = 6; h <= 22; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hour = h.toString().padStart(2, '0');
    const minute = m.toString().padStart(2, '0');
    TIME_OPTIONS.push(`${hour}:${minute}`);
  }
}

export default function BusinessHoursSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hours, setHours] = useState({});

  useEffect(() => {
    loadBusinessHours();
  }, []);

  const loadBusinessHours = async () => {
    try {
      const response = await fetch(`${API_URL}/api/settings/business-hours`, {
        credentials: 'include'
      });
      const data = await response.json();
      setHours(data.business_hours || {});
    } catch (error) {
      toast.error('Failed to load business hours');
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (day) => {
    setHours({
      ...hours,
      [day]: {
        ...hours[day],
        is_open: !hours[day]?.is_open
      }
    });
  };

  const handleTimeChange = (day, field, value) => {
    setHours({
      ...hours,
      [day]: {
        ...hours[day],
        [field]: value
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/settings/business-hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ business_hours: hours })
      });
      
      if (!response.ok) throw new Error('Failed to save');
      toast.success('Business hours updated');
    } catch (error) {
      toast.error('Failed to save business hours');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Business Hours</h2>
            <p className="text-sm text-gray-500">Set when your business is open for bookings</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-gray-900 hover:bg-gray-800">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {DAYS.map(({ key, label }) => {
          const dayHours = hours[key] || { open: '09:00', close: '17:00', is_open: key !== 'saturday' && key !== 'sunday' };
          const isOpen = dayHours.is_open;
          
          return (
            <div key={key} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4 min-w-[140px]">
                <Switch
                  checked={isOpen}
                  onCheckedChange={() => handleDayToggle(key)}
                  data-testid={`toggle-${key}`}
                />
                <Label className={`font-medium ${isOpen ? 'text-gray-900' : 'text-gray-400'}`}>
                  {label}
                </Label>
              </div>
              
              {isOpen ? (
                <div className="flex items-center gap-2">
                  <select
                    value={dayHours.open || '09:00'}
                    onChange={(e) => handleTimeChange(key, 'open', e.target.value)}
                    className="h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    data-testid={`open-${key}`}
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  <span className="text-gray-400">to</span>
                  <select
                    value={dayHours.close || '17:00'}
                    onChange={(e) => handleTimeChange(key, 'close', e.target.value)}
                    className="h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    data-testid={`close-${key}`}
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-sm text-gray-400">Closed</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Staff schedules are automatically bounded by these business hours. 
          Staff cannot be booked outside of your business operating hours.
        </p>
      </div>
    </div>
  );
}
