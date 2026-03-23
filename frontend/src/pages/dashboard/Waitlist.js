import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { 
  Clock, UserPlus, Calendar, Bell, Check, X, RefreshCw,
  Phone, Mail, Plus, MoreHorizontal, Send
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

const statusConfig = {
  pending: { label: 'Waiting', color: 'bg-amber-100 text-amber-700' },
  notified: { label: 'Notified', color: 'bg-blue-100 text-blue-700' },
  booked: { label: 'Booked', color: 'bg-green-100 text-green-700' },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-500' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' }
};

const AddToWaitlistModal = ({ services, onAdd }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    service_id: '',
    preferred_date: '',
    preferred_time_start: '',
    preferred_time_end: '',
    any_date: false,
    notes: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.client_name || !formData.service_id) {
      toast.error('Please fill in required fields');
      return;
    }

    setLoading(true);
    try {
      await onAdd(formData);
      setOpen(false);
      setFormData({
        client_name: '',
        client_email: '',
        client_phone: '',
        service_id: '',
        preferred_date: '',
        preferred_time_start: '',
        preferred_time_end: '',
        any_date: false,
        notes: ''
      });
    } catch (error) {
      toast.error(error.message || 'Failed to add to waitlist');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#2E473B] hover:bg-[#243a30] text-white rounded-xl" data-testid="add-waitlist-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add to Waitlist
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Outfit' }}>Add to Waitlist</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-[#6B6B6B]">Client Name *</label>
            <Input
              value={formData.client_name}
              onChange={(e) => setFormData({...formData, client_name: e.target.value})}
              placeholder="John Doe"
              className="rounded-xl border-[#E5E5E0]"
              data-testid="waitlist-name-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-[#6B6B6B]">Email</label>
              <Input
                type="email"
                value={formData.client_email}
                onChange={(e) => setFormData({...formData, client_email: e.target.value})}
                placeholder="email@example.com"
                className="rounded-xl border-[#E5E5E0]"
              />
            </div>
            <div>
              <label className="text-sm text-[#6B6B6B]">Phone</label>
              <Input
                value={formData.client_phone}
                onChange={(e) => setFormData({...formData, client_phone: e.target.value})}
                placeholder="+1 555-0123"
                className="rounded-xl border-[#E5E5E0]"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-[#6B6B6B]">Service *</label>
            <Select 
              value={formData.service_id} 
              onValueChange={(v) => setFormData({...formData, service_id: v})}
            >
              <SelectTrigger className="rounded-xl border-[#E5E5E0]" data-testid="waitlist-service-select">
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
                {services.map(s => (
                  <SelectItem key={s.service_id} value={s.service_id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-[#6B6B6B]">Preferred Date</label>
            <Input
              type="date"
              value={formData.preferred_date}
              onChange={(e) => setFormData({...formData, preferred_date: e.target.value})}
              className="rounded-xl border-[#E5E5E0]"
              disabled={formData.any_date}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="any_date"
              checked={formData.any_date}
              onChange={(e) => setFormData({...formData, any_date: e.target.checked})}
              className="rounded"
            />
            <label htmlFor="any_date" className="text-sm text-[#6B6B6B]">
              Any available date
            </label>
          </div>
          <div>
            <label className="text-sm text-[#6B6B6B]">Notes</label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Special requests..."
              className="rounded-xl border-[#E5E5E0]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-[#2E473B] hover:bg-[#243a30] text-white rounded-xl"
              data-testid="waitlist-submit-btn"
            >
              {loading ? 'Adding...' : 'Add to Waitlist'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const Waitlist = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('pending');
  const { user } = useAuth();

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter && filter !== 'all') params.append('status', filter);
      
      const [entriesRes, statsRes] = await Promise.all([
        api.get(`/api/waitlist?${params}`),
        api.get('/api/waitlist/stats/summary')
      ]);
      
      setEntries(entriesRes.entries || []);
      setStats(statsRes);
    } catch (error) {
      console.error('Error fetching waitlist:', error);
      if (error.message?.includes('upgrade')) {
        toast.error('Waitlist feature requires Growth plan or higher');
      } else {
        toast.error('Failed to load waitlist');
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchServices = useCallback(async () => {
    try {
      const res = await api.get('/api/services');
      setServices(res.services || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchServices();
  }, [fetchEntries, fetchServices]);

  const handleAddToWaitlist = async (formData) => {
    await api.post('/api/waitlist', formData);
    toast.success('Added to waitlist');
    fetchEntries();
  };

  const handleNotify = async (waitlistId) => {
    try {
      await api.post(`/api/waitlist/${waitlistId}/notify`);
      toast.success('Notification sent');
      fetchEntries();
    } catch (error) {
      toast.error(error.message || 'Failed to send notification');
    }
  };

  const handleCancel = async (waitlistId) => {
    try {
      await api.delete(`/api/waitlist/${waitlistId}`);
      toast.success('Removed from waitlist');
      fetchEntries();
    } catch (error) {
      toast.error(error.message || 'Failed to remove');
    }
  };

  return (
    <DashboardLayout title="Waitlist">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
            Waitlist
          </h1>
          <p className="text-[#6B6B6B]">Manage clients waiting for appointments</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="icon"
            onClick={fetchEntries}
            className="rounded-xl border-[#E5E5E0]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <AddToWaitlistModal services={services} onAdd={handleAddToWaitlist} />
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-amber-600" />
              <div>
                <p className="text-sm text-amber-700">Waiting</p>
                <p className="text-2xl font-bold text-amber-700" data-testid="stat-pending">
                  {stats.pending}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
            <div className="flex items-center gap-3">
              <Bell className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-blue-700">Notified</p>
                <p className="text-2xl font-bold text-blue-700" data-testid="stat-notified">
                  {stats.notified}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4">
            <div className="flex items-center gap-3">
              <Check className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-green-700">Booked This Month</p>
                <p className="text-2xl font-bold text-green-700" data-testid="stat-booked">
                  {stats.booked_this_month}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { key: 'pending', label: 'Waiting' },
          { key: 'notified', label: 'Notified' },
          { key: 'booked', label: 'Booked' },
          { key: 'all', label: 'All' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              filter === key 
                ? 'bg-[#2E473B] text-white' 
                : 'bg-white text-[#6B6B6B] border border-[#E5E5E0] hover:bg-[#FAF9F6]'
            }`}
            data-testid={`filter-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Entries list */}
      <div className="bg-white rounded-xl border border-[#E5E5E0] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[#6B6B6B]">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="w-12 h-12 mx-auto mb-3 text-[#6B6B6B] opacity-50" />
            <p className="text-[#6B6B6B]">No waitlist entries</p>
            <p className="text-sm text-[#6B6B6B] mt-1">
              Add clients who want appointments when slots open up
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E5E0]">
            {entries.map((entry) => {
              const status = statusConfig[entry.status] || statusConfig.pending;
              
              return (
                <div 
                  key={entry.waitlist_id} 
                  className="p-4 hover:bg-[#FAF9F6] transition-colors"
                  data-testid={`waitlist-entry-${entry.waitlist_id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#2E473B]/10 flex items-center justify-center text-[#2E473B] font-medium">
                        {entry.client_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#1C1C1C]">
                            {entry.client_name}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm text-[#2E473B] mt-1">
                          {entry.service_name}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-[#6B6B6B]">
                          {entry.client_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {entry.client_email}
                            </span>
                          )}
                          {entry.client_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {entry.client_phone}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {entry.any_date 
                              ? 'Any date' 
                              : entry.preferred_date 
                                ? format(new Date(entry.preferred_date), 'MMM d')
                                : 'Flexible'}
                          </span>
                        </div>
                        {entry.notes && (
                          <p className="text-xs text-[#6B6B6B] mt-2 italic">
                            "{entry.notes}"
                          </p>
                        )}
                        <p className="text-xs text-[#6B6B6B] mt-2">
                          Added {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    
                    {entry.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleNotify(entry.waitlist_id)}
                          className="rounded-lg border-[#E5E5E0] text-[#2E473B]"
                          data-testid={`notify-${entry.waitlist_id}`}
                        >
                          <Send className="w-4 h-4 mr-1" />
                          Notify
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancel(entry.waitlist_id)}
                          className="rounded-lg text-red-600 hover:bg-red-50"
                          data-testid={`cancel-${entry.waitlist_id}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Waitlist;
