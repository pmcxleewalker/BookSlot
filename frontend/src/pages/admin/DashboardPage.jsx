import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Check, Phone, Plus, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { format, parseISO, differenceInMinutes } from 'date-fns';

const DashboardPage = () => {
  const { token } = useAuth();
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const urlPrefix = tenantSlug ? `/${tenantSlug}` : '';

  useEffect(() => {
    fetchTodayData();
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
      
      const sorted = (apptRes.data.appointments || [])
        .filter(a => a.status !== 'cancelled')
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      
      setAppointments(sorted);
      setPendingApprovals(pendingRes.data.appointments || []);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await axios.post(`${API}/appointments/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Approved');
      fetchTodayData();
    } catch (error) {
      toast.error('Failed');
    }
  };

  const handleComplete = async (id) => {
    try {
      await axios.put(`${API}/appointments/${id}`, { status: 'completed' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Done');
      fetchTodayData();
    } catch (error) {
      toast.error('Failed');
    }
  };

  const getTimeUntil = (startTime) => {
    const start = parseISO(startTime);
    const mins = differenceInMinutes(start, currentTime);
    if (mins <= 0) return null;
    if (mins < 60) return `in ${mins}m`;
    return `in ${Math.floor(mins / 60)}h`;
  };

  const upcoming = appointments.filter(a => a.status === 'confirmed');
  const completed = appointments.filter(a => a.status === 'completed');

  return (
    <TenantLayout title="Today">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-[#999]">Loading...</div>
        </div>
      ) : (
        <div className="max-w-xl mx-auto">
          {/* Time Display */}
          <div className="text-center mb-8">
            <p className="text-[#666] text-sm">{format(currentTime, 'EEEE, MMMM d')}</p>
            <p className="text-5xl font-light text-[#0A0A0A] mt-1 font-mono tracking-tight">
              {format(currentTime, 'HH:mm')}
            </p>
          </div>

          {/* Pending Approvals */}
          {pendingApprovals.length > 0 && (
            <div className="mb-6">
              <button 
                onClick={() => navigate(`${urlPrefix}/calendar`)}
                className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between hover:bg-amber-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <span className="text-amber-700 font-semibold">{pendingApprovals.length}</span>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-amber-800">Pending approval</p>
                    <p className="text-sm text-amber-600">Tap to review</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-amber-400" />
              </button>
            </div>
          )}

          {/* Quick Add */}
          <Button 
            className="w-full mb-8 h-12 bg-[#0A0A0A] hover:bg-[#1a1a1a] text-white rounded-xl text-base font-medium"
            onClick={() => navigate(`${urlPrefix}/calendar`)}
          >
            <Plus className="w-5 h-5 mr-2" />
            New Appointment
          </Button>

          {/* Appointments */}
          {upcoming.length === 0 && completed.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-[#F5F5F5] rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-[#CCC]" />
              </div>
              <p className="text-[#666]">No appointments today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((appt) => {
                const timeUntil = getTimeUntil(appt.start_time);
                return (
                  <div 
                    key={appt.appointment_id}
                    className="bg-white rounded-xl p-4 border border-[#EAEAEA]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[50px]">
                          <p className="text-lg font-semibold text-[#0A0A0A] font-mono">
                            {format(parseISO(appt.start_time), 'HH:mm')}
                          </p>
                          {timeUntil && (
                            <p className="text-[10px] text-[#999] uppercase tracking-wide">{timeUntil}</p>
                          )}
                        </div>
                        <div className="w-px h-10 bg-[#EAEAEA]" />
                        <div>
                          <p className="font-medium text-[#0A0A0A]">{appt.client_name || 'Walk-in'}</p>
                          <p className="text-sm text-[#666]">{appt.service_name || 'Service'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {appt.client_phone && (
                          <a href={`tel:${appt.client_phone}`} className="p-2 text-[#999] hover:text-[#0A0A0A] rounded-lg hover:bg-[#F5F5F5]">
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-8 px-3 rounded-lg"
                          onClick={() => handleComplete(appt.appointment_id)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Completed */}
              {completed.length > 0 && (
                <div className="pt-4 mt-4">
                  <p className="text-xs text-[#999] uppercase tracking-wider mb-2 px-1">
                    Completed · {completed.length}
                  </p>
                  {completed.map((appt) => (
                    <div 
                      key={appt.appointment_id}
                      className="flex items-center gap-4 py-2 px-1 opacity-50"
                    >
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm text-[#666]">{appt.client_name}</span>
                      <span className="text-xs text-[#999] ml-auto font-mono">
                        {format(parseISO(appt.start_time), 'HH:mm')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </TenantLayout>
  );
};

export default DashboardPage;
