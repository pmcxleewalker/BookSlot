import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Clock, DollarSign, Briefcase } from 'lucide-react';

const ServicesPage = () => {
  const { token } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: 30,
    buffer_time: 0,
    price: 0,
    deposit_required: false,
    deposit_amount: 0,
    color: '#E34A33',
    category: ''
  });

  const colors = ['#E34A33', '#4F46E5', '#059669', '#D97706', '#7C3AED', '#0891B2', '#BE185D', '#121212'];

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await axios.get(`${API}/services`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServices(response.data.services || []);
    } catch (error) {
      console.error('Failed to load services:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (service = null) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        description: service.description || '',
        duration: service.duration,
        buffer_time: service.buffer_time || 0,
        price: service.price,
        deposit_required: service.deposit_required,
        deposit_amount: service.deposit_amount || 0,
        color: service.color,
        category: service.category || ''
      });
    } else {
      setEditingService(null);
      setFormData({
        name: '',
        description: '',
        duration: 30,
        buffer_time: 0,
        price: 0,
        deposit_required: false,
        deposit_amount: 0,
        color: '#E34A33',
        category: ''
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('Service name is required');
      return;
    }

    try {
      if (editingService) {
        await axios.put(`${API}/services/${editingService.service_id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Service updated');
      } else {
        await axios.post(`${API}/services`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Service created');
      }
      setShowDialog(false);
      fetchServices();
    } catch (error) {
      toast.error('Failed to save service');
    }
  };

  const handleDelete = async (serviceId) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;

    try {
      await axios.delete(`${API}/services/${serviceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Service deleted');
      fetchServices();
    } catch (error) {
      toast.error('Failed to delete service');
    }
  };

  return (
    <TenantLayout title="Services">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-[#666666]">{services.length} services</p>
        <Button 
          onClick={() => openDialog()} 
          className="btn-primary flex items-center gap-2"
          data-testid="add-service-btn"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </Button>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="py-12 text-center text-[#666666]">Loading...</div>
      ) : services.length === 0 ? (
        <div className="card-flat py-12 text-center">
          <Briefcase className="w-12 h-12 text-[#E5E5E5] mx-auto mb-4" />
          <h3 className="font-semibold text-[#0A0A0A] mb-2">No services yet</h3>
          <p className="text-[#666666] mb-4">Create services that your clients can book</p>
          <Button onClick={() => openDialog()} className="btn-primary">Add First Service</Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <div key={service.service_id} className="card-hover" data-testid={`service-${service.service_id}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-12 rounded-sm"
                    style={{ backgroundColor: service.color }}
                  />
                  <div>
                    <h3 className="font-semibold text-[#0A0A0A]">{service.name}</h3>
                    {service.category && <p className="text-xs text-[#666666]">{service.category}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => openDialog(service)}
                    data-testid={`edit-service-${service.service_id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(service.service_id)}
                    className="text-red-500 hover:text-red-600"
                    data-testid={`delete-service-${service.service_id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {service.description && (
                <p className="text-sm text-[#666666] mb-4 line-clamp-2">{service.description}</p>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-[#E5E5E5]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-sm text-[#666666]">
                    <Clock className="w-4 h-4" />
                    {service.duration} min
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-[#0A0A0A]">
                    <DollarSign className="w-4 h-4" />
                    €{service.price}
                  </div>
                </div>
                {service.deposit_required && (
                  <span className="text-xs text-[#666666] bg-[#FAFAFA] px-2 py-1 border border-[#E5E5E5]">
                    €{service.deposit_amount} deposit
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Edit Service' : 'Add Service'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <Label className="text-sm font-medium">Service name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Haircut, Consultation"
                className="mt-1.5"
                data-testid="service-name-input"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Description</Label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the service"
                rows={2}
                className="mt-1.5 input-swiss resize-none"
                data-testid="service-desc-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Duration (min) *</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 30 })}
                  className="mt-1.5"
                  data-testid="service-duration-input"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Buffer time (min)</Label>
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={formData.buffer_time}
                  onChange={(e) => setFormData({ ...formData, buffer_time: parseInt(e.target.value) || 0 })}
                  className="mt-1.5"
                  data-testid="service-buffer-input"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Price (€) *</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="mt-1.5"
                data-testid="service-price-input"
              />
            </div>

            <div className="flex items-center justify-between py-3 border-y border-[#E5E5E5]">
              <div>
                <p className="font-medium text-[#0A0A0A]">Require deposit</p>
                <p className="text-sm text-[#666666]">Collect a deposit when booking</p>
              </div>
              <Switch
                checked={formData.deposit_required}
                onCheckedChange={(checked) => setFormData({ ...formData, deposit_required: checked })}
                data-testid="service-deposit-toggle"
              />
            </div>

            {formData.deposit_required && (
              <div>
                <Label className="text-sm font-medium">Deposit amount (€)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.deposit_amount}
                  onChange={(e) => setFormData({ ...formData, deposit_amount: parseFloat(e.target.value) || 0 })}
                  className="mt-1.5"
                  data-testid="service-deposit-amount"
                />
              </div>
            )}

            <div>
              <Label className="text-sm font-medium">Category</Label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g. Hair, Nails, Wellness"
                className="mt-1.5"
                data-testid="service-category-input"
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
                    data-testid={`service-color-${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1 btn-primary" onClick={handleSubmit} data-testid="save-service-btn">
                {editingService ? 'Update' : 'Create Service'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
};

export default ServicesPage;
