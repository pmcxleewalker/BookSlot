import React, { useState, useEffect } from 'react';
import { Plus, MoreHorizontal, Clock, DollarSign, Edit, Trash2 } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from '../../components/ui/dropdown-menu';
import { servicesAPI } from '../../lib/api';
import { toast } from 'sonner';

const colors = [
  '#2E473B', '#C26A58', '#3E6653', '#E6B861', '#6B6B6B',
  '#4A90A4', '#9B59B6', '#E74C3C', '#2ECC71', '#F39C12'
];

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: 30,
    price: 0,
    buffer_before: 0,
    buffer_after: 0,
    deposit_required: false,
    deposit_amount: 0,
    color: '#2E473B'
  });

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const data = await servicesAPI.list();
      setServices(data);
    } catch (error) {
      console.error('Failed to load services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingService) {
        await servicesAPI.update(editingService.service_id, formData);
        toast.success('Service updated');
      } else {
        await servicesAPI.create(formData);
        toast.success('Service created');
      }
      loadServices();
      closeModal();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (serviceId) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    try {
      await servicesAPI.delete(serviceId);
      toast.success('Service deleted');
      loadServices();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const openEditModal = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      duration: service.duration,
      price: service.price,
      buffer_before: service.buffer_before || 0,
      buffer_after: service.buffer_after || 0,
      deposit_required: service.deposit_required || false,
      deposit_amount: service.deposit_amount || 0,
      color: service.color || '#2E473B'
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingService(null);
    setFormData({
      name: '', description: '', duration: 30, price: 0,
      buffer_before: 0, buffer_after: 0, deposit_required: false,
      deposit_amount: 0, color: '#2E473B'
    });
  };

  return (
    <DashboardLayout title="Services">
      <div className="space-y-6">
        {/* Actions */}
        <div className="flex justify-end">
          <Button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
            data-testid="add-service-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        </div>

        {/* Services Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#E5E5E0] p-6 animate-pulse">
                <div className="h-4 w-32 bg-[#E5E5E0] rounded mb-4" />
                <div className="h-3 w-full bg-[#E5E5E0] rounded mb-2" />
                <div className="h-3 w-24 bg-[#E5E5E0] rounded" />
              </div>
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E5E0] p-12">
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#E5E5E0] mx-auto mb-4 flex items-center justify-center">
                <Plus className="w-8 h-8 text-[#6B6B6B]" />
              </div>
              <p className="text-[#6B6B6B] mb-4">No services yet</p>
              <Button
                onClick={() => setShowModal(true)}
                className="rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
              >
                Add First Service
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div 
                key={service.service_id}
                className="bg-white rounded-2xl border border-[#E5E5E0] p-6"
                data-testid={`service-card-${service.service_id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-12 rounded-full"
                      style={{ backgroundColor: service.color || '#2E473B' }}
                    />
                    <div>
                      <h3 className="font-semibold text-[#1C1C1C]">{service.name}</h3>
                      {service.description && (
                        <p className="text-sm text-[#6B6B6B] line-clamp-2">{service.description}</p>
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
                      <DropdownMenuItem onClick={() => openEditModal(service)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDelete(service.service_id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-[#E5E5E0]">
                  <div className="flex items-center gap-1 text-sm text-[#6B6B6B]">
                    <Clock className="w-4 h-4" />
                    {service.duration} min
                  </div>
                  <div className="text-lg font-semibold text-[#1C1C1C]">
                    €{service.price}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Edit Service' : 'Add Service'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <Label htmlFor="name">Service Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Haircut"
                required
                className="mt-1 rounded-xl"
                data-testid="service-name-input"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the service"
                className="mt-1 rounded-xl"
                data-testid="service-desc-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="duration">Duration (minutes) *</Label>
                <Input
                  id="duration"
                  type="number"
                  min="5"
                  step="5"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  className="mt-1 rounded-xl"
                  data-testid="service-duration-input"
                />
              </div>
              <div>
                <Label htmlFor="price">Price (€) *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  className="mt-1 rounded-xl"
                  data-testid="service-price-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="buffer_before">Buffer Before (min)</Label>
                <Input
                  id="buffer_before"
                  type="number"
                  min="0"
                  step="5"
                  value={formData.buffer_before}
                  onChange={(e) => setFormData({ ...formData, buffer_before: parseInt(e.target.value) })}
                  className="mt-1 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="buffer_after">Buffer After (min)</Label>
                <Input
                  id="buffer_after"
                  type="number"
                  min="0"
                  step="5"
                  value={formData.buffer_after}
                  onChange={(e) => setFormData({ ...formData, buffer_after: parseInt(e.target.value) })}
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-[#E5E5E0]">
              <div>
                <Label htmlFor="deposit">Require Deposit</Label>
                <p className="text-xs text-[#6B6B6B]">Collect payment upfront</p>
              </div>
              <Switch
                id="deposit"
                checked={formData.deposit_required}
                onCheckedChange={(checked) => setFormData({ ...formData, deposit_required: checked })}
              />
            </div>
            {formData.deposit_required && (
              <div>
                <Label htmlFor="deposit_amount">Deposit Amount (€)</Label>
                <Input
                  id="deposit_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.deposit_amount}
                  onChange={(e) => setFormData({ ...formData, deposit_amount: parseFloat(e.target.value) })}
                  className="mt-1 rounded-xl"
                />
              </div>
            )}
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
                data-testid="save-service-btn"
              >
                {editingService ? 'Update' : 'Add'} Service
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
