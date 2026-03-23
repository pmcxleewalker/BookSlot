import React, { useState, useEffect } from 'react';
import { Plus, Search, Mail, Phone, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { clientsAPI } from '../../lib/api';
import { toast } from 'sonner';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', notes: '', marketing_consent: false
  });

  useEffect(() => {
    loadClients();
  }, [search]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const params = search ? { search } : {};
      const data = await clientsAPI.list(params);
      setClients(data.clients);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await clientsAPI.create(formData);
      toast.success('Client created');
      loadClients();
      closeModal();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({ name: '', email: '', phone: '', notes: '', marketing_consent: false });
  };

  return (
    <DashboardLayout title="Clients">
      <div className="space-y-6">
        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6B6B]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="pl-10 rounded-xl border-[#E5E5E0]"
              data-testid="client-search"
            />
          </div>
          <Button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
            data-testid="add-client-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Client
          </Button>
        </div>

        {/* Clients List */}
        <div className="bg-white rounded-2xl border border-[#E5E5E0] overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-[#2E473B]/20 border-t-[#2E473B] rounded-full animate-spin mx-auto" />
            </div>
          ) : clients.length === 0 ? (
            <div className="empty-state py-12">
              <p className="text-[#6B6B6B]">
                {search ? 'No clients found' : 'No clients yet'}
              </p>
              {!search && (
                <Button
                  onClick={() => setShowModal(true)}
                  className="mt-4 rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
                >
                  Add First Client
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead className="bg-[#FAF9F6]">
                  <tr>
                    <th>Client</th>
                    <th>Contact</th>
                    <th>Bookings</th>
                    <th>Total Spent</th>
                    <th>Last Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.client_id} data-testid={`client-row-${client.client_id}`}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#2E473B]/10 flex items-center justify-center text-[#2E473B] font-medium">
                            {client.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-[#1C1C1C]">{client.name}</p>
                            {client.tags?.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {client.tags.map(tag => (
                                  <span key={tag} className="text-xs bg-[#E5E5E0] px-2 py-0.5 rounded-full">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1">
                          {client.email && (
                            <div className="flex items-center gap-2 text-sm text-[#6B6B6B]">
                              <Mail className="w-3 h-3" />
                              {client.email}
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-2 text-sm text-[#6B6B6B]">
                              <Phone className="w-3 h-3" />
                              {client.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{client.total_bookings}</td>
                      <td className="font-medium">€{client.total_spent}</td>
                      <td>
                        {client.last_visit ? (
                          <div className="flex items-center gap-2 text-sm text-[#6B6B6B]">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(client.last_visit), 'MMM d, yyyy')}
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {total > 0 && (
          <p className="text-sm text-[#6B6B6B] text-center">
            Showing {clients.length} of {total} clients
          </p>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Client name"
                required
                className="mt-1 rounded-xl"
                data-testid="client-name-input"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="client@example.com"
                className="mt-1 rounded-xl"
                data-testid="client-email-input"
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
                data-testid="client-phone-input"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any notes about this client"
                className="mt-1 rounded-xl"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal} className="flex-1 rounded-xl">
                Cancel
              </Button>
              <Button type="submit" className="flex-1 rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white" data-testid="save-client-btn">
                Add Client
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
