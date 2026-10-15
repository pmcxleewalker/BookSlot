import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Checkbox } from '../../components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Mail, Phone, User, Clock, Briefcase, Check, Plane, KeyRound } from 'lucide-react';
import { errorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/utils';
import WorkingHoursEditor from '../../components/WorkingHoursEditor';

const StaffPage = () => {
  const { token, tenant, user, can, isManager, currency } = useAuth();
  const canManage = can('can_manage_staff');
  const [showTimeOff, setShowTimeOff] = useState(null); // staff member
  const [blocks, setBlocks] = useState([]);
  const [newBlock, setNewBlock] = useState({ title: 'Annual leave', block_type: 'annual_leave', start_date: '', end_date: '', all_day: true, start_time: '12:00', end_time: '13:00' });
  const [perms, setPerms] = useState({});
  const [loginPassword, setLoginPassword] = useState('');
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showHoursDialog, setShowHoursDialog] = useState(false);
  const [showServicesDialog, setShowServicesDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [selectedStaffForHours, setSelectedStaffForHours] = useState(null);
  const [selectedStaffForServices, setSelectedStaffForServices] = useState(null);
  const [workingHours, setWorkingHours] = useState({});
  const [selectedServices, setSelectedServices] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    color: '#4F46E5',
    password: ''
  });

  const PERMISSIONS = [
    ['can_view_all_bookings', "See everyone's appointments"],
    ['can_manage_customers', 'View and edit clients'],
    ['can_edit_services', 'Edit services and prices'],
    ['can_manage_staff', 'Manage team members'],
    ['can_view_reports', 'View reports'],
  ];

  const colors = ['#E34A33', '#4F46E5', '#059669', '#D97706', '#7C3AED', '#0891B2', '#BE185D'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [staffRes, servicesRes] = await Promise.all([
        axios.get(`${API}/staff`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setStaff(staffRes.data.staff || []);
      setServices(servicesRes.data.services || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (member = null) => {
    if (member) {
      setEditingStaff(member);
      setFormData({
        name: member.name,
        email: member.email,
        phone: member.phone || '',
        title: member.title || '',
        color: member.color,
        password: ''
      });
      setPerms({ role: member.role || 'staff', ...Object.fromEntries(PERMISSIONS.map(([k]) => [k, !!member[k]])) });
    } else {
      setEditingStaff(null);
      setFormData({ name: '', email: '', phone: '', title: '', color: '#4F46E5', password: '' });
      setPerms({ role: 'staff', can_manage_customers: true });
    }
    setLoginPassword('');
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email) {
      toast.error('Name and email are required');
      return;
    }

    try {
      const { password, ...details } = formData;
      const body = isManager ? { ...details, ...perms } : details;
      if (editingStaff) {
        await axios.put(`${API}/staff/${editingStaff.staff_id}`, body);
        if (isManager && loginPassword && !editingStaff.has_account) {
          await axios.post(`${API}/staff/${editingStaff.staff_id}/create-account`, { password: loginPassword });
        } else if (isManager && loginPassword && editingStaff.has_account) {
          await axios.put(`${API}/staff/${editingStaff.staff_id}/change-password`, { new_password: loginPassword });
        }
        toast.success('Team member updated');
      } else {
        if (password && password.length < 8) return toast.error('Login password must be at least 8 characters');
        await axios.post(`${API}/staff`, { ...body, password: password || undefined });
        toast.success(password ? 'Team member added - they can now sign in with their email' : 'Team member added');
      }
      setShowDialog(false);
      fetchData();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save team member'));
    }
  };

  const handleDelete = async (staffId) => {
    if (!window.confirm('Are you sure you want to remove this staff member?')) return;

    try {
      await axios.delete(`${API}/staff/${staffId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Staff member removed');
      fetchData();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to remove staff member'));
    }
  };

  const openHoursDialog = async (member) => {
    setSelectedStaffForHours(member);
    try {
      const response = await axios.get(`${API}/staff/${member.staff_id}/working-hours`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkingHours(response.data.working_hours || {});
    } catch (error) {
      setWorkingHours({});
    }
    setShowHoursDialog(true);
  };

  const saveWorkingHours = async () => {
    if (!selectedStaffForHours) return;
    
    try {
      await axios.put(`${API}/staff/${selectedStaffForHours.staff_id}/working-hours`, workingHours, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Working hours updated');
      setShowHoursDialog(false);
      fetchData();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to update working hours'));
    }
  };

  const openServicesDialog = (member) => {
    setSelectedStaffForServices(member);
    setSelectedServices(member.services || []);
    setShowServicesDialog(true);
  };

  const toggleService = (serviceId) => {
    setSelectedServices(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  const saveServices = async () => {
    if (!selectedStaffForServices) return;
    
    try {
      await axios.put(`${API}/staff/${selectedStaffForServices.staff_id}`, 
        { services: selectedServices },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Services updated');
      setShowServicesDialog(false);
      fetchData();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to update services'));
    }
  };

  const getServiceNames = (member) => {
    const memberServices = member.services || [];
    if (memberServices.length === 0) return 'All services';
    
    const serviceNames = memberServices
      .map(id => services.find(s => s.service_id === id)?.name)
      .filter(Boolean);
    
    if (serviceNames.length === 0) return 'All services';
    if (serviceNames.length <= 2) return serviceNames.join(', ');
    return `${serviceNames.slice(0, 2).join(', ')} +${serviceNames.length - 2} more`;
  };

  const getWorkingDays = (member) => {
    const hours = member.working_hours || {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayLabels = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
    const enabledDays = days.filter(d => hours[d]?.enabled);
    if (enabledDays.length === 0) return 'No schedule set';
    if (enabledDays.length === 7) return 'Every day';
    if (enabledDays.length === 5 && !hours.saturday?.enabled && !hours.sunday?.enabled) return 'Mon-Fri';
    if (enabledDays.length === 6 && !hours.sunday?.enabled) return 'Mon-Sat';
    return enabledDays.map(d => dayLabels[d]).join(', ');
  };

  const getStaffLimit = () => tenant?.features?.max_staff || 2;

  const openTimeOff = async (member) => {
    setShowTimeOff(member);
    const today = new Date().toISOString().slice(0, 10);
    setNewBlock({ ...newBlock, start_date: today, end_date: today });
    try {
      const r = await axios.get(`${API}/staff/${member.staff_id}/time-blocks`, { params: { start_date: today, end_date: '2100-01-01' } });
      setBlocks(r.data.time_blocks || []);
    } catch (e) { setBlocks([]); }
  };

  const addBlock = async () => {
    try {
      await axios.post(`${API}/staff/${showTimeOff.staff_id}/time-blocks`, {
        ...newBlock,
        start_time: newBlock.all_day ? null : newBlock.start_time,
        end_time: newBlock.all_day ? null : newBlock.end_time,
      });
      toast.success('Time off added - those times are no longer bookable');
      openTimeOff(showTimeOff);
    } catch (e) { toast.error(errorMessage(e, 'Could not add time off')); }
  };

  const removeBlock = async (blockId) => {
    try {
      await axios.delete(`${API}/time-blocks/${blockId}`);
      setBlocks((b) => b.filter((x) => x.block_id !== blockId));
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const isSelf = (member) => user?.staff_id === member.staff_id;

  return (
    <TenantLayout title="Staff">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[#666666]">
            {staff.length} of {getStaffLimit()} staff members
          </p>
        </div>
        {canManage && <Button 
          onClick={() => openDialog()} 
          className="btn-primary flex items-center gap-2"
          disabled={staff.length >= getStaffLimit()}
          title={staff.length >= getStaffLimit() ? 'Upgrade your plan to add more team members' : ''}
          data-testid="add-staff-btn"
        >
          <Plus className="w-4 h-4" />
          Add Staff
        </Button>}
      </div>

      {/* Staff Grid */}
      {loading ? (
        <div className="py-12 text-center text-[#666666]">Loading...</div>
      ) : staff.length === 0 ? (
        <div className="card-flat py-12 text-center">
          <User className="w-12 h-12 text-[#E5E5E5] mx-auto mb-4" />
          <h3 className="font-semibold text-[#0A0A0A] mb-2">No staff members yet</h3>
          <p className="text-[#666666] mb-4">Add your team to start scheduling</p>
          <Button onClick={() => openDialog()} className="btn-primary">Add First Staff</Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((member) => (
            <div key={member.staff_id} className="card-hover" data-testid={`staff-${member.staff_id}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0A0A0A]">{member.name}</h3>
                    {member.title && <p className="text-sm text-[#666666]">{member.title}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {(canManage || isSelf(member)) && <Button variant="ghost" size="sm" onClick={() => openTimeOff(member)} className="text-[#666666]" title="Time off" data-testid={`timeoff-staff-${member.staff_id}`}>
                    <Plane className="w-4 h-4" />
                  </Button>}
                  {canManage && <><Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => openServicesDialog(member)}
                    className="text-[#666666]"
                    title="Assign Services"
                    data-testid={`services-staff-${member.staff_id}`}
                  >
                    <Briefcase className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => openHoursDialog(member)}
                    className="text-[#666666]"
                    title="Working Hours"
                    data-testid={`hours-staff-${member.staff_id}`}
                  >
                    <Clock className="w-4 h-4" />
                  </Button></>}
                  {!canManage && isSelf(member) && <Button variant="ghost" size="sm" onClick={() => openHoursDialog(member)} className="text-[#666666]" title="Working Hours"><Clock className="w-4 h-4" /></Button>}
                  {canManage && <><Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => openDialog(member)}
                    title="Edit"
                    data-testid={`edit-staff-${member.staff_id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(member.staff_id)}
                    className="text-red-500 hover:text-red-600"
                    title="Delete"
                    data-testid={`delete-staff-${member.staff_id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button></>}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-[#666666]">
                  <Mail className="w-4 h-4" />
                  {member.email}
                </div>
                {member.phone && (
                  <div className="flex items-center gap-2 text-[#666666]">
                    <Phone className="w-4 h-4" />
                    {member.phone}
                  </div>
                )}
                <div className="flex items-center gap-2 text-[#666666]">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">{getWorkingDays(member)}</span>
                </div>
                <div className="flex items-center gap-2 text-[#666666]">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-xs">{getServiceNames(member)}</span>
                </div>
                <div className="flex items-center gap-2 text-[#666666]">
                  <KeyRound className="w-4 h-4" />
                  <span className="text-xs">{member.has_account ? (member.role === 'admin' ? 'Can sign in · Admin' : 'Can sign in') : 'No login'}</span>
                </div>
              </div>

              {/* Services Pills */}
              {member.services && member.services.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#E5E5E5]">
                  <div className="flex flex-wrap gap-1">
                    {member.services.slice(0, 3).map(serviceId => {
                      const service = services.find(s => s.service_id === serviceId);
                      return service ? (
                        <span 
                          key={serviceId}
                          className="px-2 py-0.5 text-xs bg-[#FAFAFA] border border-[#E5E5E5] rounded"
                        >
                          {service.name}
                        </span>
                      ) : null;
                    })}
                    {member.services.length > 3 && (
                      <span className="px-2 py-0.5 text-xs text-[#666666]">
                        +{member.services.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Staff Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStaff ? 'Edit Staff' : 'Add Staff Member'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="John Smith"
                data-testid="staff-name-input"
              />
            </div>

            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="john@example.com"
                data-testid="staff-email-input"
              />
            </div>

            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="+1 555 123 4567"
                data-testid="staff-phone-input"
              />
            </div>

            <div>
              <Label>Job Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Senior Stylist"
                data-testid="staff-title-input"
              />
            </div>

            <div>
              <Label>Calendar Color</Label>
              <div className="flex gap-2 mt-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({...formData, color})}
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.color === color ? 'border-[#0A0A0A]' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    data-testid={`color-${color}`}
                  />
                ))}
              </div>
            </div>

            {isManager && (
              <div className="pt-4 border-t border-[#E5E5E5] space-y-3">
                <p className="font-medium text-[#0A0A0A]">Login & permissions</p>
                {!editingStaff ? (
                  <div>
                    <Label>Login password (optional)</Label>
                    <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Min. 8 characters - leave empty for no login" data-testid="staff-password-input" />
                    <p className="text-xs text-[#666666] mt-1">They'll sign in at the normal login page with their email and this password.</p>
                  </div>
                ) : (
                  <div>
                    <Label>{editingStaff.has_account ? 'Set a new password' : 'Create a login (password)'}</Label>
                    <Input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Min. 8 characters" />
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={perms.role === 'admin'} onCheckedChange={(v) => setPerms({ ...perms, role: v ? 'admin' : 'staff' })} />
                  Admin - full access to everything (like the owner)
                </label>
                {perms.role !== 'admin' && PERMISSIONS.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={!!perms[key]} onCheckedChange={(v) => setPerms({ ...perms, [key]: !!v })} />
                    {label}
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1 btn-primary" onClick={handleSubmit} data-testid="save-staff-btn">
                {editingStaff ? 'Update' : 'Add Staff'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Working Hours Dialog */}
      <Dialog open={showHoursDialog} onOpenChange={setShowHoursDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Working Hours - {selectedStaffForHours?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            <WorkingHoursEditor
              workingHours={workingHours}
              onChange={setWorkingHours}
            />

            <div className="flex gap-3 pt-6 border-t border-[#E5E5E5] mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowHoursDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1 btn-primary" onClick={saveWorkingHours} data-testid="save-hours-btn">
                Save Working Hours
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Services Assignment Dialog */}
      <Dialog open={showServicesDialog} onOpenChange={setShowServicesDialog}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Assign Services - {selectedStaffForServices?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            <p className="text-sm text-[#666666] mb-4">
              Choose what this person offers. Leave everything unticked to let them take every service.
            </p>

            {services.length === 0 ? (
              <div className="text-center py-8 text-[#666666]">
                <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No services created yet.</p>
                <p className="text-sm">Add services first to assign them to staff.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {services.map((service) => (
                  <div 
                    key={service.service_id}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      selectedServices.includes(service.service_id)
                        ? 'border-[#E34A33] bg-[#E34A33]/5'
                        : 'border-[#E5E5E5] hover:border-[#0A0A0A]'
                    }`}
                    onClick={() => toggleService(service.service_id)}
                    data-testid={`service-checkbox-${service.service_id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                        selectedServices.includes(service.service_id)
                          ? 'bg-[#E34A33] border-[#E34A33]'
                          : 'border-[#E5E5E5]'
                      }`}>
                        {selectedServices.includes(service.service_id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-[#0A0A0A]">{service.name}</p>
                        <p className="text-xs text-[#666666]">
                          {service.duration} min • {formatMoney(service.price, currency)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#E5E5E5]">
              <p className="text-sm text-[#666666]">
                {selectedServices.length} of {services.length} services selected
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedServices(services.map(s => s.service_id))}
                >
                  Select All
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedServices([])}
                >
                  Clear All
                </Button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowServicesDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1 btn-primary" onClick={saveServices} data-testid="save-services-btn">
                Save Services
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Time off */}
      <Dialog open={!!showTimeOff} onOpenChange={(o) => !o && setShowTimeOff(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Time off - {showTimeOff?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-[#666666]">Holidays, sick days or blocked hours. Clients can't book these times. Existing appointments are not moved.</p>
            <div className="p-3 border border-[#E5E5E5] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Type</Label>
                  <select className="input-swiss" value={newBlock.block_type} onChange={(e) => setNewBlock({ ...newBlock, block_type: e.target.value, title: e.target.selectedOptions[0].text })}>
                    <option value="annual_leave">Annual leave</option>
                    <option value="sick">Sick day</option>
                    <option value="unavailable">Unavailable</option>
                    <option value="lunch">Lunch / break</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Label</Label>
                  <Input value={newBlock.title} onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={newBlock.start_date} onChange={(e) => setNewBlock({ ...newBlock, start_date: e.target.value, end_date: newBlock.end_date < e.target.value ? e.target.value : newBlock.end_date })} />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={newBlock.end_date} min={newBlock.start_date} onChange={(e) => setNewBlock({ ...newBlock, end_date: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={newBlock.all_day} onCheckedChange={(v) => setNewBlock({ ...newBlock, all_day: !!v })} /> All day
              </label>
              {!newBlock.all_day && (
                <div className="grid grid-cols-2 gap-3">
                  <Input type="time" value={newBlock.start_time} onChange={(e) => setNewBlock({ ...newBlock, start_time: e.target.value })} />
                  <Input type="time" value={newBlock.end_time} onChange={(e) => setNewBlock({ ...newBlock, end_time: e.target.value })} />
                </div>
              )}
              <Button className="btn-primary w-full" onClick={addBlock} data-testid="add-timeoff-btn">Add time off</Button>
            </div>
            {blocks.length === 0 ? (
              <p className="text-sm text-center text-[#666666] py-2">No upcoming time off</p>
            ) : blocks.map((b) => (
              <div key={b.block_id} className="flex items-center justify-between p-3 bg-[#FAFAFA] border border-[#E5E5E5] text-sm">
                <div>
                  <p className="font-medium">{b.title}</p>
                  <p className="text-[#666666]">{b.start_date}{b.end_date && b.end_date !== b.start_date ? ` → ${b.end_date}` : ''}{b.all_day ? ' · all day' : ` · ${b.start_time}-${b.end_time}`}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => removeBlock(b.block_id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
};

export default StaffPage;
