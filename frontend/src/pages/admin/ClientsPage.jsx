import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Search, User, Mail, Phone, Calendar, Edit2 } from 'lucide-react';
import { format } from 'date-fns';

const ClientsPage = () => {
  const { token } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  });

  useEffect(() => {
    fetchClients();
  }, [search]);

  const fetchClients = async () => {
    try {
      const params = search ? { search } : {};
      const response = await axios.get(`${API}/clients`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setClients(response.data.clients || []);
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (client = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        notes: client.notes || ''
      });
    } else {
      setEditingClient(null);
      setFormData({ name: '', email: '', phone: '', notes: '' });
    }
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('Client name is required');
      return;
    }

    try {
      if (editingClient) {
        await axios.put(`${API}/clients/${editingClient.client_id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Client updated');
      } else {
        await axios.post(`${API}/clients`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Client added');
      }
      setShowDialog(false);
      fetchClients();
    } catch (error) {
      toast.error('Failed to save client');
    }
  };

  return (
    <AdminLayout title="Clients">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="search-clients"
          />
        </div>
        <Button 
          onClick={() => openDialog()} 
          className="btn-primary flex items-center gap-2"
          data-testid="add-client-btn"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </Button>
      </div>

      {/* Clients Table */}
      <div className="card-flat overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="text-left p-4">Client</th>
                <th className="text-left p-4">Contact</th>
                <th className="text-left p-4">Appointments</th>
                <th className="text-left p-4">Total Spent</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[#666666]">Loading...</td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[#666666]">
                    {search ? 'No clients found' : 'No clients yet'}
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.client_id} className="table-row" data-testid={`client-${client.client_id}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#121212] rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {client.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-[#0A0A0A]">{client.name}</p>
                          {client.tags?.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {client.tags.map((tag, idx) => (
                                <span key={idx} className="text-xs bg-[#FAFAFA] px-2 py-0.5 text-[#666666]">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {client.email && (
                        <div className="flex items-center gap-2 text-sm text-[#666666]">
                          <Mail className="w-4 h-4" />
                          {client.email}
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center gap-2 text-sm text-[#666666] mt-1">
                          <Phone className="w-4 h-4" />
                          {client.phone}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-[#0A0A0A]">{client.total_appointments || 0}</span>
                      {client.last_visit && (
                        <p className="text-xs text-[#666666] mt-1">
                          Last: {format(new Date(client.last_visit), 'MMM d, yyyy')}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="font-mono font-semibold text-[#0A0A0A]">
                        €{client.total_spent || 0}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => openDialog(client)}
                        data-testid={`edit-client-${client.client_id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Edit Client' : 'Add Client'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-sm font-medium">Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name"
                className="mt-1.5"
                data-testid="client-name-input"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="client@email.com"
                className="mt-1.5"
                data-testid="client-email-input"
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
                data-testid="client-phone-input"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Notes</Label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any notes about this client..."
                rows={3}
                className="mt-1.5 input-swiss resize-none"
                data-testid="client-notes-input"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1 btn-primary" onClick={handleSubmit} data-testid="save-client-btn">
                {editingClient ? 'Update' : 'Add Client'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default ClientsPage;
