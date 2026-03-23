import React, { useState, useEffect } from 'react';
import { Clock, Save, Loader2, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DAYS = [
  { key: 0, label: 'Monday' },
  { key: 1, label: 'Tuesday' },
  { key: 2, label: 'Wednesday' },
  { key: 3, label: 'Thursday' },
  { key: 4, label: 'Friday' },
  { key: 5, label: 'Saturday' },
  { key: 6, label: 'Sunday' },
];

const TIME_OPTIONS = [];
for (let h = 6; h <= 22; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hour = h.toString().padStart(2, '0');
    const minute = m.toString().padStart(2, '0');
    TIME_OPTIONS.push(`${hour}:${minute}`);
  }
}

export default function StaffScheduleModal({ staff, isOpen, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState({});
  const [businessHours, setBusinessHours] = useState({});

  useEffect(() => {
    if (isOpen && staff) {
      loadData();
    }
  }, [isOpen, staff]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load business hours for reference
      const bizResponse = await fetch(`${API_URL}/api/settings/business-hours`, {
        credentials: 'include'
      });
      const bizData = await bizResponse.json();
      setBusinessHours(bizData.business_hours || {});

      // Load staff schedule
      const staffResponse = await fetch(`${API_URL}/api/staff/${staff.staff_id}`, {
        credentials: 'include'
      });
      const staffData = await staffResponse.json();
      
      // Convert working_hours array to object keyed by day
      const scheduleObj = {};
      const workingHours = staffData.schedule?.working_hours || staffData.working_hours || [];
      
      DAYS.forEach(({ key }) => {
        const daySchedule = workingHours.find(wh => wh.day_of_week === key);
        if (daySchedule) {
          scheduleObj[key] = {
            start_time: daySchedule.start_time,
            end_time: daySchedule.end_time,
            is_working: daySchedule.is_working !== false
          };
        } else {
          // Default based on business hours
          const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          const bizDay = bizData.business_hours?.[dayNames[key]];
          scheduleObj[key] = {
            start_time: bizDay?.open || '09:00',
            end_time: bizDay?.close || '17:00',
            is_working: bizDay?.is_open !== false
          };
        }
      });
      
      setSchedule(scheduleObj);
    } catch (error) {
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (dayKey) => {
    setSchedule({
      ...schedule,
      [dayKey]: {
        ...schedule[dayKey],
        is_working: !schedule[dayKey]?.is_working
      }
    });
  };

  const handleTimeChange = (dayKey, field, value) => {
    setSchedule({
      ...schedule,
      [dayKey]: {
        ...schedule[dayKey],
        [field]: value
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert schedule object to array format
      const workingHours = DAYS.map(({ key }) => ({
        day_of_week: key,
        start_time: schedule[key]?.start_time || '09:00',
        end_time: schedule[key]?.end_time || '17:00',
        is_working: schedule[key]?.is_working !== false
      }));

      const response = await fetch(`${API_URL}/api/staff/${staff.staff_id}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ working_hours: workingHours })
      });
      
      if (!response.ok) throw new Error('Failed to save');
      toast.success('Schedule updated');
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {staff?.name}'s Schedule
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Set working hours for this staff member. Hours are bounded by business operating hours.
            </p>

            <div className="border rounded-xl divide-y">
              {DAYS.map(({ key, label }) => {
                const daySchedule = schedule[key] || {};
                const isWorking = daySchedule.is_working !== false;
                const bizDay = businessHours[dayNames[key]];
                const bizOpen = bizDay?.is_open !== false;

                return (
                  <div key={key} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3 min-w-[120px]">
                      <Switch
                        checked={isWorking && bizOpen}
                        disabled={!bizOpen}
                        onCheckedChange={() => handleDayToggle(key)}
                      />
                      <Label className={`font-medium text-sm ${isWorking && bizOpen ? 'text-gray-900' : 'text-gray-400'}`}>
                        {label}
                      </Label>
                    </div>
                    
                    {!bizOpen ? (
                      <span className="text-xs text-gray-400">Business closed</span>
                    ) : isWorking ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={daySchedule.start_time || '09:00'}
                          onChange={(e) => handleTimeChange(key, 'start_time', e.target.value)}
                          className="h-8 px-2 rounded border border-gray-200 text-sm"
                        >
                          {TIME_OPTIONS.filter(t => !bizDay?.open || t >= bizDay.open).map((time) => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                        <span className="text-gray-400 text-sm">to</span>
                        <select
                          value={daySchedule.end_time || '17:00'}
                          onChange={(e) => handleTimeChange(key, 'end_time', e.target.value)}
                          className="h-8 px-2 rounded border border-gray-200 text-sm"
                        >
                          {TIME_OPTIONS.filter(t => !bizDay?.close || t <= bizDay.close).map((time) => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Not working</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-gray-900 hover:bg-gray-800">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Schedule
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
