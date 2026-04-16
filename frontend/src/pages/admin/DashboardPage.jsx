import React, { useState, useEffect, useCallback } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Check, Phone, Plus, ChevronRight, RefreshCw, CalendarDays, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { format, parseISO, differenceInMinutes, isToday, isTomorrow, addDays } from 'date-fns';

const DashboardPage = () => {
  const { token } = useAuth();
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [stats, setStats] = useState({ todayTotal: 0, weekTotal: 0, pendingTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());

  const urlPrefix = tenantSlug ? `/${tenantSlug}` : '';

  const fetchAllData = useCallback(async () => {
    try {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const weekEnd = format(addDays(now, 7), 'yyyy-MM-dd');

      const [todayRes, weekRes, pendingRes] = await Promise.all([
        axios.get(`${API}/appointments`, {
          params: { start_date: today, end_date: today + 'T23:59:59' },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/appointments`, {
          params: { start_date: today, end_date: weekEnd + 'T23:59:59' },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/appointments`, {
          params: { status: 'pending' },
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const todayAppts = (todayRes.data.appointments || [])
        .filter(a => a.status !== 'cancelled')
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

      const allWeekAppts = (weekRes.data.appointments || [])
        .filter(a => a.status !== 'cancelled')
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

      // Upcoming = week appointments minus today's
      const upcomingAppts = allWeekAppts.filter(a => {
        try {
          return !isToday(parseISO(a.start_time));
        } catch { return true; }
      });

      const pending = pendingRes.data.appointments || [];

      setTodayAppointments(todayAppts);
      setUpcomingAppointments(upcomingAppts);
      setPendingApprovals(pending);
      setStats({
        todayTotal: todayAppts.length,
        weekTotal: allWeekAppts.length,
        pendingTotal: pending.length
      });
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial load + auto-refresh every 30s
  useEffect(() => {
    fetchAllData();
    const dataTimer = setInterval(fetchAllData, 30000);
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => { clearInterval(dataTimer); clearInterval(clockTimer); };
  }, [fetchAllData]);

  const handleApprove = async (id) => {
    try {
      await axios.post(`${API}/appointments/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Approved');
      fetchAllData();
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
      fetchAllData();
    } catch (error) {
      toast.error('Failed');
    }
  };

  const getTimeUntil = (startTime) => {
    try {
      const start = parseISO(startTime);
      const mins = differenceInMinutes(start, currentTime);
      if (mins <= 0) return null;
      if (mins < 60) return `in ${mins}m`;
      return `in ${Math.floor(mins / 60)}h`;
    } catch { return null; }
  };

  const formatDayLabel = (startTime) => {
    try {
      const date = parseISO(startTime);
      if (isToday(date)) return 'Today';
      if (isTomorrow(date)) return 'Tomorrow';
      return format(date, 'EEE, MMM d');
    } catch { return ''; }
  };

  // Group upcoming by day
  const groupedUpcoming = upcomingAppointments.reduce((groups, appt) => {
    const label = formatDayLabel(appt.start_time);
    if (!groups[label]) groups[label] = [];
    groups[label].push(appt);
    return groups;
  }, {});

  const todayConfirmed = todayAppointments.filter(a => a.status === 'confirmed');
  const todayCompleted = todayAppointments.filter(a => a.status === 'completed');

  return (
    <TenantLayout title="Today">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-[#999]">Loading...</div>
        </div>
      ) : (
        <div className="max-w-xl mx-auto">
          {/* Time + Refresh */}
          <div className="text-center mb-6">
            <p className="text-[#666] text-sm">{format(currentTime, 'EEEE, MMMM d')}</p>
            <p className="text-5xl font-light text-[#0A0A0A] mt-1 font-mono tracking-tight">
              {format(currentTime, 'HH:mm')}
            </p>
            <button
              onClick={() => { setLoading(true); fetchAllData(); }}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#999] hover:text-[#666] transition-colors"
              data-testid="refresh-dashboard-btn"
            >
              <RefreshCw className="w-3 h-3" />
              Updated {format(lastRefresh, 'HH:mm:ss')}
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3 mb-6" data-testid="dashboard-stats">
            <div className="bg-white rounded-xl p-3 border border-[#EAEAEA] text-center">
              <p className="text-2xl font-semibold text-[#0A0A0A]" data-testid="stat-today">{stats.todayTotal}</p>
              <p className="text-xs text-[#999] mt-0.5">Today</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-[#EAEAEA] text-center">
              <p className="text-2xl font-semibold text-[#0A0A0A]" data-testid="stat-week">{stats.weekTotal}</p>
              <p className="text-xs text-[#999] mt-0.5">This Week</p>
            </div>
            <div className={`rounded-xl p-3 border text-center ${stats.pendingTotal > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#EAEAEA]'}`}>
              <p className={`text-2xl font-semibold ${stats.pendingTotal > 0 ? 'text-amber-700' : 'text-[#0A0A0A]'}`} data-testid="stat-pending">{stats.pendingTotal}</p>
              <p className={`text-xs mt-0.5 ${stats.pendingTotal > 0 ? 'text-amber-600' : 'text-[#999]'}`}>Pending</p>
            </div>
          </div>

          {/* Pending Approvals Banner */}
          {pendingApprovals.length > 0 && (
            <div className="mb-6" data-testid="pending-approvals-banner">
              <button
                onClick={() => navigate(`${urlPrefix}/calendar`)}
                className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between hover:bg-amber-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-amber-700" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-amber-800">{pendingApprovals.length} pending approval{pendingApprovals.length !== 1 ? 's' : ''}</p>
                    <p className="text-sm text-amber-600">Tap to review</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-amber-400" />
              </button>
            </div>
          )}

          {/* Quick Add */}
          <Button
            className="w-full mb-6 h-12 bg-[#0A0A0A] hover:bg-[#1a1a1a] text-white rounded-xl text-base font-medium"
            onClick={() => navigate(`${urlPrefix}/calendar`)}
            data-testid="new-appointment-btn"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Appointment
          </Button>

          {/* Today's Appointments */}
          <div className="mb-8" data-testid="today-appointments-section">
            <h2 className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-3 px-1">
              Today · {todayAppointments.length} appointment{todayAppointments.length !== 1 ? 's' : ''}
            </h2>

            {todayConfirmed.length === 0 && todayCompleted.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-[#EAEAEA]">
                <Clock className="w-6 h-6 text-[#CCC] mx-auto mb-2" />
                <p className="text-sm text-[#666]">No appointments today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayConfirmed.map((appt) => {
                  const timeUntil = getTimeUntil(appt.start_time);
                  return (
                    <div key={appt.appointment_id} className="bg-white rounded-xl p-4 border border-[#EAEAEA]" data-testid={`appt-${appt.appointment_id}`}>
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
                            data-testid={`complete-btn-${appt.appointment_id}`}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {todayCompleted.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-[#999] uppercase tracking-wider mb-2 px-1">
                      Completed · {todayCompleted.length}
                    </p>
                    {todayCompleted.map((appt) => (
                      <div key={appt.appointment_id} className="flex items-center gap-4 py-2 px-1 opacity-50">
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

          {/* Upcoming Appointments (Next 7 Days) */}
          {Object.keys(groupedUpcoming).length > 0 && (
            <div data-testid="upcoming-appointments-section">
              <h2 className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-3 px-1">
                Upcoming · Next 7 Days
              </h2>
              <div className="space-y-4">
                {Object.entries(groupedUpcoming).map(([dayLabel, appts]) => (
                  <div key={dayLabel}>
                    <p className="text-sm font-medium text-[#0A0A0A] mb-2 px-1 flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-[#999]" />
                      {dayLabel}
                      <span className="text-[#999] font-normal">· {appts.length}</span>
                    </p>
                    <div className="space-y-1.5">
                      {appts.map((appt) => (
                        <div key={appt.appointment_id} className="bg-white rounded-lg px-4 py-3 border border-[#EAEAEA] flex items-center gap-4">
                          <span className="text-sm font-mono font-medium text-[#0A0A0A] min-w-[45px]">
                            {format(parseISO(appt.start_time), 'HH:mm')}
                          </span>
                          <div className="w-px h-6 bg-[#EAEAEA]" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#0A0A0A] truncate">{appt.client_name || 'Walk-in'}</p>
                            <p className="text-xs text-[#999]">{appt.service_name || 'Service'}</p>
                          </div>
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${
                            appt.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' :
                            appt.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {appt.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State - No appointments at all */}
          {todayAppointments.length === 0 && Object.keys(groupedUpcoming).length === 0 && pendingApprovals.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-[#EAEAEA]" data-testid="empty-state">
              <div className="w-14 h-14 bg-[#F5F5F5] rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarDays className="w-6 h-6 text-[#CCC]" />
              </div>
              <p className="text-[#666] font-medium">No upcoming appointments</p>
              <p className="text-sm text-[#999] mt-1">Create one or share your booking link</p>
            </div>
          )}
        </div>
      )}
    </TenantLayout>
  );
};

export default DashboardPage;
