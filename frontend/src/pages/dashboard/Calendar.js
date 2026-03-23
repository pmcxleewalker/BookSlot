import React, { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Clock, User, Scissors, Calendar as CalendarIcon, Phone, Mail, MapPin } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { appointmentsAPI, staffAPI } from '../../lib/api';
import NewAppointmentModal from '../../components/NewAppointmentModal';

// Status color mapping
const STATUS_COLORS = {
  confirmed: { bg: '#22c55e', label: 'Confirmed' },
  pending: { bg: '#eab308', label: 'Pending' },
  cancelled: { bg: '#ef4444', label: 'Cancelled' },
  completed: { bg: '#3b82f6', label: 'Completed' },
  no_show: { bg: '#6b7280', label: 'No Show' },
};

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = [...Array(5)].map((_, i) => addDays(weekStart, i)); // Mon-Fri (5 days like image)
  const hours = [...Array(10)].map((_, i) => i + 8); // 8 AM to 5 PM

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

  const handleAppointmentClick = (apt, e) => {
    e.stopPropagation();
    setSelectedAppointment(apt);
  };

  const getStatusColor = (status) => {
    return STATUS_COLORS[status]?.bg || '#22c55e';
  };

  const getStatusLabel = (status) => {
    return STATUS_COLORS[status]?.label || 'Confirmed';
  };

  return (
    <DashboardLayout title="Calendar">
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        {/* Calendar Header */}
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                data-testid="prev-week"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Outfit' }}>
                {format(weekStart, 'MMMM yyyy')}
              </h2>
              <button
                onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                data-testid="next-week"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Legend */}
              <div className="hidden md:flex items-center gap-4 mr-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-emerald-500"></div>
                  <span className="text-gray-600">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-amber-400"></div>
                  <span className="text-gray-600">Pending</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-blue-500"></div>
                  <span className="text-gray-600">Booked</span>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
                className="rounded-full px-4"
              >
                Today
              </Button>
              <Button
                onClick={() => setShowModal(true)}
                className="rounded-full bg-gray-900 hover:bg-gray-800 text-white px-4"
                data-testid="new-appointment-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Booking
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Day Headers */}
            <div className="grid grid-cols-6 border-b border-gray-200 bg-white">
              <div className="p-4 text-center border-r border-gray-200">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Time</span>
              </div>
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`p-4 text-center border-r border-gray-200 last:border-r-0 ${
                    isToday(day) ? 'bg-emerald-50' : ''
                  }`}
                >
                  <div className="text-sm font-semibold text-gray-900">
                    {format(day, 'EEEE')}
                  </div>
                  <div className={`text-xs mt-0.5 ${
                    isToday(day) ? 'text-emerald-600 font-medium' : 'text-gray-500'
                  }`}>
                    {format(day, 'dd.MM.yyyy')}
                  </div>
                </div>
              ))}
            </div>

            {/* Time Slots */}
            {loading ? (
              <div className="h-[500px] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
              </div>
            ) : (
              <div>
                {hours.map((hour) => (
                  <div key={hour} className="grid grid-cols-6 border-b border-gray-100 last:border-b-0">
                    {/* Time Column */}
                    <div className="p-3 text-center border-r border-gray-200 bg-gray-50/50 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {String(hour).padStart(2, '0')}:00
                      </span>
                    </div>
                    
                    {/* Day Columns */}
                    {weekDays.map((day) => {
                      const slotAppointments = getAppointmentsForSlot(day, hour);
                      const hasAppointment = slotAppointments.length > 0;
                      
                      return (
                        <div
                          key={`${day.toISOString()}-${hour}`}
                          className={`p-1.5 border-r border-gray-100 last:border-r-0 min-h-[56px] transition-colors cursor-pointer ${
                            isToday(day) ? 'bg-emerald-50/50' : 'bg-white'
                          } ${!hasAppointment ? 'hover:bg-gray-50' : ''}`}
                          onClick={() => !hasAppointment && handleSlotClick(day, hour)}
                          data-testid={`slot-${format(day, 'yyyy-MM-dd')}-${hour}`}
                        >
                          {hasAppointment ? (
                            slotAppointments.map((apt) => (
                              <div
                                key={apt.appointment_id}
                                onClick={(e) => handleAppointmentClick(apt, e)}
                                className="h-full rounded-lg px-3 py-2 cursor-pointer transition-all hover:opacity-90 hover:shadow-md"
                                style={{ 
                                  backgroundColor: getStatusColor(apt.status),
                                }}
                                data-testid={`appointment-${apt.appointment_id}`}
                              >
                                <div className="text-white text-xs font-semibold truncate">
                                  {format(parseISO(apt.start_time), 'HH:mm')}
                                </div>
                                <div className="text-white/90 text-[10px] truncate mt-0.5">
                                  {apt.client_name}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="h-full rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                              <span className="text-emerald-600 text-xs font-medium">
                                {String(hour).padStart(2, '0')}:00
                              </span>
                            </div>
                          )}
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

      {/* Appointment Details Modal */}
      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-gray-600" />
              Appointment Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedAppointment && (
            <div className="space-y-5 py-2">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <span 
                  className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: getStatusColor(selectedAppointment.status) }}
                >
                  {getStatusLabel(selectedAppointment.status)}
                </span>
                <span className="text-sm text-gray-500">
                  ID: {selectedAppointment.appointment_id?.slice(-8)}
                </span>
              </div>

              {/* Client Info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white font-semibold">
                    {selectedAppointment.client_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{selectedAppointment.client_name}</div>
                    <div className="text-sm text-gray-500">Client</div>
                  </div>
                </div>
                
                {selectedAppointment.client_email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {selectedAppointment.client_email}
                  </div>
                )}
                
                {selectedAppointment.client_phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {selectedAppointment.client_phone}
                  </div>
                )}
              </div>

              {/* Service & Staff Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Scissors className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900">{selectedAppointment.service_name}</div>
                    <div className="text-xs text-gray-500">Service</div>
                  </div>
                </div>

                {selectedAppointment.staff_name && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">{selectedAppointment.staff_name}</div>
                      <div className="text-xs text-gray-500">Staff Member</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Date & Time */}
              <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-medium text-gray-900">
                    {format(parseISO(selectedAppointment.start_time), 'EEEE, MMMM d, yyyy')}
                  </div>
                  <div className="text-sm text-gray-600">
                    {format(parseISO(selectedAppointment.start_time), 'h:mm a')}
                    {selectedAppointment.end_time && (
                      <> - {format(parseISO(selectedAppointment.end_time), 'h:mm a')}</>
                    )}
                  </div>
                </div>
              </div>

              {/* Price */}
              {selectedAppointment.price && (
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                  <span className="text-gray-600">Total Price</span>
                  <span className="text-xl font-bold text-emerald-600">
                    €{selectedAppointment.price}
                  </span>
                </div>
              )}

              {/* Notes */}
              {selectedAppointment.notes && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <div className="text-xs font-medium text-amber-700 mb-1">Notes</div>
                  <div className="text-sm text-amber-900">{selectedAppointment.notes}</div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setSelectedAppointment(null)}
                >
                  Close
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-gray-900 hover:bg-gray-800 text-white"
                  onClick={() => {
                    // TODO: Implement reschedule
                    setSelectedAppointment(null);
                  }}
                >
                  Reschedule
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
