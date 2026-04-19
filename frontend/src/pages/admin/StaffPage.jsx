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
import { Plus, Pencil, Trash2, User, Clock, DollarSign, Mail, Phone as PhoneIcon, Star, CheckSquare, Square, Camera, Loader2 } from 'lucide-react';

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
  const [staffForm, setStaffForm] = useState({ name: '', email: '', phone: '', role: 'staff' });
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
      const [staffRes, servicesRes] = await Promise.all([
        axios.get(`${API}/staff`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setStaff(staffRes.data.staff || []);
      setServices(servicesRes.data.services || []);
    } catch (error) { console.error('Failed:', error); }
    finally { setLoading(false); }
  };

  // Photo upload handler
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a JPEG, PNG, or WebP image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API}/upload/image`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      const url = `${BACKEND_URL}${res.data.url}`;
      setAvatarUrl(url);
      toast.success('Photo uploaded');
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const openAddStaff = () => {
    setEditingStaff(null);
    setStaffForm({ name: '', email: '', phone: '', role: 'staff' });
    setSelectedServices([]);
    setAvatarUrl(null);
    setShowStaffDialog(true);
  };

  const openEditStaff = (member) => {
    setEditingStaff(member);
    setStaffForm({ name: member.name, email: member.email || '', phone: member.phone || '', role: member.role || 'staff' });
    setSelectedServices(member.services || []);
    setAvatarUrl(member.avatar_url || null);
    setShowStaffDialog(true);
  };

  const toggleService = (serviceId) => {
    setSelectedServices(prev =>
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    );
  };

  const selectAllServices = () => {
    setSelectedServices(selectedServices.length === services.length ? [] : services.map(s => s.service_id));
  };

  const handleSaveStaff = async () => {
    if (!staffForm.name) { toast.error('Name is required'); return; }
    try {
      const payload = { ...staffForm, services: selectedServices, avatar_url: avatarUrl || null };
      if (!payload.email) delete payload.email;
      if (!payload.phone) delete payload.phone;
      if (editingStaff) {
        await axios.put(`${API}/staff/${editingStaff.staff_id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Updated');
      } else {
        await axios.post(`${API}/staff`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Added');
      }
      setShowStaffDialog(false);
      fetchData();
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(d => d.msg || d).join(', ') : 'Failed to save';
      toast.error(msg);
    }
  };

  const handleDeleteStaff = async (id) => {
    if (!window.confirm('Delete this team member?')) return;
    try { await axios.delete(`${API}/staff/${id}`, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Deleted'); fetchData(); }
    catch { toast.error('Failed'); }
  };

  const openAddService = () => { setEditingService(null); setServiceForm({ name: '', duration: 30, price: 0, description: '' }); setShowServiceDialog(true); };
  const openEditService = (s) => { setEditingService(s); setServiceForm({ name: s.name, duration: s.duration || 30, price: s.price || 0, description: s.description || '' }); setShowServiceDialog(true); };
  const handleSaveService = async () => {
    if (!serviceForm.name) { toast.error('Name is required'); return; }
    try {
      if (editingService) { await axios.put(`${API}/services/${editingService.service_id}`, serviceForm, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Updated'); }
      else { await axios.post(`${API}/services`, serviceForm, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Added'); }
      setShowServiceDialog(false); fetchData();
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(d => d.msg || d).join(', ') : 'Failed to save';
      toast.error(msg);
    }
  };
  const handleDeleteService = async (id) => {
    if (!window.confirm('Delete this service?')) return;
    try { await axios.delete(`${API}/services/${id}`, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Deleted'); fetchData(); }
    catch { toast.error('Failed'); }
  };

  const getAvatarGradient = (idx) => {
    const gradients = [['#e11d48', '#be185d'], ['#0284c7', '#0369a1'], ['#059669', '#047857'], ['#7c3aed', '#6d28d9'], ['#ea580c', '#c2410c'], ['#0891b2', '#0e7490']];
    return gradients[idx % gradients.length];
  };

  const getServiceNames = (serviceIds) => {
    if (!serviceIds || serviceIds.length === 0) return null;
    return serviceIds.map(id => services.find(s => s.service_id === id)?.name).filter(Boolean);
  };

  // Render staff avatar - photo or gradient initial
  const StaffAvatar = ({ member, idx, size = 48 }) => {
    if (member.avatar_url) {
      return (
        <img
          src={member.avatar_url}
          alt={member.name}
          className="rounded-xl object-cover shrink-0"
          style={{ width: size, height: size }}
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
        />
      );
    }
    const [c1, c2] = getAvatarGradient(idx);
    return (
      <div className="rounded-xl flex items-center justify-center text-white font-bold shadow-sm shrink-0"
        style={{ width: size, height: size, background: `linear-gradient(135deg, ${c1}, ${c2})`, fontSize: size * 0.38 }}
      >
        {member.name?.charAt(0)?.toUpperCase()}
      </div>
    );
  };

  return (
    <TenantLayout title="Team">
      <div className="max-w-2xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-2xl" style={{ backgroundColor: theme.primaryLight }}>
          {[
            { key: 'staff', label: theme.terminology.staff, count: staff.length, icon: User },
            { key: 'services', label: 'Services', count: services.length, icon: Star },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2.5 px-4 text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${
                  activeTab === tab.key ? 'bg-white shadow-md text-gray-900 font-semibold' : 'text-gray-500'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label} <span className="text-xs opacity-60">({tab.count})</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : activeTab === 'staff' ? (
          <div>
            <Button onClick={openAddStaff}
              className="w-full mb-5 h-11 rounded-xl text-white shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
              data-testid="add-staff-btn"
            >
              <Plus className="w-4 h-4 mr-2" /> Add {theme.terminology.staff.replace(/s$/, '')}
            </Button>

            {staff.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                <User className="w-8 h-8 mx-auto mb-2" style={{ color: theme.primary + '60' }} />
                <p className="text-gray-500">No team members yet</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {staff.map((member, idx) => {
                  const assignedServices = getServiceNames(member.services);
                  return (
                    <div key={member.staff_id}
                      className="bg-white rounded-2xl p-4 border border-gray-200 hover:shadow-md transition-all group"
                      data-testid={`staff-card-${member.staff_id}`}
                    >
                      <div className="flex items-start gap-4">
                        <StaffAvatar member={member} idx={idx} size={52} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{member.name}</p>
                              <p className="text-sm text-gray-500">{member.role || 'Staff'}</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditStaff(member)} className="h-9 w-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteStaff(member.staff_id)} className="h-9 w-9 rounded-xl border border-red-200 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            {member.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{member.email}</span>}
                            {member.phone && <span className="flex items-center gap-1"><PhoneIcon className="w-3 h-3" />{member.phone}</span>}
                          </div>
                          {assignedServices && assignedServices.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {assignedServices.map((name, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: theme.primaryLight, color: theme.primary }}>{name}</span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-gray-300 mt-2 italic">No services assigned</p>
                          )}
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
            <Button onClick={openAddService}
              className="w-full mb-5 h-11 rounded-xl text-white shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
              data-testid="add-service-btn"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Service
            </Button>

            {services.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                <Star className="w-8 h-8 mx-auto mb-2" style={{ color: theme.primary + '60' }} />
                <p className="text-gray-500">No services yet</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {services.map((service) => (
                  <div key={service.service_id} className="bg-white rounded-2xl p-4 border border-gray-200 hover:shadow-md transition-all group" style={{ borderLeft: `4px solid ${theme.primary}` }} data-testid={`service-card-${service.service_id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{service.name}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-lg" style={{ backgroundColor: theme.primaryLight, color: theme.primary }}><Clock className="w-3.5 h-3.5" /> {service.duration}m</span>
                          <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700"><DollarSign className="w-3.5 h-3.5" /> &euro;{service.price}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditService(service)} className="h-9 w-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteService(service.service_id)} className="h-9 w-9 rounded-xl border border-red-200 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== Staff Dialog with Photo Upload + Service Checkboxes ===== */}
        <Dialog open={showStaffDialog} onOpenChange={setShowStaffDialog}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">{editingStaff ? 'Edit' : 'Add'} {theme.terminology.staff.replace(/s$/, '')}</DialogTitle>
              <DialogDescription className="text-xs text-gray-400">Fill in details, upload a photo, and assign services</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Photo Upload */}
              <div className="flex flex-col items-center" data-testid="staff-photo-section">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Staff" className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-200 group-hover:border-gray-400 transition-colors" />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center group-hover:border-gray-400 transition-colors" style={{ backgroundColor: theme.primaryLight }}>
                      <User className="w-8 h-8" style={{ color: theme.primary + '40' }} />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-110"
                    style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  data-testid="staff-photo-input"
                />
                <p className="text-[11px] text-gray-400 mt-2">Click to upload photo</p>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Name *</Label>
                <Input value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} className="mt-1 h-10 rounded-xl" placeholder="Full name" data-testid="staff-name-input" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Email</Label>
                <Input type="email" value={staffForm.email} onChange={e => setStaffForm({ ...staffForm, email: e.target.value })} className="mt-1 h-10 rounded-xl" placeholder="email@example.com" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Phone</Label>
                <Input type="tel" value={staffForm.phone} onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })} className="mt-1 h-10 rounded-xl" placeholder="+353..." />
              </div>

              {/* Service Checkboxes */}
              {services.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-gray-500">Assigned Services</Label>
                    <button type="button" onClick={selectAllServices} className="text-[11px] font-medium" style={{ color: theme.primary }}>
                      {selectedServices.length === services.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto" data-testid="service-checkboxes">
                    {services.map((svc) => {
                      const isSelected = selectedServices.includes(svc.service_id);
                      return (
                        <button key={svc.service_id} type="button" onClick={() => toggleService(svc.service_id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors border-b border-gray-100 last:border-0 ${isSelected ? '' : 'hover:bg-gray-50'}`}
                          style={isSelected ? { backgroundColor: theme.primaryLight } : {}}
                          data-testid={`service-check-${svc.service_id}`}
                        >
                          {isSelected ? <CheckSquare className="w-4 h-4 shrink-0" style={{ color: theme.primary }} /> : <Square className="w-4 h-4 shrink-0 text-gray-300" />}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${isSelected ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{svc.name}</p>
                          </div>
                          <span className="text-[10px] text-gray-400">{svc.duration}m</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{selectedServices.length}/{services.length} selected</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={() => setShowStaffDialog(false)}>Cancel</Button>
                <Button className="flex-1 h-10 rounded-xl text-white transition-all hover:shadow-lg active:scale-[0.98]"
                  style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
                  onClick={handleSaveStaff} data-testid="save-staff-btn"
                >Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Service Dialog */}
        <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">{editingService ? 'Edit' : 'Add'} Service</DialogTitle>
              <DialogDescription className="text-xs text-gray-400">Set service details and pricing</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label className="text-xs text-gray-500">Service Name</Label><Input value={serviceForm.name} onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })} className="mt-1 h-10 rounded-xl" placeholder="e.g. Haircut" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-gray-500">Duration (min)</Label><Input type="number" value={serviceForm.duration} onChange={e => setServiceForm({ ...serviceForm, duration: parseInt(e.target.value) || 30 })} className="mt-1 h-10 rounded-xl" /></div>
                <div><Label className="text-xs text-gray-500">Price (&euro;)</Label><Input type="number" value={serviceForm.price} onChange={e => setServiceForm({ ...serviceForm, price: parseFloat(e.target.value) || 0 })} className="mt-1 h-10 rounded-xl" /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={() => setShowServiceDialog(false)}>Cancel</Button>
                <Button className="flex-1 h-10 rounded-xl text-white transition-all hover:shadow-lg active:scale-[0.98]" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }} onClick={handleSaveService}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TenantLayout>
  );
};

export default StaffPage;
