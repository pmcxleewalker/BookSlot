import React, { useState, useEffect, useRef } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import { getTheme } from '../../config/industryThemes';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, User, Clock, DollarSign, Mail, Phone, Star, CheckSquare, Square, Camera, Loader2, ChevronRight, Shield, CalendarOff, Palette, Save } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
const COLOR_OPTIONS = ['#C4898E', '#D4A373', '#7BA07B', '#9AADCC', '#B8A0C8', '#E8C5C8', '#2C2A29', '#706B68'];

const StaffPage = () => {
  const { token, tenant } = useAuth();
  const theme = getTheme(tenant?.industry);
  const [activeTab, setActiveTab] = useState('staff');
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Staff form
  const [showStaffDialog, setShowStaffDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [dialogTab, setDialogTab] = useState('details');
  const [staffForm, setStaffForm] = useState({ name: '', email: '', phone: '', role: '' });
  const [selectedServices, setSelectedServices] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [colorTag, setColorTag] = useState('#C4898E');
  const [bookableOnline, setBookableOnline] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [workingHours, setWorkingHours] = useState({});
  const [permissions, setPermissions] = useState({ role: 'staff', can_view_all_bookings: false, can_edit_services: false, can_manage_staff: false, can_view_reports: false, can_manage_customers: true });
  const fileInputRef = useRef(null);

  // Service form
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [serviceForm, setServiceForm] = useState({ name: '', duration: 30, price: 0, description: '' });

  useEffect(() => { fetchData(); }, []);
  const fetchData = async () => {
    try {
      const [s, sv] = await Promise.all([
        axios.get(`${API}/staff`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setStaff(s.data.staff || []); setServices(sv.data.services || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('JPEG, PNG, or WebP only'); return; }
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await axios.post(`${API}/upload/image`, fd, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      setAvatarUrl(`${BACKEND_URL}${res.data.url}`); toast.success('Photo uploaded');
    } catch { toast.error('Upload failed'); } finally { setUploading(false); }
  };

  const defaultHours = () => DAYS.reduce((acc, d) => {
    const isWeekend = d === 'saturday' || d === 'sunday';
    acc[d] = { enabled: !isWeekend, start: '09:00', end: '17:00', break_start: '13:00', break_end: '14:00' };
    return acc;
  }, {});

  const openAddStaff = () => {
    setEditingStaff(null); setDialogTab('details');
    setStaffForm({ name: '', email: '', phone: '', role: '' }); setSelectedServices([]); setAvatarUrl(null);
    setColorTag('#C4898E'); setBookableOnline(true); setIsActive(true);
    setWorkingHours(defaultHours());
    setPermissions({ role: 'staff', can_view_all_bookings: false, can_edit_services: false, can_manage_staff: false, can_view_reports: false, can_manage_customers: true });
    setShowStaffDialog(true);
  };

  const openEditStaff = (m) => {
    setEditingStaff(m); setDialogTab('details');
    setStaffForm({ name: m.name, email: m.email || '', phone: m.phone || '', role: m.role || '' });
    setSelectedServices(m.services || []); setAvatarUrl(m.avatar_url || null);
    setColorTag(m.color || '#C4898E'); setBookableOnline(m.bookable_online !== false);
    setIsActive(m.is_active !== false);
    const wh = m.working_hours || {};
    const parsed = DAYS.reduce((acc, d) => {
      const dayData = wh[d];
      if (dayData) {
        acc[d] = { enabled: true, start: dayData.start || '09:00', end: dayData.end || '17:00', break_start: dayData.breaks?.[0]?.start || dayData.break_start || '', break_end: dayData.breaks?.[0]?.end || dayData.break_end || '' };
      } else { acc[d] = { enabled: false, start: '09:00', end: '17:00', break_start: '', break_end: '' }; }
      return acc;
    }, {});
    setWorkingHours(parsed);
    setPermissions({ role: m.role || 'staff', can_view_all_bookings: m.can_view_all_bookings || false, can_edit_services: m.can_edit_services || false, can_manage_staff: m.can_manage_staff || false, can_view_reports: m.can_view_reports || false, can_manage_customers: m.can_manage_customers !== false });
    setShowStaffDialog(true);
  };

  const handleSaveStaff = async () => {
    if (!staffForm.name) { toast.error('Name required'); return; }
    try {
      const whFormatted = {};
      DAYS.forEach(d => {
        if (workingHours[d]?.enabled) {
          const breaks = [];
          if (workingHours[d].break_start && workingHours[d].break_end) breaks.push({ start: workingHours[d].break_start, end: workingHours[d].break_end });
          whFormatted[d] = { start: workingHours[d].start, end: workingHours[d].end, breaks };
        }
      });
      const payload = {
        ...staffForm, services: selectedServices, avatar_url: avatarUrl || null,
        color: colorTag, bookable_online: bookableOnline, is_active: isActive,
        working_hours: whFormatted, ...permissions,
      };
      if (!payload.email) delete payload.email; if (!payload.phone) delete payload.phone;
      if (editingStaff) { await axios.put(`${API}/staff/${editingStaff.staff_id}`, payload, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Updated'); }
      else { await axios.post(`${API}/staff`, payload, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Added'); }
      setShowStaffDialog(false); fetchData();
    } catch (error) { const d = error.response?.data?.detail; toast.error(typeof d === 'string' ? d : Array.isArray(d) ? d.map(x => x.msg || x).join(', ') : 'Failed'); }
  };

  const handleDeleteStaff = async (id) => { if (!window.confirm('Remove this team member?')) return; try { await axios.delete(`${API}/staff/${id}`, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Removed'); fetchData(); } catch { toast.error('Failed'); } };

  // Service handlers
  const openAddService = () => { setEditingService(null); setServiceForm({ name: '', duration: 30, price: 0, description: '' }); setShowServiceDialog(true); };
  const openEditService = (s) => { setEditingService(s); setServiceForm({ name: s.name, duration: s.duration || 30, price: s.price || 0, description: s.description || '' }); setShowServiceDialog(true); };
  const handleSaveService = async () => {
    if (!serviceForm.name) { toast.error('Name required'); return; }
    try {
      if (editingService) { await axios.put(`${API}/services/${editingService.service_id}`, serviceForm, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Updated'); }
      else { await axios.post(`${API}/services`, serviceForm, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Added'); }
      setShowServiceDialog(false); fetchData();
    } catch (error) { const d = error.response?.data?.detail; toast.error(typeof d === 'string' ? d : 'Failed'); }
  };
  const handleDeleteService = async (id) => { if (!window.confirm('Remove this service?')) return; try { await axios.delete(`${API}/services/${id}`, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Removed'); fetchData(); } catch { toast.error('Failed'); } };

  const getServiceNames = (ids) => ids?.map(id => services.find(s => s.service_id === id)?.name).filter(Boolean) || [];
  const CARD_COLORS = ['#E8C5C8', '#E5DFD9', '#C8D5C8', '#D4D9E8', '#E8D9C8', '#C8D8E8'];

  return (
    <TenantLayout title="Team">
      <div className="max-w-4xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 p-1.5 bg-[#F7F3EE] rounded-full w-fit">
          {[
            { key: 'staff', label: theme.terminology.staff, count: staff.length, icon: User },
            { key: 'services', label: 'Services', count: services.length, icon: Star },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-2.5 text-sm rounded-full transition-all flex items-center gap-2 ${activeTab === tab.key ? 'bg-white shadow-sm text-[#2C2A29] font-medium' : 'text-[#9E948F] hover:text-[#706B68]'}`}>
              <tab.icon className="w-4 h-4" strokeWidth={1.5} /> {tab.label} <span className="text-xs opacity-50">({tab.count})</span>
            </button>
          ))}
        </div>

        {loading ? <div className="text-center py-16 text-[#9E948F]">Loading...</div> : activeTab === 'staff' ? (
          <div>
            <button onClick={openAddStaff} className="w-full mb-6 py-3.5 rounded-full bg-[#2C2A29] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#3D3A38] transition-all hover:shadow-lg hover:scale-[1.01]" data-testid="add-staff-btn">
              <Plus className="w-4 h-4" strokeWidth={2} /> Add Team Member
            </button>
            {staff.length === 0 ? (
              <EmptyState icon={User} title="No team members yet" sub="Add your first stylist to get started" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {staff.map((m, i) => {
                  const assigned = getServiceNames(m.services);
                  const activeDays = DAYS.filter(d => m.working_hours?.[d]).length;
                  return (
                    <div key={m.staff_id} className={`bg-white rounded-3xl overflow-hidden shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-[#F0EBE6]/60 hover:shadow-[0_8px_32px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5 group ${!m.is_active ? 'opacity-50' : ''}`} data-testid={`staff-card-${m.staff_id}`}>
                      <div className="h-1.5" style={{ backgroundColor: m.color || CARD_COLORS[i % CARD_COLORS.length] }} />
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          {m.avatar_url ? <img src={m.avatar_url} alt={m.name} className="w-14 h-14 rounded-2xl object-cover" /> :
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-['Cormorant_Garamond'] font-light" style={{ backgroundColor: m.color || CARD_COLORS[i % CARD_COLORS.length], color: '#fff' }}>{m.name?.charAt(0)}</div>}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-['Cormorant_Garamond'] text-xl text-[#2C2A29]">{m.name}</h3>
                                <p className="text-[11px] tracking-[0.1em] uppercase text-[#9E948F]">{m.role || 'Team Member'}</p>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEditStaff(m)} className="p-2 rounded-xl text-[#9E948F] hover:text-[#2C2A29] hover:bg-[#F7F3EE] transition-colors"><Pencil className="w-4 h-4" strokeWidth={1.5} /></button>
                                <button onClick={() => handleDeleteStaff(m.staff_id)} className="p-2 rounded-xl text-[#9E948F] hover:text-[#C4898E] hover:bg-[#E8C5C8]/20 transition-colors"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></button>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#F7F3EE] text-[#706B68]">{activeDays} days/week</span>
                              {m.bookable_online !== false && <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#7BA07B]/10 text-[#7BA07B]">Online Booking</span>}
                              {!m.is_active && <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#C4898E]/10 text-[#C4898E]">Inactive</span>}
                            </div>
                            {assigned.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {assigned.slice(0, 3).map((n, j) => <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF8F6] text-[#9E948F]">{n}</span>)}
                                {assigned.length > 3 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF8F6] text-[#9E948F]">+{assigned.length - 3}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ===== SERVICES TAB ===== */
          <div>
            <button onClick={openAddService} className="w-full mb-6 py-3.5 rounded-full bg-[#2C2A29] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#3D3A38] transition-all hover:shadow-lg hover:scale-[1.01]" data-testid="add-service-btn">
              <Plus className="w-4 h-4" strokeWidth={2} /> Add Service
            </button>
            {services.length === 0 ? <EmptyState icon={Star} title="No services yet" sub="Add your menu of services" /> : (
              <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-[#F0EBE6]/60 overflow-hidden divide-y divide-[#F0EBE6]">
                {services.map(s => (
                  <div key={s.service_id} className="px-6 py-5 flex items-center justify-between hover:bg-[#FDFCFA] transition-colors group" data-testid={`service-card-${s.service_id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-['Cormorant_Garamond'] text-lg text-[#2C2A29]">{s.name}</h3>
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#F7F3EE] text-[#9E948F] flex items-center gap-1"><Clock className="w-3 h-3" strokeWidth={1.5} />{s.duration}m</span>
                      </div>
                      {s.description && <p className="text-sm text-[#9E948F] mt-1">{s.description}</p>}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-['Cormorant_Garamond'] text-xl text-[#2C2A29]">&euro;{s.price}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditService(s)} className="p-2 rounded-xl text-[#9E948F] hover:text-[#2C2A29] hover:bg-[#F7F3EE] transition-colors"><Pencil className="w-4 h-4" strokeWidth={1.5} /></button>
                        <button onClick={() => handleDeleteService(s.service_id)} className="p-2 rounded-xl text-[#9E948F] hover:text-[#C4898E] hover:bg-[#E8C5C8]/20 transition-colors"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== STAFF DIALOG (Multi-tab) ===== */}
        <Dialog open={showStaffDialog} onOpenChange={setShowStaffDialog}>
          <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-3xl border-[#F0EBE6]">
            <DialogHeader>
              <DialogTitle className="font-['Cormorant_Garamond'] text-2xl font-light">{editingStaff ? 'Edit' : 'Add'} Team Member</DialogTitle>
              <DialogDescription className="text-[#9E948F]">Profile, schedule, and permissions</DialogDescription>
            </DialogHeader>

            {/* Dialog Tabs */}
            <div className="flex gap-1 p-1 bg-[#F7F3EE] rounded-full mb-4 overflow-x-auto">
              {[
                { key: 'details', label: 'Details', icon: User },
                { key: 'schedule', label: 'Schedule', icon: Clock },
                { key: 'services', label: 'Services', icon: Star },
                { key: 'permissions', label: 'Access', icon: Shield },
              ].map(t => (
                <button key={t.key} onClick={() => setDialogTab(t.key)}
                  className={`flex-1 px-3 py-2 text-xs rounded-full transition-all flex items-center justify-center gap-1.5 ${dialogTab === t.key ? 'bg-white shadow-sm text-[#2C2A29] font-medium' : 'text-[#9E948F]'}`}>
                  <t.icon className="w-3.5 h-3.5" strokeWidth={1.5} /> {t.label}
                </button>
              ))}
            </div>

            {/* TAB: Details */}
            {dialogTab === 'details' && (
              <div className="space-y-4">
                <div className="flex flex-col items-center" data-testid="staff-photo-section">
                  <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    {avatarUrl ? <img src={avatarUrl} alt="" className="w-20 h-20 rounded-2xl object-cover ring-2 ring-[#EDE8E3]" /> :
                      <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-[#E5DFD9] flex items-center justify-center bg-[#FAF8F6]"><User className="w-8 h-8 text-[#9E948F]" /></div>}
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#2C2A29] flex items-center justify-center text-white shadow-md">
                      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} data-testid="staff-photo-input" />
                </div>
                <Field label="Name"><Input value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} data-testid="staff-name-input" /></Field>
                <Field label="Role / Specialty"><Input value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value })} placeholder="e.g. Senior Stylist" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email"><Input type="email" value={staffForm.email} onChange={e => setStaffForm({ ...staffForm, email: e.target.value })} /></Field>
                  <Field label="Phone"><Input type="tel" value={staffForm.phone} onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })} /></Field>
                </div>
                <div>
                  <Label className="text-xs tracking-[0.1em] uppercase text-[#9E948F] font-medium flex items-center gap-1"><Palette className="w-3 h-3" /> Calendar Color</Label>
                  <div className="flex gap-2 mt-2">
                    {COLOR_OPTIONS.map(c => (
                      <button key={c} onClick={() => setColorTag(c)} className={`w-8 h-8 rounded-xl transition-all ${colorTag === c ? 'ring-2 ring-offset-2 ring-[#2C2A29] scale-110' : 'hover:scale-105'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 border-t border-[#F0EBE6]">
                  <div><p className="text-sm font-medium text-[#2C2A29]">Bookable Online</p><p className="text-xs text-[#9E948F]">Clients can book this person directly</p></div>
                  <Switch checked={bookableOnline} onCheckedChange={setBookableOnline} />
                </div>
                <div className="flex items-center justify-between py-3 border-t border-[#F0EBE6]">
                  <div><p className="text-sm font-medium text-[#2C2A29]">Active</p><p className="text-xs text-[#9E948F]">Show in calendar and booking</p></div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>
            )}

            {/* TAB: Schedule */}
            {dialogTab === 'schedule' && (
              <div className="space-y-2" data-testid="staff-schedule">
                <p className="text-xs text-[#9E948F] mb-3">Set working hours for each day. Disable days they don't work.</p>
                {DAYS.map(day => {
                  const dh = workingHours[day] || { enabled: false, start: '09:00', end: '17:00', break_start: '', break_end: '' };
                  return (
                    <div key={day} className={`rounded-2xl p-4 border transition-colors ${dh.enabled ? 'bg-white border-[#EDE8E3]' : 'bg-[#FAF8F6] border-transparent'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-[#2C2A29] w-12">{DAY_LABELS[day]}</span>
                        <Switch checked={dh.enabled} onCheckedChange={v => setWorkingHours({ ...workingHours, [day]: { ...dh, enabled: v } })} />
                      </div>
                      {dh.enabled && (
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          <div><p className="text-[10px] text-[#9E948F] mb-1">Start</p><input type="time" value={dh.start} onChange={e => setWorkingHours({ ...workingHours, [day]: { ...dh, start: e.target.value } })} className="w-full h-9 px-2 text-xs bg-[#FAF8F6] rounded-lg border border-[#EDE8E3]" /></div>
                          <div><p className="text-[10px] text-[#9E948F] mb-1">End</p><input type="time" value={dh.end} onChange={e => setWorkingHours({ ...workingHours, [day]: { ...dh, end: e.target.value } })} className="w-full h-9 px-2 text-xs bg-[#FAF8F6] rounded-lg border border-[#EDE8E3]" /></div>
                          <div><p className="text-[10px] text-[#9E948F] mb-1">Break Start</p><input type="time" value={dh.break_start} onChange={e => setWorkingHours({ ...workingHours, [day]: { ...dh, break_start: e.target.value } })} className="w-full h-9 px-2 text-xs bg-[#FAF8F6] rounded-lg border border-[#EDE8E3]" /></div>
                          <div><p className="text-[10px] text-[#9E948F] mb-1">Break End</p><input type="time" value={dh.break_end} onChange={e => setWorkingHours({ ...workingHours, [day]: { ...dh, break_end: e.target.value } })} className="w-full h-9 px-2 text-xs bg-[#FAF8F6] rounded-lg border border-[#EDE8E3]" /></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB: Services */}
            {dialogTab === 'services' && (
              <div data-testid="service-checkboxes">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-[#9E948F]">Assign services this person can perform</p>
                  <button onClick={() => setSelectedServices(selectedServices.length === services.length ? [] : services.map(s => s.service_id))} className="text-[11px] text-[#C4898E] font-medium">{selectedServices.length === services.length ? 'Clear All' : 'Select All'}</button>
                </div>
                <div className="border border-[#F0EBE6] rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                  {services.map(svc => {
                    const sel = selectedServices.includes(svc.service_id);
                    return (
                      <button key={svc.service_id} type="button" onClick={() => setSelectedServices(sel ? selectedServices.filter(x => x !== svc.service_id) : [...selectedServices, svc.service_id])}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#F0EBE6] last:border-0 ${sel ? 'bg-[#C4898E]/5' : 'hover:bg-[#FAF8F6]'}`} data-testid={`service-check-${svc.service_id}`}>
                        {sel ? <CheckSquare className="w-4 h-4 text-[#C4898E] shrink-0" /> : <Square className="w-4 h-4 text-[#E5DFD9] shrink-0" />}
                        <span className={`text-sm flex-1 ${sel ? 'text-[#2C2A29] font-medium' : 'text-[#706B68]'}`}>{svc.name}</span>
                        <span className="text-[10px] text-[#9E948F]">{svc.duration}m · &euro;{svc.price}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-[#9E948F] mt-2">{selectedServices.length}/{services.length} selected</p>
              </div>
            )}

            {/* TAB: Permissions */}
            {dialogTab === 'permissions' && (
              <div className="space-y-3" data-testid="staff-permissions">
                <Field label="Role">
                  <select value={permissions.role} onChange={e => setPermissions({ ...permissions, role: e.target.value })} className="w-full h-11 px-4 text-sm bg-[#FAF8F6] rounded-xl border border-[#EDE8E3]">
                    <option value="owner">Owner</option><option value="admin">Manager</option><option value="staff">Staff</option>
                  </select>
                </Field>
                <p className="text-xs text-[#9E948F] pt-2">Control what this person can access:</p>
                {[
                  { key: 'can_view_all_bookings', label: 'View all calendars', desc: 'See bookings for all team members' },
                  { key: 'can_edit_services', label: 'Manage services', desc: 'Add, edit, and remove services' },
                  { key: 'can_manage_staff', label: 'Manage team', desc: 'Add and edit team members' },
                  { key: 'can_view_reports', label: 'View reports', desc: 'Access business reports and analytics' },
                  { key: 'can_manage_customers', label: 'View client data', desc: 'See client contact information' },
                ].map(p => (
                  <div key={p.key} className="flex items-center justify-between py-3 border-b border-[#F0EBE6] last:border-0">
                    <div><p className="text-sm text-[#2C2A29]">{p.label}</p><p className="text-xs text-[#9E948F]">{p.desc}</p></div>
                    <Switch checked={permissions[p.key]} onCheckedChange={v => setPermissions({ ...permissions, [p.key]: v })} />
                  </div>
                ))}
              </div>
            )}

            {/* Save Button */}
            <div className="flex gap-3 pt-4 border-t border-[#F0EBE6] mt-4">
              <Button variant="outline" className="flex-1 h-11 rounded-full border-[#E5DFD9] text-[#706B68]" onClick={() => setShowStaffDialog(false)}>Cancel</Button>
              <Button className="flex-1 h-11 rounded-full bg-[#2C2A29] text-white hover:bg-[#3D3A38] transition-all" onClick={handleSaveStaff} data-testid="save-staff-btn">
                <Save className="w-4 h-4 mr-2" strokeWidth={1.5} /> Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Service Dialog */}
        <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
          <DialogContent className="sm:max-w-sm rounded-3xl border-[#F0EBE6]">
            <DialogHeader><DialogTitle className="font-['Cormorant_Garamond'] text-2xl font-light">{editingService ? 'Edit' : 'Add'} Service</DialogTitle><DialogDescription className="text-[#9E948F]">Service details and pricing</DialogDescription></DialogHeader>
            <div className="space-y-4 mt-3">
              <Field label="Name"><Input value={serviceForm.name} onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })} placeholder="e.g. Women's Cut & Blow Dry" /></Field>
              <Field label="Description"><Input value={serviceForm.description} onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })} placeholder="Optional" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Duration (min)"><Input type="number" value={serviceForm.duration} onChange={e => setServiceForm({ ...serviceForm, duration: parseInt(e.target.value) || 30 })} /></Field>
                <Field label="Price (&euro;)"><Input type="number" value={serviceForm.price} onChange={e => setServiceForm({ ...serviceForm, price: parseFloat(e.target.value) || 0 })} /></Field>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 h-11 rounded-full border-[#E5DFD9] text-[#706B68]" onClick={() => setShowServiceDialog(false)}>Cancel</Button>
                <Button className="flex-1 h-11 rounded-full bg-[#2C2A29] text-white hover:bg-[#3D3A38]" onClick={handleSaveService}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TenantLayout>
  );
};

const Field = ({ label, children }) => (
  <div>
    <Label className="text-xs tracking-[0.1em] uppercase text-[#9E948F] font-medium">{label}</Label>
    <div className="mt-1.5 [&>input]:h-11 [&>input]:rounded-xl [&>input]:bg-[#FAF8F6] [&>input]:border-[#EDE8E3]">{children}</div>
  </div>
);

const EmptyState = ({ icon: Icon, title, sub }) => (
  <div className="text-center py-16 bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-[#F0EBE6]/60">
    <div className="w-16 h-16 rounded-full bg-[#F7F3EE] flex items-center justify-center mx-auto mb-4"><Icon className="w-7 h-7 text-[#9E948F]" strokeWidth={1.5} /></div>
    <p className="text-[#706B68] font-medium">{title}</p>
    <p className="text-sm text-[#9E948F] mt-1">{sub}</p>
  </div>
);

export default StaffPage;
