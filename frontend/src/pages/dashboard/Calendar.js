import React, { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../../components/ui/button';
import { appointmentsAPI, staffAPI } from '../../lib/api';
import NewAppointmentModal from '../../components/NewAppointmentModal';

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));
  const hours = [...Array(12)].map((_, i) => i + 8); // 8 AM to 7 PM

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(weekStart, 7), 'yyyy-MM-dd');
      
      const [aptsData, staffData] = await Promise.all([
        appointmentsAPI.list({ start_date: startDate, end_date: endDate }),
        staffAPI.list()
      ]);
      
      setAppointments(aptsData);
      setStaff(staffData);
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAppointmentsForSlot = (date, hour) => {
    return appointments.filter(apt => {
      const aptDate = parseISO(apt.start_time);
      return isSameDay(aptDate, date) && aptDate.getHours() === hour;
    });
  };

  const handleSlotClick = (date, hour) => {
    const startTime = new Date(date);
    startTime.setHours(hour, 0, 0, 0);
    setSelectedSlot({ date: startTime });
    setShowModal(true);
  };

  return (
    <DashboardLayout title="Calendar">
      <div className="bg-white rounded-2xl border border-[#E5E5E0] overflow-hidden">
        {/* Calendar Header */}
        <div className="p-4 border-b border-[#E5E5E0] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
              className="rounded-xl"
              data-testid="prev-week"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
              {format(weekStart, 'MMMM d')} - {format(addDays(weekStart, 6), 'MMMM d, yyyy')}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
              className="rounded-xl"
              data-testid="next-week"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
              className="rounded-xl"
            >
              Today
            </Button>
            <Button
              onClick={() => setShowModal(true)}
              className="rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
              data-testid="new-appointment-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Booking
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="overflow-auto">
          <div className="min-w-[800px]">
            {/* Day Headers */}
            <div className="grid grid-cols-8 border-b border-[#E5E5E0]">
              <div className="p-3 text-xs font-medium text-[#6B6B6B] text-center border-r border-[#E5E5E0]">
                Time
              </div>
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`p-3 text-center border-r border-[#E5E5E0] last:border-r-0 ${
                    isSameDay(day, new Date()) ? 'bg-[#2E473B]/5' : ''
                  }`}
                >
                  <div className="text-xs text-[#6B6B6B]">{format(day, 'EEE')}</div>
                  <div className={`text-lg font-semibold ${
                    isSameDay(day, new Date()) ? 'text-[#2E473B]' : 'text-[#1C1C1C]'
                  }`}>
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
            </div>

            {/* Time Slots */}
            {loading ? (
              <div className="h-96 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-[#2E473B]/20 border-t-[#2E473B] rounded-full animate-spin" />
              </div>
            ) : (
              <div className="divide-y divide-[#E5E5E0]">
                {hours.map((hour) => (
                  <div key={hour} className="grid grid-cols-8 min-h-[80px]">
                    <div className="p-2 text-xs text-[#6B6B6B] text-right border-r border-[#E5E5E0] pr-3">
                      {format(new Date().setHours(hour, 0), 'h a')}
                    </div>
                    {weekDays.map((day) => {
                      const slotAppointments = getAppointmentsForSlot(day, hour);
                      return (
                        <div
                          key={`${day.toISOString()}-${hour}`}
                          className={`p-1 border-r border-[#E5E5E0] last:border-r-0 relative cursor-pointer hover:bg-[#FAF9F6] ${
                            isSameDay(day, new Date()) ? 'bg-[#2E473B]/5' : ''
                          }`}
                          onClick={() => handleSlotClick(day, hour)}
                          data-testid={`slot-${format(day, 'yyyy-MM-dd')}-${hour}`}
                        >
                          {slotAppointments.map((apt) => (
                            <div
                              key={apt.appointment_id}
                              className="calendar-appointment text-white mb-1"
                              style={{ backgroundColor: apt.staff_color || '#2E473B' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Open appointment details
                              }}
                            >
                              <div className="font-medium truncate">{apt.client_name}</div>
                              <div className="opacity-80 text-[10px]">{apt.service_name}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Appointment Modal */}
      <NewAppointmentModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedSlot(null);
        }}
        onSuccess={() => {
          loadData();
          setShowModal(false);
          setSelectedSlot(null);
        }}
        initialDate={selectedSlot?.date}
      />
    </DashboardLayout>
  );
}
