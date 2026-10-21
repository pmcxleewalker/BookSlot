import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Checkbox } from '../../components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Search, User, Mail, Phone, Calendar, Edit2, Star, AlertCircle, Scissors, Trash2 } from 'lucide-react';
import { errorMessage } from '../../lib/api';
import { formatMoney, parseLocal, STATUS_LABELS, STATUS_STYLES } from '../../lib/utils';
import { format } from 'date-fns';

const ClientsPage = () => {
  const { token, currency, isManager } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [filterVip, setFilterVip] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
    is_vip: false,
    service_notes: '',
    important_info: '',
    birthday: ''
  });

  useEffect(() => {
    fetchClients();
  }, [search, filterVip]);

  const fetchClients = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      
      const response = await axios.get(`${API}/clients`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let data = response.data.clients || [];
      if (filterVip) {
        data = data.filter(c => c.is_vip);
      }
      setClients(data);
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
        notes: client.notes || '',
        is_vip: client.is_vip || false,
        service_notes: client.service_notes || '',
        important_info: client.important_info || '',
        birthday: client.birthday || ''
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        notes: '',
        is_vip: false,
        service_notes: '',
        important_info: '',
        birthday: ''
      });
    }
    setShowDialog(true);
  };

  const viewClientDetail = async (client) => {
    setSelectedClient(client);
    setShowDetailDialog(true);
    try {
      const r = await axios.get(`${API}/clients/${client.client_id}`);
      setSelectedClient(r.data.client);
    } catch (e) { /* keep summary */ }
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
      toast.error(errorMessage(error, 'Failed to save client'));
    }
  };

  const toggleVip = async (client) => {
    try {
      await axios.put(`${API}/clients/${client.client_id}`, {
        is_vip: !client.is_vip
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(client.is_vip ? 'VIP status removed' : 'Marked as VIP');
      setShowDetailDialog(false); // Close dialog after action
      fetchClients();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to update VIP status'));
    }
  };

  const deleteClient = async (clientId) => {
    if (!window.confirm('Delete this client? Their contact details are removed from past appointments too. This cannot be undone.')) return;
    
    try {
      await axios.delete(`${API}/clients/${clientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Client deleted');
      fetchClients();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to delete client'));
    }
  };

  const vipCount = clients.filter(c => c.is_vip).length;

  return (
    <TenantLayout title="Clients">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="pl-10 w-64"
              data-testid="search-clients"
            />
          </div>
          <Button
            variant={filterVip ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterVip(!filterVip)}
            className={filterVip ? "bg-yellow-500 hover:bg-yellow-600" : ""}
            data-testid="filter-vip"
          >
            <Star className={`w-4 h-4 mr-1 ${filterVip ? 'fill-white' : ''}`} />
            VIP ({vipCount})
          </Button>
        </div>
        <Button onClick={() => openDialog()} className="btn-primary flex items-center gap-2" data-testid="add-client-btn">
          <Plus className="w-4 h-4" />
          Add Client
        </Button>
      </div>

      {/* Client List */}
      {loading ? (
        <div className="py-12 text-center text-[#666666]">Loading...</div>
      ) : clients.length === 0 ? (
        <div className="card-flat py-12 text-center">
          <User className="w-12 h-12 text-[#E5E5E5] mx-auto mb-4" />
          <h3 className="font-semibold text-[#0A0A0A] mb-2">No clients found</h3>
          <p className="text-[#666666] mb-4">
            {search || filterVip ? 'Try adjusting your filters' : 'Add your first client to get started'}
          </p>
          {!search && !filterVip && (
            <Button onClick={() => openDialog()} className="btn-primary">Add First Client</Button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <div 
              key={client.client_id} 
              className="card-hover cursor-pointer relative"
              onClick={() => viewClientDetail(client)}
              data-testid={`client-${client.client_id}`}
            >
              {/* VIP Badge */}
              {client.is_vip && (
                <div className="absolute -top-2 -right-2 bg-yellow-500 text-white p-1 rounded-full">
                  <Star className="w-4 h-4 fill-white" />
                </div>
              )}

              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-[#666666]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0A0A0A]">{client.name}</h3>
                    {client.is_vip && <span className="text-xs text-yellow-600 font-medium">VIP Client</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                {client.email && (
                  <div className="flex items-center gap-2 text-[#666666]">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-[#666666]">
                    <Phone className="w-4 h-4" />
                    {client.phone}
                  </div>
                )}
                <div className="flex items-center gap-2 text-[#666666]">
                  <Calendar className="w-4 h-4" />
                  {client.total_appointments || 0} visits • {formatMoney(client.total_spent || 0, currency)} spent
                </div>
              </div>

              {/* Important Info Warning */}
              {client.important_info && (
                <div className="mt-3 pt-3 border-t border-[#E5E5E5]">
                  <div className="flex items-start gap-2 text-amber-600 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{client.important_info}</span>
                  </div>
                </div>
              )}

              {/* Service Notes Preview */}
              {client.service_notes && (
                <div className="mt-2 flex items-start gap-2 text-[#666666] text-xs">
                  <Scissors className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-1">{client.service_notes}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Client Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Edit Client' : 'Add New Client'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Jane Smith"
                  data-testid="client-name"
                />
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="jane@email.com"
                />
              </div>

              <div>
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="+1 555 123 4567"
                />
              </div>
            </div>

            <div>
              <Label>Birthday</Label>
              <Input
                type="date"
                value={formData.birthday}
                onChange={(e) => setFormData({...formData, birthday: e.target.value})}
              />
            </div>

            {/* VIP Checkbox */}
            <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <Checkbox
                id="vip"
                checked={formData.is_vip}
                onCheckedChange={(checked) => setFormData({...formData, is_vip: checked})}
                data-testid="vip-checkbox"
              />
              <div>
                <label htmlFor="vip" className="font-medium text-[#0A0A0A] cursor-pointer flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  VIP Client
                </label>
                <p className="text-xs text-[#666666]">Mark as VIP for priority treatment</p>
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Scissors className="w-4 h-4" />
                Service Notes
              </Label>
              <Textarea
                value={formData.service_notes}
                onChange={(e) => setFormData({...formData, service_notes: e.target.value})}
                placeholder="Preferred services, usual style, color preferences..."
                rows={2}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-4 h-4" />
                Important Information
              </Label>
              <Textarea
                value={formData.important_info}
                onChange={(e) => setFormData({...formData, important_info: e.target.value})}
                placeholder="Allergies, sensitivities, special requirements..."
                rows={2}
                className="border-amber-200 focus:border-amber-400"
              />
            </div>

            <div>
              <Label>General Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Any other notes about this client..."
                rows={2}
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

      {/* Client Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedClient?.is_vip && <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
              {selectedClient?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedClient && (
            <div className="mt-4 space-y-4">
              {/* Contact Info */}
              <div className="space-y-2">
                {selectedClient.email && (
                  <div className="flex items-center gap-2 text-[#666666]">
                    <Mail className="w-4 h-4" />
                    {selectedClient.email}
                  </div>
                )}
                {selectedClient.phone && (
                  <div className="flex items-center gap-2 text-[#666666]">
                    <Phone className="w-4 h-4" />
                    {selectedClient.phone}
                  </div>
                )}
                {selectedClient.birthday && (
                  <div className="flex items-center gap-2 text-[#666666]">
                    <Calendar className="w-4 h-4" />
                    Birthday: {selectedClient.birthday}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-[#FAFAFA] rounded">
                <div>
                  <p className="text-2xl font-bold text-[#0A0A0A]">{selectedClient.total_appointments || 0}</p>
                  <p className="text-xs text-[#666666]">Total Visits</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#3730A3]">{formatMoney(selectedClient.total_spent || 0, currency)}</p>
                  <p className="text-xs text-[#666666]">Total Spent</p>
                </div>
              </div>

              {/* Important Info */}
              {selectedClient.important_info && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                  <div className="flex items-center gap-2 text-amber-700 font-medium mb-1">
                    <AlertCircle className="w-4 h-4" />
                    Important Information
                  </div>
                  <p className="text-sm text-amber-800">{selectedClient.important_info}</p>
                </div>
              )}

              {/* Service Notes */}
              {selectedClient.service_notes && (
                <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded">
                  <div className="flex items-center gap-2 text-[#666666] font-medium mb-1">
                    <Scissors className="w-4 h-4" />
                    Service Preferences
                  </div>
                  <p className="text-sm">{selectedClient.service_notes}</p>
                </div>
              )}

              {/* General Notes */}
              {selectedClient.notes && (
                <div>
                  <p className="text-sm font-medium text-[#666666] mb-1">Notes</p>
                  <p className="text-sm">{selectedClient.notes}</p>
                </div>
              )}

              {/* History */}
              {selectedClient.service_history?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-[#666666] mb-2">Appointment history</p>
                  <div className="max-h-48 overflow-y-auto border border-[#E5E5E5] divide-y divide-[#E5E5E5]">
                    {selectedClient.service_history.map((h) => (
                      <div key={h.appointment_id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div>
                          <p className="text-[#0A0A0A]">{h.service_name} <span className="text-[#666666]">with {h.staff}</span></p>
                          <p className="text-xs text-[#666666]">{format(parseLocal(h.date), 'd MMM yyyy, HH:mm')}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[h.status] || ''}`}>{STATUS_LABELS[h.status] || h.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-[#E5E5E5]">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => toggleVip(selectedClient)}
                >
                  <Star className={`w-4 h-4 mr-2 ${selectedClient.is_vip ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                  {selectedClient.is_vip ? 'Remove VIP' : 'Make VIP'}
                </Button>
                <Button 
                  className="flex-1 btn-primary"
                  onClick={() => {
                    setShowDetailDialog(false);
                    openDialog(selectedClient);
                  }}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                {isManager && <Button 
                  variant="outline"
                  className="text-red-500 border-red-200"
                  onClick={() => {
                    deleteClient(selectedClient.client_id);
                    setShowDetailDialog(false);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
};

export default ClientsPage;
