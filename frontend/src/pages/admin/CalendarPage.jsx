import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import TenantLayout from '../../components/TenantLayout';
import { useAuth } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Plus, X, Clock, Calendar as CalendarIcon, List, Check, Search, User, Mail, Phone,
  RotateCcw, Ban, UserX, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { API, errorMessage } from '../../lib/api';
import { formatMoney, parseLocal, STATUS_LABELS, STATUS_STYLES } from '../../lib/utils';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 07:00 - 21:00
const EMPTY_FORM = { service_id: '', staff_id: '', client_id: '', client_name: '', client_email: '', client_phone: '', date: '', time: '', notes: '' };

const CalendarPage = () => {
  const { can, user, currency } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState(() => {
    if (searchParams.get('view') === 'list' || searchParams.get('status')) return 'list';
    if (searchParams.get('view') === 'day' || (typeof window !== 'undefined' && window.innerWidth < 768)) return 'day';
    return 'calendar';
  });
  const [appointments, setAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffFilter, setStaffFilter] = useState('all');
  const [showCancelled, setShowCancelled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'upcoming');

  const [showNew, setShowNew] = useState(false);
  const [newAppt, setNewAppt] = useState(EMPTY_FORM);
  const [freeSlots, setFreeSlots] = useState(null);
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState(null); // appointment detail dialog
  const [reschedule, setReschedule] = useState(null); // {date, time, staff_id}
  const [cancelReason, setCancelReason] = useState(null); // string when cancel form open
  const [dragged, setDragged] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const canSeeAll = can('can_view_all_bookings');

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (viewMode === 'calendar') {
        params.start_date = format(weekStart, 'yyyy-MM-dd');
        params.end_date = format(addDays(weekStart, 6), 'yyyy-MM-dd');
      } else if (viewMode === 'day') {
        params.start_date = format(currentDate, 'yyyy-MM-dd');
        params.end_date = format(currentDate, 'yyyy-MM-dd');
      } else if (statusFilter === 'upcoming') {
        params.start_date = format(new Date(), 'yyyy-MM-dd');
      } else if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const [apptRes, staffRes, servicesRes] = await Promise.all([
        axios.get(`${API}/appointments`, { params }),
        axios.get(`${API}/staff`),
        axios.get(`${API}/services`),
      ]);
      setAppointments(apptRes.data.appointments || []);
      setStaff(staffRes.data.staff || []);
      setServices(servicesRes.data.services || []);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to load calendar'));
    } finally {
      setLoading(false);
    }
  }, [viewMode, statusFilter, format(weekStart, 'yyyy-MM-dd'), viewMode === 'day' ? format(currentDate, 'yyyy-MM-dd') : '']); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!can('can_manage_customers')) return;
    axios.get(`${API}/clients`).then((r) => setClients(r.data.clients || [])).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Open an appointment from a link (?appointment=...)
  useEffect(() => {
    const id = searchParams.get('appointment');
    if (!id) return;
    axios.get(`${API}/appointments/${id}`).then((r) => {
      const appt = r.data.appointment;
      setSelected(appt);
      setCurrentDate(parseLocal(appt.start_time));
    }).catch(() => toast.error('Appointment not found'));
  }, [searchParams]);

  const closeDetail = () => {
    setSelected(null);
    setReschedule(null);
    setCancelReason(null);
    if (searchParams.get('appointment')) {
      searchParams.delete('appointment');
      setSearchParams(searchParams, { replace: true });
    }
  };

  // Free time suggestions in the "new appointment" form
  useEffect(() => {
    if (!showNew || !newAppt.service_id || !newAppt.staff_id || !newAppt.date) { setFreeSlots(null); return; }
    axios.get(`${API}/appointments/availability`, { params: { service_id: newAppt.service_id, staff_id: newAppt.staff_id, date: newAppt.date } })
      .then((r) => setFreeSlots(r.data.slots || [])).catch(() => setFreeSlots(null));
  }, [showNew, newAppt.service_id, newAppt.staff_id, newAppt.date]);

  const visibleAppointments = useMemo(() => appointments.filter((a) =>
    (staffFilter === 'all' || a.staff_id === staffFilter) && (showCancelled || a.status !== 'cancelled')
  ), [appointments, staffFilter, showCancelled]);

  const listAppointments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return appointments.filter((a) => (staffFilter === 'all' || a.staff_id === staffFilter) && (!q ||
      a.client_name?.toLowerCase().includes(q) || a.client_email?.toLowerCase().includes(q) ||
      a.client_phone?.includes(q) || a.appointment_id.includes(q)));
  }, [appointments, searchQuery, staffFilter]);

  const apptsForCell = (day, hour) => visibleAppointments.filter((a) => {
    const d = parseLocal(a.start_time);
    if (!isSameDay(d, day)) return false;
    const h = d.getHours();
    if (hour === HOURS[0]) return h <= hour;
    if (hour === HOURS[HOURS.length - 1]) return h >= hour;
    return h === hour;
  }).sort((x, y) => x.start_time.localeCompare(y.start_time));

  const replaceAppt = (appt) => {
    setAppointments((prev) => prev.map((a) => (a.appointment_id === appt.appointment_id ? appt : a)));
    if (selected?.appointment_id === appt.appointment_id) setSelected(appt);
  };

  // ---------- actions ----------
  const updateAppt = async (appt, body, success) => {
    try {
      const r = await axios.put(`${API}/appointments/${appt.appointment_id}`, body);
      replaceAppt(r.data.appointment);
      toast.success(success);
      return r.data.appointment;
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update appointment'));
      return null;
    }
  };

  const approve = async (appt) => {
    try {
      await axios.post(`${API}/appointments/${appt.appointment_id}/approve`);
      toast.success('Booking approved - the client has been notified');
      fetchData();
      closeDetail();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const decline = async (appt) => {
    const reason = window.prompt('Reason to share with the client (optional):', '');
    if (reason === null) return;
    try {
      await axios.post(`${API}/appointments/${appt.appointment_id}/reject`, { reason });
      toast.success('Booking declined');
      fetchData();
      closeDetail();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const cancel = async (appt) => {
    try {
      const r = await axios.post(`${API}/appointments/${appt.appointment_id}/cancel`, { reason: cancelReason || '' });
      replaceAppt({ ...appt, ...r.data.appointment });
      setCancelReason(null);
      toast.success('Appointment cancelled');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const saveReschedule = async () => {
    if (!reschedule?.date || !reschedule?.time) return toast.error('Pick a date and time');
    const appt = await updateAppt(selected, {
      start_time: `${reschedule.date}T${reschedule.time}:00`,
      staff_id: reschedule.staff_id,
    }, 'Appointment moved');
    if (appt) setReschedule(null);
  };

  const createAppointment = async () => {
    if (!newAppt.service_id || !newAppt.staff_id || !newAppt.date || !newAppt.time) {
      return toast.error('Choose a service, team member, date and time');
    }
    if (!newAppt.client_id && !newAppt.client_name.trim()) return toast.error('Enter the client name');
    setSaving(true);
    try {
      await axios.post(`${API}/appointments`, {
        service_id: newAppt.service_id,
        staff_id: newAppt.staff_id,
        client_id: newAppt.client_id || undefined,
        client_name: newAppt.client_name.trim(),
        client_email: newAppt.client_email.trim(),
        client_phone: newAppt.client_phone.trim(),
        start_time: `${newAppt.date}T${newAppt.time}:00`,
        notes: newAppt.notes,
      });
      toast.success('Appointment created');
      setShowNew(false);
      setNewAppt(EMPTY_FORM);
      fetchData();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to create appointment'));
    } finally {
      setSaving(false);
    }
  };

  const openNew = (day, hour) => {
    if (dragged) return;
    const mine = user?.staff_id && !canSeeAll ? user.staff_id : '';
    setNewAppt({
      ...EMPTY_FORM,
      staff_id: staffFilter !== 'all' ? staffFilter : (mine || (staff.length === 1 ? staff[0].staff_id : '')),
      date: day ? format(day, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      time: hour !== undefined ? `${String(hour).padStart(2, '0')}:00` : '',
    });
    setShowNew(true);
  };

  // ---------- drag & drop ----------
  const onDrop = async (e, day, hour) => {
    e.preventDefault();
    setDropTarget(null);
    const appt = dragged;
    setDragged(null);
    if (!appt) return;
    const original = parseLocal(appt.start_time);
    const minutes = String(original.getMinutes()).padStart(2, '0');
    const newStart = `${format(day, 'yyyy-MM-dd')}T${String(hour).padStart(2, '0')}:${minutes}:00`;
    if (newStart === appt.start_time) return;
    const moved = await updateAppt(appt, { start_time: newStart }, 'Appointment moved');
    if (moved) fetchData();
  };

  const staffColor = (id) => staff.find((s) => s.staff_id === id)?.color || '#4F46E5';
  const serviceFor = (id) => services.find((s) => s.service_id === id);
  const eligibleStaff = (serviceId) => staff.filter((s) => !s.services?.length || s.services.includes(serviceId));

  const statusButtons = ['upcoming', 'pending_approval', 'confirmed', 'completed', 'no_show', 'cancelled', 'all'];

  return (
    <TenantLayout title="Calendar">
      {/* Header */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex border border-[#E5E5E5] rounded-md overflow-hidden">
            <button onClick={() => setViewMode('day')} data-testid="view-day"
              className={`px-3 py-1.5 flex items-center gap-1.5 text-sm ${viewMode === 'day' ? 'bg-[#0A0A0A] text-white' : 'bg-white text-[#666666] hover:bg-[#FAFAFA]'}`}>
              <Clock className="w-4 h-4" /> Day
            </button>
            <button onClick={() => setViewMode('calendar')} data-testid="view-calendar"
              className={`px-3 py-1.5 flex items-center gap-1.5 text-sm ${viewMode === 'calendar' ? 'bg-[#0A0A0A] text-white' : 'bg-white text-[#666666] hover:bg-[#FAFAFA]'}`}>
              <CalendarIcon className="w-4 h-4" /> Week
            </button>
            <button onClick={() => setViewMode('list')} data-testid="view-list"
              className={`px-3 py-1.5 flex items-center gap-1.5 text-sm ${viewMode === 'list' ? 'bg-[#0A0A0A] text-white' : 'bg-white text-[#666666] hover:bg-[#FAFAFA]'}`}>
              <List className="w-4 h-4" /> List
            </button>
          </div>
          {viewMode === 'calendar' && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(subWeeks(currentDate, 1))} data-testid="prev-week"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} data-testid="today-btn">Today</Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(addWeeks(currentDate, 1))} data-testid="next-week"><ChevronRight className="w-4 h-4" /></Button>
              <span className="ml-1 font-semibold text-[#0A0A0A]" data-testid="current-week">
                {format(weekStart, 'd MMM')} - {format(addDays(weekStart, 6), 'd MMM yyyy')}
              </span>
            </div>
          )}
          {viewMode === 'day' && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(addDays(currentDate, -1))} data-testid="prev-day"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} data-testid="today-day-btn">Today</Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(addDays(currentDate, 1))} data-testid="next-day"><ChevronRight className="w-4 h-4" /></Button>
              <span className="ml-1 font-semibold text-[#0A0A0A]" data-testid="current-day">{format(currentDate, 'EEE d MMM')}</span>
            </div>
          )}
          {canSeeAll && staff.length > 1 && (
            <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="input-swiss !py-1.5 !w-auto text-sm" data-testid="staff-filter">
              <option value="all">All team members</option>
              {staff.map((s) => <option key={s.staff_id} value={s.staff_id}>{s.name}</option>)}
            </select>
          )}
          {viewMode === 'calendar' && (
            <label className="flex items-center gap-2 text-sm text-[#666666] cursor-pointer">
              <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
              Show cancelled
            </label>
          )}
        </div>
        <Button onClick={() => openNew(viewMode === 'day' ? currentDate : undefined)} className="btn-primary hidden md:flex items-center gap-2" data-testid="new-appointment-btn">
          <Plus className="w-4 h-4" /> New appointment
        </Button>
      </div>

      {/* List view */}
      {viewMode === 'list' && (
        <>
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
              <Input placeholder="Search by client name, email, phone or code..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" data-testid="search-appointments" />
            </div>
            <div className="flex flex-wrap gap-2">
              {statusButtons.map((s) => (
                <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm"
                  onClick={() => { setLoading(true); setStatusFilter(s); }} className={statusFilter === s ? 'btn-primary' : ''} data-testid={`filter-${s}`}>
                  {s === 'upcoming' ? 'Upcoming' : s === 'all' ? 'All' : STATUS_LABELS[s]}
                </Button>
              ))}
            </div>
          </div>
          <div className="card-flat overflow-hidden !p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                    {['Client', 'Date & time', 'Service', 'With', 'Status', 'Price'].map((h) => (
                      <th key={h} className="text-left p-4 text-sm font-medium text-[#666666]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-[#666666]">Loading...</td></tr>
                  ) : listAppointments.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-[#666666]">No appointments found</td></tr>
                  ) : listAppointments.map((appt) => (
                    <tr key={appt.appointment_id} onClick={() => setSelected(appt)}
                      className="border-b border-[#E5E5E5] last:border-0 hover:bg-[#FAFAFA] cursor-pointer" data-testid={`appt-row-${appt.appointment_id}`}>
                      <td className="p-4">
                        <p className="font-medium text-[#0A0A0A]">{appt.client_name || 'Walk-in'}</p>
                        <p className="text-sm text-[#666666]">{appt.client_email || appt.client_phone || '-'}</p>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <p className="text-[#0A0A0A]">{format(parseLocal(appt.start_time), 'EEE d MMM yyyy')}</p>
                        <p className="text-sm text-[#666666]">{appt.start_time.slice(11, 16)} - {appt.end_time.slice(11, 16)}</p>
                      </td>
                      <td className="p-4 text-[#0A0A0A]">{appt.service_name}</td>
                      <td className="p-4 text-[#0A0A0A]">{appt.staff_name}</td>
                      <td className="p-4"><span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${STATUS_STYLES[appt.status] || ''}`}>{STATUS_LABELS[appt.status] || appt.status}</span></td>
                      <td className="p-4 font-mono text-[#0A0A0A]">{formatMoney(appt.total_price, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Day view (default on phones) */}
      {viewMode === 'day' && (
        <div className="space-y-3 pb-24 md:pb-0" data-testid="day-view">
          {loading ? (
            <p className="p-8 text-center text-[#666666]">Loading...</p>
          ) : visibleAppointments.length === 0 ? (
            <div className="card-flat p-8 text-center">
              <p className="text-[#666666] mb-4">No appointments on {format(currentDate, 'EEEE d MMMM')}</p>
              <Button onClick={() => openNew(currentDate)} className="btn-primary"><Plus className="w-4 h-4 mr-1" />Add a booking</Button>
            </div>
          ) : [...visibleAppointments].sort((a, b) => a.start_time.localeCompare(b.start_time)).map((appt) => (
            <button key={appt.appointment_id} onClick={() => setSelected(appt)} data-testid={`day-appt-${appt.appointment_id}`}
              className={`w-full text-left card-flat !p-4 flex gap-4 items-start border-l-4 ${appt.status === 'cancelled' ? 'opacity-50' : ''}`}
              style={{ borderLeftColor: staffColor(appt.staff_id) }}>
              <div className="w-14 shrink-0">
                <p className="font-semibold text-[#0A0A0A]">{appt.start_time.slice(11, 16)}</p>
                <p className="text-xs text-[#666666]">{appt.end_time.slice(11, 16)}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#0A0A0A] truncate">{appt.client_name || 'Walk-in'}</p>
                <p className="text-sm text-[#666666] truncate">{appt.service_name}{staff.length > 1 ? ` · ${appt.staff_name}` : ''}</p>
                {appt.client_phone && <p className="text-sm text-[#666666]">{appt.client_phone}</p>}
              </div>
              <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${STATUS_STYLES[appt.status] || ''}`}>{STATUS_LABELS[appt.status] || appt.status}</span>
            </button>
          ))}
        </div>
      )}

      {/* Quick "new booking" button on phones */}
      <button onClick={() => openNew(viewMode === 'day' ? currentDate : undefined)} aria-label="New appointment"
        className="md:hidden fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-[#0A0A0A] text-white shadow-lg flex items-center justify-center"
        data-testid="new-appointment-fab">
        <Plus className="w-7 h-7" />
      </button>

      {/* Week view */}
      {viewMode === 'calendar' && (
        <div className="card-flat overflow-x-auto !p-0">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-[#E5E5E5]">
              <div />
              {weekDays.map((day) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={day.toISOString()} className={`p-3 text-center ${isToday ? 'bg-[#FAFAFA]' : ''}`}>
                    <p className="text-xs text-[#666666] uppercase">{format(day, 'EEE')}</p>
                    <p className={`text-lg font-semibold ${isToday ? 'text-[#3730A3]' : 'text-[#0A0A0A]'}`}>{format(day, 'd')}</p>
                  </div>
                );
              })}
            </div>
            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-[#E5E5E5] last:border-0">
                <div className="p-2 text-xs font-mono text-[#666666] border-r border-[#E5E5E5]">{String(hour).padStart(2, '0')}:00</div>
                {weekDays.map((day) => {
                  const key = `${format(day, 'yyyy-MM-dd')}-${hour}`;
                  const cellAppts = apptsForCell(day, hour);
                  return (
                    <div key={key} onClick={() => openNew(day, hour)}
                      onDragOver={(e) => { e.preventDefault(); if (dropTarget !== key) setDropTarget(key); }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null); }}
                      onDrop={(e) => onDrop(e, day, hour)}
                      className={`min-h-[56px] p-1 space-y-1 border-r border-[#F0F0F0] last:border-r-0 cursor-pointer hover:bg-[#FAFAFA] ${isSameDay(day, new Date()) ? 'bg-[#FAFAFA]/60' : ''} ${dropTarget === key ? 'bg-[#3730A3]/10 ring-2 ring-[#3730A3] ring-inset' : ''}`}
                      data-testid={`slot-${key}`}>
                      {cellAppts.map((appt) => {
                        const movable = ['confirmed', 'pending', 'pending_approval'].includes(appt.status);
                        return (
                          <div key={appt.appointment_id} draggable={movable}
                            onDragStart={(e) => { setDragged(appt); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', appt.appointment_id); }}
                            onDragEnd={() => { setDragged(null); setDropTarget(null); }}
                            onClick={(e) => { e.stopPropagation(); setSelected(appt); }}
                            className={`px-1.5 py-1 text-xs text-white rounded-sm ${movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${appt.status === 'cancelled' ? 'opacity-40 line-through' : ''} ${appt.status === 'pending_approval' ? 'ring-2 ring-orange-400' : ''}`}
                            style={{ backgroundColor: appt.staff_color || staffColor(appt.staff_id) }}
                            title={`${appt.client_name} - ${appt.service_name} (${STATUS_LABELS[appt.status]})`}
                            data-testid={`appt-${appt.appointment_id}`}>
                            <p className="font-medium truncate">{appt.start_time.slice(11, 16)} {appt.client_name || 'Walk-in'}</p>
                            <p className="text-white/80 truncate">{appt.service_name}</p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Appointment detail */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && closeDetail()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selected.client_name || 'Walk-in'}
                  <span className={`px-2 py-0.5 text-xs rounded-full font-normal ${STATUS_STYLES[selected.status] || ''}`}>{STATUS_LABELS[selected.status]}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2 text-sm">
                <p className="flex items-center gap-2 text-[#0A0A0A]"><Clock className="w-4 h-4 text-[#666666]" />
                  {format(parseLocal(selected.start_time), 'EEEE d MMMM yyyy')}, {selected.start_time.slice(11, 16)} - {selected.end_time.slice(11, 16)}
                </p>
                <p className="flex items-center gap-2 text-[#0A0A0A]"><CalendarIcon className="w-4 h-4 text-[#666666]" />
                  {selected.service_name} with {selected.staff_name} · {formatMoney(selected.total_price, currency)}
                </p>
                {selected.client_email && <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#666666]" /><a className="underline" href={`mailto:${selected.client_email}`}>{selected.client_email}</a></p>}
                {selected.client_phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#666666]" /><a className="underline" href={`tel:${selected.client_phone}`}>{selected.client_phone}</a></p>}
                {selected.deposit_paid && <p className="text-sm text-emerald-700" data-testid="appt-deposit">Deposit paid online: {formatMoney(selected.deposit_amount, currency)}{selected.deposit_refunded ? ' (refunded)' : selected.status === 'cancelled' && selected.deposit_kept ? ' (kept: late cancellation)' : ''}</p>}
                {selected.status === 'pending_payment' && <p className="text-sm text-yellow-800">Waiting for the client to pay the deposit. The slot is released automatically if they don't.</p>}
                <p className="text-xs text-[#999999]">Booked {selected.source === 'online' ? 'online' : selected.source === 'ai_receptionist' ? 'via AI receptionist' : selected.source === 'api' ? 'via API' : 'by the team'} · Code {selected.appointment_id}</p>
                {selected.cancellation_reason && <p className="p-2 bg-red-50 text-red-700">Cancelled: {selected.cancellation_reason}</p>}
                {selected.form_responses?.length > 0 && (
                  <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5]">
                    <p className="font-medium mb-2">Form answers</p>
                    {selected.form_responses.map((r) => (
                      <p key={r.field_id}><span className="text-[#666666]">{r.label}:</span> {String(r.value === true ? 'Yes' : r.value)}</p>
                    ))}
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium">Notes</Label>
                  <textarea defaultValue={selected.notes || ''} key={selected.appointment_id} rows={2} className="mt-1 input-swiss resize-none"
                    onBlur={(e) => { if ((e.target.value || '') !== (selected.notes || '')) updateAppt(selected, { notes: e.target.value }, 'Notes saved'); }}
                    data-testid="appt-detail-notes" />
                </div>
              </div>

              {reschedule && (
                <div className="mt-4 p-3 border border-[#E5E5E5] space-y-3">
                  <p className="font-medium text-sm">Move appointment</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input type="date" value={reschedule.date} onChange={(e) => setReschedule({ ...reschedule, date: e.target.value })} />
                    <Input type="time" step={300} value={reschedule.time} onChange={(e) => setReschedule({ ...reschedule, time: e.target.value })} />
                  </div>
                  {canSeeAll && (
                    <select value={reschedule.staff_id} onChange={(e) => setReschedule({ ...reschedule, staff_id: e.target.value })} className="input-swiss">
                      {eligibleStaff(selected.service_id).map((s) => <option key={s.staff_id} value={s.staff_id}>{s.name}</option>)}
                    </select>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" className="btn-primary" onClick={saveReschedule}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setReschedule(null)}>Close</Button>
                  </div>
                  <p className="text-xs text-[#666666]">The client will be emailed the new time.</p>
                </div>
              )}

              {cancelReason !== null && (
                <div className="mt-4 p-3 border border-red-200 bg-red-50 space-y-3">
                  <Label className="text-sm">Reason (included in the email to the client)</Label>
                  <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Staff illness" />
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => cancel(selected)} data-testid="confirm-cancel">Cancel appointment</Button>
                    <Button size="sm" variant="outline" onClick={() => setCancelReason(null)}>Keep it</Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-[#E5E5E5]">
                {selected.status === 'pending_approval' && (
                  <>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => approve(selected)} data-testid="approve-btn"><ThumbsUp className="w-4 h-4 mr-1" />Approve</Button>
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => decline(selected)} data-testid="decline-btn"><ThumbsDown className="w-4 h-4 mr-1" />Decline</Button>
                  </>
                )}
                {selected.status === 'pending' && (
                  <Button size="sm" className="btn-primary" onClick={() => updateAppt(selected, { status: 'confirmed' }, 'Confirmed')}><Check className="w-4 h-4 mr-1" />Confirm</Button>
                )}
                {['confirmed', 'pending', 'no_show'].includes(selected.status) && (
                  <Button size="sm" variant="outline" onClick={() => updateAppt(selected, { status: 'completed' }, 'Marked as completed')} data-testid="complete-btn"><Check className="w-4 h-4 mr-1" />Completed</Button>
                )}
                {['confirmed', 'pending'].includes(selected.status) && (
                  <Button size="sm" variant="outline" onClick={() => updateAppt(selected, { status: 'no_show' }, 'Marked as no-show')} data-testid="noshow-btn"><UserX className="w-4 h-4 mr-1" />No-show</Button>
                )}
                {['completed', 'no_show'].includes(selected.status) && (
                  <Button size="sm" variant="outline" onClick={() => updateAppt(selected, { status: 'confirmed' }, 'Status reset')}><RotateCcw className="w-4 h-4 mr-1" />Undo</Button>
                )}
                {['confirmed', 'pending', 'pending_approval'].includes(selected.status) && !reschedule && (
                  <Button size="sm" variant="outline" onClick={() => setReschedule({ date: selected.start_time.slice(0, 10), time: selected.start_time.slice(11, 16), staff_id: selected.staff_id })} data-testid="reschedule-btn">
                    <CalendarIcon className="w-4 h-4 mr-1" />Move
                  </Button>
                )}
                {['confirmed', 'pending'].includes(selected.status) && cancelReason === null && (
                  <Button size="sm" variant="outline" className="text-red-600 ml-auto" onClick={() => setCancelReason('')} data-testid="cancel-btn"><Ban className="w-4 h-4 mr-1" />Cancel</Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New appointment */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New appointment</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm font-medium">Service *</Label>
              <select value={newAppt.service_id} className="mt-1.5 input-swiss" data-testid="select-service"
                onChange={(e) => {
                  const id = e.target.value;
                  const keepStaff = eligibleStaff(id).some((s) => s.staff_id === newAppt.staff_id);
                  setNewAppt({ ...newAppt, service_id: id, staff_id: keepStaff ? newAppt.staff_id : '' });
                }}>
                <option value="">Select a service</option>
                {services.map((s) => <option key={s.service_id} value={s.service_id}>{s.name} ({s.duration} min · {formatMoney(s.price, currency)})</option>)}
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium">Team member *</Label>
              <select value={newAppt.staff_id} onChange={(e) => setNewAppt({ ...newAppt, staff_id: e.target.value })} className="mt-1.5 input-swiss" data-testid="select-staff">
                <option value="">Select a team member</option>
                {(newAppt.service_id ? eligibleStaff(newAppt.service_id) : staff)
                  .filter((s) => canSeeAll || s.staff_id === user?.staff_id)
                  .map((s) => <option key={s.staff_id} value={s.staff_id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Date *</Label>
                <Input type="date" value={newAppt.date} onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value })} className="mt-1.5" data-testid="appt-date" />
              </div>
              <div>
                <Label className="text-sm font-medium">Time *</Label>
                <Input type="time" step={300} value={newAppt.time} onChange={(e) => setNewAppt({ ...newAppt, time: e.target.value })} className="mt-1.5" data-testid="appt-time" />
              </div>
            </div>
            {freeSlots && (
              <div>
                <p className="text-xs text-[#666666] mb-2">{freeSlots.length ? 'Free times (within working hours):' : 'No free time in working hours that day - you can still pick a time manually.'}</p>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {freeSlots.map((s) => {
                    const t = s.start_time.slice(11, 16);
                    return (
                      <button key={t} type="button" onClick={() => setNewAppt({ ...newAppt, time: t })}
                        className={`px-3 py-2 sm:px-2 sm:py-1 text-sm sm:text-xs font-mono border rounded ${newAppt.time === t ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]' : 'border-[#E5E5E5] hover:border-[#0A0A0A]'}`}>{t}</button>
                    );
                  })}
                </div>
              </div>
            )}
            {clients.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Existing client</Label>
                <select value={newAppt.client_id} className="mt-1.5 input-swiss" data-testid="select-client"
                  onChange={(e) => {
                    const cl = clients.find((x) => x.client_id === e.target.value);
                    setNewAppt({ ...newAppt, client_id: e.target.value, client_name: cl?.name || '', client_email: cl?.email || '', client_phone: cl?.phone || '' });
                  }}>
                  <option value="">New client / walk-in</option>
                  {clients.map((cl) => <option key={cl.client_id} value={cl.client_id}>{cl.name}{cl.email ? ` (${cl.email})` : ''}</option>)}
                </select>
              </div>
            )}
            {!newAppt.client_id && (
              <>
                <div>
                  <Label className="text-sm font-medium">Client name *</Label>
                  <div className="relative mt-1.5">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
                    <Input value={newAppt.client_name} onChange={(e) => setNewAppt({ ...newAppt, client_name: e.target.value })} placeholder="Client name" className="pl-9" data-testid="client-name-input" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input type="tel" inputMode="tel" value={newAppt.client_phone} onChange={(e) => setNewAppt({ ...newAppt, client_phone: e.target.value })} placeholder="Mobile (for text reminders)" data-testid="client-phone-input" />
                  <Input type="email" inputMode="email" value={newAppt.client_email} onChange={(e) => setNewAppt({ ...newAppt, client_email: e.target.value })} placeholder="Email (optional)" data-testid="client-email-input" />
                </div>
              </>
            )}
            <div>
              <Label className="text-sm font-medium">Notes</Label>
              <textarea value={newAppt.notes} onChange={(e) => setNewAppt({ ...newAppt, notes: e.target.value })} rows={2} className="mt-1.5 input-swiss resize-none" data-testid="appt-notes" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowNew(false)}><X className="w-4 h-4 mr-1" />Cancel</Button>
              <Button className="flex-1 btn-primary" onClick={createAppointment} disabled={saving} data-testid="create-appointment-btn">
                {saving ? 'Saving...' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
};

export default CalendarPage;
