import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import { getTheme } from '../../config/industryThemes';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, X, Check, Phone, Clock, CalendarDays, Zap } from 'lucide-react';
import {
  format, addDays, subDays, addWeeks, subWeeks, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, parseISO, addMinutes, differenceInMinutes, isToday
} from 'date-fns';

const CalendarPage = () => {
  const { token, tenant } = useAuth();
  const theme = getTheme(tenant?.industry);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('day');
  const [appointments, setAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [allPendingAppts, setAllPendingAppts] = useState([]);

  const [newAppt, setNewAppt] = useState({
    service_id: '', staff_id: '', client_name: '', client_phone: '', time: ''
  });

  useEffect(() => { fetchData(); }, [selectedDate, viewMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let startDate, endDate;
      if (viewMode === 'day') {
        startDate = format(selectedDate, 'yyyy-MM-dd');
        endDate = startDate + 'T23:59:59';
      } else {
        const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const we = endOfWeek(selectedDate, { weekStartsOn: 1 });
        startDate = format(ws, 'yyyy-MM-dd');
        endDate = format(we, 'yyyy-MM-dd') + 'T23:59:59';
      }
      const [apptRes, staffRes, servicesRes, pendingRes] = await Promise.all([
        axios.get(`${API}/appointments`, { params: { start_date: startDate, end_date: endDate }, headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/staff`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/appointments`, { params: { status: 'pending' }, headers: { Authorization: `Bearer ${token}` } })
      ]);
      setAppointments((apptRes.data.appointments || []).sort((a, b) => new Date(a.start_time) - new Date(b.start_time)));
      setStaff(staffRes.data.staff || []);
      setServices(servicesRes.data.services || []);
      setAllPendingAppts(pendingRes.data.appointments || []);
    } catch (error) { console.error('Failed:', error); }
    finally { setLoading(false); }
  };

  const handlePrev = () => { viewMode === 'day' ? setSelectedDate(subDays(selectedDate, 1)) : setSelectedDate(subWeeks(selectedDate, 1)); };
  const handleNext = () => { viewMode === 'day' ? setSelectedDate(addDays(selectedDate, 1)) : setSelectedDate(addWeeks(selectedDate, 1)); };

  const handleApprove = async (id) => { try { await axios.post(`${API}/appointments/${id}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Approved'); fetchData(); } catch { toast.error('Failed'); } };
  const handleReject = async (id) => { try { await axios.post(`${API}/appointments/${id}/reject`, {}, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Rejected'); fetchData(); } catch { toast.error('Failed'); } };
  const handleComplete = async (id) => { try { await axios.put(`${API}/appointments/${id}`, { status: 'completed' }, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Done'); fetchData(); } catch { toast.error('Failed'); } };

  const handleCreateAppointment = async () => {
    if (!newAppt.service_id || !newAppt.staff_id || !newAppt.client_name || !newAppt.time) { toast.error('Please fill required fields'); return; }
    try {
      const service = services.find(s => s.service_id === newAppt.service_id);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const startTime = `${dateStr}T${newAppt.time}:00`;
      const endTime = format(addMinutes(parseISO(startTime), service?.duration || 30), "yyyy-MM-dd'T'HH:mm:ss");
      await axios.post(`${API}/appointments`, { ...newAppt, start_time: startTime, end_time: endTime, status: 'confirmed' }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Created'); setShowNewAppointment(false); setNewAppt({ service_id: '', staff_id: '', client_name: '', client_phone: '', time: '' }); fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed'); }
  };

  const getHeaderText = () => {
    if (viewMode === 'day') return format(selectedDate, 'EEE, MMM d');
    const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const we = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return `${format(ws, 'MMM d')} – ${format(we, 'd')}`;
  };

  const confirmed = appointments.filter(a => a.status === 'confirmed');
  const completed = appointments.filter(a => a.status === 'completed');

  return (
    <TenantLayout title="Calendar">
      <div className="max-w-2xl mx-auto">
        {/* Themed Header Bar */}
        <div className="rounded-2xl p-4 mb-6 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${theme.primary}15, ${theme.accent}10)`, border: `1px solid ${theme.primary}20` }}>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handlePrev} className="h-9 w-9 p-0 rounded-xl hover:bg-white/50">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setSelectedDate(new Date())}
              className="h-9 px-4 rounded-xl text-white"
              style={isToday(selectedDate) ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` } : { background: 'white', color: '#666' }}
            >
              Today
            </Button>
            <Button variant="ghost" size="sm" onClick={handleNext} className="h-9 w-9 p-0 rounded-xl hover:bg-white/50">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="ml-2 font-semibold text-gray-800">{getHeaderText()}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white/80 rounded-xl p-0.5 border border-gray-200">
              {['day', 'week'].map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${viewMode === mode ? 'text-white shadow-sm' : 'text-gray-500'}`}
                  style={viewMode === mode ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` } : {}}
                >{mode}</button>
              ))}
            </div>
            <Button size="sm" onClick={() => setShowNewAppointment(true)}
              className="h-9 px-4 rounded-xl text-white shadow-lg"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
              data-testid="new-appointment-calendar-btn"
            >
              <Plus className="w-4 h-4 mr-1" /> New
            </Button>
          </div>
        </div>

        {/* Pending Approvals */}
        {allPendingAppts.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl overflow-hidden" data-testid="pending-approvals-section">
            <div className="px-4 py-3 border-b border-amber-200/50 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800">{allPendingAppts.length} Awaiting Approval</p>
            </div>
            <div className="divide-y divide-amber-100 max-h-52 overflow-y-auto">
              {allPendingAppts.map((appt) => (
                <div key={appt.appointment_id} className="px-4 py-3 flex items-center justify-between bg-white/50 hover:bg-white transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold font-mono text-amber-700" style={{ backgroundColor: '#fef3c7' }}>
                      {format(parseISO(appt.start_time), 'HH:mm')}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{appt.client_name}</p>
                      <p className="text-xs text-gray-500">{appt.service_name} &middot; {format(parseISO(appt.start_time), 'MMM d')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleApprove(appt.appointment_id)} className="h-8 w-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors shadow-sm">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleReject(appt.appointment_id)} className="h-8 w-8 rounded-lg bg-white border border-red-200 text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calendar Content */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : viewMode === 'day' ? (
          <div className="space-y-2">
            {confirmed.length === 0 && completed.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                <CalendarDays className="w-8 h-8 mx-auto mb-3" style={{ color: theme.primary + '60' }} />
                <p className="text-gray-500">No {theme.terminology.appointment.toLowerCase()}s this day</p>
              </div>
            ) : (
              <>
                {confirmed.map((appt) => (
                  <div key={appt.appointment_id}
                    className="bg-white rounded-2xl p-4 border border-gray-200 hover:shadow-md transition-shadow"
                    style={{ borderLeft: `4px solid ${theme.primary}` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center" style={{ backgroundColor: theme.primaryLight }}>
                          <p className="text-sm font-bold font-mono" style={{ color: theme.primary }}>{format(parseISO(appt.start_time), 'HH:mm')}</p>
                          <p className="text-[9px] text-gray-400">{differenceInMinutes(parseISO(appt.end_time), parseISO(appt.start_time))}m</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{appt.client_name || 'Walk-in'}</p>
                          <p className="text-sm text-gray-500">{appt.service_name} {appt.staff_name ? `· ${appt.staff_name}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {appt.client_phone && (
                          <a href={`tel:${appt.client_phone}`} className="p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        <button onClick={() => handleComplete(appt.appointment_id)}
                          className="h-9 w-9 rounded-xl text-white flex items-center justify-center shadow-sm transition-transform hover:scale-105"
                          style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {completed.length > 0 && (
                  <div className="pt-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Completed &middot; {completed.length}
                    </p>
                    {completed.map((appt) => (
                      <div key={appt.appointment_id} className="flex items-center gap-3 py-2 px-1 opacity-50">
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm text-gray-600">{appt.client_name}</span>
                        <span className="text-xs text-gray-400 ml-auto font-mono">{format(parseISO(appt.start_time), 'HH:mm')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <WeekView selectedDate={selectedDate} appointments={appointments} onDayClick={(date) => { setSelectedDate(date); setViewMode('day'); }} theme={theme} />
        )}

        {/* New Appointment Dialog */}
        <Dialog open={showNewAppointment} onOpenChange={setShowNewAppointment}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">New {theme.terminology.appointment}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-xs text-gray-500">{theme.terminology.service}</Label>
                <Select value={newAppt.service_id} onValueChange={(v) => setNewAppt({ ...newAppt, service_id: v })}>
                  <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{services.map(s => <SelectItem key={s.service_id} value={s.service_id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500">{theme.terminology.staff}</Label>
                <Select value={newAppt.staff_id} onValueChange={(v) => setNewAppt({ ...newAppt, staff_id: v })}>
                  <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{staff.map(s => <SelectItem key={s.staff_id} value={s.staff_id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-gray-500">Time</Label><Input type="time" value={newAppt.time} onChange={e => setNewAppt({ ...newAppt, time: e.target.value })} className="mt-1 h-10 rounded-xl" /></div>
              <div><Label className="text-xs text-gray-500">{theme.terminology.client} Name</Label><Input value={newAppt.client_name} onChange={e => setNewAppt({ ...newAppt, client_name: e.target.value })} className="mt-1 h-10 rounded-xl" /></div>
              <div><Label className="text-xs text-gray-500">Phone</Label><Input type="tel" value={newAppt.client_phone} onChange={e => setNewAppt({ ...newAppt, client_phone: e.target.value })} className="mt-1 h-10 rounded-xl" /></div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={() => setShowNewAppointment(false)}>Cancel</Button>
                <Button className="flex-1 h-10 rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }} onClick={handleCreateAppointment}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TenantLayout>
  );
};

const WeekView = ({ selectedDate, appointments, onDayClick, theme }) => {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(selectedDate, { weekStartsOn: 1 }) });
  const getAppts = (date) => appointments.filter(a => isSameDay(parseISO(a.start_time), date) && a.status !== 'cancelled');

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const dayAppts = getAppts(day);
        const today = isToday(day);
        return (
          <button key={day.toISOString()} onClick={() => onDayClick(day)}
            className={`p-3 rounded-2xl text-center transition-all hover:scale-[1.02] ${today ? 'text-white shadow-lg' : 'bg-white border border-gray-200 hover:shadow-md'}`}
            style={today ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` } : {}}
          >
            <p className={`text-[10px] uppercase font-medium ${today ? 'text-white/70' : 'text-gray-400'}`}>{format(day, 'EEE')}</p>
            <p className={`text-xl font-bold mt-1 ${today ? '' : 'text-gray-800'}`}>{format(day, 'd')}</p>
            {dayAppts.length > 0 && (
              <div className={`mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${today ? 'bg-white/20' : ''}`} style={!today ? { backgroundColor: theme.primaryLight, color: theme.primary } : {}}>
                {dayAppts.length}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default CalendarPage;
