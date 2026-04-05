import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';
import { Search, Filter, Calendar, Clock, User, MoreVertical, X, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';

const AppointmentsPage = () => {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchAppointments();
  }, [statusFilter]);

  const fetchAppointments = async () => {
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const response = await axios.get(`${API}/appointments`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setAppointments(response.data.appointments || []);
    } catch (error) {
      console.error('Failed to load appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      if (newStatus === 'cancelled') {
        await axios.post(`${API}/appointments/${appointmentId}/cancel`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else if (newStatus === 'approved') {
        await axios.post(`${API}/appointments/${appointmentId}/approve`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Booking approved!');
        fetchAppointments();
        return;
      } else if (newStatus === 'rejected') {
        await axios.post(`${API}/appointments/${appointmentId}/reject`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Booking rejected');
        fetchAppointments();
        return;
      } else {
        await axios.put(`${API}/appointments/${appointmentId}`, { status: newStatus }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      toast.success(`Appointment ${newStatus}`);
      fetchAppointments();
    } catch (error) {
      toast.error('Failed to update appointment');
    }
  };

  // Count pending approvals
  const pendingCount = appointments.filter(a => a.status === 'pending').length;

  const filteredAppointments = appointments.filter(appt => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        appt.client_name?.toLowerCase().includes(searchLower) ||
        appt.client_email?.toLowerCase().includes(searchLower) ||
        appt.appointment_id?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'badge-pending',
      confirmed: 'badge-confirmed',
      completed: 'badge-completed',
      cancelled: 'badge-cancelled',
      no_show: 'badge-cancelled'
    };
    return badges[status] || 'badge-pending';
  };

  return (
    <TenantLayout title="Appointments">
      {/* Pending Approvals Alert */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-amber-800">{pendingCount} booking{pendingCount > 1 ? 's' : ''} awaiting approval</p>
              <p className="text-sm text-amber-700">Review and approve or reject pending bookings</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={() => setStatusFilter('pending')}
          >
            View Pending
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
          <Input
            placeholder="Search by client name, email, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="search-appointments"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className={`${statusFilter === status ? 'btn-primary' : ''} ${status === 'pending' && pendingCount > 0 ? 'relative' : ''}`}
              data-testid={`filter-${status}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status === 'pending' && pendingCount > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5">{pendingCount}</span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Appointments Table */}
      <div className="card-flat overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="text-left p-4">Client</th>
                <th className="text-left p-4">Date & Time</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Price</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[#666666]">Loading...</td>
                </tr>
              ) : filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[#666666]">No appointments found</td>
                </tr>
              ) : (
                filteredAppointments.map((appt) => (
                  <tr key={appt.appointment_id} className={`table-row ${appt.status === 'pending' ? 'bg-amber-50' : ''}`} data-testid={`appt-row-${appt.appointment_id}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#121212] rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {appt.client_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-[#0A0A0A]">{appt.client_name || 'Walk-in'}</p>
                          <p className="text-sm text-[#666666]">{appt.client_email || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#666666]" />
                        <span className="text-[#0A0A0A]">
                          {format(parseISO(appt.start_time), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-4 h-4 text-[#666666]" />
                        <span className="text-sm text-[#666666]">
                          {format(parseISO(appt.start_time), 'h:mm a')}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={getStatusBadge(appt.status)}>{appt.status}</span>
                      {appt.source === 'online' && (
                        <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Online</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-[#0A0A0A]">€{appt.total_price || 0}</span>
                    </td>
                    <td className="p-4 text-right">
                      {/* Quick Approve/Reject buttons for pending */}
                      {appt.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2 mb-2">
                          <Button 
                            size="sm" 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleStatusChange(appt.appointment_id, 'approved')}
                            data-testid={`approve-${appt.appointment_id}`}
                          >
                            <Check className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() => handleStatusChange(appt.appointment_id, 'rejected')}
                            data-testid={`reject-${appt.appointment_id}`}
                          >
                            <X className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`appt-actions-${appt.appointment_id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {appt.status === 'confirmed' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(appt.appointment_id, 'completed')}>
                              <Check className="w-4 h-4 mr-2" /> Mark Complete
                            </DropdownMenuItem>
                          )}
                          {(appt.status === 'pending' || appt.status === 'confirmed') && (
                            <DropdownMenuItem 
                              onClick={() => handleStatusChange(appt.appointment_id, 'cancelled')}
                              className="text-red-600"
                            >
                              <X className="w-4 h-4 mr-2" /> Cancel
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </TenantLayout>
  );
};

export default AppointmentsPage;
