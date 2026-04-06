import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, X, Clock, AlertCircle, Check, User, Phone, Mail } from 'lucide-react';
import { format, addDays, subDays, isSameDay, parseISO, addMinutes, differenceInMinutes, startOfDay, endOfDay } from 'date-fns';

const CalendarPage = () => {
  const { token } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [showPendingPanel, setShowPendingPanel] = useState(true);
  
  const [newAppt, setNewAppt] = useState({
    service_id: '',
    staff_id: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    time: '',
    notes: ''
  });
  
  const [allPendingAppts, setAllPendingAppts] = useState([]);

  useEffect(() => {
    fetchData();
    fetchAllPending();
  }, [selectedDate]);

  const fetchAllPending = async () => {
    try {
      const res = await axios.get(`${API}/appointments`, {
        params: { status: 'pending' },
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllPendingAppts(res.data.appointments || []);
    } catch (error) {
      console.error('Failed to fetch pending:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const [apptRes, staffRes, servicesRes] = await Promise.all([
        axios.get(`${API}/appointments`, {
          params: { start_date: dateStr, end_date: dateStr + 'T23:59:59' },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/staff`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const sorted = (apptRes.data.appointments || []).sort((a, b) => 
        new Date(a.start_time) - new Date(b.start_time)
      );
      setAppointments(sorted);
      setStaff(staffRes.data.staff || []);
      setServices(servicesRes.data.services || []);
    } catch (error) {
      console.error('Failed to load calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevDay = () => setSelectedDate(subDays(selectedDate, 1));
  const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const handleToday = () => setSelectedDate(new Date());

  // Today's appointments by status
  const confirmedAppointments = appointments.filter(a => a.status === 'confirmed');
  const completedAppointments = appointments.filter(a => a.status === 'completed');
  const todayPendingAppointments = appointments.filter(a => a.status === 'pending');

  const handleApprove = async (appointmentId) => {
    try {
      await axios.post(`${API}/appointments/${appointmentId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Approved!');
      fetchData();
      fetchAllPending();
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleReject = async (appointmentId) => {
    try {
      await axios.post(`${API}/appointments/${appointmentId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Rejected');
      fetchData();
      fetchAllPending();
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  const handleComplete = async (appointmentId) => {
    try {
      await axios.put(`${API}/appointments/${appointmentId}`, { status: 'completed' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Marked complete');
      fetchData();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleCreateAppointment = async () => {
    if (!newAppt.service_id || !newAppt.staff_id || !newAppt.client_name || !newAppt.time) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const service = services.find(s => s.service_id === newAppt.service_id);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const startTime = `${dateStr}T${newAppt.time}:00`;
      const endTime = format(addMinutes(parseISO(startTime), service?.duration || 30), "yyyy-MM-dd'T'HH:mm:ss");

      await axios.post(`${API}/appointments`, {
        service_id: newAppt.service_id,
        staff_id: newAppt.staff_id,
        client_name: newAppt.client_name,
        client_email: newAppt.client_email,
        client_phone: newAppt.client_phone,
        start_time: startTime,
        end_time: endTime,
        notes: newAppt.notes,
        status: 'confirmed' // Admin-created = auto-confirmed
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Appointment created!');
      setShowNewAppointment(false);
      setNewAppt({ service_id: '', staff_id: '', client_name: '', client_email: '', client_phone: '', time: '', notes: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create');
    }
  };

  const isToday = isSameDay(selectedDate, new Date());

  return (
    <TenantLayout title="Calendar">
      <div className="max-w-3xl mx-auto">
        {/* Date Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevDay} data-testid="prev-day">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant={isToday ? "default" : "outline"} 
              size="sm" 
              onClick={handleToday}
              className={isToday ? "btn-primary" : ""}
              data-testid="today-btn"
            >
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextDay} data-testid="next-day">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="text-center">
            <p className="text-2xl font-semibold text-[#0A0A0A]">
              {format(selectedDate, 'EEEE')}
            </p>
            <p className="text-sm text-[#666]">
              {format(selectedDate, 'MMMM d, yyyy')}
            </p>
          </div>
          
          <Button 
            onClick={() => setShowNewAppointment(true)} 
            className="btn-primary"
            data-testid="new-appointment-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>

        {/* Pending Approvals - All (not just today) */}
        {allPendingAppts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg mb-6 overflow-hidden">
            <button 
              onClick={() => setShowPendingPanel(!showPendingPanel)}
              className="w-full p-4 flex items-center justify-between hover:bg-amber-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-amber-800">
                  {allPendingAppts.length} pending approval{allPendingAppts.length > 1 ? 's' : ''}
                </span>
              </div>
              <ChevronRight className={`w-5 h-5 text-amber-600 transition-transform ${showPendingPanel ? 'rotate-90' : ''}`} />
            </button>
            
            {showPendingPanel && (
              <div className="border-t border-amber-200 divide-y divide-amber-100 max-h-72 overflow-y-auto">
                {allPendingAppts.map((appt) => (
                  <AppointmentRow 
                    key={appt.appointment_id}
                    appt={appt}
                    staff={staff}
                    services={services}
                    isPending
                    showDate
                    onApprove={() => handleApprove(appt.appointment_id)}
                    onReject={() => handleReject(appt.appointment_id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Confirmed Appointments */}
        {loading ? (
          <div className="text-center py-12 text-[#666]">Loading...</div>
        ) : confirmedAppointments.length === 0 && completedAppointments.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-[#FAFAFA] rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-[#999]" />
            </div>
            <p className="text-lg text-[#666] mb-2">No appointments</p>
            <p className="text-sm text-[#999]">
              {isToday ? "Your schedule is clear today" : `Nothing scheduled for ${format(selectedDate, 'MMM d')}`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {confirmedAppointments.map((appt) => (
              <AppointmentRow 
                key={appt.appointment_id}
                appt={appt}
                staff={staff}
                services={services}
                onComplete={() => handleComplete(appt.appointment_id)}
              />
            ))}
            
            {/* Completed Section */}
            {completedAppointments.length > 0 && (
              <div className="pt-4 mt-4 border-t border-[#E5E5E5]">
                <p className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-3">
                  Completed ({completedAppointments.length})
                </p>
                {completedAppointments.map((appt) => (
                  <AppointmentRow 
                    key={appt.appointment_id}
                    appt={appt}
                    staff={staff}
                    services={services}
                    isCompleted
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* New Appointment Dialog */}
        <Dialog open={showNewAppointment} onOpenChange={setShowNewAppointment}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Appointment - {format(selectedDate, 'MMM d')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-sm font-medium">Service *</Label>
                <Select value={newAppt.service_id} onValueChange={(v) => setNewAppt({ ...newAppt, service_id: v })}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.service_id} value={service.service_id}>
                        {service.name} ({service.duration} min - €{service.price})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Staff *</Label>
                <Select value={newAppt.staff_id} onValueChange={(v) => setNewAppt({ ...newAppt, staff_id: v })}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select staff" />
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

              <div>
                <Label className="text-sm font-medium">Time *</Label>
                <Input
                  type="time"
                  value={newAppt.time}
                  onChange={(e) => setNewAppt({ ...newAppt, time: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Client Name *</Label>
                <Input
                  value={newAppt.client_name}
                  onChange={(e) => setNewAppt({ ...newAppt, client_name: e.target.value })}
                  placeholder="John Doe"
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Phone</Label>
                  <Input
                    type="tel"
                    value={newAppt.client_phone}
                    onChange={(e) => setNewAppt({ ...newAppt, client_phone: e.target.value })}
                    placeholder="+353..."
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <Input
                    type="email"
                    value={newAppt.client_email}
                    onChange={(e) => setNewAppt({ ...newAppt, client_email: e.target.value })}
                    placeholder="email@..."
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowNewAppointment(false)}>
                  Cancel
                </Button>
                <Button className="flex-1 btn-primary" onClick={handleCreateAppointment}>
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TenantLayout>
  );
};

// Appointment Row Component
const AppointmentRow = ({ appt, staff, services, isPending, isCompleted, showDate, onApprove, onReject, onComplete }) => {
  const start = parseISO(appt.start_time);
  const end = parseISO(appt.end_time);
  const duration = differenceInMinutes(end, start);
  const staffMember = staff.find(s => s.staff_id === appt.staff_id);
  const service = services.find(s => s.service_id === appt.service_id);
  
  return (
    <div 
      className={`flex items-center gap-4 p-4 rounded-lg ${
        isPending ? 'bg-white' : isCompleted ? 'bg-[#FAFAFA] opacity-60' : 'bg-white border border-[#E5E5E5]'
      }`}
      data-testid={`appt-row-${appt.appointment_id}`}
    >
      {/* Time */}
      <div className="min-w-[70px] text-center">
        <p className={`text-xl font-semibold font-mono ${isCompleted ? 'text-[#999]' : 'text-[#0A0A0A]'}`}>
          {format(start, 'HH:mm')}
        </p>
        {showDate ? (
          <p className="text-xs text-[#666]">{format(start, 'MMM d')}</p>
        ) : (
          <p className="text-xs text-[#999]">{duration}m</p>
        )}
      </div>
      
      {/* Colored bar */}
      <div className={`w-1 h-12 rounded-full ${
        isPending ? 'bg-amber-400' : isCompleted ? 'bg-[#CCC]' : 'bg-emerald-500'
      }`} />
      
      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${isCompleted ? 'text-[#999]' : 'text-[#0A0A0A]'}`}>
          {appt.client_name || 'Walk-in'}
        </p>
        <p className="text-sm text-[#666] truncate">
          {service?.name || 'Service'} · {staffMember?.name || 'Staff'}
        </p>
      </div>
      
      {/* Contact Icons */}
      {!isCompleted && (
        <div className="flex items-center gap-2">
          {appt.client_phone && (
            <a href={`tel:${appt.client_phone}`} className="p-2 text-[#666] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] rounded">
              <Phone className="w-4 h-4" />
            </a>
          )}
          {appt.client_email && (
            <a href={`mailto:${appt.client_email}`} className="p-2 text-[#666] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] rounded">
              <Mail className="w-4 h-4" />
            </a>
          )}
        </div>
      )}
      
      {/* Actions */}
      {isPending && (
        <div className="flex items-center gap-2">
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onApprove}>
            <Check className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={onReject}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      
      {!isPending && !isCompleted && onComplete && (
        <Button size="sm" variant="outline" onClick={onComplete}>
          <Check className="w-4 h-4 mr-1" />
          Done
        </Button>
      )}
      
      {isCompleted && (
        <Check className="w-5 h-5 text-emerald-500" />
      )}
    </div>
  );
};

export default CalendarPage;
