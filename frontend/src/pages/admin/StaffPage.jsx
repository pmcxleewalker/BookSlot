import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, User, Briefcase, Clock } from 'lucide-react';

const StaffPage = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('staff');
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Staff form
  const [showStaffDialog, setShowStaffDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', phone: '', role: 'staff' });
  
  // Service form
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [serviceForm, setServiceForm] = useState({ name: '', duration: 30, price: 0, description: '' });

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
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  // Staff handlers
  const openAddStaff = () => {
    setEditingStaff(null);
    setStaffForm({ name: '', email: '', phone: '', role: 'staff' });
    setShowStaffDialog(true);
  };

  const openEditStaff = (member) => {
    setEditingStaff(member);
    setStaffForm({ name: member.name, email: member.email || '', phone: member.phone || '', role: member.role || 'staff' });
    setShowStaffDialog(true);
  };

  const handleSaveStaff = async () => {
    if (!staffForm.name) {
      toast.error('Name is required');
      return;
    }
    try {
      if (editingStaff) {
        await axios.put(`${API}/staff/${editingStaff.staff_id}`, staffForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Updated');
      } else {
        await axios.post(`${API}/staff`, staffForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Added');
      }
      setShowStaffDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    }
  };

  const handleDeleteStaff = async (id) => {
    if (!window.confirm('Delete this team member?')) return;
    try {
      await axios.delete(`${API}/staff/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  // Service handlers
  const openAddService = () => {
    setEditingService(null);
    setServiceForm({ name: '', duration: 30, price: 0, description: '' });
    setShowServiceDialog(true);
  };

  const openEditService = (service) => {
    setEditingService(service);
    setServiceForm({ 
      name: service.name, 
      duration: service.duration || 30, 
      price: service.price || 0, 
      description: service.description || '' 
    });
    setShowServiceDialog(true);
  };

  const handleSaveService = async () => {
    if (!serviceForm.name) {
      toast.error('Name is required');
      return;
    }
    try {
      if (editingService) {
        await axios.put(`${API}/services/${editingService.service_id}`, serviceForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Updated');
      } else {
        await axios.post(`${API}/services`, serviceForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Added');
      }
      setShowServiceDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    }
  };

  const handleDeleteService = async (id) => {
    if (!window.confirm('Delete this service?')) return;
    try {
      await axios.delete(`${API}/services/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <TenantLayout title="Team">
      <div className="max-w-xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#F5F5F5] p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex-1 py-2 px-4 text-sm rounded-md transition-colors ${
              activeTab === 'staff' ? 'bg-white shadow-sm text-[#0A0A0A] font-medium' : 'text-[#666]'
            }`}
          >
            <User className="w-4 h-4 inline mr-2" />
            Staff ({staff.length})
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`flex-1 py-2 px-4 text-sm rounded-md transition-colors ${
              activeTab === 'services' ? 'bg-white shadow-sm text-[#0A0A0A] font-medium' : 'text-[#666]'
            }`}
          >
            <Briefcase className="w-4 h-4 inline mr-2" />
            Services ({services.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[#999]">Loading...</div>
        ) : activeTab === 'staff' ? (
          /* Staff Tab */
          <div>
            <Button onClick={openAddStaff} className="w-full mb-4 h-10 bg-[#0A0A0A] hover:bg-[#1a1a1a]">
              <Plus className="w-4 h-4 mr-2" /> Add Staff
            </Button>
            
            {staff.length === 0 ? (
              <div className="text-center py-12 text-[#999]">No staff members yet</div>
            ) : (
              <div className="space-y-2">
                {staff.map((member) => (
                  <div key={member.staff_id} className="bg-white rounded-xl p-4 border border-[#EAEAEA] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#F5F5F5] rounded-full flex items-center justify-center text-sm font-medium text-[#666]">
                        {member.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-[#0A0A0A]">{member.name}</p>
                        <p className="text-xs text-[#999]">{member.role || 'Staff'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditStaff(member)}>
                        <Pencil className="w-4 h-4 text-[#666]" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteStaff(member.staff_id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Services Tab */
          <div>
            <Button onClick={openAddService} className="w-full mb-4 h-10 bg-[#0A0A0A] hover:bg-[#1a1a1a]">
              <Plus className="w-4 h-4 mr-2" /> Add Service
            </Button>
            
            {services.length === 0 ? (
              <div className="text-center py-12 text-[#999]">No services yet</div>
            ) : (
              <div className="space-y-2">
                {services.map((service) => (
                  <div key={service.service_id} className="bg-white rounded-xl p-4 border border-[#EAEAEA] flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[#0A0A0A]">{service.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#666]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {service.duration}m
                        </span>
                        <span>€{service.price}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditService(service)}>
                        <Pencil className="w-4 h-4 text-[#666]" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteService(service.service_id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Staff Dialog */}
        <Dialog open={showStaffDialog} onOpenChange={setShowStaffDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">{editingStaff ? 'Edit' : 'Add'} Staff</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-xs text-[#666]">Name</Label>
                <Input value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} className="mt-1 h-10" />
              </div>
              <div>
                <Label className="text-xs text-[#666]">Email</Label>
                <Input type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} className="mt-1 h-10" />
              </div>
              <div>
                <Label className="text-xs text-[#666]">Phone</Label>
                <Input type="tel" value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} className="mt-1 h-10" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 h-10" onClick={() => setShowStaffDialog(false)}>Cancel</Button>
                <Button className="flex-1 h-10 bg-[#0A0A0A] hover:bg-[#1a1a1a]" onClick={handleSaveStaff}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Service Dialog */}
        <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">{editingService ? 'Edit' : 'Add'} Service</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-xs text-[#666]">Service Name</Label>
                <Input value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} className="mt-1 h-10" placeholder="Haircut" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-[#666]">Duration (min)</Label>
                  <Input type="number" value={serviceForm.duration} onChange={(e) => setServiceForm({ ...serviceForm, duration: parseInt(e.target.value) || 30 })} className="mt-1 h-10" />
                </div>
                <div>
                  <Label className="text-xs text-[#666]">Price (€)</Label>
                  <Input type="number" value={serviceForm.price} onChange={(e) => setServiceForm({ ...serviceForm, price: parseFloat(e.target.value) || 0 })} className="mt-1 h-10" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 h-10" onClick={() => setShowServiceDialog(false)}>Cancel</Button>
                <Button className="flex-1 h-10 bg-[#0A0A0A] hover:bg-[#1a1a1a]" onClick={handleSaveService}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TenantLayout>
  );
};

export default StaffPage;
