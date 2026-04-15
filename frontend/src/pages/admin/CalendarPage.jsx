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
import { ChevronLeft, ChevronRight, Plus, X, Check, Phone } from 'lucide-react';
import { 
  format, addDays, subDays, addWeeks, subWeeks, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, parseISO, addMinutes, differenceInMinutes, isToday
} from 'date-fns';

const CalendarPage = () => {
  const { token } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('day');
  const [appointments, setAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [allPendingAppts, setAllPendingAppts] = useState([]);
  
  const [newAppt, setNewAppt] = useState({
    service_id: '',
    staff_id: '',
    client_name: '',
    client_phone: '',
    time: ''
  });

  useEffect(() => {
    fetchData();
  }, [selectedDate, viewMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let startDate, endDate;
      
      if (viewMode === 'day') {
        startDate = format(selectedDate, 'yyyy-MM-dd');
        endDate = startDate + 'T23:59:59';
      } else {
        const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
        startDate = format(weekStart, 'yyyy-MM-dd');
        endDate = format(weekEnd, 'yyyy-MM-dd') + 'T23:59:59';
      }

      const [apptRes, staffRes, servicesRes, pendingRes] = await Promise.all([
        axios.get(`${API}/appointments`, {
          params: { start_date: startDate, end_date: endDate },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/staff`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/appointments`, {
          params: { status: 'pending' },
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setAppointments((apptRes.data.appointments || []).sort((a, b) => 
        new Date(a.start_time) - new Date(b.start_time)
      ));
      setStaff(staffRes.data.staff || []);
      setServices(servicesRes.data.services || []);
      setAllPendingAppts(pendingRes.data.appointments || []);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    if (viewMode === 'day') setSelectedDate(subDays(selectedDate, 1));
    else setSelectedDate(subWeeks(selectedDate, 1));
  };
  
  const handleNext = () => {
    if (viewMode === 'day') setSelectedDate(addDays(selectedDate, 1));
    else setSelectedDate(addWeeks(selectedDate, 1));
  };

  const handleApprove = async (id) => {
    try {
      await axios.post(`${API}/appointments/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Approved');
      fetchData();
    } catch (error) {
      toast.error('Failed');
    }
  };

  const handleReject = async (id) => {
    try {
      await axios.post(`${API}/appointments/${id}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Rejected');
      fetchData();
    } catch (error) {
      toast.error('Failed');
    }
  };

  const handleComplete = async (id) => {
    try {
      await axios.put(`${API}/appointments/${id}`, { status: 'completed' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Done');
      fetchData();
    } catch (error) {
      toast.error('Failed');
    }
  };

  const handleCreateAppointment = async () => {
    if (!newAppt.service_id || !newAppt.staff_id || !newAppt.client_name || !newAppt.time) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const service = services.find(s => s.service_id === newAppt.service_id);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const startTime = `${dateStr}T${newAppt.time}:00`;
      const endTime = format(addMinutes(parseISO(startTime), service?.duration || 30), "yyyy-MM-dd'T'HH:mm:ss");

      await axios.post(`${API}/appointments`, {
        ...newAppt,
        start_time: startTime,
        end_time: endTime,
        status: 'confirmed'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Created');
      setShowNewAppointment(false);
      setNewAppt({ service_id: '', staff_id: '', client_name: '', client_phone: '', time: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    }
  };

  const getHeaderText = () => {
    if (viewMode === 'day') return format(selectedDate, 'EEE, MMM d');
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'd')}`;
  };

  const confirmed = appointments.filter(a => a.status === 'confirmed');
  const completed = appointments.filter(a => a.status === 'completed');

  return (
    <TenantLayout title="Calendar">
      <div className="max-w-2xl mx-auto">
        {/* Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handlePrev} className="h-8 w-8 p-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant={isToday(selectedDate) ? "default" : "ghost"} 
              size="sm" 
              onClick={() => setSelectedDate(new Date())}
              className={`h-8 px-3 ${isToday(selectedDate) ? 'bg-[#0A0A0A] text-white' : ''}`}
            >
              Today
            </Button>
            <Button variant="ghost" size="sm" onClick={handleNext} className="h-8 w-8 p-0">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="ml-3 font-medium text-[#0A0A0A]">{getHeaderText()}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-[#F5F5F5] rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  viewMode === 'day' ? 'bg-white shadow-sm text-[#0A0A0A]' : 'text-[#666]'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  viewMode === 'week' ? 'bg-white shadow-sm text-[#0A0A0A]' : 'text-[#666]'
                }`}
              >
                Week
              </button>
            </div>
            
            <Button 
              size="sm"
              onClick={() => setShowNewAppointment(true)} 
              className="h-8 bg-[#0A0A0A] hover:bg-[#1a1a1a] text-white"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Pending Approvals */}
        {allPendingAppts.length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-amber-200 bg-amber-100/50">
              <p className="text-sm font-medium text-amber-800">
                {allPendingAppts.length} awaiting approval
              </p>
            </div>
            <div className="divide-y divide-amber-100 max-h-48 overflow-y-auto">
              {allPendingAppts.map((appt) => (
                <div key={appt.appointment_id} className="p-3 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-center min-w-[45px]">
                      <p className="text-sm font-semibold font-mono">{format(parseISO(appt.start_time), 'HH:mm')}</p>
                      <p className="text-[10px] text-[#666]">{format(parseISO(appt.start_time), 'MMM d')}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[#0A0A0A] truncate">{appt.client_name}</p>
                      <p className="text-xs text-[#666] truncate">{appt.service_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" className="h-7 w-7 p-0 bg-emerald-500 hover:bg-emerald-600" onClick={() => handleApprove(appt.appointment_id)}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-red-200 text-red-500 hover:bg-red-50" onClick={() => handleReject(appt.appointment_id)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calendar Content */}
        {loading ? (
          <div className="text-center py-12 text-[#999]">Loading...</div>
        ) : viewMode === 'day' ? (
          /* Day View */
          <div className="space-y-2">
            {confirmed.length === 0 && completed.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[#999]">No appointments</p>
              </div>
            ) : (
              <>
                {confirmed.map((appt) => (
                  <div key={appt.appointment_id} className="bg-white rounded-xl p-4 border border-[#EAEAEA]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[50px]">
                          <p className="text-lg font-semibold font-mono">{format(parseISO(appt.start_time), 'HH:mm')}</p>
                          <p className="text-[10px] text-[#999]">
                            {differenceInMinutes(parseISO(appt.end_time), parseISO(appt.start_time))}m
                          </p>
                        </div>
                        <div className="w-px h-10 bg-[#EAEAEA]" />
                        <div>
                          <p className="font-medium">{appt.client_name || 'Walk-in'}</p>
                          <p className="text-sm text-[#666]">{appt.service_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {appt.client_phone && (
                          <a href={`tel:${appt.client_phone}`} className="p-2 text-[#999] hover:text-[#0A0A0A] rounded-lg hover:bg-[#F5F5F5]">
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        <Button size="sm" variant="outline" className="h-8" onClick={() => handleComplete(appt.appointment_id)}>
                          <Check className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {completed.length > 0 && (
                  <div className="pt-4">
                    <p className="text-xs text-[#999] uppercase tracking-wider mb-2">Completed</p>
                    {completed.map((appt) => (
                      <div key={appt.appointment_id} className="flex items-center gap-3 py-2 opacity-50">
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm">{appt.client_name}</span>
                        <span className="text-xs text-[#999] ml-auto font-mono">{format(parseISO(appt.start_time), 'HH:mm')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Week View */
          <WeekView 
            selectedDate={selectedDate}
            appointments={appointments}
            onDayClick={(date) => { setSelectedDate(date); setViewMode('day'); }}
          />
        )}

        {/* New Appointment Dialog */}
        <Dialog open={showNewAppointment} onOpenChange={setShowNewAppointment}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">New Appointment</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-xs text-[#666]">Service</Label>
                <Select value={newAppt.service_id} onValueChange={(v) => setNewAppt({ ...newAppt, service_id: v })}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.service_id} value={s.service_id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-[#666]">Staff</Label>
                <Select value={newAppt.staff_id} onValueChange={(v) => setNewAppt({ ...newAppt, staff_id: v })}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.staff_id} value={s.staff_id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-[#666]">Time</Label>
                <Input type="time" value={newAppt.time} onChange={(e) => setNewAppt({ ...newAppt, time: e.target.value })} className="mt-1 h-10" />
              </div>

              <div>
                <Label className="text-xs text-[#666]">Client Name</Label>
                <Input value={newAppt.client_name} onChange={(e) => setNewAppt({ ...newAppt, client_name: e.target.value })} className="mt-1 h-10" placeholder="John Doe" />
              </div>

              <div>
                <Label className="text-xs text-[#666]">Phone (optional)</Label>
                <Input type="tel" value={newAppt.client_phone} onChange={(e) => setNewAppt({ ...newAppt, client_phone: e.target.value })} className="mt-1 h-10" placeholder="+353..." />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 h-10" onClick={() => setShowNewAppointment(false)}>Cancel</Button>
                <Button className="flex-1 h-10 bg-[#0A0A0A] hover:bg-[#1a1a1a]" onClick={handleCreateAppointment}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TenantLayout>
  );
};

// Simple Week View
const WeekView = ({ selectedDate, appointments, onDayClick }) => {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(selectedDate, { weekStartsOn: 1 })
  });

  const getAppointmentsForDay = (date) => {
    return appointments.filter(a => isSameDay(parseISO(a.start_time), date) && a.status !== 'cancelled');
  };

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const dayAppts = getAppointmentsForDay(day);
        const today = isToday(day);
        
        return (
          <button
            key={day.toISOString()}
            onClick={() => onDayClick(day)}
            className={`p-2 rounded-lg text-center hover:bg-[#F5F5F5] transition-colors ${
              today ? 'bg-[#0A0A0A] text-white hover:bg-[#1a1a1a]' : 'bg-white border border-[#EAEAEA]'
            }`}
          >
            <p className={`text-[10px] uppercase ${today ? 'text-white/70' : 'text-[#999]'}`}>
              {format(day, 'EEE')}
            </p>
            <p className={`text-lg font-semibold ${today ? '' : 'text-[#0A0A0A]'}`}>
              {format(day, 'd')}
            </p>
            {dayAppts.length > 0 && (
              <div className={`mt-1 text-[10px] font-medium ${today ? 'text-white/80' : 'text-[#666]'}`}>
                {dayAppts.length} apt{dayAppts.length > 1 ? 's' : ''}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default CalendarPage;
