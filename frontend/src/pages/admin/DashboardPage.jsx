import React, { useState, useEffect, useCallback } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import { getTheme } from '../../config/industryThemes';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock, Check, Phone, Plus, ChevronRight, RefreshCw,
  CalendarDays, Sparkles, TrendingUp, Users, Zap, Brain
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { format, parseISO, differenceInMinutes, isToday, isTomorrow, addDays } from 'date-fns';

const DashboardPage = () => {
  const { token, tenant } = useAuth();
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const theme = getTheme(tenant?.industry);

  const [todayAppointments, setTodayAppointments] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [stats, setStats] = useState({ todayTotal: 0, weekTotal: 0, pendingTotal: 0 });
  const [aiInsights, setAiInsights] = useState([]);
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

      const upcomingAppts = allWeekAppts.filter(a => {
        try { return !isToday(parseISO(a.start_time)); } catch { return true; }
      });

      const pending = pendingRes.data.appointments || [];

      setTodayAppointments(todayAppts);
      setUpcomingAppointments(upcomingAppts);
      setPendingApprovals(pending);
      setStats({
        todayTotal: todayAppts.length,
        weekTotal: allWeekAppts.length,
        pendingTotal: pending.length,
      });

      // Generate AI insights
      const insights = [];
      if (pending.length > 0) insights.push({ icon: Zap, text: `${pending.length} booking${pending.length > 1 ? 's' : ''} awaiting your approval`, type: 'warning' });
      if (todayAppts.length === 0 && upcomingAppts.length > 0) insights.push({ icon: CalendarDays, text: `Quiet today — ${upcomingAppts.length} upcoming this week`, type: 'info' });
      if (todayAppts.length > 5) insights.push({ icon: TrendingUp, text: `Busy day ahead! ${todayAppts.length} appointments scheduled`, type: 'success' });
      if (allWeekAppts.length === 0) insights.push({ icon: Users, text: 'No bookings this week — share your booking link to get started', type: 'info' });
      const confirmed = todayAppts.filter(a => a.status === 'confirmed').length;
      if (confirmed > 0) insights.push({ icon: Brain, text: `AI monitoring ${confirmed} active appointment${confirmed > 1 ? 's' : ''} for no-show risk`, type: 'ai' });
      setAiInsights(insights);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAllData();
    const dataTimer = setInterval(fetchAllData, 30000);
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => { clearInterval(dataTimer); clearInterval(clockTimer); };
  }, [fetchAllData]);

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
      if (mins < 60) return `${mins}m`;
      return `${Math.floor(mins / 60)}h`;
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

  const groupedUpcoming = upcomingAppointments.reduce((groups, appt) => {
    const label = formatDayLabel(appt.start_time);
    if (!groups[label]) groups[label] = [];
    groups[label].push(appt);
    return groups;
  }, {});

  const todayConfirmed = todayAppointments.filter(a => a.status === 'confirmed');
  const todayCompleted = todayAppointments.filter(a => a.status === 'completed');

  const insightColors = {
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' },
    success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'text-emerald-500' },
    ai: { bg: `bg-[${theme.primaryLight}]`, border: `border-[${theme.cardBorder}]`, text: 'text-gray-700', icon: '' },
  };

  return (
    <TenantLayout title="Today">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading...</div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          {/* Hero Section */}
          <div
            className="rounded-2xl p-6 mb-6 text-white relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
            data-testid="dashboard-hero"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-10 -translate-x-10" />
            <div className="relative z-10">
              <p className="text-white/70 text-sm">{format(currentTime, 'EEEE, MMMM d')}</p>
              <p className="text-4xl font-light mt-1 font-mono tracking-tight">
                {format(currentTime, 'HH:mm')}
              </p>
              <div className="flex items-center gap-6 mt-4">
                <div>
                  <p className="text-3xl font-bold">{stats.todayTotal}</p>
                  <p className="text-white/60 text-xs">Today</p>
                </div>
                <div className="w-px h-10 bg-white/20" />
                <div>
                  <p className="text-3xl font-bold">{stats.weekTotal}</p>
                  <p className="text-white/60 text-xs">This Week</p>
                </div>
                <div className="w-px h-10 bg-white/20" />
                <div>
                  <p className="text-3xl font-bold">{stats.pendingTotal}</p>
                  <p className="text-white/60 text-xs">Pending</p>
                </div>
              </div>
              <button
                onClick={() => { setLoading(true); fetchAllData(); }}
                className="absolute top-4 right-4 text-white/40 hover:text-white/70 transition-colors"
                data-testid="refresh-dashboard-btn"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* AI Intelligence Banner */}
          {aiInsights.length > 0 && (
            <div className="mb-6 space-y-2" data-testid="ai-insights-banner">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4" style={{ color: theme.primary }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.primary }}>
                  {theme.aiName} Intelligence
                </span>
              </div>
              {aiInsights.map((insight, i) => {
                const colors = insightColors[insight.type] || insightColors.info;
                const Icon = insight.icon;
                return (
                  <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${colors.bg} ${colors.border}`}>
                    <Icon className={`w-4 h-4 shrink-0 ${colors.icon}`} style={insight.type === 'ai' ? { color: theme.primary } : {}} />
                    <span className={`text-sm ${colors.text}`}>{insight.text}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pending Approvals */}
          {pendingApprovals.length > 0 && (
            <button
              onClick={() => navigate(`${urlPrefix}/calendar`)}
              className="w-full mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between hover:bg-amber-100 transition-colors"
              data-testid="pending-approvals-banner"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-amber-800">{pendingApprovals.length} pending approval{pendingApprovals.length !== 1 ? 's' : ''}</p>
                  <p className="text-sm text-amber-600">Tap to review</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-400" />
            </button>
          )}

          {/* Quick Actions */}
          <Button
            className="w-full mb-6 h-12 text-white rounded-xl text-base font-medium shadow-lg hover:shadow-xl transition-shadow"
            style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
            onClick={() => navigate(`${urlPrefix}/calendar`)}
            data-testid="new-appointment-btn"
          >
            <Plus className="w-5 h-5 mr-2" />
            New {theme.terminology.appointment}
          </Button>

          {/* Today's Appointments */}
          <div className="mb-8" data-testid="today-appointments-section">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
              Today &middot; {todayAppointments.length} {theme.terminology.appointment.toLowerCase()}{todayAppointments.length !== 1 ? 's' : ''}
            </h2>

            {todayConfirmed.length === 0 && todayCompleted.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
                <Clock className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No {theme.terminology.appointment.toLowerCase()}s today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayConfirmed.map((appt) => {
                  const timeUntil = getTimeUntil(appt.start_time);
                  return (
                    <div
                      key={appt.appointment_id}
                      className="bg-white rounded-xl p-4 border border-gray-200 hover:border-gray-300 transition-colors"
                      data-testid={`appt-${appt.appointment_id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[50px]">
                            <p className="text-lg font-semibold text-gray-900 font-mono">
                              {format(parseISO(appt.start_time), 'HH:mm')}
                            </p>
                            {timeUntil && (
                              <p className="text-[10px] uppercase tracking-wide" style={{ color: theme.primary }}>{timeUntil}</p>
                            )}
                          </div>
                          <div className="w-px h-10" style={{ backgroundColor: theme.cardBorder }} />
                          <div>
                            <p className="font-medium text-gray-900">{appt.client_name || 'Walk-in'}</p>
                            <p className="text-sm text-gray-500">{appt.service_name || theme.terminology.service}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {appt.client_phone && (
                            <a href={`tel:${appt.client_phone}`} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          <Button
                            size="sm"
                            className="h-8 px-3 rounded-lg text-white"
                            style={{ backgroundColor: theme.primary }}
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
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 px-1">
                      Completed &middot; {todayCompleted.length}
                    </p>
                    {todayCompleted.map((appt) => (
                      <div key={appt.appointment_id} className="flex items-center gap-4 py-2 px-1 opacity-50">
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm text-gray-600">{appt.client_name}</span>
                        <span className="text-xs text-gray-400 ml-auto font-mono">
                          {format(parseISO(appt.start_time), 'HH:mm')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upcoming */}
          {Object.keys(groupedUpcoming).length > 0 && (
            <div data-testid="upcoming-appointments-section">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
                Upcoming &middot; Next 7 Days
              </h2>
              <div className="space-y-4">
                {Object.entries(groupedUpcoming).map(([dayLabel, appts]) => (
                  <div key={dayLabel}>
                    <p className="text-sm font-medium text-gray-900 mb-2 px-1 flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-gray-400" />
                      {dayLabel}
                      <span className="text-gray-400 font-normal">&middot; {appts.length}</span>
                    </p>
                    <div className="space-y-1.5">
                      {appts.map((appt) => (
                        <div
                          key={appt.appointment_id}
                          className="bg-white rounded-lg px-4 py-3 border border-gray-200 flex items-center gap-4"
                        >
                          <span className="text-sm font-mono font-medium text-gray-900 min-w-[45px]">
                            {format(parseISO(appt.start_time), 'HH:mm')}
                          </span>
                          <div className="w-px h-6 bg-gray-200" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{appt.client_name || 'Walk-in'}</p>
                            <p className="text-xs text-gray-400">{appt.service_name || theme.terminology.service}</p>
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

          {/* Empty State */}
          {todayAppointments.length === 0 && Object.keys(groupedUpcoming).length === 0 && pendingApprovals.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200" data-testid="empty-state">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: theme.primaryLight }}
              >
                <CalendarDays className="w-6 h-6" style={{ color: theme.primary }} />
              </div>
              <p className="text-gray-700 font-medium">No upcoming {theme.terminology.appointment.toLowerCase()}s</p>
              <p className="text-sm text-gray-400 mt-1">Create one or share your booking link</p>
            </div>
          )}
        </div>
      )}
    </TenantLayout>
  );
};

export default DashboardPage;
