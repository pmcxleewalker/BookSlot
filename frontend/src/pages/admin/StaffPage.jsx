import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Mail, Phone, User, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import WorkingHoursEditor from '../../components/WorkingHoursEditor';

const StaffPage = () => {
  const { token, tenant } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showHoursDialog, setShowHoursDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [selectedStaffForHours, setSelectedStaffForHours] = useState(null);
  const [workingHours, setWorkingHours] = useState({});
  const [expandedStaff, setExpandedStaff] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    color: '#4F46E5'
  });

  const colors = ['#E34A33', '#4F46E5', '#059669', '#D97706', '#7C3AED', '#0891B2', '#BE185D'];

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const response = await axios.get(`${API}/staff`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStaff(response.data.staff || []);
    } catch (error) {
      console.error('Failed to load staff:', error);
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
        color: member.color
      });
    } else {
      setEditingStaff(null);
      setFormData({ name: '', email: '', phone: '', title: '', color: '#4F46E5' });
    }
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email) {
      toast.error('Name and email are required');
      return;
    }

    try {
      if (editingStaff) {
        await axios.put(`${API}/staff/${editingStaff.staff_id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Staff member updated');
      } else {
        await axios.post(`${API}/staff`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Staff member added');
      }
      setShowDialog(false);
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save staff member');
    }
  };

  const handleDelete = async (staffId) => {
    if (!window.confirm('Are you sure you want to remove this staff member?')) return;

    try {
      await axios.delete(`${API}/staff/${staffId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Staff member removed');
      fetchStaff();
    } catch (error) {
      toast.error('Failed to remove staff member');
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
      fetchStaff();
    } catch (error) {
      toast.error('Failed to update working hours');
    }
  };

  const getWorkingDays = (member) => {
    const hours = member.working_hours || {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const enabledDays = days.filter(d => hours[d]?.enabled);
    if (enabledDays.length === 0) return 'No schedule set';
    if (enabledDays.length === 7) return 'Every day';
    if (enabledDays.length === 5 && !hours.saturday?.enabled && !hours.sunday?.enabled) return 'Mon-Fri';
    return enabledDays.map(d => d.charAt(0).toUpperCase() + d.slice(0, 2)).join(', ');
  };

  const getStaffLimit = () => {
    const limits = { starter: 2, growth: 8, pro: 999 };
    return limits[tenant?.plan] || 2;
  };

  return (
    <TenantLayout title="Staff">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[#666666]">
            {staff.length} of {getStaffLimit()} staff members
          </p>
        </div>
        <Button 
          onClick={() => openDialog()} 
          className="btn-primary flex items-center gap-2"
          disabled={staff.length >= getStaffLimit()}
          data-testid="add-staff-btn"
        >
          <Plus className="w-4 h-4" />
          Add Staff
        </Button>
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
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => openHoursDialog(member)}
                    className="text-[#666666]"
                    data-testid={`hours-staff-${member.staff_id}`}
                  >
                    <Clock className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => openDialog(member)}
                    data-testid={`edit-staff-${member.staff_id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(member.staff_id)}
                    className="text-red-500 hover:text-red-600"
                    data-testid={`delete-staff-${member.staff_id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-sm font-medium">Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name"
                className="mt-1.5"
                data-testid="staff-name-input"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
                className="mt-1.5"
                data-testid="staff-email-input"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Phone</Label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 234 567 8900"
                className="mt-1.5"
                data-testid="staff-phone-input"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Title/Role</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Senior Stylist"
                className="mt-1.5"
                data-testid="staff-title-input"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Color</Label>
              <div className="flex gap-2 mt-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      formData.color === color ? 'border-[#121212] scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    data-testid={`color-${color}`}
                  />
                ))}
              </div>
            </div>

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
    </TenantLayout>
  );
};

export default StaffPage;
