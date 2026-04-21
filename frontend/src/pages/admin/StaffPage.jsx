import React, { useState, useEffect, useRef } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import { getTheme } from '../../config/industryThemes';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, User, Clock, DollarSign, Mail, Phone, Star, CheckSquare, Square, Camera, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const StaffPage = () => {
  const { token, tenant } = useAuth();
  const theme = getTheme(tenant?.industry);
  const [activeTab, setActiveTab] = useState('staff');
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStaffDialog, setShowStaffDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', phone: '', role: '' });
  const [selectedServices, setSelectedServices] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
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
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await axios.post(`${API}/upload/image`, fd, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      setAvatarUrl(`${BACKEND_URL}${res.data.url}`); toast.success('Photo uploaded');
    } catch { toast.error('Upload failed'); } finally { setUploading(false); }
  };

  const openAddStaff = () => { setEditingStaff(null); setStaffForm({ name: '', email: '', phone: '', role: '' }); setSelectedServices([]); setAvatarUrl(null); setShowStaffDialog(true); };
  const openEditStaff = (m) => { setEditingStaff(m); setStaffForm({ name: m.name, email: m.email || '', phone: m.phone || '', role: m.role || '' }); setSelectedServices(m.services || []); setAvatarUrl(m.avatar_url || null); setShowStaffDialog(true); };

  const handleSaveStaff = async () => {
    if (!staffForm.name) { toast.error('Name required'); return; }
    try {
      const p = { ...staffForm, services: selectedServices, avatar_url: avatarUrl || null };
      if (!p.email) delete p.email; if (!p.phone) delete p.phone;
      if (editingStaff) { await axios.put(`${API}/staff/${editingStaff.staff_id}`, p, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Updated'); }
      else { await axios.post(`${API}/staff`, p, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Added'); }
      setShowStaffDialog(false); fetchData();
    } catch (error) { const d = error.response?.data?.detail; toast.error(typeof d === 'string' ? d : Array.isArray(d) ? d.map(x => x.msg || x).join(', ') : 'Failed'); }
  };

  const handleDeleteStaff = async (id) => { if (!window.confirm('Remove this team member?')) return; try { await axios.delete(`${API}/staff/${id}`, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Removed'); fetchData(); } catch { toast.error('Failed'); } };
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
        <div className="flex gap-1 mb-8 p-1 bg-[#F7F3EE] rounded-full w-fit">
          {[
            { key: 'staff', label: theme.terminology.staff, count: staff.length, icon: User },
            { key: 'services', label: 'Services', count: services.length, icon: Star },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-2.5 text-sm rounded-full transition-all flex items-center gap-2 ${
                activeTab === tab.key ? 'bg-white shadow-sm text-[#2C2A29] font-medium' : 'text-[#9E948F] hover:text-[#706B68]'
              }`}
            >
              <tab.icon className="w-4 h-4" strokeWidth={1.5} /> {tab.label} <span className="text-xs opacity-50">({tab.count})</span>
            </button>
          ))}
        </div>

        {loading ? <div className="text-center py-16 text-[#9E948F]">Loading...</div> : activeTab === 'staff' ? (
          <div>
            <button onClick={openAddStaff} className="w-full mb-6 py-3.5 rounded-full bg-[#2C2A29] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#4A4745] transition-all hover:shadow-lg hover:scale-[1.01]" data-testid="add-staff-btn">
              <Plus className="w-4 h-4" strokeWidth={2} /> Add {theme.terminology.staff.replace(/s$/, '')}
            </button>
            {staff.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="w-16 h-16 rounded-full bg-[#F7F3EE] flex items-center justify-center mx-auto mb-4"><User className="w-7 h-7 text-[#9E948F]" strokeWidth={1.5} /></div>
                <p className="text-[#706B68] font-medium">No team members yet</p>
                <p className="text-sm text-[#9E948F] mt-1">Add your first stylist to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {staff.map((m, i) => {
                  const assigned = getServiceNames(m.services);
                  const c = CARD_COLORS[i % CARD_COLORS.length];
                  return (
                    <div key={m.staff_id} className="bg-white rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5 group" data-testid={`staff-card-${m.staff_id}`}>
                      <div className="h-2" style={{ backgroundColor: c }} />
                      <div className="p-6">
                        <div className="flex items-start gap-4">
                          {m.avatar_url ? (
                            <img src={m.avatar_url} alt={m.name} className="w-16 h-16 rounded-2xl object-cover" />
                          ) : (
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-['Cormorant_Garamond'] font-light" style={{ backgroundColor: c, color: '#2C2A29' }}>{m.name?.charAt(0)}</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-['Cormorant_Garamond'] text-xl text-[#2C2A29]">{m.name}</h3>
                                <p className="text-xs tracking-[0.15em] uppercase text-[#9E948F] mt-0.5">{m.role || 'Team Member'}</p>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEditStaff(m)} className="p-2 rounded-xl text-[#9E948F] hover:text-[#2C2A29] hover:bg-[#F7F3EE] transition-colors"><Pencil className="w-4 h-4" strokeWidth={1.5} /></button>
                                <button onClick={() => handleDeleteStaff(m.staff_id)} className="p-2 rounded-xl text-[#9E948F] hover:text-[#B8868B] hover:bg-[#E8C5C8]/20 transition-colors"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></button>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs text-[#9E948F]">
                              {m.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{m.email}</span>}
                              {m.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{m.phone}</span>}
                            </div>
                            {assigned.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {assigned.slice(0, 4).map((n, j) => <span key={j} className="text-[10px] px-2.5 py-1 rounded-full bg-[#F7F3EE] text-[#706B68]">{n}</span>)}
                                {assigned.length > 4 && <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#F7F3EE] text-[#9E948F]">+{assigned.length - 4}</span>}
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
          /* Services Tab */
          <div>
            <button onClick={openAddService} className="w-full mb-6 py-3.5 rounded-full bg-[#2C2A29] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#4A4745] transition-all hover:shadow-lg hover:scale-[1.01]" data-testid="add-service-btn">
              <Plus className="w-4 h-4" strokeWidth={2} /> Add Service
            </button>
            {services.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="w-16 h-16 rounded-full bg-[#F7F3EE] flex items-center justify-center mx-auto mb-4"><Star className="w-7 h-7 text-[#9E948F]" strokeWidth={1.5} /></div>
                <p className="text-[#706B68] font-medium">No services yet</p>
                <p className="text-sm text-[#9E948F] mt-1">Add your menu of services</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden divide-y divide-[#F0EBE6]">
                {services.map((s) => (
                  <div key={s.service_id} className="px-6 py-5 flex items-center justify-between hover:bg-[#FCFCFA] transition-colors group" data-testid={`service-card-${s.service_id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-['Cormorant_Garamond'] text-lg text-[#2C2A29]">{s.name}</h3>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-[#F7F3EE] text-[#9E948F] flex items-center gap-1"><Clock className="w-3 h-3" strokeWidth={1.5} />{s.duration}m</span>
                      </div>
                      {s.description && <p className="text-sm text-[#9E948F] mt-1">{s.description}</p>}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-['Cormorant_Garamond'] text-xl text-[#2C2A29]">&euro;{s.price}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditService(s)} className="p-2 rounded-xl text-[#9E948F] hover:text-[#2C2A29] hover:bg-[#F7F3EE] transition-colors"><Pencil className="w-4 h-4" strokeWidth={1.5} /></button>
                        <button onClick={() => handleDeleteService(s.service_id)} className="p-2 rounded-xl text-[#9E948F] hover:text-[#B8868B] hover:bg-[#E8C5C8]/20 transition-colors"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Staff Dialog */}
        <Dialog open={showStaffDialog} onOpenChange={setShowStaffDialog}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border-[#F0EBE6]">
            <DialogHeader><DialogTitle className="font-['Cormorant_Garamond'] text-2xl font-light">{editingStaff ? 'Edit' : 'Add'} Team Member</DialogTitle><DialogDescription className="text-[#9E948F]">Profile details and service assignments</DialogDescription></DialogHeader>
            <div className="space-y-4 mt-3">
              <div className="flex flex-col items-center" data-testid="staff-photo-section">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {avatarUrl ? <img src={avatarUrl} alt="" className="w-20 h-20 rounded-2xl object-cover ring-2 ring-[#F0EBE6] group-hover:ring-[#B8868B] transition-colors" /> :
                    <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-[#E5DFD9] flex items-center justify-center bg-[#F7F3EE] group-hover:border-[#B8868B] transition-colors"><User className="w-8 h-8 text-[#9E948F]" strokeWidth={1.5} /></div>}
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#2C2A29] flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-110">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} data-testid="staff-photo-input" />
                <p className="text-[11px] text-[#9E948F] mt-2">Upload photo</p>
              </div>
              <div><Label className="text-xs text-[#9E948F] uppercase tracking-wider">Name</Label><Input value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} className="mt-1.5 h-11 rounded-xl bg-[#F7F3EE] border-transparent" data-testid="staff-name-input" /></div>
              <div><Label className="text-xs text-[#9E948F] uppercase tracking-wider">Role / Specialty</Label><Input value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value })} className="mt-1.5 h-11 rounded-xl bg-[#F7F3EE] border-transparent" placeholder="e.g. Senior Stylist" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-[#9E948F] uppercase tracking-wider">Email</Label><Input type="email" value={staffForm.email} onChange={e => setStaffForm({ ...staffForm, email: e.target.value })} className="mt-1.5 h-11 rounded-xl bg-[#F7F3EE] border-transparent" /></div>
                <div><Label className="text-xs text-[#9E948F] uppercase tracking-wider">Phone</Label><Input type="tel" value={staffForm.phone} onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })} className="mt-1.5 h-11 rounded-xl bg-[#F7F3EE] border-transparent" /></div>
              </div>
              {services.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-[#9E948F] uppercase tracking-wider">Services</Label>
                    <button onClick={() => setSelectedServices(selectedServices.length === services.length ? [] : services.map(s => s.service_id))} className="text-[11px] text-[#B8868B] font-medium">{selectedServices.length === services.length ? 'Clear' : 'Select All'}</button>
                  </div>
                  <div className="border border-[#F0EBE6] rounded-2xl overflow-hidden max-h-44 overflow-y-auto" data-testid="service-checkboxes">
                    {services.map(svc => {
                      const sel = selectedServices.includes(svc.service_id);
                      return (
                        <button key={svc.service_id} type="button" onClick={() => setSelectedServices(sel ? selectedServices.filter(x => x !== svc.service_id) : [...selectedServices, svc.service_id])}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-[#F0EBE6] last:border-0 ${sel ? 'bg-[#E8C5C8]/10' : 'hover:bg-[#F7F3EE]'}`} data-testid={`service-check-${svc.service_id}`}>
                          {sel ? <CheckSquare className="w-4 h-4 text-[#B8868B] shrink-0" /> : <Square className="w-4 h-4 text-[#E5DFD9] shrink-0" />}
                          <span className={`text-sm ${sel ? 'text-[#2C2A29] font-medium' : 'text-[#706B68]'}`}>{svc.name}</span>
                          <span className="text-[10px] text-[#9E948F] ml-auto">{svc.duration}m</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-[#9E948F] mt-1">{selectedServices.length}/{services.length} selected</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 h-11 rounded-full border-[#E5DFD9] text-[#706B68]" onClick={() => setShowStaffDialog(false)}>Cancel</Button>
                <Button className="flex-1 h-11 rounded-full bg-[#2C2A29] text-white hover:bg-[#4A4745]" onClick={handleSaveStaff} data-testid="save-staff-btn">Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Service Dialog */}
        <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
          <DialogContent className="sm:max-w-sm rounded-3xl border-[#F0EBE6]">
            <DialogHeader><DialogTitle className="font-['Cormorant_Garamond'] text-2xl font-light">{editingService ? 'Edit' : 'Add'} Service</DialogTitle><DialogDescription className="text-[#9E948F]">Service details and pricing</DialogDescription></DialogHeader>
            <div className="space-y-4 mt-3">
              <div><Label className="text-xs text-[#9E948F] uppercase tracking-wider">Name</Label><Input value={serviceForm.name} onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })} className="mt-1.5 h-11 rounded-xl bg-[#F7F3EE] border-transparent" placeholder="e.g. Women's Cut & Blow Dry" /></div>
              <div><Label className="text-xs text-[#9E948F] uppercase tracking-wider">Description</Label><Input value={serviceForm.description} onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })} className="mt-1.5 h-11 rounded-xl bg-[#F7F3EE] border-transparent" placeholder="Optional description" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-[#9E948F] uppercase tracking-wider">Duration (min)</Label><Input type="number" value={serviceForm.duration} onChange={e => setServiceForm({ ...serviceForm, duration: parseInt(e.target.value) || 30 })} className="mt-1.5 h-11 rounded-xl bg-[#F7F3EE] border-transparent" /></div>
                <div><Label className="text-xs text-[#9E948F] uppercase tracking-wider">Price (&euro;)</Label><Input type="number" value={serviceForm.price} onChange={e => setServiceForm({ ...serviceForm, price: parseFloat(e.target.value) || 0 })} className="mt-1.5 h-11 rounded-xl bg-[#F7F3EE] border-transparent" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 h-11 rounded-full border-[#E5DFD9] text-[#706B68]" onClick={() => setShowServiceDialog(false)}>Cancel</Button>
                <Button className="flex-1 h-11 rounded-full bg-[#2C2A29] text-white hover:bg-[#4A4745]" onClick={handleSaveService}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TenantLayout>
  );
};

export default StaffPage;
