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
import { ChevronLeft, ChevronRight, Plus, X, Check, Phone, Zap, User } from 'lucide-react';
import {
  format, addDays, subDays, addWeeks, subWeeks, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, parseISO, addMinutes, differenceInMinutes, isToday
} from 'date-fns';

// Appointment block colors by status
const STATUS_COLORS = {
  confirmed: { bg: '#10b981', text: '#fff', light: '#d1fae5', border: '#6ee7b7' },
  pending:   { bg: '#f59e0b', text: '#fff', light: '#fef3c7', border: '#fcd34d' },
  completed: { bg: '#3b82f6', text: '#fff', light: '#dbeafe', border: '#93c5fd' },
  cancelled: { bg: '#ef4444', text: '#fff', light: '#fee2e2', border: '#fca5a5' },
  noshow:    { bg: '#f97316', text: '#fff', light: '#ffedd5', border: '#fdba74' },
};

const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 08:00 to 17:00

const CalendarPage = () => {
  const { token, tenant } = useAuth();
  const theme = getTheme(tenant?.industry);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');
  const [appointments, setAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [allPendingAppts, setAllPendingAppts] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState('all');
  const [newAppt, setNewAppt] = useState({ service_id: '', staff_id: '', client_name: '', client_phone: '', time: '' });

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
    if (viewMode === 'day') return format(selectedDate, 'EEEE, MMM d, yyyy');
    const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const we = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return `${format(ws, 'MMM d')} - ${format(we, 'MMM d, yyyy')}`;
  };

  const filteredAppts = selectedStaff === 'all'
    ? appointments
    : appointments.filter(a => a.staff_id === selectedStaff);

  // Staff avatar colors
  const avatarColors = ['#e11d48', '#0284c7', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#d946ef'];

  return (
    <TenantLayout title="Calendar">
      <div className="max-w-5xl mx-auto">
        {/* Top Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button onClick={handlePrev} className="cal-btn w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-all hover:shadow-md">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setSelectedDate(new Date())}
              className="cal-btn h-9 px-5 rounded-xl font-semibold text-sm text-white transition-all hover:shadow-lg hover:shadow-[${theme.primary}40] active:scale-95"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
            >
              TODAY
            </button>
            <button onClick={handleNext} className="cal-btn w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-all hover:shadow-md">
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="ml-3 text-lg font-bold text-gray-800">{getHeaderText()}</span>
          </div>

          {/* View Toggle + New */}
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              {['day', 'week'].map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`px-5 py-2 text-xs font-semibold rounded-lg transition-all capitalize ${viewMode === mode ? 'text-white shadow-md' : 'text-gray-500 hover:text-gray-800'}`}
                  style={viewMode === mode ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` } : {}}
                >{mode}</button>
              ))}
            </div>
            <button onClick={() => setShowNewAppointment(true)}
              className="cal-btn h-10 px-5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 transition-all hover:shadow-lg active:scale-95"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
              data-testid="new-appointment-calendar-btn"
            >
              <Plus className="w-4 h-4" /> New
            </button>
          </div>
        </div>

        {/* Staff Avatar Row */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-200 overflow-x-auto">
          <button onClick={() => setSelectedStaff('all')}
            className={`flex flex-col items-center gap-1.5 min-w-[60px] transition-all ${selectedStaff === 'all' ? 'scale-110' : 'opacity-60 hover:opacity-100'}`}
          >
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold ring-2 ring-offset-2 transition-all"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`, ringColor: selectedStaff === 'all' ? theme.primary : 'transparent' }}
            >All</div>
            <span className="text-[10px] font-medium text-gray-500">Everyone</span>
          </button>
          {staff.map((s, i) => (
            <button key={s.staff_id} onClick={() => setSelectedStaff(s.staff_id === selectedStaff ? 'all' : s.staff_id)}
              className={`flex flex-col items-center gap-1.5 min-w-[60px] transition-all ${selectedStaff === s.staff_id ? 'scale-110' : selectedStaff === 'all' ? '' : 'opacity-40 hover:opacity-100'}`}
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold transition-all"
                style={{
                  background: `linear-gradient(135deg, ${avatarColors[i % avatarColors.length]}, ${avatarColors[(i + 1) % avatarColors.length]})`,
                  boxShadow: selectedStaff === s.staff_id ? `0 0 0 3px white, 0 0 0 5px ${avatarColors[i % avatarColors.length]}` : 'none'
                }}
              >{s.name?.charAt(0)}</div>
              <span className="text-[10px] font-medium text-gray-600 truncate max-w-[65px]">{s.name?.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Pending Approvals */}
        {allPendingAppts.length > 0 && (
          <div className="mb-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl overflow-hidden" data-testid="pending-approvals-section">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-amber-200/40">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-amber-800">{allPendingAppts.length} Awaiting Approval</span>
            </div>
            <div className="divide-y divide-amber-100/50 max-h-36 overflow-y-auto">
              {allPendingAppts.map((appt) => (
                <div key={appt.appointment_id} className="px-4 py-2.5 flex items-center justify-between hover:bg-white/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">{format(parseISO(appt.start_time), 'HH:mm')}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{appt.client_name}</p>
                      <p className="text-[11px] text-gray-500">{appt.service_name} &middot; {format(parseISO(appt.start_time), 'MMM d')}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleApprove(appt.appointment_id)} className="cal-btn h-8 w-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-all hover:shadow-md active:scale-95"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleReject(appt.appointment_id)} className="cal-btn h-8 w-8 rounded-lg bg-white border border-red-200 text-red-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-all hover:shadow-md active:scale-95"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calendar Grid */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading...</div>
        ) : viewMode === 'week' ? (
          <WeekGrid selectedDate={selectedDate} appointments={filteredAppts} theme={theme} onDayClick={(d) => { setSelectedDate(d); setViewMode('day'); }} onComplete={handleComplete} />
        ) : (
          <DayList appointments={filteredAppts.filter(a => isSameDay(parseISO(a.start_time), selectedDate) && a.status !== 'cancelled')} theme={theme} onComplete={handleComplete} />
        )}

        {/* New Appointment Dialog */}
        <Dialog open={showNewAppointment} onOpenChange={setShowNewAppointment}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle className="text-base">New {theme.terminology.appointment}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label className="text-xs text-gray-500">{theme.terminology.service}</Label>
                <Select value={newAppt.service_id} onValueChange={v => setNewAppt({ ...newAppt, service_id: v })}>
                  <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{services.map(s => <SelectItem key={s.service_id} value={s.service_id}>{s.name} ({s.duration}m - &euro;{s.price})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-gray-500">{theme.terminology.staff}</Label>
                <Select value={newAppt.staff_id} onValueChange={v => setNewAppt({ ...newAppt, staff_id: v })}>
                  <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{staff.map(s => <SelectItem key={s.staff_id} value={s.staff_id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-gray-500">Time</Label><Input type="time" value={newAppt.time} onChange={e => setNewAppt({ ...newAppt, time: e.target.value })} className="mt-1 h-10 rounded-xl" /></div>
              <div><Label className="text-xs text-gray-500">{theme.terminology.client} Name</Label><Input value={newAppt.client_name} onChange={e => setNewAppt({ ...newAppt, client_name: e.target.value })} className="mt-1 h-10 rounded-xl" /></div>
              <div><Label className="text-xs text-gray-500">Phone</Label><Input type="tel" value={newAppt.client_phone} onChange={e => setNewAppt({ ...newAppt, client_phone: e.target.value })} className="mt-1 h-10 rounded-xl" /></div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={() => setShowNewAppointment(false)}>Cancel</Button>
                <Button className="flex-1 h-10 rounded-xl text-white transition-all hover:shadow-lg active:scale-[0.98]" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }} onClick={handleCreateAppointment}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Glow effect styles */}
      <style>{`
        .cal-btn { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .cal-btn:hover { transform: translateY(-1px); }
        .cal-btn:active { transform: translateY(0) scale(0.97); }
        .appt-block { transition: all 0.2s ease; cursor: pointer; }
        .appt-block:hover { transform: scale(1.03); box-shadow: 0 4px 15px rgba(0,0,0,0.15); z-index: 10; }
      `}</style>
    </TenantLayout>
  );
};

/* ============ WEEK TIME-GRID ============ */
const WeekGrid = ({ selectedDate, appointments, theme, onDayClick, onComplete }) => {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(selectedDate, { weekStartsOn: 1 }) });

  const getAppts = (date) => appointments.filter(a => isSameDay(parseISO(a.start_time), date) && a.status !== 'cancelled');

  const getBlockStyle = (appt) => {
    try {
      const start = parseISO(appt.start_time);
      const end = parseISO(appt.end_time);
      const startHour = start.getHours() + start.getMinutes() / 60;
      const duration = differenceInMinutes(end, start);
      const top = (startHour - 8) * 60; // px offset from 08:00
      const height = Math.max(duration, 25);
      return { top: `${top}px`, height: `${height}px` };
    } catch { return { top: '0px', height: '30px' }; }
  };

  const getStatusColor = (status) => STATUS_COLORS[status] || STATUS_COLORS.confirmed;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Day Headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200">
        <div className="p-2" />
        {days.map(day => {
          const today = isToday(day);
          return (
            <button key={day.toISOString()} onClick={() => onDayClick(day)}
              className={`py-3 text-center border-l border-gray-100 transition-colors ${today ? 'bg-gradient-to-b from-white' : 'hover:bg-gray-50'}`}
              style={today ? { borderBottom: `3px solid ${theme.primary}` } : {}}
            >
              <p className={`text-[10px] uppercase font-semibold tracking-wider ${today ? '' : 'text-gray-400'}`} style={today ? { color: theme.primary } : {}}>
                {format(day, 'EEE')}
              </p>
              <p className={`text-xl font-bold mt-0.5 ${today ? '' : 'text-gray-800'}`} style={today ? { color: theme.primary } : {}}>
                {format(day, 'd')}
              </p>
            </button>
          );
        })}
      </div>

      {/* Time Grid */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ height: `${HOURS.length * 60}px` }}>
        {/* Time Labels */}
        <div className="relative">
          {HOURS.map(hour => (
            <div key={hour} className="absolute w-full text-right pr-2 text-[11px] text-gray-400 font-mono" style={{ top: `${(hour - 8) * 60}px` }}>
              {hour.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Day Columns */}
        {days.map((day, dayIdx) => {
          const dayAppts = getAppts(day);
          const today = isToday(day);
          return (
            <div key={day.toISOString()} className="relative border-l border-gray-100" style={today ? { backgroundColor: `${theme.primary}05` } : {}}>
              {/* Hour grid lines */}
              {HOURS.map(hour => (
                <div key={hour} className="absolute w-full border-t border-gray-100" style={{ top: `${(hour - 8) * 60}px` }} />
              ))}
              {/* Half-hour lines */}
              {HOURS.map(hour => (
                <div key={`half-${hour}`} className="absolute w-full border-t border-gray-50" style={{ top: `${(hour - 8) * 60 + 30}px` }} />
              ))}

              {/* Appointment Blocks */}
              {dayAppts.map((appt) => {
                const style = getBlockStyle(appt);
                const colors = getStatusColor(appt.status);
                return (
                  <div key={appt.appointment_id}
                    className="appt-block absolute left-1 right-1 rounded-lg px-2 py-1 overflow-hidden border-l-[3px]"
                    style={{
                      ...style,
                      backgroundColor: colors.light,
                      borderLeftColor: colors.bg,
                    }}
                    title={`${appt.client_name} - ${appt.service_name}`}
                    onClick={() => appt.status === 'confirmed' && onComplete(appt.appointment_id)}
                  >
                    <p className="text-[11px] font-bold truncate" style={{ color: colors.bg }}>{appt.service_name}</p>
                    <p className="text-[10px] truncate text-gray-600">{appt.client_name}</p>
                    <span className="text-[9px] uppercase font-bold tracking-wider" style={{ color: colors.bg }}>{appt.status}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============ DAY LIST VIEW ============ */
const DayList = ({ appointments, theme, onComplete }) => {
  const confirmed = appointments.filter(a => a.status === 'confirmed');
  const completed = appointments.filter(a => a.status === 'completed');

  if (confirmed.length === 0 && completed.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
        <p className="text-gray-400">No appointments this day</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {confirmed.map(appt => (
        <div key={appt.appointment_id} className="appt-block bg-white rounded-2xl p-4 border border-gray-200"
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
                <a href={`tel:${appt.client_phone}`} className="cal-btn p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100"><Phone className="w-4 h-4" /></a>
              )}
              <button onClick={() => onComplete(appt.appointment_id)}
                className="cal-btn h-9 w-9 rounded-xl text-white flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
              ><Check className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      ))}
      {completed.length > 0 && (
        <div className="pt-3">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 px-1">Completed · {completed.length}</p>
          {completed.map(appt => (
            <div key={appt.appointment_id} className="flex items-center gap-3 py-2 px-1 opacity-50">
              <Check className="w-4 h-4 text-emerald-500" /><span className="text-sm text-gray-600">{appt.client_name}</span>
              <span className="text-xs text-gray-400 ml-auto font-mono">{format(parseISO(appt.start_time), 'HH:mm')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
