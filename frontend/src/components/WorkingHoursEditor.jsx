import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Plus, Trash2, Clock } from 'lucide-react';

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const DEFAULT_DAY = {
  enabled: false,
  start: '09:00',
  end: '17:00',
  breaks: []
};

const WorkingHoursEditor = ({ workingHours, onChange, readOnly = false }) => {
  const [hours, setHours] = useState(() => {
    const initial = {};
    DAYS.forEach(day => {
      initial[day.key] = workingHours?.[day.key] || { ...DEFAULT_DAY };
    });
    return initial;
  });

  const handleDayChange = (day, field, value) => {
    const updated = {
      ...hours,
      [day]: {
        ...hours[day],
        [field]: value
      }
    };
    setHours(updated);
    onChange?.(updated);
  };

  const handleAddBreak = (day) => {
    const dayHours = hours[day];
    const newBreak = { start: '12:00', end: '13:00' };
    const updated = {
      ...hours,
      [day]: {
        ...dayHours,
        breaks: [...(dayHours.breaks || []), newBreak]
      }
    };
    setHours(updated);
    onChange?.(updated);
  };

  const handleRemoveBreak = (day, breakIndex) => {
    const dayHours = hours[day];
    const updated = {
      ...hours,
      [day]: {
        ...dayHours,
        breaks: dayHours.breaks.filter((_, i) => i !== breakIndex)
      }
    };
    setHours(updated);
    onChange?.(updated);
  };

  const handleBreakChange = (day, breakIndex, field, value) => {
    const dayHours = hours[day];
    const updatedBreaks = [...dayHours.breaks];
    updatedBreaks[breakIndex] = { ...updatedBreaks[breakIndex], [field]: value };
    const updated = {
      ...hours,
      [day]: {
        ...dayHours,
        breaks: updatedBreaks
      }
    };
    setHours(updated);
    onChange?.(updated);
  };

  const copyToAll = (sourceDay) => {
    const sourceHours = hours[sourceDay];
    const updated = {};
    DAYS.forEach(day => {
      updated[day.key] = { ...sourceHours };
    });
    setHours(updated);
    onChange?.(updated);
  };

  return (
    <div className="space-y-4" data-testid="working-hours-editor">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#666666]" />
          <h4 className="font-medium text-[#0A0A0A]">Working Hours</h4>
        </div>
      </div>

      <div className="space-y-3">
        {DAYS.map((day) => {
          const dayHours = hours[day.key] || DEFAULT_DAY;
          return (
            <div 
              key={day.key} 
              className={`p-4 border ${dayHours.enabled ? 'border-[#E5E5E5] bg-white' : 'border-[#E5E5E5] bg-[#FAFAFA]'}`}
              data-testid={`day-${day.key}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={dayHours.enabled}
                    onCheckedChange={(checked) => handleDayChange(day.key, 'enabled', checked)}
                    disabled={readOnly}
                    data-testid={`toggle-${day.key}`}
                  />
                  <span className={`font-medium ${dayHours.enabled ? 'text-[#0A0A0A]' : 'text-[#999999]'}`}>
                    {day.label}
                  </span>
                </div>
                {dayHours.enabled && !readOnly && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => copyToAll(day.key)}
                    className="text-xs text-[#666666]"
                  >
                    Copy to all days
                  </Button>
                )}
              </div>

              {dayHours.enabled && (
                <div className="ml-9 space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-[#666666] w-10">From</Label>
                      <Input
                        type="time"
                        value={dayHours.start}
                        onChange={(e) => handleDayChange(day.key, 'start', e.target.value)}
                        disabled={readOnly}
                        className="w-32"
                        data-testid={`start-${day.key}`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-[#666666] w-10">To</Label>
                      <Input
                        type="time"
                        value={dayHours.end}
                        onChange={(e) => handleDayChange(day.key, 'end', e.target.value)}
                        disabled={readOnly}
                        className="w-32"
                        data-testid={`end-${day.key}`}
                      />
                    </div>
                  </div>

                  {/* Breaks */}
                  {dayHours.breaks && dayHours.breaks.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-dashed border-[#E5E5E5]">
                      <Label className="text-xs text-[#666666]">Breaks</Label>
                      {dayHours.breaks.map((brk, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={brk.start}
                            onChange={(e) => handleBreakChange(day.key, idx, 'start', e.target.value)}
                            disabled={readOnly}
                            className="w-28"
                          />
                          <span className="text-[#666666]">to</span>
                          <Input
                            type="time"
                            value={brk.end}
                            onChange={(e) => handleBreakChange(day.key, idx, 'end', e.target.value)}
                            disabled={readOnly}
                            className="w-28"
                          />
                          {!readOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveBreak(day.key, idx)}
                              className="text-red-500 hover:text-red-600 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddBreak(day.key)}
                      className="text-xs text-[#666666] flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add break
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkingHoursEditor;
