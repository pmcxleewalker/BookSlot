import React, { useState, useEffect } from 'react';
import { CalendarOff, Plus, Trash2, Loader2, Save, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TIME_OPTIONS = [];
for (let h = 6; h <= 22; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hour = h.toString().padStart(2, '0');
    const minute = m.toString().padStart(2, '0');
    TIME_OPTIONS.push(`${hour}:${minute}`);
  }
}

// Common Irish holidays
const PRESET_HOLIDAYS = [
  { name: "New Year's Day", month: 1, day: 1 },
  { name: "St. Patrick's Day", month: 3, day: 17 },
  { name: "Good Friday", month: null, day: null }, // Variable
  { name: "Easter Monday", month: null, day: null }, // Variable
  { name: "May Bank Holiday", month: 5, day: 1 },
  { name: "June Bank Holiday", month: 6, day: 1 },
  { name: "August Bank Holiday", month: 8, day: 1 },
  { name: "October Bank Holiday", month: 10, day: 1 },
  { name: "Christmas Day", month: 12, day: 25 },
  { name: "St. Stephen's Day", month: 12, day: 26 },
];

export default function HolidaysSettings() {
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    name: '',
    is_closed: true,
    open_time: '09:00',
    close_time: '17:00'
  });

  useEffect(() => {
    loadHolidays();
  }, []);

  const loadHolidays = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const response = await fetch(`${API_URL}/api/holidays?year=${currentYear}`, {
        credentials: 'include'
      });
      const data = await response.json();
      setHolidays(data);
    } catch (error) {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (holiday = null) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setFormData({
        date: holiday.date,
        name: holiday.name,
        is_closed: holiday.is_closed,
        open_time: holiday.open_time || '09:00',
        close_time: holiday.close_time || '17:00'
      });
    } else {
      setEditingHoliday(null);
      setFormData({
        date: '',
        name: '',
        is_closed: true,
        open_time: '09:00',
        close_time: '17:00'
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.date || !formData.name) {
      toast.error('Date and name are required');
      return;
    }

    setSaving(true);
    try {
      const url = editingHoliday 
        ? `${API_URL}/api/holidays/${editingHoliday.holiday_id}`
        : `${API_URL}/api/holidays`;
      
      const response = await fetch(url, {
        method: editingHoliday ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to save');
      }

      toast.success(editingHoliday ? 'Holiday updated' : 'Holiday added');
      loadHolidays();
      setShowModal(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (holidayId) => {
    if (!window.confirm('Delete this holiday?')) return;

    try {
      const response = await fetch(`${API_URL}/api/holidays/${holidayId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to delete');

      toast.success('Holiday deleted');
      loadHolidays();
    } catch (error) {
      toast.error('Failed to delete holiday');
    }
  };

  const addPresetHoliday = (preset) => {
    const year = new Date().getFullYear();
    let date = '';
    
    if (preset.month && preset.day) {
      const month = preset.month.toString().padStart(2, '0');
      const day = preset.day.toString().padStart(2, '0');
      date = `${year}-${month}-${day}`;
    }
    
    setFormData({
      ...formData,
      name: preset.name,
      date: date
    });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IE', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
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
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
            <CalendarOff className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Holidays & Closures</h2>
            <p className="text-sm text-gray-500">Set dates when your business is closed or has special hours</p>
          </div>
        </div>
        <Button onClick={() => openModal()} className="bg-gray-900 hover:bg-gray-800">
          <Plus className="w-4 h-4 mr-2" />
          Add Holiday
        </Button>
      </div>

      {holidays.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
          <CalendarOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No holidays set</p>
          <p className="text-gray-400 text-sm mt-1">Add holidays to block bookings on specific dates</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y">
          {holidays.map((holiday) => (
            <div key={holiday.holiday_id} className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium text-gray-900">{holiday.name}</div>
                <div className="text-sm text-gray-500">{formatDate(holiday.date)}</div>
              </div>
              <div className="flex items-center gap-4">
                {holiday.is_closed ? (
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                    Closed
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                    {holiday.open_time} - {holiday.close_time}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openModal(holiday)}
                    className="h-8 w-8 p-0"
                  >
                    <span className="text-gray-400 hover:text-gray-600">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(holiday.holiday_id)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Quick presets */}
            {!editingHoliday && (
              <div>
                <Label className="text-sm text-gray-500 mb-2 block">Quick add:</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_HOLIDAYS.slice(0, 5).map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => addPresetHoliday(preset)}
                      className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Holiday Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Christmas Day"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-gray-900">Fully Closed</Label>
                <p className="text-xs text-gray-500">No bookings allowed on this day</p>
              </div>
              <Switch
                checked={formData.is_closed}
                onCheckedChange={(checked) => setFormData({ ...formData, is_closed: checked })}
              />
            </div>

            {!formData.is_closed && (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label>Open Time</Label>
                  <select
                    value={formData.open_time}
                    onChange={(e) => setFormData({ ...formData, open_time: e.target.value })}
                    className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 text-sm"
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <Label>Close Time</Label>
                  <select
                    value={formData.close_time}
                    onChange={(e) => setFormData({ ...formData, close_time: e.target.value })}
                    className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 text-sm"
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-gray-900 hover:bg-gray-800">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {editingHoliday ? 'Update' : 'Add Holiday'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
