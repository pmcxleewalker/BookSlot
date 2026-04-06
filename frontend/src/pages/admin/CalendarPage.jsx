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
import { 
  ChevronLeft, ChevronRight, Plus, X, Clock, AlertCircle, Check, 
  Phone, Mail, Calendar as CalendarIcon, Users, List
} from 'lucide-react';
import { 
  format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, parseISO, addMinutes, differenceInMinutes, isToday
} from 'date-fns';

const CalendarPage = () => {
  const { token } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('day'); // day, week, month
  const [selectedStaff, setSelectedStaff] = useState('all');
  const [appointments, setAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [showPendingPanel, setShowPendingPanel] = useState(true);
  const [newApptDate, setNewApptDate] = useState(null);
  
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
  }, [selectedDate, viewMode]);

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
      let startDate, endDate;
      
      if (viewMode === 'day') {
        startDate = format(selectedDate, 'yyyy-MM-dd');
        endDate = startDate + 'T23:59:59';
      } else if (viewMode === 'week') {
        const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
        startDate = format(weekStart, 'yyyy-MM-dd');
        endDate = format(weekEnd, 'yyyy-MM-dd') + 'T23:59:59';
      } else {
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        startDate = format(monthStart, 'yyyy-MM-dd');
        endDate = format(monthEnd, 'yyyy-MM-dd') + 'T23:59:59';
      }

      const [apptRes, staffRes, servicesRes] = await Promise.all([
        axios.get(`${API}/appointments`, {
          params: { start_date: startDate, end_date: endDate },
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

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'day') setSelectedDate(subDays(selectedDate, 1));
    else if (viewMode === 'week') setSelectedDate(subWeeks(selectedDate, 1));
    else setSelectedDate(subMonths(selectedDate, 1));
  };
  
  const handleNext = () => {
    if (viewMode === 'day') setSelectedDate(addDays(selectedDate, 1));
    else if (viewMode === 'week') setSelectedDate(addWeeks(selectedDate, 1));
    else setSelectedDate(addMonths(selectedDate, 1));
  };
  
  const handleToday = () => setSelectedDate(new Date());

  // Filter appointments by staff
  const filteredAppointments = selectedStaff === 'all' 
    ? appointments 
    : appointments.filter(a => a.staff_id === selectedStaff);

  // Get appointments for a specific day
  const getAppointmentsForDay = (date) => {
    return filteredAppointments.filter(a => 
      isSameDay(parseISO(a.start_time), date)
    );
  };

  // Categorize today's appointments
  const confirmedAppointments = filteredAppointments.filter(a => a.status === 'confirmed');
  const completedAppointments = filteredAppointments.filter(a => a.status === 'completed');

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

  const openNewAppointment = (date = selectedDate) => {
    setNewApptDate(date);
    setShowNewAppointment(true);
  };

  const handleCreateAppointment = async () => {
    if (!newAppt.service_id || !newAppt.staff_id || !newAppt.client_name || !newAppt.time) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const service = services.find(s => s.service_id === newAppt.service_id);
      const dateStr = format(newApptDate || selectedDate, 'yyyy-MM-dd');
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
        status: 'confirmed'
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

  // Get header text based on view mode
  const getHeaderText = () => {
    if (viewMode === 'day') return format(selectedDate, 'EEEE, MMMM d, yyyy');
    if (viewMode === 'week') {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    return format(selectedDate, 'MMMM yyyy');
  };

  return (
    <TenantLayout title="Calendar">
      <div className="max-w-6xl mx-auto">
        {/* Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrev} data-testid="prev-btn">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant={isToday(selectedDate) ? "default" : "outline"} 
              size="sm" 
              onClick={handleToday}
              className={isToday(selectedDate) ? "btn-primary" : ""}
              data-testid="today-btn"
            >
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={handleNext} data-testid="next-btn">
              <ChevronRight className="w-4 h-4" />
            </Button>
            
            <span className="ml-4 text-lg font-semibold text-[#0A0A0A]">
              {getHeaderText()}
            </span>
          </div>
          
          {/* View Toggle & Staff Filter */}
          <div className="flex items-center gap-3">
            {/* Staff Filter */}
            <Select value={selectedStaff} onValueChange={setSelectedStaff}>
              <SelectTrigger className="w-[160px]" data-testid="staff-filter">
                <Users className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {staff.map((member) => (
                  <SelectItem key={member.staff_id} value={member.staff_id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* View Toggle */}
            <div className="flex bg-[#F5F5F5] rounded-lg p-1">
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'day' ? 'bg-white shadow text-[#0A0A0A]' : 'text-[#666]'
                }`}
                data-testid="view-day"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'week' ? 'bg-white shadow text-[#0A0A0A]' : 'text-[#666]'
                }`}
                data-testid="view-week"
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'month' ? 'bg-white shadow text-[#0A0A0A]' : 'text-[#666]'
                }`}
                data-testid="view-month"
              >
                Month
              </button>
            </div>
            
            {/* Add Button */}
            <Button 
              onClick={() => openNewAppointment()} 
              className="btn-primary"
              data-testid="new-appointment-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </div>

        {/* Pending Approvals - All */}
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
              <div className="border-t border-amber-200 divide-y divide-amber-100 max-h-48 overflow-y-auto">
                {allPendingAppts.map((appt) => (
                  <PendingRow 
                    key={appt.appointment_id}
                    appt={appt}
                    staff={staff}
                    services={services}
                    onApprove={() => handleApprove(appt.appointment_id)}
                    onReject={() => handleReject(appt.appointment_id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Calendar Views */}
        {loading ? (
          <div className="text-center py-12 text-[#666]">Loading...</div>
        ) : viewMode === 'day' ? (
          <DayView 
            appointments={filteredAppointments}
            staff={staff}
            services={services}
            selectedDate={selectedDate}
            onComplete={handleComplete}
          />
        ) : viewMode === 'week' ? (
          <WeekView 
            appointments={filteredAppointments}
            staff={staff}
            services={services}
            selectedDate={selectedDate}
            onDayClick={(date) => { setSelectedDate(date); setViewMode('day'); }}
            onAddClick={(date) => openNewAppointment(date)}
          />
        ) : (
          <MonthView 
            appointments={filteredAppointments}
            selectedDate={selectedDate}
            onDayClick={(date) => { setSelectedDate(date); setViewMode('day'); }}
          />
        )}

        {/* New Appointment Dialog */}
        <Dialog open={showNewAppointment} onOpenChange={setShowNewAppointment}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Appointment - {format(newApptDate || selectedDate, 'MMM d, yyyy')}</DialogTitle>
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

// Pending Row Component
const PendingRow = ({ appt, staff, services, onApprove, onReject }) => {
  const start = parseISO(appt.start_time);
  const staffMember = staff.find(s => s.staff_id === appt.staff_id);
  const service = services.find(s => s.service_id === appt.service_id);
  
  return (
    <div className="flex items-center gap-4 p-3 bg-white">
      <div className="min-w-[65px] text-center">
        <p className="text-base font-semibold font-mono text-[#0A0A0A]">{format(start, 'HH:mm')}</p>
        <p className="text-xs text-[#666]">{format(start, 'MMM d')}</p>
      </div>
      <div className="w-1 h-10 rounded-full bg-amber-400" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[#0A0A0A] truncate">{appt.client_name || 'Walk-in'}</p>
        <p className="text-sm text-[#666] truncate">{service?.name} · {staffMember?.name}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 w-8 p-0" onClick={onApprove}>
          <Check className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 h-8 w-8 p-0" onClick={onReject}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

// Day View Component
const DayView = ({ appointments, staff, services, selectedDate, onComplete }) => {
  const confirmed = appointments.filter(a => a.status === 'confirmed');
  const completed = appointments.filter(a => a.status === 'completed');
  
  if (confirmed.length === 0 && completed.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-[#FAFAFA] rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-[#999]" />
        </div>
        <p className="text-lg text-[#666] mb-2">No appointments</p>
        <p className="text-sm text-[#999]">
          {isToday(selectedDate) ? "Your schedule is clear today" : `Nothing scheduled for ${format(selectedDate, 'MMM d')}`}
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {confirmed.map((appt) => (
        <AppointmentRow 
          key={appt.appointment_id}
          appt={appt}
          staff={staff}
          services={services}
          onComplete={() => onComplete(appt.appointment_id)}
        />
      ))}
      
      {completed.length > 0 && (
        <div className="pt-4 mt-4 border-t border-[#E5E5E5]">
          <p className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-3">
            Completed ({completed.length})
          </p>
          {completed.map((appt) => (
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
  );
};

// Week View Component
const WeekView = ({ appointments, staff, services, selectedDate, onDayClick, onAddClick }) => {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(selectedDate, { weekStartsOn: 1 })
  });
  
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM
  
  const getAppointmentsForDayAndHour = (date, hour) => {
    return appointments.filter(a => {
      const start = parseISO(a.start_time);
      return isSameDay(start, date) && start.getHours() === hour;
    });
  };
  
  return (
    <div className="border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="grid grid-cols-8 border-b border-[#E5E5E5]">
        <div className="p-2 text-center text-xs font-medium text-[#666] bg-[#FAFAFA]"></div>
        {days.map((day) => (
          <div 
            key={day.toISOString()}
            className={`p-2 text-center border-l border-[#E5E5E5] cursor-pointer hover:bg-[#FAFAFA] ${
              isToday(day) ? 'bg-orange-50' : ''
            }`}
            onClick={() => onDayClick(day)}
          >
            <p className="text-xs text-[#666]">{format(day, 'EEE')}</p>
            <p className={`text-lg font-semibold ${isToday(day) ? 'text-orange-600' : 'text-[#0A0A0A]'}`}>
              {format(day, 'd')}
            </p>
          </div>
        ))}
      </div>
      
      {/* Time Grid */}
      <div className="max-h-[500px] overflow-y-auto">
        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-8 border-b border-[#E5E5E5] min-h-[60px]">
            <div className="p-2 text-xs text-[#666] bg-[#FAFAFA] text-right pr-3">
              {hour}:00
            </div>
            {days.map((day) => {
              const dayAppts = getAppointmentsForDayAndHour(day, hour);
              return (
                <div 
                  key={`${day.toISOString()}-${hour}`}
                  className="border-l border-[#E5E5E5] p-1 relative group cursor-pointer hover:bg-[#FAFAFA]"
                  onClick={() => onAddClick(day)}
                >
                  {dayAppts.map((appt) => {
                    const staffMember = staff.find(s => s.staff_id === appt.staff_id);
                    const duration = differenceInMinutes(parseISO(appt.end_time), parseISO(appt.start_time));
                    const height = Math.max(duration / 60 * 60, 24);
                    return (
                      <div 
                        key={appt.appointment_id}
                        className={`text-xs p-1 rounded mb-1 truncate ${
                          appt.status === 'confirmed' 
                            ? 'bg-emerald-100 text-emerald-800 border-l-2 border-emerald-500' 
                            : 'bg-gray-100 text-gray-600'
                        }`}
                        style={{ minHeight: height }}
                        onClick={(e) => { e.stopPropagation(); onDayClick(day); }}
                      >
                        <p className="font-medium truncate">{appt.client_name}</p>
                        <p className="text-[10px] opacity-75 truncate">{staffMember?.name}</p>
                      </div>
                    );
                  })}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-4 h-4 text-[#999]" />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// Month View Component
const MonthView = ({ appointments, selectedDate, onDayClick }) => {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  
  const getAppointmentsForDay = (date) => {
    return appointments.filter(a => isSameDay(parseISO(a.start_time), date));
  };
  
  return (
    <div className="border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-[#E5E5E5] bg-[#FAFAFA]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="p-2 text-center text-xs font-medium text-[#666]">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} className="grid grid-cols-7 border-b border-[#E5E5E5] last:border-b-0">
          {week.map((day) => {
            const dayAppts = getAppointmentsForDay(day);
            const isCurrentMonth = isSameMonth(day, selectedDate);
            const confirmed = dayAppts.filter(a => a.status === 'confirmed').length;
            const pending = dayAppts.filter(a => a.status === 'pending').length;
            
            return (
              <div 
                key={day.toISOString()}
                className={`min-h-[80px] p-2 border-l border-[#E5E5E5] first:border-l-0 cursor-pointer hover:bg-[#FAFAFA] transition-colors ${
                  !isCurrentMonth ? 'bg-[#FAFAFA] opacity-50' : ''
                } ${isToday(day) ? 'bg-orange-50' : ''}`}
                onClick={() => onDayClick(day)}
              >
                <p className={`text-sm font-medium mb-1 ${
                  isToday(day) ? 'text-orange-600' : isCurrentMonth ? 'text-[#0A0A0A]' : 'text-[#999]'
                }`}>
                  {format(day, 'd')}
                </p>
                
                {dayAppts.length > 0 && (
                  <div className="space-y-1">
                    {confirmed > 0 && (
                      <div className="text-[10px] bg-emerald-100 text-emerald-700 rounded px-1 py-0.5">
                        {confirmed} confirmed
                      </div>
                    )}
                    {pending > 0 && (
                      <div className="text-[10px] bg-amber-100 text-amber-700 rounded px-1 py-0.5">
                        {pending} pending
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Appointment Row Component (for Day view)
const AppointmentRow = ({ appt, staff, services, isCompleted, onComplete }) => {
  const start = parseISO(appt.start_time);
  const end = parseISO(appt.end_time);
  const duration = differenceInMinutes(end, start);
  const staffMember = staff.find(s => s.staff_id === appt.staff_id);
  const service = services.find(s => s.service_id === appt.service_id);
  
  return (
    <div 
      className={`flex items-center gap-4 p-4 rounded-lg ${
        isCompleted ? 'bg-[#FAFAFA] opacity-60' : 'bg-white border border-[#E5E5E5]'
      }`}
      data-testid={`appt-row-${appt.appointment_id}`}
    >
      <div className="min-w-[70px] text-center">
        <p className={`text-xl font-semibold font-mono ${isCompleted ? 'text-[#999]' : 'text-[#0A0A0A]'}`}>
          {format(start, 'HH:mm')}
        </p>
        <p className="text-xs text-[#999]">{duration}m</p>
      </div>
      
      <div className={`w-1 h-12 rounded-full ${isCompleted ? 'bg-[#CCC]' : 'bg-emerald-500'}`} />
      
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${isCompleted ? 'text-[#999]' : 'text-[#0A0A0A]'}`}>
          {appt.client_name || 'Walk-in'}
        </p>
        <p className="text-sm text-[#666] truncate">
          {service?.name || 'Service'} · {staffMember?.name || 'Staff'}
        </p>
      </div>
      
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
      
      {!isCompleted && onComplete && (
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
