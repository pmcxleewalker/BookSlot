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
import { ChevronLeft, ChevronRight, Plus, X, Check, Phone, Zap, Repeat, StickyNote, Save, CalendarDays } from 'lucide-react';
import { format, addDays, subDays, addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, addMinutes, differenceInMinutes, isToday } from 'date-fns';

const BLOCK_COLORS = [
  { bg: '#E8C5C8', text: '#8B5E63' },  // blush
  { bg: '#E5DFD9', text: '#706B68' },  // champagne
  { bg: '#C8D5C8', text: '#5A6B5A' },  // sage
  { bg: '#D4D9E8', text: '#5A6080' },  // lavender
  { bg: '#E8D9C8', text: '#8B7260' },  // warm taupe
  { bg: '#C8D8E8', text: '#5A7088' },  // soft blue
];
const HOURS = Array.from({ length: 10 }, (_, i) => i + 8);

const CalendarPage = () => {
  const { token, tenant, user } = useAuth();
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
  const [newAppt, setNewAppt] = useState({ service_id: '', staff_id: '', client_name: '', client_phone: '', client_email: '', time: '', notes: '', repeat_weeks: 0, repeat_count: 1 });

  // Staff-role users see ONLY their own bookings — lock the filter to their linked staff_id
  const isStaffRole = user?.role === 'staff';
  useEffect(() => {
    if (isStaffRole && user?.linked_staff_id && selectedStaff !== user.linked_staff_id) {
      setSelectedStaff(user.linked_staff_id);
    }
  }, [isStaffRole, user?.linked_staff_id, selectedStaff]);

  useEffect(() => { fetchData(); }, [selectedDate, viewMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let sd, ed;
      if (viewMode === 'day') { sd = format(selectedDate, 'yyyy-MM-dd'); ed = sd + 'T23:59:59'; }
      else { const ws = startOfWeek(selectedDate, { weekStartsOn: 1 }); const we = endOfWeek(selectedDate, { weekStartsOn: 1 }); sd = format(ws, 'yyyy-MM-dd'); ed = format(we, 'yyyy-MM-dd') + 'T23:59:59'; }
      const [a, s, sv, p] = await Promise.all([
        axios.get(`${API}/appointments`, { params: { start_date: sd, end_date: ed }, headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/staff`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/appointments`, { params: { status: 'pending' }, headers: { Authorization: `Bearer ${token}` } })
      ]);
      setAppointments((a.data.appointments || []).sort((x, y) => new Date(x.start_time) - new Date(y.start_time)));
      setStaff(s.data.staff || []); setServices(sv.data.services || []); setAllPending(p.data.appointments || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handlePrev = () => viewMode === 'day' ? setSelectedDate(subDays(selectedDate, 1)) : setSelectedDate(subWeeks(selectedDate, 1));
  const handleNext = () => viewMode === 'day' ? setSelectedDate(addDays(selectedDate, 1)) : setSelectedDate(addWeeks(selectedDate, 1));
  const handleApprove = async (id) => { try { await axios.post(`${API}/appointments/${id}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Approved'); fetchData(); } catch { toast.error('Failed'); } };
  const handleReject = async (id) => { try { await axios.post(`${API}/appointments/${id}/reject`, {}, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Rejected'); fetchData(); } catch { toast.error('Failed'); } };
  const handleComplete = async (id) => { try { await axios.put(`${API}/appointments/${id}`, { status: 'completed' }, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Done'); fetchData(); setSelectedAppt(null); } catch { toast.error('Failed'); } };
  const handleSaveNotes = async (id, notes) => { try { await axios.put(`${API}/appointments/${id}`, { notes }, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Notes saved'); fetchData(); } catch { toast.error('Failed'); } };

  const handleUpdateAppt = async (id, payload) => {
    try {
      await axios.put(`${API}/appointments/${id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Appointment updated');
      setSelectedAppt(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update');
    }
  };

  const handleRefundDeposit = async (id) => {
    if (!window.confirm('Refund this deposit? The client will be refunded via Stripe.')) return;
    try {
      const r = await axios.post(`${API}/appointments/${id}/refund-deposit`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(r.data?.message || 'Refunded');
      setSelectedAppt(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Refund failed');
    }
  };

  const handleCancelAppt = async (id) => {
    if (!window.confirm('Cancel this appointment? The client will be notified.')) return;
    try {
      await axios.put(`${API}/appointments/${id}`, { status: 'cancelled' }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Appointment cancelled');
      setSelectedAppt(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    }
  };

  // Drag-and-drop: reschedule an appointment to a new day+time while keeping its duration.
  const handleDropAppt = async (appt, newDate, newTimeHHMM) => {
    try {
      const origStart = parseISO(appt.start_time);
      const origEnd = parseISO(appt.end_time);
      const duration = differenceInMinutes(origEnd, origStart);
      const [h, m] = newTimeHHMM.split(':').map(Number);
      const newStartDate = new Date(newDate);
      newStartDate.setHours(h, m, 0, 0);
      const newEndDate = addMinutes(newStartDate, duration);
      // Build local-ISO strings without timezone suffix (mirrors existing appointments)
      const iso = (d) => `${format(d, 'yyyy-MM-dd')}T${format(d, 'HH:mm:ss')}`;
      const payload = { start_time: iso(newStartDate), end_time: iso(newEndDate) };
      // No-op if nothing changed
      if (payload.start_time === appt.start_time) return;
      await axios.put(`${API}/appointments/${appt.appointment_id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Moved to ${format(newStartDate, 'EEE d MMM, HH:mm')}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not reschedule');
    }
  };

  const openNewAppt = (date, time) => {
    if (date) setSelectedDate(date);
    const now = new Date();
    const defaultTime = time || `${String(now.getHours()).padStart(2, '0')}:${now.getMinutes() < 30 ? '00' : '30'}`;
    setNewAppt({ service_id: '', staff_id: selectedStaff !== 'all' ? selectedStaff : '', client_name: '', client_phone: '', client_email: '', time: defaultTime, notes: '', repeat_weeks: 0, repeat_count: 1 });
    setShowNewAppt(true);
  };

  const handleCreate = async () => {
    if (!newAppt.service_id || !newAppt.staff_id || !newAppt.client_name || !newAppt.time) { toast.error('Fill required fields'); return; }
    try {
      const svc = services.find(s => s.service_id === newAppt.service_id);
      const ds = format(selectedDate, 'yyyy-MM-dd');
      const st = `${ds}T${newAppt.time}:00`, et = format(addMinutes(parseISO(st), svc?.duration || 30), "yyyy-MM-dd'T'HH:mm:ss");
      const payload = { service_id: newAppt.service_id, staff_id: newAppt.staff_id, client_name: newAppt.client_name, client_phone: newAppt.client_phone || undefined, client_email: newAppt.client_email || undefined, start_time: st, end_time: et, status: 'confirmed', notes: newAppt.notes || undefined, repeat_weeks: newAppt.repeat_weeks > 0 ? newAppt.repeat_weeks : undefined, repeat_count: newAppt.repeat_weeks > 0 ? newAppt.repeat_count : undefined };
      const res = await axios.post(`${API}/appointments`, payload, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(res.data.total_created > 1 ? `Created ${res.data.total_created} appointments` : 'Booked');
      setShowNewAppt(false); setNewAppt({ service_id: '', staff_id: '', client_name: '', client_phone: '', client_email: '', time: '', notes: '', repeat_weeks: 0, repeat_count: 1 }); fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed'); }
  };

  const filteredAppts = selectedStaff === 'all' ? appointments : appointments.filter(a => a.staff_id === selectedStaff);
  const staffColorMap = {};
  staff.forEach((s, i) => {
    // Honour the color set on the staff profile first; fall back to the preset palette.
    if (s.color) {
      staffColorMap[s.staff_id] = { bg: s.color, text: '#2C2A29' };
    } else {
      staffColorMap[s.staff_id] = BLOCK_COLORS[i % BLOCK_COLORS.length];
    }
  });

  return (
    <TenantLayout title="Calendar">
      <div className="max-w-6xl mx-auto">
        {/* Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={handlePrev} className="w-9 h-9 rounded-full bg-white border border-[#F0EBE6] flex items-center justify-center text-[#706B68] hover:text-[#2C2A29] hover:border-[#E5DFD9] transition-all hover:shadow-md"><ChevronLeft className="w-4 h-4" strokeWidth={1.5} /></button>
            <button onClick={() => setSelectedDate(new Date())} className="h-9 px-5 rounded-full bg-[#2C2A29] text-white text-sm font-medium hover:bg-[#4A4745] transition-all hover:shadow-lg">Today</button>
            <button onClick={handleNext} className="w-9 h-9 rounded-full bg-white border border-[#F0EBE6] flex items-center justify-center text-[#706B68] hover:text-[#2C2A29] hover:border-[#E5DFD9] transition-all hover:shadow-md"><ChevronRight className="w-4 h-4" strokeWidth={1.5} /></button>
            <span className="ml-2 font-['Cormorant_Garamond'] text-xl text-[#2C2A29]">
              {viewMode === 'day' ? format(selectedDate, 'EEEE, MMMM d') : `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'MMM d')} – ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'MMM d')}`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[#F7F3EE] rounded-full p-1">
              {['day', 'week'].map(m => (
                <button key={m} onClick={() => setViewMode(m)} className={`px-5 py-2 text-xs font-medium rounded-full transition-all capitalize ${viewMode === m ? 'bg-white text-[#2C2A29] shadow-sm' : 'text-[#9E948F] hover:text-[#706B68]'}`}>{m}</button>
              ))}
            </div>
            <button onClick={() => openNewAppt()} className="h-10 px-5 rounded-full bg-[#2C2A29] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#4A4745] transition-all hover:shadow-lg hover:scale-[1.02]" data-testid="new-appointment-calendar-btn">
              <Plus className="w-4 h-4" strokeWidth={2} /> Book
            </button>
          </div>
        </div>

        {/* Staff Filter */}
        <div className="flex items-center gap-3 mb-6 pb-5 border-b border-[#F0EBE6] overflow-x-auto">
          <button onClick={() => setSelectedStaff('all')} className={`flex flex-col items-center gap-1.5 min-w-[56px] transition-all ${selectedStaff === 'all' ? '' : 'opacity-50 hover:opacity-80'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium transition-all ${selectedStaff === 'all' ? 'bg-[#2C2A29] text-white ring-2 ring-offset-2 ring-[#2C2A29]' : 'bg-[#F7F3EE] text-[#706B68]'}`}>All</div>
            <span className="text-[10px] text-[#9E948F]">Everyone</span>
          </button>
          {staff.map((s, i) => {
            const c = staffColorMap[s.staff_id] || BLOCK_COLORS[i % BLOCK_COLORS.length];
            return (
              <button key={s.staff_id} onClick={() => setSelectedStaff(s.staff_id === selectedStaff ? 'all' : s.staff_id)} className={`flex flex-col items-center gap-1.5 min-w-[56px] transition-all ${selectedStaff === s.staff_id ? '' : selectedStaff === 'all' ? '' : 'opacity-40 hover:opacity-80'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium transition-all ${selectedStaff === s.staff_id ? 'ring-2 ring-offset-2' : ''}`}
                  style={{ backgroundColor: c.bg, color: c.text, ringColor: selectedStaff === s.staff_id ? c.text : 'transparent' }}>{s.name?.charAt(0)}</div>
                <span className="text-[10px] text-[#706B68] truncate max-w-[60px]">{s.name?.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Pending */}
        {allPending.length > 0 && (
          <div className="mb-6 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden" data-testid="pending-approvals-section">
            <div className="px-6 py-4 border-b border-[#F0EBE6] flex items-center gap-2"><Zap className="w-4 h-4 text-[#D4A373]" strokeWidth={1.5} /><span className="text-sm font-medium text-[#2C2A29]">{allPending.length} Awaiting Approval</span></div>
            <div className="divide-y divide-[#F0EBE6] max-h-40 overflow-y-auto">
              {allPending.map(a => (
                <div key={a.appointment_id} className="px-6 py-3 flex items-center justify-between hover:bg-[#FCFCFA] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-[#B8868B] bg-[#E8C5C8]/20 px-2.5 py-1 rounded-lg">{format(parseISO(a.start_time), 'HH:mm')}</span>
                    <div><p className="text-sm font-medium text-[#2C2A29]">{a.client_name}</p><p className="text-[11px] text-[#9E948F]">{a.service_name} · {format(parseISO(a.start_time), 'MMM d')}</p></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(a.appointment_id)} className="h-8 px-4 rounded-full bg-[#8FA68F] text-white text-xs font-medium hover:bg-[#7A917A] transition-colors">Approve</button>
                    <button onClick={() => handleReject(a.appointment_id)} className="h-8 px-4 rounded-full bg-white border border-[#E5DFD9] text-[#9E948F] text-xs hover:text-[#B8868B] hover:border-[#E8C5C8] transition-colors">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calendar Grid */}
        {loading ? <div className="text-center py-16 text-[#9E948F]">Loading...</div> :
          viewMode === 'week' ? <WeekGrid selectedDate={selectedDate} appointments={filteredAppts} staffColorMap={staffColorMap} onDayClick={d => { setSelectedDate(d); setViewMode('day'); }} onApptClick={setSelectedAppt} onSlotClick={openNewAppt} onDropAppt={handleDropAppt} /> :
          <DayView selectedDate={selectedDate} appointments={filteredAppts.filter(a => isSameDay(parseISO(a.start_time), selectedDate) && a.status !== 'cancelled')} allDayAppts={filteredAppts.filter(a => isSameDay(parseISO(a.start_time), selectedDate))} staffColorMap={staffColorMap} onComplete={handleComplete} onApptClick={setSelectedAppt} onSlotClick={openNewAppt} onDropAppt={handleDropAppt} />
        }

        {/* New Appointment Dialog */}
        <Dialog open={showNewAppt} onOpenChange={setShowNewAppt}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border-[#F0EBE6]">
            <DialogHeader><DialogTitle className="font-['Cormorant_Garamond'] text-2xl font-light">New Booking</DialogTitle><DialogDescription className="text-[#9E948F] text-sm">Schedule for <span className="text-[#B8868B] font-medium">{format(selectedDate, 'EEEE, MMMM d')}</span></DialogDescription></DialogHeader>
            <div className="space-y-4 mt-3">
              <div><Label className="text-xs text-[#9E948F] uppercase tracking-wider">Service</Label>
                <Select value={newAppt.service_id} onValueChange={v => setNewAppt({ ...newAppt, service_id: v })}><SelectTrigger className="mt-1.5 h-11 rounded-xl bg-[#F7F3EE] border-transparent"><SelectValue placeholder="Choose a service" /></SelectTrigger><SelectContent>{services.map(s => <SelectItem key={s.service_id} value={s.service_id}>{s.name} ({s.duration}m)</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label className="text-xs text-[#9E948F] uppercase tracking-wider">Stylist</Label>
                <Select value={newAppt.staff_id} onValueChange={v => setNewAppt({ ...newAppt, staff_id: v })}><SelectTrigger className="mt-1.5 h-11 rounded-xl bg-[#F7F3EE] border-transparent"><SelectValue placeholder="Choose a stylist" /></SelectTrigger><SelectContent>{staff.map(s => <SelectItem key={s.staff_id} value={s.staff_id}>{s.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label className="text-xs text-[#9E948F] uppercase tracking-wider">Time</Label><Input type="time" value={newAppt.time} onChange={e => setNewAppt({ ...newAppt, time: e.target.value })} className="mt-1.5 h-11 rounded-xl bg-[#F7F3EE] border-transparent" /></div>
              <div><Label className="text-xs text-[#9E948F] uppercase tracking-wider">Client Name</Label><Input value={newAppt.client_name} onChange={e => setNewAppt({ ...newAppt, client_name: e.target.value })} className="mt-1.5 h-11 rounded-xl bg-[#F7F3EE] border-transparent" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-[#9E948F] uppercase tracking-wider">Phone</Label><Input type="tel" value={newAppt.client_phone} onChange={e => setNewAppt({ ...newAppt, client_phone: e.target.value })} className="mt-1.5 h-11 rounded-xl bg-[#F7F3EE] border-transparent" /></div>
                <div><Label className="text-xs text-[#9E948F] uppercase tracking-wider">Email</Label><Input type="email" value={newAppt.client_email} onChange={e => setNewAppt({ ...newAppt, client_email: e.target.value })} className="mt-1.5 h-11 rounded-xl bg-[#F7F3EE] border-transparent" /></div>
              </div>
              <div><Label className="text-xs text-[#9E948F] uppercase tracking-wider">Notes</Label><textarea value={newAppt.notes} onChange={e => setNewAppt({ ...newAppt, notes: e.target.value })} className="mt-1.5 w-full px-4 py-3 text-sm bg-[#F7F3EE] border-transparent rounded-xl focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#B8868B] resize-none" rows={2} placeholder="Client preferences, notes..." data-testid="appointment-notes-input" /></div>
              <div className="bg-[#F7F3EE] rounded-2xl p-4">
                <Label className="text-xs text-[#9E948F] uppercase tracking-wider flex items-center gap-1"><Repeat className="w-3 h-3 text-[#B8868B]" /> Repeat</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <select value={newAppt.repeat_weeks} onChange={e => setNewAppt({ ...newAppt, repeat_weeks: parseInt(e.target.value) })} className="h-10 px-3 text-sm bg-white rounded-xl border-transparent" data-testid="repeat-weeks-select">
                    <option value={0}>No repeat</option><option value={1}>Every week</option><option value={2}>Every 2 weeks</option><option value={3}>Every 3 weeks</option><option value={4}>Every 4 weeks</option><option value={6}>Every 6 weeks</option><option value={8}>Every 8 weeks</option><option value={12}>Every 12 weeks</option>
                  </select>
                  {newAppt.repeat_weeks > 0 && <select value={newAppt.repeat_count} onChange={e => setNewAppt({ ...newAppt, repeat_count: parseInt(e.target.value) })} className="h-10 px-3 text-sm bg-white rounded-xl border-transparent" data-testid="repeat-count-select">{[2,3,4,5,6,8,10,12].map(n => <option key={n} value={n}>{n} times</option>)}</select>}
                </div>
                {newAppt.repeat_weeks > 0 && <p className="text-[11px] text-[#B8868B] mt-2">{newAppt.repeat_count} bookings, every {newAppt.repeat_weeks} week{newAppt.repeat_weeks > 1 ? 's' : ''}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 h-11 rounded-full border-[#E5DFD9] text-[#706B68]" onClick={() => setShowNewAppt(false)}>Cancel</Button>
                <Button className="flex-1 h-11 rounded-full bg-[#2C2A29] text-white hover:bg-[#4A4745]" onClick={handleCreate}>{newAppt.repeat_weeks > 0 ? `Book ${newAppt.repeat_count} Sessions` : 'Book Now'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <ApptDetail appt={selectedAppt} staff={staff} services={services} onClose={() => setSelectedAppt(null)} onUpdate={handleUpdateAppt} onComplete={handleComplete} onCancel={handleCancelAppt} onRefund={handleRefundDeposit} />
      </div>
    </TenantLayout>
  );
};

const ApptDetail = ({ appt, staff, services, onClose, onUpdate, onComplete, onCancel, onRefund }) => {
  const [form, setForm] = useState({ service_id: '', staff_id: '', client_name: '', client_phone: '', client_email: '', date: '', time: '', notes: '' });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!appt) return;
    try {
      const start = parseISO(appt.start_time);
      setForm({
        service_id: appt.service_id || '',
        staff_id: appt.staff_id || '',
        client_name: appt.client_name || '',
        client_phone: appt.client_phone || '',
        client_email: appt.client_email || '',
        date: format(start, 'yyyy-MM-dd'),
        time: format(start, 'HH:mm'),
        notes: appt.notes || ''
      });
      setDirty(false);
    } catch {
      // ignore parse errors
    }
  }, [appt]);

  if (!appt) return null;

  const updateField = (k, v) => { setForm(prev => ({ ...prev, [k]: v })); setDirty(true); };

  const handleSave = async () => {
    if (!form.service_id || !form.staff_id || !form.client_name || !form.date || !form.time) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      const svc = services.find(s => s.service_id === form.service_id);
      const duration = svc?.duration || 30;
      const startISO = `${form.date}T${form.time}:00`;
      const startDate = parseISO(startISO);
      const endDate = addMinutes(startDate, duration);
      const iso = (d) => `${format(d, 'yyyy-MM-dd')}T${format(d, 'HH:mm:ss')}`;
      const payload = {
        service_id: form.service_id,
        staff_id: form.staff_id,
        client_name: form.client_name,
        client_phone: form.client_phone || null,
        client_email: form.client_email || null,
        start_time: iso(startDate),
        end_time: iso(endDate),
        notes: form.notes || null
      };
      await onUpdate(appt.appointment_id, payload);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!appt} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl border-[#F0EBE6] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-['Cormorant_Garamond'] text-2xl font-light">Edit Booking</DialogTitle>
          <DialogDescription className="text-[#9E948F] text-sm flex items-center gap-2 flex-wrap">
            {appt.status === 'pending' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E8C5C8]/40 text-[#B8868B] uppercase tracking-wider">Pending</span>}
            {appt.status === 'pending_payment' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFE5B4] text-[#A06A1B] uppercase tracking-wider">Awaiting Payment</span>}
            {appt.status === 'completed' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C8D5C8]/40 text-[#5F7A5F] uppercase tracking-wider">Completed</span>}
            {appt.status === 'cancelled' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E5E5E5] text-[#706B68] uppercase tracking-wider">Cancelled</span>}
            {appt.payment_status === 'paid' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C8D5C8]/40 text-[#5F7A5F] uppercase tracking-wider">Deposit €{appt.deposit_amount} Paid</span>}
            {appt.payment_status === 'refunded' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E5E5E5] text-[#706B68] uppercase tracking-wider">Refunded</span>}
            {appt.repeat_weeks ? <span className="flex items-center gap-1"><Repeat className="w-3 h-3" />Every {appt.repeat_weeks} week{appt.repeat_weeks > 1 ? 's' : ''}</span> : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs text-[#9E948F] uppercase tracking-wider">Service *</Label>
            <Select value={form.service_id} onValueChange={v => updateField('service_id', v)}>
              <SelectTrigger className="mt-1.5 bg-[#F7F3EE] border-transparent rounded-xl h-11" data-testid="edit-service-select"><SelectValue placeholder="Choose a service" /></SelectTrigger>
              <SelectContent>
                {services.map(s => <SelectItem key={s.service_id} value={s.service_id}>{s.name} · {s.duration}min · €{s.price}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-[#9E948F] uppercase tracking-wider">Staff *</Label>
            <Select value={form.staff_id} onValueChange={v => updateField('staff_id', v)}>
              <SelectTrigger className="mt-1.5 bg-[#F7F3EE] border-transparent rounded-xl h-11" data-testid="edit-staff-select"><SelectValue placeholder="Choose staff" /></SelectTrigger>
              <SelectContent>
                {staff.map(s => <SelectItem key={s.staff_id} value={s.staff_id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-[#9E948F] uppercase tracking-wider">Date *</Label>
              <Input type="date" value={form.date} onChange={e => updateField('date', e.target.value)} className="mt-1.5 bg-[#F7F3EE] border-transparent rounded-xl h-11" data-testid="edit-date" />
            </div>
            <div>
              <Label className="text-xs text-[#9E948F] uppercase tracking-wider">Time *</Label>
              <Input type="time" value={form.time} onChange={e => updateField('time', e.target.value)} className="mt-1.5 bg-[#F7F3EE] border-transparent rounded-xl h-11" data-testid="edit-time" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-[#9E948F] uppercase tracking-wider">Client name *</Label>
            <Input value={form.client_name} onChange={e => updateField('client_name', e.target.value)} className="mt-1.5 bg-[#F7F3EE] border-transparent rounded-xl h-11" data-testid="edit-client-name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-[#9E948F] uppercase tracking-wider">Phone</Label>
              <Input value={form.client_phone} onChange={e => updateField('client_phone', e.target.value)} className="mt-1.5 bg-[#F7F3EE] border-transparent rounded-xl h-11" data-testid="edit-client-phone" />
            </div>
            <div>
              <Label className="text-xs text-[#9E948F] uppercase tracking-wider">Email</Label>
              <Input type="email" value={form.client_email} onChange={e => updateField('client_email', e.target.value)} className="mt-1.5 bg-[#F7F3EE] border-transparent rounded-xl h-11" data-testid="edit-client-email" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-[#9E948F] uppercase tracking-wider">Notes</Label>
            <textarea value={form.notes} onChange={e => updateField('notes', e.target.value)} className="mt-1.5 w-full px-4 py-3 text-sm bg-[#F7F3EE] rounded-xl border-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#B8868B] resize-none" rows={3} placeholder="Add notes..." data-testid="edit-notes" />
          </div>

          <div className="flex gap-2 pt-3 flex-wrap">
            <Button variant="outline" size="sm" className="flex-1 h-10 rounded-full border-[#E5DFD9] text-[#706B68] min-w-[90px]" onClick={onClose}>Close</Button>
            {appt.status === 'confirmed' && <Button size="sm" variant="outline" className="h-10 rounded-full border-[#8FA68F]/40 text-[#5F7A5F] gap-1 min-w-[100px]" onClick={() => onComplete(appt.appointment_id)} data-testid="complete-appt"><Check className="w-3.5 h-3.5" /> Complete</Button>}
            {appt.payment_status === 'paid' && onRefund && <Button size="sm" variant="outline" className="h-10 rounded-full border-[#E5DFD9] text-[#A06A1B] hover:bg-[#FFF6E5] min-w-[110px]" onClick={() => onRefund(appt.appointment_id)} data-testid="refund-deposit">Refund deposit</Button>}
            {appt.status !== 'cancelled' && <Button size="sm" variant="outline" className="h-10 rounded-full border-[#E5DFD9] text-[#B86868] hover:bg-[#FAF0F0] min-w-[90px]" onClick={() => onCancel(appt.appointment_id)} data-testid="cancel-appt">Cancel</Button>}
            <Button size="sm" className="flex-1 h-10 rounded-full bg-[#2C2A29] text-white hover:bg-[#4A4745] gap-1 disabled:opacity-50 min-w-[120px]" onClick={handleSave} disabled={!dirty || saving} data-testid="save-appt"><Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const WeekGrid = ({ selectedDate, appointments, staffColorMap, onDayClick, onApptClick, onSlotClick, onDropAppt }) => {
  const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: ws, end: endOfWeek(selectedDate, { weekStartsOn: 1 }) });
  const getAppts = (d) => appointments.filter(a => isSameDay(parseISO(a.start_time), d) && a.status !== 'cancelled');
  const getStyle = (a) => { try { const s = parseISO(a.start_time), e = parseISO(a.end_time); return { top: `${(s.getHours() + s.getMinutes() / 60 - 8) * 56}px`, height: `${Math.max(differenceInMinutes(e, s) / 60 * 56, 24)}px` }; } catch { return { top: '0', height: '28px' }; } };

  return (
    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border-2 border-[#E5DFD9]">
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b-2 border-[#E5DFD9]">
        <div className="p-2" />
        {days.map(d => {
          const today = isToday(d);
          return (
            <button key={d.toISOString()} onClick={() => onDayClick(d)} className={`py-4 text-center border-l-2 border-[#E5DFD9] transition-colors ${today ? 'bg-[#FAF5F0]' : 'hover:bg-[#FCFCFA]'}`}>
              <p className={`text-[10px] uppercase tracking-[0.15em] font-semibold ${today ? 'text-[#B8868B]' : 'text-[#9E948F]'}`}>{format(d, 'EEE')}</p>
              <p className={`text-lg mt-0.5 ${today ? 'font-semibold text-[#2C2A29]' : 'text-[#706B68]'}`}>{format(d, 'd')}</p>
              {today && <div className="w-1 h-1 rounded-full bg-[#B8868B] mx-auto mt-1" />}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-[56px_repeat(7,1fr)] relative" style={{ height: `${HOURS.length * 56}px` }}>
        <div className="relative border-r-2 border-[#E5DFD9]">{HOURS.map(h => <div key={h} className="absolute w-full text-right pr-2 text-[10px] text-[#706B68] font-mono font-semibold" style={{ top: `${(h - 8) * 56 - 6}px` }}>{String(h).padStart(2, '0')}:00</div>)}</div>
        {days.map(d => {
          const da = getAppts(d); const today = isToday(d);
          return (
            <div key={d.toISOString()} className="relative border-l-2 border-[#E5DFD9] today-col-bg" style={today ? { '--today-col': '#FCFCFA', backgroundColor: 'var(--today-col)' } : {}}>
              {HOURS.map(h => (
                <React.Fragment key={h}>
                  <div className="absolute w-full border-t-2 border-[#F0EBE6]" style={{ top: `${(h - 8) * 56}px` }} />
                  <button
                    onClick={(e) => { e.stopPropagation(); onSlotClick(d, `${String(h).padStart(2, '0')}:00`); }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const payload = e.dataTransfer.getData('application/json');
                      if (!payload) return;
                      try { const appt = JSON.parse(payload); onDropAppt?.(appt, d, `${String(h).padStart(2, '0')}:00`); } catch {}
                    }}
                    className="absolute w-full h-7 hover:bg-[#E8C5C8]/15 group flex items-center justify-center transition-colors"
                    style={{ top: `${(h - 8) * 56}px` }}
                    data-testid={`slot-${format(d, 'yyyy-MM-dd')}-${h}-00`}
                    aria-label={`Book at ${h}:00`}
                  >
                    <span className="text-[9px] text-[#B8868B] opacity-0 group-hover:opacity-100 transition-opacity font-medium tracking-wider uppercase">+ Book</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSlotClick(d, `${String(h).padStart(2, '0')}:30`); }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const payload = e.dataTransfer.getData('application/json');
                      if (!payload) return;
                      try { const appt = JSON.parse(payload); onDropAppt?.(appt, d, `${String(h).padStart(2, '0')}:30`); } catch {}
                    }}
                    className="absolute w-full h-7 hover:bg-[#E8C5C8]/15 group flex items-center justify-center border-t border-dashed border-[#F0EBE6]/80 transition-colors"
                    style={{ top: `${(h - 8) * 56 + 28}px` }}
                    data-testid={`slot-${format(d, 'yyyy-MM-dd')}-${h}-30`}
                    aria-label={`Book at ${h}:30`}
                  >
                    <span className="text-[9px] text-[#B8868B] opacity-0 group-hover:opacity-100 transition-opacity font-medium tracking-wider uppercase">+ Book</span>
                  </button>
                </React.Fragment>
              ))}
              {da.map(a => {
                const s = getStyle(a);
                const c = staffColorMap[a.staff_id] || BLOCK_COLORS[0];
                return (
                  <div
                    key={a.appointment_id}
                    className="absolute left-1 right-1 rounded-xl px-2 py-1 overflow-hidden cursor-grab active:cursor-grabbing transition-all hover:scale-[1.03] hover:shadow-md hover:z-10 border border-white/50"
                    style={{ ...s, backgroundColor: c.bg, zIndex: 5 }}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('application/json', JSON.stringify(a)); e.dataTransfer.effectAllowed = 'move'; }}
                    onClick={(e) => { e.stopPropagation(); onApptClick(a); }}
                    data-testid={`appt-${a.appointment_id}`}
                  >
                    <p className="text-[10px] font-semibold truncate" style={{ color: c.text }}>{a.client_name}</p>
                    <p className="text-[9px] truncate" style={{ color: c.text + '99' }}>{a.service_name}</p>
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

const DayView = ({ selectedDate, appointments, allDayAppts, staffColorMap, onComplete, onApptClick, onSlotClick, onDropAppt }) => {
  const confirmed = appointments.filter(a => a.status === 'confirmed');
  const completed = appointments.filter(a => a.status === 'completed');
  const getStyle = (a) => { try { const s = parseISO(a.start_time), e = parseISO(a.end_time); return { top: `${(s.getHours() + s.getMinutes() / 60 - 8) * 56}px`, height: `${Math.max(differenceInMinutes(e, s) / 60 * 56, 28)}px` }; } catch { return { top: '0', height: '28px' }; } };
  const dayAppts = appointments.filter(a => a.status !== 'cancelled');

  return (
    <div className="space-y-5">
      {/* Clickable Day Time Grid */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border-2 border-[#E5DFD9]">
        <div className="px-6 py-4 border-b-2 border-[#E5DFD9] flex items-center justify-between">
          <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#B8868B]" strokeWidth={1.5} /><span className="text-sm font-semibold text-[#2C2A29]">{format(selectedDate, 'EEEE, MMMM d')}</span></div>
          <span className="text-[11px] text-[#9E948F] uppercase tracking-[0.15em]">Click or drag to reschedule</span>
        </div>
        <div className="grid grid-cols-[72px_1fr] relative" style={{ height: `${HOURS.length * 56}px` }}>
          <div className="relative border-r-2 border-[#E5DFD9] bg-[#FCFCFA]">
            {HOURS.map(h => <div key={h} className="absolute w-full text-right pr-3 text-xs text-[#706B68] font-mono font-semibold" style={{ top: `${(h - 8) * 56 - 7}px` }}>{String(h).padStart(2, '0')}:00</div>)}
          </div>
          <div className="relative">
            {HOURS.map(h => (
              <React.Fragment key={h}>
                <div className="absolute w-full border-t-2 border-[#F0EBE6]" style={{ top: `${(h - 8) * 56}px` }} />
                <button
                  onClick={(e) => { e.stopPropagation(); onSlotClick(selectedDate, `${String(h).padStart(2, '0')}:00`); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const payload = e.dataTransfer.getData('application/json'); if (!payload) return; try { const appt = JSON.parse(payload); onDropAppt?.(appt, selectedDate, `${String(h).padStart(2, '0')}:00`); } catch {} }}
                  className="absolute w-full h-7 hover:bg-[#E8C5C8]/15 group flex items-center px-4 transition-colors"
                  style={{ top: `${(h - 8) * 56}px` }}
                  data-testid={`day-slot-${h}-00`}
                  aria-label={`Book at ${h}:00`}
                >
                  <span className="text-[10px] text-[#B8868B] opacity-0 group-hover:opacity-100 transition-opacity font-medium tracking-wider uppercase">+ Book at {String(h).padStart(2, '0')}:00</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onSlotClick(selectedDate, `${String(h).padStart(2, '0')}:30`); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const payload = e.dataTransfer.getData('application/json'); if (!payload) return; try { const appt = JSON.parse(payload); onDropAppt?.(appt, selectedDate, `${String(h).padStart(2, '0')}:30`); } catch {} }}
                  className="absolute w-full h-7 hover:bg-[#E8C5C8]/15 group flex items-center px-4 border-t border-dashed border-[#F0EBE6]/80 transition-colors"
                  style={{ top: `${(h - 8) * 56 + 28}px` }}
                  data-testid={`day-slot-${h}-30`}
                  aria-label={`Book at ${h}:30`}
                >
                  <span className="text-[10px] text-[#B8868B] opacity-0 group-hover:opacity-100 transition-opacity font-medium tracking-wider uppercase">+ Book at {String(h).padStart(2, '0')}:30</span>
                </button>
              </React.Fragment>
            ))}
            {dayAppts.map(a => {
              const s = getStyle(a);
              const c = staffColorMap[a.staff_id] || BLOCK_COLORS[0];
              const isDone = a.status === 'completed';
              return (
                <div key={a.appointment_id}
                  className={`absolute left-2 right-2 rounded-xl px-3 py-2 overflow-hidden cursor-grab active:cursor-grabbing transition-all hover:scale-[1.01] hover:shadow-md hover:z-10 border border-white/50 ${isDone ? 'opacity-60' : ''}`}
                  style={{ ...s, backgroundColor: c.bg, zIndex: 5 }}
                  draggable={!isDone}
                  onDragStart={(e) => { e.dataTransfer.setData('application/json', JSON.stringify(a)); e.dataTransfer.effectAllowed = 'move'; }}
                  onClick={(e) => { e.stopPropagation(); onApptClick(a); }}
                  data-testid={`appt-${a.appointment_id}`}
                >
                  <p className="text-xs font-semibold truncate" style={{ color: c.text }}>{a.client_name}{isDone && ' ✓'}</p>
                  <p className="text-[10px] truncate" style={{ color: c.text + '99' }}>{a.service_name} · {format(parseISO(a.start_time), 'HH:mm')}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Today's List Summary */}
      {(confirmed.length > 0 || completed.length > 0) && (
        <div className="space-y-3">
          <p className="text-xs tracking-[0.2em] uppercase text-[#9E948F] font-semibold">Today's Schedule · {confirmed.length + completed.length}</p>
          {confirmed.map(a => {
            const c = staffColorMap[a.staff_id] || BLOCK_COLORS[0];
            return (
              <div key={a.appointment_id} className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5 cursor-pointer group" onClick={() => onApptClick(a)} style={{ borderLeft: `4px solid ${c.text}` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center" style={{ backgroundColor: c.bg }}>
                      <p className="text-sm font-semibold font-mono" style={{ color: c.text }}>{format(parseISO(a.start_time), 'HH:mm')}</p>
                      <p className="text-[9px]" style={{ color: c.text + '80' }}>{differenceInMinutes(parseISO(a.end_time), parseISO(a.start_time))}m</p>
                    </div>
                    <div>
                      <p className="font-medium text-[#2C2A29]">{a.client_name || 'Walk-in'}</p>
                      <p className="text-sm text-[#9E948F]">{a.service_name}{a.staff_name ? ` · ${a.staff_name}` : ''}</p>
                      {a.notes && <p className="text-xs text-[#B8868B] mt-0.5 italic">"{a.notes.substring(0, 50)}{a.notes.length > 50 ? '...' : ''}"</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    {a.client_phone && <a href={`tel:${a.client_phone}`} className="p-2.5 text-[#9E948F] hover:text-[#2C2A29] rounded-xl hover:bg-[#F7F3EE]"><Phone className="w-4 h-4" strokeWidth={1.5} /></a>}
                    <button onClick={() => onComplete(a.appointment_id)} className="px-4 py-2 rounded-full bg-[#2C2A29] text-white text-xs font-medium hover:bg-[#4A4745] transition-colors">Done</button>
                  </div>
                </div>
              </div>
            );
          })}
          {completed.length > 0 && (
            <div className="pt-2">
              <p className="text-xs tracking-[0.2em] uppercase text-[#9E948F] font-semibold mb-3">Completed · {completed.length}</p>
              {completed.map(a => <div key={a.appointment_id} className="flex items-center gap-4 py-2.5 px-2 opacity-50 cursor-pointer hover:opacity-70" onClick={() => onApptClick(a)}><div className="w-5 h-5 rounded-full bg-[#8FA68F]/20 flex items-center justify-center"><Check className="w-3 h-3 text-[#8FA68F]" /></div><span className="text-sm text-[#706B68]">{a.client_name}</span><span className="text-xs text-[#9E948F] ml-auto font-mono">{format(parseISO(a.start_time), 'HH:mm')}</span></div>)}
            </div>
          )}
        </div>
      )}
      {confirmed.length === 0 && completed.length === 0 && (
        <div className="text-center py-10 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#F0EBE6]">
          <div className="w-14 h-14 rounded-full bg-[#F7F3EE] flex items-center justify-center mx-auto mb-3"><CalendarDays className="w-6 h-6 text-[#9E948F]" strokeWidth={1.5} /></div>
          <p className="text-[#706B68] font-medium">No appointments yet</p>
          <p className="text-sm text-[#9E948F] mt-1">Tap any time slot above to book</p>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
