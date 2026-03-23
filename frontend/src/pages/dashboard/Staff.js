import React, { useState, useEffect } from 'react';
import { Plus, MoreHorizontal, Mail, Phone, Edit, Trash2 } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from '../../components/ui/dropdown-menu';
import { staffAPI } from '../../lib/api';
import { toast } from 'sonner';

const colors = [
  '#2E473B', '#C26A58', '#3E6653', '#E6B861', '#6B6B6B',
  '#4A90A4', '#9B59B6', '#E74C3C', '#2ECC71', '#F39C12'
];

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    color: '#2E473B'
  });

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      const data = await staffAPI.list();
      setStaff(data);
    } catch (error) {
      console.error('Failed to load staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStaff) {
        await staffAPI.update(editingStaff.staff_id, formData);
        toast.success('Staff member updated');
      } else {
        await staffAPI.create(formData);
        toast.success('Staff member created');
      }
      loadStaff();
      closeModal();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (staffId) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;
    try {
      await staffAPI.delete(staffId);
      toast.success('Staff member deleted');
      loadStaff();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const openEditModal = (staffMember) => {
    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name,
      email: staffMember.email || '',
      phone: staffMember.phone || '',
      title: staffMember.title || '',
      color: staffMember.color || '#2E473B'
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStaff(null);
    setFormData({ name: '', email: '', phone: '', title: '', color: '#2E473B' });
  };

  return (
    <DashboardLayout title="Staff">
      <div className="space-y-6">
        {/* Actions */}
        <div className="flex justify-end">
          <Button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
            data-testid="add-staff-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Staff Member
          </Button>
        </div>

        {/* Staff Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#E5E5E0] p-6 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#E5E5E0]" />
                  <div className="flex-1">
                    <div className="h-4 w-24 bg-[#E5E5E0] rounded mb-2" />
                    <div className="h-3 w-32 bg-[#E5E5E0] rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : staff.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E5E0] p-12">
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#E5E5E0] mx-auto mb-4 flex items-center justify-center">
                <Plus className="w-8 h-8 text-[#6B6B6B]" />
              </div>
              <p className="text-[#6B6B6B] mb-4">No staff members yet</p>
              <Button
                onClick={() => setShowModal(true)}
                className="rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
              >
                Add First Staff Member
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((member) => (
              <div 
                key={member.staff_id}
                className="bg-white rounded-2xl border border-[#E5E5E0] p-6"
                data-testid={`staff-card-${member.staff_id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold"
                      style={{ backgroundColor: member.color || '#2E473B' }}
                    >
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#1C1C1C]">{member.name}</h3>
                      {member.title && (
                        <p className="text-sm text-[#6B6B6B]">{member.title}</p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(member)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDelete(member.staff_id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="space-y-2 text-sm">
                  {member.email && (
                    <div className="flex items-center gap-2 text-[#6B6B6B]">
                      <Mail className="w-4 h-4" />
                      {member.email}
                    </div>
                  )}
                  {member.phone && (
                    <div className="flex items-center gap-2 text-[#6B6B6B]">
                      <Phone className="w-4 h-4" />
                      {member.phone}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                required
                className="mt-1 rounded-xl"
                data-testid="staff-name-input"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                className="mt-1 rounded-xl"
                data-testid="staff-email-input"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 234 567 8900"
                className="mt-1 rounded-xl"
                data-testid="staff-phone-input"
              />
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Senior Stylist"
                className="mt-1 rounded-xl"
                data-testid="staff-title-input"
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      formData.color === color ? 'ring-2 ring-offset-2 ring-[#2E473B] scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
                data-testid="save-staff-btn"
              >
                {editingStaff ? 'Update' : 'Add'} Staff
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
