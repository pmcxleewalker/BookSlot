import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
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
    <AdminLayout title="Appointments">
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
        <div className="flex gap-2">
          {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className={statusFilter === status ? 'btn-primary' : ''}
              data-testid={`filter-${status}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
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
                  <tr key={appt.appointment_id} className="table-row" data-testid={`appt-row-${appt.appointment_id}`}>
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
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-[#0A0A0A]">€{appt.total_price || 0}</span>
                    </td>
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`appt-actions-${appt.appointment_id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {appt.status === 'pending' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(appt.appointment_id, 'confirmed')}>
                              <Check className="w-4 h-4 mr-2" /> Confirm
                            </DropdownMenuItem>
                          )}
                          {(appt.status === 'pending' || appt.status === 'confirmed') && (
                            <>
                              <DropdownMenuItem onClick={() => handleStatusChange(appt.appointment_id, 'completed')}>
                                <Check className="w-4 h-4 mr-2" /> Mark Complete
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleStatusChange(appt.appointment_id, 'cancelled')}
                                className="text-red-600"
                              >
                                <X className="w-4 h-4 mr-2" /> Cancel
                              </DropdownMenuItem>
                            </>
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
    </AdminLayout>
  );
};

export default AppointmentsPage;
