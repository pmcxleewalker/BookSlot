import React, { useState, useEffect, useRef } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, X, GripVertical, Clock, AlertCircle, Check, User } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, addMinutes, differenceInMinutes } from 'date-fns';

const CalendarPage = () => {
  const { token } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week');
  const [appointments, setAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [draggedAppointment, setDraggedAppointment] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  // Pending approvals panel
  const [showPendingPanel, setShowPendingPanel] = useState(true);
  
  // New appointment form
  const [newAppt, setNewAppt] = useState({
    service_id: '',
    staff_id: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    date: '',
    time: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const fetchData = async () => {
    try {
      const weekStart = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), 6), 'yyyy-MM-dd');

      const [apptRes, staffRes, servicesRes, clientsRes] = await Promise.all([
        axios.get(`${API}/appointments`, {
          params: { start_date: weekStart, end_date: weekEnd + 'T23:59:59' },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/staff`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/clients`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      setAppointments(apptRes.data.appointments || []);
      setStaff(staffRes.data.staff || []);
      setServices(servicesRes.data.services || []);
      setClients(clientsRes.data.clients || []);
    } catch (error) {
      console.error('Failed to load calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

  const getAppointmentsForSlot = (day, hour) => {
    return appointments.filter(appt => {
      const apptDate = parseISO(appt.start_time);
      const apptHour = apptDate.getHours();
      return isSameDay(apptDate, day) && apptHour === hour;
    });
  };

  const handleSlotClick = (day, hour) => {
    if (draggedAppointment) return; // Don't open dialog while dragging
    setSelectedSlot({ day, hour });
    setNewAppt({
      ...newAppt,
      date: format(day, 'yyyy-MM-dd'),
      time: `${hour.toString().padStart(2, '0')}:00`
    });
    setShowNewAppointment(true);
  };

  // Drag and drop handlers
  const handleDragStart = (e, appointment) => {
    setDraggedAppointment(appointment);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appointment.appointment_id);
    // Add visual feedback
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedAppointment(null);
    setDropTarget(null);
  };

  const handleDragOver = (e, day, hour) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const targetKey = `${format(day, 'yyyy-MM-dd')}-${hour}`;
    if (dropTarget !== targetKey) {
      setDropTarget(targetKey);
    }
  };

  const handleDragLeave = (e) => {
    // Only clear if leaving the cell entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDropTarget(null);
    }
  };

  const handleDrop = async (e, day, hour) => {
    e.preventDefault();
    setDropTarget(null);
    
    if (!draggedAppointment) return;

    const newDate = format(day, 'yyyy-MM-dd');
    const newTime = `${hour.toString().padStart(2, '0')}:00`;
    const newStartTime = `${newDate}T${newTime}:00`;
    
    // Calculate duration from original appointment
    const originalStart = parseISO(draggedAppointment.start_time);
    const originalEnd = parseISO(draggedAppointment.end_time);
    const durationMinutes = differenceInMinutes(originalEnd, originalStart);
    
    const newEndTime = format(addMinutes(parseISO(newStartTime), durationMinutes), "yyyy-MM-dd'T'HH:mm:ss");

    try {
      await axios.put(`${API}/appointments/${draggedAppointment.appointment_id}`, {
        start_time: newStartTime,
        end_time: newEndTime
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Appointment moved successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to move appointment');
    }
    
    setDraggedAppointment(null);
  };

  const handleCreateAppointment = async () => {
    if (!newAppt.service_id || !newAppt.staff_id || !newAppt.client_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const service = services.find(s => s.service_id === newAppt.service_id);
      const startTime = `${newAppt.date}T${newAppt.time}:00`;
      const endTime = format(addMinutes(parseISO(startTime), service?.duration || 30), "yyyy-MM-dd'T'HH:mm:ss");

      await axios.post(`${API}/appointments`, {
        service_id: newAppt.service_id,
        staff_id: newAppt.staff_id,
        client_name: newAppt.client_name,
        client_email: newAppt.client_email,
        client_phone: newAppt.client_phone,
        start_time: startTime,
        end_time: endTime,
        notes: newAppt.notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Appointment created!');
      setShowNewAppointment(false);
      setNewAppt({
        service_id: '',
        staff_id: '',
        client_name: '',
        client_email: '',
        client_phone: '',
        date: '',
        time: '',
        notes: ''
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create appointment');
    }
  };

  // Get pending appointments
  const pendingAppointments = appointments.filter(a => a.status === 'pending');
  const pendingCount = pendingAppointments.length;

  const handleApprove = async (appointmentId) => {
    try {
      await axios.post(`${API}/appointments/${appointmentId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Booking approved!');
      fetchData();
    } catch (error) {
      toast.error('Failed to approve booking');
    }
  };

  const handleReject = async (appointmentId) => {
    try {
      await axios.post(`${API}/appointments/${appointmentId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Booking rejected');
      fetchData();
    } catch (error) {
      toast.error('Failed to reject booking');
    }
  };

  const getStaffColor = (staffId) => {
    const member = staff.find(s => s.staff_id === staffId);
    return member?.color || '#4F46E5';
  };

  return (
    <TenantLayout title="Calendar">
      {/* Pending Approvals Panel */}
      {pendingCount > 0 && (
        <div className={`mb-6 bg-amber-50 border border-amber-200 rounded-lg overflow-hidden ${showPendingPanel ? '' : 'p-4'}`}>
          <button 
            onClick={() => setShowPendingPanel(!showPendingPanel)}
            className="w-full p-4 flex items-center justify-between hover:bg-amber-100 transition-colors"
            data-testid="toggle-pending-panel"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-amber-800">{pendingCount} booking{pendingCount > 1 ? 's' : ''} awaiting approval</p>
                <p className="text-sm text-amber-700">Click to {showPendingPanel ? 'hide' : 'view'} pending bookings</p>
              </div>
            </div>
            <ChevronRight className={`w-5 h-5 text-amber-600 transition-transform ${showPendingPanel ? 'rotate-90' : ''}`} />
          </button>
          
          {showPendingPanel && (
            <div className="border-t border-amber-200 divide-y divide-amber-100 max-h-64 overflow-y-auto">
              {pendingAppointments.map((appt) => {
                const staffMember = staff.find(s => s.staff_id === appt.staff_id);
                const service = services.find(s => s.service_id === appt.service_id);
                return (
                  <div key={appt.appointment_id} className="p-4 flex items-center justify-between gap-4 bg-white" data-testid={`pending-${appt.appointment_id}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-amber-700" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-[#0A0A0A] truncate">{appt.client_name || 'Walk-in'}</p>
                        <p className="text-sm text-[#666666]">
                          {service?.name} with {staffMember?.name || 'Staff'}
                        </p>
                        <p className="text-xs text-[#666666] flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {format(parseISO(appt.start_time), 'EEE, MMM d · h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button 
                        size="sm" 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleApprove(appt.appointment_id)}
                        data-testid={`approve-${appt.appointment_id}`}
                      >
                        <Check className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => handleReject(appt.appointment_id)}
                        data-testid={`reject-${appt.appointment_id}`}
                      >
                        <X className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevWeek} data-testid="prev-week">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday} data-testid="today-btn">
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextWeek} data-testid="next-week">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="ml-4 font-semibold text-[#0A0A0A]" data-testid="current-week">
            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
        </div>
        <Button 
          onClick={() => setShowNewAppointment(true)} 
          className="btn-primary flex items-center gap-2"
          data-testid="new-appointment-btn"
        >
          <Plus className="w-4 h-4" />
          New Appointment
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="card-flat overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b border-[#E5E5E5]">
            <div className="p-3 text-sm font-medium text-[#666666]">Time</div>
            {weekDays.map((day, idx) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div 
                  key={idx} 
                  className={`p-3 text-center ${isToday ? 'bg-[#FAFAFA]' : ''}`}
                >
                  <p className="text-xs text-[#666666] uppercase">{format(day, 'EEE')}</p>
                  <p className={`text-lg font-semibold ${isToday ? 'text-[#E34A33]' : 'text-[#0A0A0A]'}`}>
                    {format(day, 'd')}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time Slots */}
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b border-[#E5E5E5] last:border-0">
              <div className="p-2 text-xs font-mono text-[#666666] border-r border-[#E5E5E5]">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {weekDays.map((day, dayIdx) => {
                const slotAppointments = getAppointmentsForSlot(day, hour);
                const isToday = isSameDay(day, new Date());
                const targetKey = `${format(day, 'yyyy-MM-dd')}-${hour}`;
                const isDropTarget = dropTarget === targetKey;
                
                return (
                  <div
                    key={dayIdx}
                    onClick={() => handleSlotClick(day, hour)}
                    onDragOver={(e) => handleDragOver(e, day, hour)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day, hour)}
                    className={`calendar-cell min-h-[60px] cursor-pointer relative transition-colors ${
                      isToday ? 'bg-[#FAFAFA]/50' : ''
                    } ${isDropTarget ? 'bg-[#E34A33]/10 ring-2 ring-[#E34A33] ring-inset' : ''}`}
                    data-testid={`slot-${format(day, 'yyyy-MM-dd')}-${hour}`}
                  >
                    {slotAppointments.map((appt) => (
                      <div
                        key={appt.appointment_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, appt)}
                        onDragEnd={handleDragEnd}
                        className="absolute inset-x-1 top-1 p-1.5 text-xs text-white rounded-sm truncate cursor-grab active:cursor-grabbing group"
                        style={{ backgroundColor: getStaffColor(appt.staff_id) }}
                        data-testid={`appt-${appt.appointment_id}`}
                      >
                        <div className="flex items-start gap-1">
                          <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-70 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{appt.client_name || 'Walk-in'}</p>
                            <p className="text-white/80 truncate flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(parseISO(appt.start_time), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* New Appointment Dialog */}
      <Dialog open={showNewAppointment} onOpenChange={setShowNewAppointment}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Appointment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-sm font-medium">Service *</Label>
              <Select value={newAppt.service_id} onValueChange={(v) => setNewAppt({ ...newAppt, service_id: v })}>
                <SelectTrigger className="mt-1.5" data-testid="select-service">
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.service_id} value={service.service_id}>
                      {service.name} ({service.duration} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Staff *</Label>
              <Select value={newAppt.staff_id} onValueChange={(v) => setNewAppt({ ...newAppt, staff_id: v })}>
                <SelectTrigger className="mt-1.5" data-testid="select-staff">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((member) => (
                    <SelectItem key={member.staff_id} value={member.staff_id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Date *</Label>
                <Input
                  type="date"
                  value={newAppt.date}
                  onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value })}
                  className="mt-1.5"
                  data-testid="appt-date"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Time *</Label>
                <Input
                  type="time"
                  value={newAppt.time}
                  onChange={(e) => setNewAppt({ ...newAppt, time: e.target.value })}
                  className="mt-1.5"
                  data-testid="appt-time"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Client name *</Label>
              <Input
                value={newAppt.client_name}
                onChange={(e) => setNewAppt({ ...newAppt, client_name: e.target.value })}
                placeholder="Enter client name"
                className="mt-1.5"
                data-testid="client-name-input"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Client email</Label>
              <Input
                type="email"
                value={newAppt.client_email}
                onChange={(e) => setNewAppt({ ...newAppt, client_email: e.target.value })}
                placeholder="client@email.com"
                className="mt-1.5"
                data-testid="client-email-input"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Notes</Label>
              <textarea
                value={newAppt.notes}
                onChange={(e) => setNewAppt({ ...newAppt, notes: e.target.value })}
                placeholder="Any notes..."
                rows={2}
                className="mt-1.5 input-swiss resize-none"
                data-testid="appt-notes"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowNewAppointment(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 btn-primary"
                onClick={handleCreateAppointment}
                data-testid="create-appointment-btn"
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
};

export default CalendarPage;
