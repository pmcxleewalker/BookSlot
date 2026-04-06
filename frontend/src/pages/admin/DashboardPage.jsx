import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { 
  Clock, Check, X, Phone, Mail, ChevronRight, Plus, AlertCircle, User
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { format, parseISO, isToday, isTomorrow, differenceInMinutes } from 'date-fns';

const DashboardPage = () => {
  const { tenant, token } = useAuth();
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchTodayData();
    // Update time every minute
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchTodayData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const [apptRes, pendingRes] = await Promise.all([
        axios.get(`${API}/appointments`, {
          params: { start_date: today, end_date: today + 'T23:59:59' },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/appointments`, {
          params: { status: 'pending' },
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      // Sort by start time
      const sorted = (apptRes.data.appointments || []).sort((a, b) => 
        new Date(a.start_time) - new Date(b.start_time)
      );
      setTodayAppointments(sorted);
      setPendingApprovals(pendingRes.data.appointments || []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (appointmentId) => {
    try {
      await axios.post(`${API}/appointments/${appointmentId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Approved!');
      fetchTodayData();
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleReject = async (appointmentId) => {
    try {
      await axios.post(`${API}/appointments/${appointmentId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Rejected');
      fetchTodayData();
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  const handleMarkComplete = async (appointmentId) => {
    try {
      await axios.put(`${API}/appointments/${appointmentId}`, { status: 'completed' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Marked complete');
      fetchTodayData();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const getTimeUntil = (startTime) => {
    const start = parseISO(startTime);
    const mins = differenceInMinutes(start, currentTime);
    if (mins < 0) return null;
    if (mins === 0) return 'Now';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const getAppointmentStatus = (appt) => {
    const start = parseISO(appt.start_time);
    const end = parseISO(appt.end_time);
    const now = currentTime;
    
    if (appt.status === 'completed') return 'completed';
    if (appt.status === 'cancelled') return 'cancelled';
    if (now >= start && now <= end) return 'in-progress';
    if (now > end) return 'overdue';
    return 'upcoming';
  };

  const urlPrefix = tenantSlug ? `/${tenantSlug}` : '';

  // Group: In Progress, Upcoming, Completed
  const inProgress = todayAppointments.filter(a => getAppointmentStatus(a) === 'in-progress');
  const upcoming = todayAppointments.filter(a => getAppointmentStatus(a) === 'upcoming');
  const completed = todayAppointments.filter(a => ['completed', 'overdue'].includes(getAppointmentStatus(a)));
  const cancelled = todayAppointments.filter(a => getAppointmentStatus(a) === 'cancelled');

  return (
    <TenantLayout title="Today">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-[#666]">Loading...</div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          {/* Current Time Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-3xl font-light text-[#0A0A0A]">
                {format(currentTime, 'EEEE, MMMM d')}
              </p>
              <p className="text-5xl font-semibold text-[#0A0A0A] font-mono mt-1">
                {format(currentTime, 'HH:mm')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold text-[#0A0A0A]">{todayAppointments.length}</p>
              <p className="text-sm text-[#666]">appointments today</p>
            </div>
          </div>

          {/* Pending Approvals Alert */}
          {pendingApprovals.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <span className="font-medium text-amber-800">
                    {pendingApprovals.length} booking{pendingApprovals.length > 1 ? 's' : ''} awaiting approval
                  </span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-amber-300 text-amber-700"
                  onClick={() => navigate(`${urlPrefix}/calendar`)}
                >
                  Review
                </Button>
              </div>
            </div>
          )}

          {/* Quick Add Button */}
          <Button 
            className="w-full mb-6 btn-primary h-12 text-base"
            onClick={() => navigate(`${urlPrefix}/calendar`)}
            data-testid="quick-add-btn"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Appointment
          </Button>

          {/* In Progress */}
          {inProgress.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-3">
                In Progress
              </h2>
              {inProgress.map((appt) => (
                <AppointmentCard 
                  key={appt.appointment_id} 
                  appt={appt} 
                  status="in-progress"
                  onComplete={() => handleMarkComplete(appt.appointment_id)}
                />
              ))}
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">
                Coming Up
              </h2>
              <div className="space-y-2">
                {upcoming.map((appt) => (
                  <AppointmentCard 
                    key={appt.appointment_id} 
                    appt={appt} 
                    status="upcoming"
                    timeUntil={getTimeUntil(appt.start_time)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No appointments today */}
          {todayAppointments.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-[#FAFAFA] rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-[#999]" />
              </div>
              <p className="text-lg text-[#666] mb-2">No appointments today</p>
              <p className="text-sm text-[#999] mb-6">Your schedule is clear</p>
              <Button 
                variant="outline"
                onClick={() => navigate(`${urlPrefix}/calendar`)}
              >
                View Calendar
              </Button>
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div className="mt-8 pt-6 border-t border-[#E5E5E5]">
              <h2 className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-3">
                Completed ({completed.length})
              </h2>
              <div className="space-y-1 opacity-60">
                {completed.map((appt) => (
                  <div 
                    key={appt.appointment_id} 
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="text-[#666]">{appt.client_name}</span>
                    </div>
                    <span className="text-[#999] font-mono text-xs">
                      {format(parseISO(appt.start_time), 'HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </TenantLayout>
  );
};

// Appointment Card Component
const AppointmentCard = ({ appt, status, timeUntil, onComplete }) => {
  const start = parseISO(appt.start_time);
  const end = parseISO(appt.end_time);
  const duration = differenceInMinutes(end, start);
  
  return (
    <div 
      className={`bg-white border rounded-lg p-4 ${
        status === 'in-progress' 
          ? 'border-emerald-300 bg-emerald-50' 
          : 'border-[#E5E5E5]'
      }`}
      data-testid={`appt-card-${appt.appointment_id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Time Column */}
          <div className="text-center min-w-[60px]">
            <p className="text-xl font-semibold text-[#0A0A0A] font-mono">
              {format(start, 'HH:mm')}
            </p>
            <p className="text-xs text-[#999]">{duration} min</p>
          </div>
          
          {/* Divider */}
          <div className={`w-1 h-14 rounded-full ${
            status === 'in-progress' ? 'bg-emerald-500' : 'bg-[#E5E5E5]'
          }`} />
          
          {/* Details */}
          <div>
            <p className="font-medium text-[#0A0A0A] text-lg">
              {appt.client_name || 'Walk-in'}
            </p>
            <p className="text-sm text-[#666]">{appt.service_name || 'Service'}</p>
            <div className="flex items-center gap-3 mt-2">
              {appt.client_phone && (
                <a href={`tel:${appt.client_phone}`} className="text-[#666] hover:text-[#0A0A0A]">
                  <Phone className="w-4 h-4" />
                </a>
              )}
              {appt.client_email && (
                <a href={`mailto:${appt.client_email}`} className="text-[#666] hover:text-[#0A0A0A]">
                  <Mail className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
        
        {/* Action / Time Until */}
        <div className="text-right">
          {status === 'in-progress' && onComplete && (
            <Button 
              size="sm" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onComplete}
            >
              <Check className="w-4 h-4 mr-1" />
              Done
            </Button>
          )}
          {status === 'upcoming' && timeUntil && (
            <div className="text-right">
              <p className="text-lg font-semibold text-[#0A0A0A] font-mono">{timeUntil}</p>
              <p className="text-xs text-[#999]">until start</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
