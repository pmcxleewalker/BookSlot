import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Plus, Search, Filter, MoreHorizontal, Check, X, Clock } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from '../../components/ui/dropdown-menu';
import { appointmentsAPI } from '../../lib/api';
import { toast } from 'sonner';
import NewAppointmentModal from '../../components/NewAppointmentModal';

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadAppointments();
  }, [filter]);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter !== 'all') {
        params.status = filter;
      }
      const data = await appointmentsAPI.list(params);
      setAppointments(data);
    } catch (error) {
      console.error('Failed to load appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (appointmentId) => {
    try {
      await appointmentsAPI.complete(appointmentId);
      toast.success('Appointment marked as completed');
      loadAppointments();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleCancel = async (appointmentId) => {
    try {
      await appointmentsAPI.cancel(appointmentId, 'Cancelled by staff');
      toast.success('Appointment cancelled');
      loadAppointments();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleNoShow = async (appointmentId) => {
    try {
      await appointmentsAPI.markNoShow(appointmentId);
      toast.success('Marked as no-show');
      loadAppointments();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      confirmed: 'status-confirmed',
      pending: 'status-pending',
      cancelled: 'status-cancelled',
      completed: 'status-completed',
      no_show: 'bg-[#6B6B6B]/10 text-[#6B6B6B]'
    };
    return styles[status] || styles.pending;
  };

  return (
    <DashboardLayout title="Appointments">
      <div className="space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-2">
            {['all', 'confirmed', 'pending', 'completed', 'cancelled'].map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
                className={`rounded-xl capitalize ${
                  filter === f ? 'bg-[#2E473B] hover:bg-[#243A2F] text-white' : ''
                }`}
                data-testid={`filter-${f}`}
              >
                {f}
              </Button>
            ))}
          </div>
          <Button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
            data-testid="new-appointment-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Appointment
          </Button>
        </div>

        {/* Appointments List */}
        <div className="bg-white rounded-2xl border border-[#E5E5E0] overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-[#2E473B]/20 border-t-[#2E473B] rounded-full animate-spin mx-auto" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="empty-state py-12">
              <Clock className="w-12 h-12 text-[#E5E5E0] mx-auto mb-4" />
              <p className="text-[#6B6B6B]">No appointments found</p>
              <Button
                onClick={() => setShowModal(true)}
                className="mt-4 rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
              >
                Create First Appointment
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead className="bg-[#FAF9F6]">
                  <tr>
                    <th>Client</th>
                    <th>Service</th>
                    <th>Staff</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th>Price</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((apt) => (
                    <tr key={apt.appointment_id} data-testid={`apt-row-${apt.appointment_id}`}>
                      <td>
                        <div>
                          <p className="font-medium text-[#1C1C1C]">{apt.client_name}</p>
                          {apt.client_email && (
                            <p className="text-xs text-[#6B6B6B]">{apt.client_email}</p>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div 
                            className="service-color" 
                            style={{ backgroundColor: apt.staff_color || '#2E473B' }}
                          />
                          {apt.service_name}
                        </div>
                      </td>
                      <td>{apt.staff_name}</td>
                      <td>
                        <div>
                          <p className="font-medium text-[#1C1C1C]">
                            {format(new Date(apt.start_time), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-[#6B6B6B]">
                            {format(new Date(apt.start_time), 'h:mm a')} - {format(new Date(apt.end_time), 'h:mm a')}
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(apt.status)}`}>
                          {apt.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="font-medium">€{apt.price}</td>
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {apt.status === 'confirmed' && (
                              <>
                                <DropdownMenuItem onClick={() => handleComplete(apt.appointment_id)}>
                                  <Check className="w-4 h-4 mr-2" />
                                  Mark Complete
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleNoShow(apt.appointment_id)}>
                                  <Clock className="w-4 h-4 mr-2" />
                                  Mark No-Show
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                              <DropdownMenuItem 
                                onClick={() => handleCancel(apt.appointment_id)}
                                className="text-red-600"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <NewAppointmentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          loadAppointments();
          setShowModal(false);
        }}
      />
    </DashboardLayout>
  );
}
