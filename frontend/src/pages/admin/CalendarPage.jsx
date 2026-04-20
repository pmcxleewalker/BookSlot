import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import { getTheme } from '../../config/industryThemes';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, X, Check, Phone, Zap, Repeat, StickyNote, Save } from 'lucide-react';
import {
  format, addDays, subDays, addWeeks, subWeeks, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, parseISO, addMinutes, differenceInMinutes, isToday
} from 'date-fns';

const STATUS_COLORS = {
  confirmed: { bg: '#10b981', light: '#d1fae5' },
  pending:   { bg: '#f59e0b', light: '#fef3c7' },
  completed: { bg: '#3b82f6', light: '#dbeafe' },
  cancelled: { bg: '#ef4444', light: '#fee2e2' },
};
const HOURS = Array.from({ length: 10 }, (_, i) => i + 8);

const CalendarPage = () => {
  const { token, tenant } = useAuth();
  const theme = getTheme(tenant?.industry);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');
  const [appointments, setAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewAppt, setShowNewAppt] = useState(false);
  const [allPending, setAllPending] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState('all');
  const [selectedAppt, setSelectedAppt] = useState(null);

  const [newAppt, setNewAppt] = useState({
    service_id: '', staff_id: '', client_name: '', client_phone: '', client_email: '', time: '', notes: '',
    repeat_weeks: 0, repeat_count: 1,
  });

  useEffect(() => { fetchData(); }, [selectedDate, viewMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let startDate, endDate;
      if (viewMode === 'day') {
        startDate = format(selectedDate, 'yyyy-MM-dd'); endDate = startDate + 'T23:59:59';
      } else {
        const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const we = endOfWeek(selectedDate, { weekStartsOn: 1 });
        startDate = format(ws, 'yyyy-MM-dd'); endDate = format(we, 'yyyy-MM-dd') + 'T23:59:59';
      }
      const [apptR, staffR, svcR, pendR] = await Promise.all([
        axios.get(`${API}/appointments`, { params: { start_date: startDate, end_date: endDate }, headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/staff`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/appointments`, { params: { status: 'pending' }, headers: { Authorization: `Bearer ${token}` } })
      ]);
      setAppointments((apptR.data.appointments || []).sort((a, b) => new Date(a.start_time) - new Date(b.start_time)));
      setStaff(staffR.data.staff || []); setServices(svcR.data.services || []); setAllPending(pendR.data.appointments || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handlePrev = () => viewMode === 'day' ? setSelectedDate(subDays(selectedDate, 1)) : setSelectedDate(subWeeks(selectedDate, 1));
  const handleNext = () => viewMode === 'day' ? setSelectedDate(addDays(selectedDate, 1)) : setSelectedDate(addWeeks(selectedDate, 1));
  const handleApprove = async (id) => { try { await axios.post(`${API}/appointments/${id}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Approved'); fetchData(); } catch { toast.error('Failed'); } };
  const handleReject = async (id) => { try { await axios.post(`${API}/appointments/${id}/reject`, {}, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Rejected'); fetchData(); } catch { toast.error('Failed'); } };
  const handleComplete = async (id) => { try { await axios.put(`${API}/appointments/${id}`, { status: 'completed' }, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Done'); fetchData(); setSelectedAppt(null); } catch { toast.error('Failed'); } };

  const handleSaveNotes = async (id, notes) => {
    try {
      await axios.put(`${API}/appointments/${id}`, { notes }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Notes saved');
      fetchData();
    } catch { toast.error('Failed to save notes'); }
  };

  const handleCreate = async () => {
    if (!newAppt.service_id || !newAppt.staff_id || !newAppt.client_name || !newAppt.time) { toast.error('Fill required fields'); return; }
    try {
      const svc = services.find(s => s.service_id === newAppt.service_id);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const startTime = `${dateStr}T${newAppt.time}:00`;
      const endTime = format(addMinutes(parseISO(startTime), svc?.duration || 30), "yyyy-MM-dd'T'HH:mm:ss");
      const payload = {
        service_id: newAppt.service_id, staff_id: newAppt.staff_id,
        client_name: newAppt.client_name, client_phone: newAppt.client_phone || undefined,
        client_email: newAppt.client_email || undefined,
        start_time: startTime, end_time: endTime, status: 'confirmed',
        notes: newAppt.notes || undefined,
        repeat_weeks: newAppt.repeat_weeks > 0 ? newAppt.repeat_weeks : undefined,
        repeat_count: newAppt.repeat_weeks > 0 ? newAppt.repeat_count : undefined,
      };
      const res = await axios.post(`${API}/appointments`, payload, { headers: { Authorization: `Bearer ${token}` } });
      const total = res.data.total_created || 1;
      toast.success(total > 1 ? `Created ${total} appointments (repeating every ${newAppt.repeat_weeks} weeks)` : 'Appointment created');
      setShowNewAppt(false);
      setNewAppt({ service_id: '', staff_id: '', client_name: '', client_phone: '', client_email: '', time: '', notes: '', repeat_weeks: 0, repeat_count: 1 });
      fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed'); }
  };

  const filteredAppts = selectedStaff === 'all' ? appointments : appointments.filter(a => a.staff_id === selectedStaff);
  const avatarColors = ['#e11d48', '#0284c7', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#d946ef'];

  return (
    <TenantLayout title="Calendar">
      <div className="max-w-5xl mx-auto">
        {/* Top Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <button onClick={handlePrev} className="cal-btn w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-all hover:shadow-md"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setSelectedDate(new Date())} className="cal-btn h-9 px-5 rounded-xl font-semibold text-sm text-white transition-all hover:shadow-lg active:scale-95" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}>TODAY</button>
            <button onClick={handleNext} className="cal-btn w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-all hover:shadow-md"><ChevronRight className="w-4 h-4" /></button>
            <span className="ml-3 text-lg font-bold text-gray-800">
              {viewMode === 'day' ? format(selectedDate, 'EEEE, MMM d, yyyy') : `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              {['day', 'week'].map(m => (
                <button key={m} onClick={() => setViewMode(m)} className={`px-5 py-2 text-xs font-semibold rounded-lg transition-all capitalize ${viewMode === m ? 'text-white shadow-md' : 'text-gray-500'}`}
                  style={viewMode === m ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` } : {}}>{m}</button>
              ))}
            </div>
            <button onClick={() => setShowNewAppt(true)} className="cal-btn h-10 px-5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 transition-all hover:shadow-lg active:scale-95"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }} data-testid="new-appointment-calendar-btn">
              <Plus className="w-4 h-4" /> New
            </button>
          </div>
        </div>

        {/* Staff Row */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-200 overflow-x-auto">
          <button onClick={() => setSelectedStaff('all')} className={`flex flex-col items-center gap-1.5 min-w-[60px] transition-all ${selectedStaff === 'all' ? 'scale-110' : 'opacity-60 hover:opacity-100'}`}>
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`, boxShadow: selectedStaff === 'all' ? `0 0 0 3px white, 0 0 0 5px ${theme.primary}` : 'none' }}>All</div>
            <span className="text-[10px] font-medium text-gray-500">Everyone</span>
          </button>
          {staff.map((s, i) => (
            <button key={s.staff_id} onClick={() => setSelectedStaff(s.staff_id === selectedStaff ? 'all' : s.staff_id)} className={`flex flex-col items-center gap-1.5 min-w-[60px] transition-all ${selectedStaff === s.staff_id ? 'scale-110' : selectedStaff === 'all' ? '' : 'opacity-40 hover:opacity-100'}`}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: `linear-gradient(135deg, ${avatarColors[i % avatarColors.length]}, ${avatarColors[(i+1) % avatarColors.length]})`, boxShadow: selectedStaff === s.staff_id ? `0 0 0 3px white, 0 0 0 5px ${avatarColors[i % avatarColors.length]}` : 'none' }}>{s.name?.charAt(0)}</div>
              <span className="text-[10px] font-medium text-gray-600 truncate max-w-[65px]">{s.name?.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Pending */}
        {allPending.length > 0 && (
          <div className="mb-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl overflow-hidden" data-testid="pending-approvals-section">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-amber-200/40"><Zap className="w-4 h-4 text-amber-500" /><span className="text-sm font-bold text-amber-800">{allPending.length} Awaiting Approval</span></div>
            <div className="divide-y divide-amber-100/50 max-h-36 overflow-y-auto">
              {allPending.map(a => (
                <div key={a.appointment_id} className="px-4 py-2.5 flex items-center justify-between hover:bg-white/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">{format(parseISO(a.start_time), 'HH:mm')}</span>
                    <div><p className="text-sm font-semibold text-gray-800">{a.client_name}</p><p className="text-[11px] text-gray-500">{a.service_name} &middot; {format(parseISO(a.start_time), 'MMM d')}</p></div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleApprove(a.appointment_id)} className="cal-btn h-8 w-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-all"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleReject(a.appointment_id)} className="cal-btn h-8 w-8 rounded-lg bg-white border border-red-200 text-red-400 hover:text-red-600 flex items-center justify-center transition-all"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grid */}
        {loading ? <div className="text-center py-16 text-gray-400">Loading...</div> :
          viewMode === 'week' ? <WeekGrid selectedDate={selectedDate} appointments={filteredAppts} theme={theme} onDayClick={d => { setSelectedDate(d); setViewMode('day'); }} onApptClick={setSelectedAppt} /> :
          <DayList appointments={filteredAppts.filter(a => isSameDay(parseISO(a.start_time), selectedDate) && a.status !== 'cancelled')} theme={theme} onComplete={handleComplete} onApptClick={setSelectedAppt} />
        }

        {/* New Appointment Dialog */}
        <Dialog open={showNewAppt} onOpenChange={setShowNewAppt}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">New {theme.terminology.appointment}</DialogTitle>
              <DialogDescription className="text-xs text-gray-400">Book an appointment with optional notes and repeat scheduling</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label className="text-xs text-gray-500">{theme.terminology.service} *</Label>
                <Select value={newAppt.service_id} onValueChange={v => setNewAppt({ ...newAppt, service_id: v })}>
                  <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{services.map(s => <SelectItem key={s.service_id} value={s.service_id}>{s.name} ({s.duration}m)</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-gray-500">{theme.terminology.staff} *</Label>
                <Select value={newAppt.staff_id} onValueChange={v => setNewAppt({ ...newAppt, staff_id: v })}>
                  <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{staff.map(s => <SelectItem key={s.staff_id} value={s.staff_id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-gray-500">Time *</Label><Input type="time" value={newAppt.time} onChange={e => setNewAppt({ ...newAppt, time: e.target.value })} className="mt-1 h-10 rounded-xl" /></div>
              <div><Label className="text-xs text-gray-500">{theme.terminology.client} Name *</Label><Input value={newAppt.client_name} onChange={e => setNewAppt({ ...newAppt, client_name: e.target.value })} className="mt-1 h-10 rounded-xl" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-gray-500">Phone</Label><Input type="tel" value={newAppt.client_phone} onChange={e => setNewAppt({ ...newAppt, client_phone: e.target.value })} className="mt-1 h-10 rounded-xl" /></div>
                <div><Label className="text-xs text-gray-500">Email</Label><Input type="email" value={newAppt.client_email} onChange={e => setNewAppt({ ...newAppt, client_email: e.target.value })} className="mt-1 h-10 rounded-xl" /></div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs text-gray-500 flex items-center gap-1"><StickyNote className="w-3 h-3" /> Notes</Label>
                <textarea
                  value={newAppt.notes}
                  onChange={e => setNewAppt({ ...newAppt, notes: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 resize-none"
                  style={{ '--tw-ring-color': theme.primary }}
                  rows={2}
                  placeholder="Client preferences, allergies, treatment notes..."
                  data-testid="appointment-notes-input"
                />
              </div>

              {/* Repeat Booking */}
              <div className="border border-gray-200 rounded-xl p-3" style={{ backgroundColor: theme.primaryLight + '30' }}>
                <Label className="text-xs text-gray-500 flex items-center gap-1 mb-2"><Repeat className="w-3 h-3" style={{ color: theme.primary }} /> Repeat Booking</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] text-gray-400">Every X weeks</Label>
                    <select value={newAppt.repeat_weeks} onChange={e => setNewAppt({ ...newAppt, repeat_weeks: parseInt(e.target.value) })}
                      className="mt-1 w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white" data-testid="repeat-weeks-select">
                      <option value={0}>No repeat</option>
                      <option value={1}>Every 1 week</option>
                      <option value={2}>Every 2 weeks</option>
                      <option value={3}>Every 3 weeks</option>
                      <option value={4}>Every 4 weeks</option>
                      <option value={6}>Every 6 weeks</option>
                      <option value={8}>Every 8 weeks</option>
                      <option value={12}>Every 12 weeks</option>
                    </select>
                  </div>
                  {newAppt.repeat_weeks > 0 && (
                    <div>
                      <Label className="text-[10px] text-gray-400">How many times</Label>
                      <select value={newAppt.repeat_count} onChange={e => setNewAppt({ ...newAppt, repeat_count: parseInt(e.target.value) })}
                        className="mt-1 w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white" data-testid="repeat-count-select">
                        {[2,3,4,5,6,8,10,12].map(n => <option key={n} value={n}>{n} times</option>)}
                      </select>
                    </div>
                  )}
                </div>
                {newAppt.repeat_weeks > 0 && (
                  <p className="text-[11px] mt-2" style={{ color: theme.primary }}>
                    Will create {newAppt.repeat_count} appointments, every {newAppt.repeat_weeks} week{newAppt.repeat_weeks > 1 ? 's' : ''} starting {format(selectedDate, 'MMM d')}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={() => setShowNewAppt(false)}>Cancel</Button>
                <Button className="flex-1 h-10 rounded-xl text-white transition-all hover:shadow-lg active:scale-[0.98]"
                  style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }} onClick={handleCreate}>
                  {newAppt.repeat_weeks > 0 ? `Create ${newAppt.repeat_count} Bookings` : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Appointment Detail Panel */}
        <AppointmentDetail appt={selectedAppt} onClose={() => setSelectedAppt(null)} onSaveNotes={handleSaveNotes} onComplete={handleComplete} theme={theme} />
      </div>

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

/* ============ APPOINTMENT DETAIL PANEL ============ */
const AppointmentDetail = ({ appt, onClose, onSaveNotes, onComplete, theme }) => {
  const [notes, setNotes] = useState('');
  useEffect(() => { if (appt) setNotes(appt.notes || ''); }, [appt]);
  if (!appt) return null;

  return (
    <Dialog open={!!appt} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{appt.client_name || 'Appointment'}</DialogTitle>
          <DialogDescription className="text-xs text-gray-400">{appt.service_name} &middot; {appt.staff_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg" style={{ backgroundColor: theme.primaryLight, color: theme.primary }}>
              {appt.start_time ? format(parseISO(appt.start_time), 'HH:mm') : ''} - {appt.end_time ? format(parseISO(appt.end_time), 'HH:mm') : ''}
            </span>
            <span className="text-xs text-gray-400">{appt.start_time ? format(parseISO(appt.start_time), 'EEEE, MMM d') : ''}</span>
          </div>
          {appt.client_phone && <p className="text-sm text-gray-600 flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" />{appt.client_phone}</p>}
          {appt.repeat_weeks && (
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: theme.primaryLight, color: theme.primary }}>
              <Repeat className="w-3.5 h-3.5" />Repeats every {appt.repeat_weeks} week{appt.repeat_weeks > 1 ? 's' : ''}
            </div>
          )}
          <div>
            <Label className="text-xs text-gray-500 flex items-center gap-1 mb-1"><StickyNote className="w-3 h-3" /> Notes</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 resize-none"
              rows={3}
              placeholder="Add notes about this client or booking..."
              data-testid="appointment-detail-notes"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-9 rounded-xl gap-1" onClick={() => { onSaveNotes(appt.appointment_id, notes); onClose(); }}>
              <Save className="w-3.5 h-3.5" /> Save Notes
            </Button>
            {appt.status === 'confirmed' && (
              <Button size="sm" className="flex-1 h-9 rounded-xl text-white gap-1" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }} onClick={() => onComplete(appt.appointment_id)}>
                <Check className="w-3.5 h-3.5" /> Complete
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ============ WEEK TIME-GRID ============ */
const WeekGrid = ({ selectedDate, appointments, theme, onDayClick, onApptClick }) => {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(selectedDate, { weekStartsOn: 1 }) });
  const getAppts = (date) => appointments.filter(a => isSameDay(parseISO(a.start_time), date) && a.status !== 'cancelled');
  const getBlockStyle = (appt) => {
    try {
      const s = parseISO(appt.start_time), e = parseISO(appt.end_time);
      const top = (s.getHours() + s.getMinutes() / 60 - 8) * 60;
      return { top: `${top}px`, height: `${Math.max(differenceInMinutes(e, s), 25)}px` };
    } catch { return { top: '0px', height: '30px' }; }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200">
        <div className="p-2" />
        {days.map(d => {
          const today = isToday(d);
          return (
            <button key={d.toISOString()} onClick={() => onDayClick(d)} className={`py-3 text-center border-l border-gray-100 transition-colors ${today ? '' : 'hover:bg-gray-50'}`} style={today ? { borderBottom: `3px solid ${theme.primary}` } : {}}>
              <p className={`text-[10px] uppercase font-semibold tracking-wider ${today ? '' : 'text-gray-400'}`} style={today ? { color: theme.primary } : {}}>{format(d, 'EEE')}</p>
              <p className={`text-xl font-bold mt-0.5 ${today ? '' : 'text-gray-800'}`} style={today ? { color: theme.primary } : {}}>{format(d, 'd')}</p>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ height: `${HOURS.length * 60}px` }}>
        <div className="relative">{HOURS.map(h => <div key={h} className="absolute w-full text-right pr-2 text-[11px] text-gray-400 font-mono" style={{ top: `${(h - 8) * 60}px` }}>{String(h).padStart(2, '0')}:00</div>)}</div>
        {days.map(d => {
          const dayAppts = getAppts(d); const today = isToday(d);
          return (
            <div key={d.toISOString()} className="relative border-l border-gray-100" style={today ? { backgroundColor: `${theme.primary}05` } : {}}>
              {HOURS.map(h => <div key={h} className="absolute w-full border-t border-gray-100" style={{ top: `${(h - 8) * 60}px` }} />)}
              {HOURS.map(h => <div key={`half-${h}`} className="absolute w-full border-t border-gray-50" style={{ top: `${(h - 8) * 60 + 30}px` }} />)}
              {dayAppts.map(appt => {
                const style = getBlockStyle(appt); const c = STATUS_COLORS[appt.status] || STATUS_COLORS.confirmed;
                return (
                  <div key={appt.appointment_id} className="appt-block absolute left-1 right-1 rounded-lg px-2 py-1 overflow-hidden border-l-[3px]"
                    style={{ ...style, backgroundColor: c.light, borderLeftColor: c.bg }}
                    onClick={() => onApptClick(appt)}
                  >
                    <p className="text-[11px] font-bold truncate" style={{ color: c.bg }}>{appt.service_name || 'Service'}</p>
                    <p className="text-[10px] truncate text-gray-600">{appt.client_name}</p>
                    {appt.notes && <StickyNote className="w-2.5 h-2.5 text-gray-400 mt-0.5" />}
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

/* ============ DAY LIST ============ */
const DayList = ({ appointments, theme, onComplete, onApptClick }) => {
  const confirmed = appointments.filter(a => a.status === 'confirmed');
  const completed = appointments.filter(a => a.status === 'completed');
  if (confirmed.length === 0 && completed.length === 0) return <div className="text-center py-16 bg-white rounded-2xl border border-gray-200"><p className="text-gray-400">No appointments this day</p></div>;

  return (
    <div className="space-y-2">
      {confirmed.map(appt => (
        <div key={appt.appointment_id} className="appt-block bg-white rounded-2xl p-4 border border-gray-200" style={{ borderLeft: `4px solid ${theme.primary}` }} onClick={() => onApptClick(appt)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center" style={{ backgroundColor: theme.primaryLight }}>
                <p className="text-sm font-bold font-mono" style={{ color: theme.primary }}>{format(parseISO(appt.start_time), 'HH:mm')}</p>
                <p className="text-[9px] text-gray-400">{differenceInMinutes(parseISO(appt.end_time), parseISO(appt.start_time))}m</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{appt.client_name || 'Walk-in'}</p>
                <p className="text-sm text-gray-500">{appt.service_name} {appt.staff_name ? `· ${appt.staff_name}` : ''}</p>
                {appt.notes && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><StickyNote className="w-3 h-3" />{appt.notes.substring(0, 40)}{appt.notes.length > 40 ? '...' : ''}</p>}
                {appt.repeat_weeks && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex items-center gap-1 w-fit mt-1"><Repeat className="w-3 h-3" />Every {appt.repeat_weeks}w</span>}
              </div>
            </div>
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              {appt.client_phone && <a href={`tel:${appt.client_phone}`} className="cal-btn p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100"><Phone className="w-4 h-4" /></a>}
              <button onClick={() => onComplete(appt.appointment_id)} className="cal-btn h-9 w-9 rounded-xl text-white flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}><Check className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      ))}
      {completed.length > 0 && (
        <div className="pt-3">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 px-1">Completed · {completed.length}</p>
          {completed.map(appt => (
            <div key={appt.appointment_id} className="flex items-center gap-3 py-2 px-1 opacity-50 cursor-pointer hover:opacity-70" onClick={() => onApptClick(appt)}>
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
