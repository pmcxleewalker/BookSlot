import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Clock, User, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Calendar } from './ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { staffAPI, servicesAPI, appointmentsAPI } from '../lib/api';
import { toast } from 'sonner';

const NewAppointmentModal = ({ isOpen, onClose, onSuccess, initialDate }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [formData, setFormData] = useState({
    service_id: '',
    staff_id: '',
    date: initialDate || new Date(),
    time: '10:00',
    client_name: '',
    client_email: '',
    client_phone: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (initialDate) {
        setFormData(prev => ({ ...prev, date: initialDate }));
      }
    }
  }, [isOpen, initialDate]);

  const loadData = async () => {
    try {
      const [servicesData, staffData] = await Promise.all([
        servicesAPI.list(),
        staffAPI.list()
      ]);
      setServices(servicesData);
      setStaff(staffData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const [hours, minutes] = formData.time.split(':').map(Number);
      const startTime = new Date(formData.date);
      startTime.setHours(hours, minutes, 0, 0);

      await appointmentsAPI.create({
        service_id: formData.service_id,
        staff_id: formData.staff_id,
        start_time: startTime.toISOString(),
        client_name: formData.client_name,
        client_email: formData.client_email || null,
        client_phone: formData.client_phone || null,
        notes: formData.notes || null
      });

      toast.success('Appointment created');
      onSuccess?.();
      resetForm();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setFormData({
      service_id: '',
      staff_id: '',
      date: new Date(),
      time: '10:00',
      client_name: '',
      client_email: '',
      client_phone: '',
      notes: ''
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const times = [];
  for (let h = 8; h < 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      times.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  const selectedService = services.find(s => s.service_id === formData.service_id);
  const selectedStaff = staff.find(s => s.staff_id === formData.staff_id);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Appointment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Service Selection */}
          <div>
            <Label>Service *</Label>
            <select
              value={formData.service_id}
              onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
              className="w-full mt-1 h-10 rounded-xl border border-[#E5E5E0] px-3 bg-white"
              required
              data-testid="apt-service-select"
            >
              <option value="">Select a service</option>
              {services.map(service => (
                <option key={service.service_id} value={service.service_id}>
                  {service.name} ({service.duration} min - €{service.price})
                </option>
              ))}
            </select>
          </div>

          {/* Staff Selection */}
          <div>
            <Label>Staff *</Label>
            <select
              value={formData.staff_id}
              onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
              className="w-full mt-1 h-10 rounded-xl border border-[#E5E5E0] px-3 bg-white"
              required
              data-testid="apt-staff-select"
            >
              <option value="">Select staff</option>
              {staff.map(s => (
                <option key={s.staff_id} value={s.staff_id}>
                  {s.name} {s.title ? `(${s.title})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full mt-1 justify-start text-left font-normal rounded-xl border-[#E5E5E0]"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.date ? format(formData.date, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) => date && setFormData({ ...formData, date })}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Time *</Label>
              <select
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full mt-1 h-10 rounded-xl border border-[#E5E5E0] px-3 bg-white"
                required
                data-testid="apt-time-select"
              >
                {times.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Client Details */}
          <div className="border-t border-[#E5E5E0] pt-4">
            <h4 className="font-medium text-[#1C1C1C] mb-3">Client Details</h4>
            <div className="space-y-4">
              <div>
                <Label htmlFor="client_name">Name *</Label>
                <Input
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  placeholder="Client name"
                  required
                  className="mt-1 rounded-xl"
                  data-testid="apt-client-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="client_email">Email</Label>
                  <Input
                    id="client_email"
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                    placeholder="client@email.com"
                    className="mt-1 rounded-xl"
                    data-testid="apt-client-email"
                  />
                </div>
                <div>
                  <Label htmlFor="client_phone">Phone</Label>
                  <Input
                    id="client_phone"
                    type="tel"
                    value={formData.client_phone}
                    onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                    placeholder="+1 234 567 8900"
                    className="mt-1 rounded-xl"
                    data-testid="apt-client-phone"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any notes..."
                  className="mt-1 rounded-xl"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          {selectedService && selectedStaff && (
            <div className="bg-[#FAF9F6] rounded-xl p-4">
              <h4 className="font-medium text-[#1C1C1C] mb-2">Summary</h4>
              <div className="space-y-1 text-sm">
                <p><span className="text-[#6B6B6B]">Service:</span> {selectedService.name}</p>
                <p><span className="text-[#6B6B6B]">With:</span> {selectedStaff.name}</p>
                <p><span className="text-[#6B6B6B]">When:</span> {format(formData.date, 'PPP')} at {formData.time}</p>
                <p><span className="text-[#6B6B6B]">Duration:</span> {selectedService.duration} min</p>
                <p className="font-medium pt-2 border-t border-[#E5E5E0] mt-2">
                  <span className="text-[#6B6B6B]">Price:</span> €{selectedService.price}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.service_id || !formData.staff_id || !formData.client_name}
              className="flex-1 rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
              data-testid="create-apt-btn"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Create Appointment'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewAppointmentModal;
