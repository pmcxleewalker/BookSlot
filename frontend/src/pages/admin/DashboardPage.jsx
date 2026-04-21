import React, { useState, useEffect, useCallback } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import { getTheme } from '../../config/industryThemes';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock, Check, Phone, Plus, ChevronRight, RefreshCw,
  CalendarDays, Sparkles, TrendingUp, Users, Zap, DollarSign, ArrowUpRight
} from 'lucide-react';
import { format, parseISO, differenceInMinutes, isToday, isTomorrow, addDays } from 'date-fns';

const DashboardPage = () => {
  const { token, tenant, user } = useAuth();
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const theme = getTheme(tenant?.industry);

  const [todayAppointments, setTodayAppointments] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [stats, setStats] = useState({ todayTotal: 0, weekTotal: 0, pendingTotal: 0, revenue: 0 });
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const urlPrefix = tenantSlug ? `/${tenantSlug}` : '';

  const fetchAllData = useCallback(async () => {
    try {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const weekEnd = format(addDays(now, 7), 'yyyy-MM-dd');

      const [todayRes, weekRes, pendingRes, staffRes] = await Promise.all([
        axios.get(`${API}/appointments`, { params: { start_date: today, end_date: today + 'T23:59:59' }, headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/appointments`, { params: { start_date: today, end_date: weekEnd + 'T23:59:59' }, headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/appointments`, { params: { status: 'pending' }, headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/staff`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const todayAppts = (todayRes.data.appointments || []).filter(a => a.status !== 'cancelled').sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      const allWeekAppts = (weekRes.data.appointments || []).filter(a => a.status !== 'cancelled').sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      const upcomingAppts = allWeekAppts.filter(a => { try { return !isToday(parseISO(a.start_time)); } catch { return true; } });
      const pending = pendingRes.data.appointments || [];
      const revenue = allWeekAppts.reduce((sum, a) => sum + (a.price || a.total_price || 0), 0);

      setTodayAppointments(todayAppts);
      setUpcomingAppointments(upcomingAppts);
      setPendingApprovals(pending);
      setStaff(staffRes.data.staff || []);
      setStats({ todayTotal: todayAppts.length, weekTotal: allWeekAppts.length, pendingTotal: pending.length, revenue });
    } catch (error) { console.error('Failed:', error); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    fetchAllData();
    const t1 = setInterval(fetchAllData, 30000);
    const t2 = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [fetchAllData]);

  const handleComplete = async (id) => {
    try { await axios.put(`${API}/appointments/${id}`, { status: 'completed' }, { headers: { Authorization: `Bearer ${token}` } }); fetchAllData(); } catch {}
  };

  const todayConfirmed = todayAppointments.filter(a => a.status === 'confirmed');
  const todayCompleted = todayAppointments.filter(a => a.status === 'completed');

  const groupedUpcoming = upcomingAppointments.reduce((g, a) => {
    const label = (() => { try { const d = parseISO(a.start_time); if (isTomorrow(d)) return 'Tomorrow'; return format(d, 'EEE, MMM d'); } catch { return ''; } })();
    if (!g[label]) g[label] = [];
    g[label].push(a);
    return g;
  }, {});

  return (
    <TenantLayout title="Today">
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="text-[#9E948F]">Loading...</div></div>
      ) : (
        <div className="max-w-5xl mx-auto">
          {/* Stat Cards - Bento Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" data-testid="dashboard-stats">
            <StatCard icon={CalendarDays} label="Today" value={stats.todayTotal} sublabel={`${todayConfirmed.length} upcoming`} color="#2C2A29" />
            <StatCard icon={TrendingUp} label="This Week" value={stats.weekTotal} sublabel="appointments" color="#B8868B" />
            <StatCard icon={DollarSign} label="Revenue" value={`€${stats.revenue}`} sublabel="this week" color="#8FA68F" />
            <StatCard icon={Users} label="Team" value={staff.length} sublabel={`${staff.filter(s => s.is_active).length} active`} color="#D4A373" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Today's Schedule */}
            <div className="lg:col-span-2 space-y-6">
              {/* Pending Banner */}
              {pendingApprovals.length > 0 && (
                <button onClick={() => navigate(`${urlPrefix}/calendar`)}
                  className="w-full bg-[#E8C5C8]/20 border border-[#E8C5C8]/40 rounded-3xl p-5 flex items-center justify-between hover:bg-[#E8C5C8]/30 transition-all duration-300"
                  data-testid="pending-approvals-banner"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-[#B8868B]/10 flex items-center justify-center"><Zap className="w-5 h-5 text-[#B8868B]" strokeWidth={1.5} /></div>
                    <div className="text-left"><p className="font-medium text-[#2C2A29]">{pendingApprovals.length} booking{pendingApprovals.length !== 1 ? 's' : ''} need approval</p><p className="text-sm text-[#9E948F]">Tap to review</p></div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#B8868B]" />
                </button>
              )}

              {/* New Appointment Button */}
              <button onClick={() => navigate(`${urlPrefix}/calendar`)}
                className="w-full bg-[#2C2A29] text-white rounded-full py-3.5 flex items-center justify-center gap-2.5 text-sm font-medium hover:bg-[#4A4745] transition-all duration-300 hover:scale-[1.01] shadow-[0_4px_20px_rgb(44,42,41,0.2)]"
                data-testid="new-appointment-btn"
              >
                <Plus className="w-4 h-4" strokeWidth={2} /> New {theme.terminology.appointment}
              </button>

              {/* Today's Timeline */}
              <div data-testid="today-appointments-section">
                <p className="text-xs tracking-[0.2em] uppercase text-[#9E948F] font-medium mb-4">
                  Today's Schedule · {todayAppointments.length}
                </p>

                {todayConfirmed.length === 0 && todayCompleted.length === 0 ? (
                  <div className="text-center py-14 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <div className="w-16 h-16 rounded-full bg-[#F7F3EE] flex items-center justify-center mx-auto mb-4">
                      <CalendarDays className="w-7 h-7 text-[#9E948F]" strokeWidth={1.5} />
                    </div>
                    <p className="text-[#706B68] font-medium">No appointments today</p>
                    <p className="text-sm text-[#9E948F] mt-1">Your day is clear — time to plan ahead</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayConfirmed.map((appt) => (
                      <div key={appt.appointment_id}
                        className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5 group"
                        data-testid={`appt-${appt.appointment_id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-[#F7F3EE] flex flex-col items-center justify-center">
                              <p className="text-base font-medium text-[#2C2A29] font-mono">{format(parseISO(appt.start_time), 'HH:mm')}</p>
                              <p className="text-[9px] text-[#9E948F] uppercase tracking-wider">{differenceInMinutes(parseISO(appt.end_time), parseISO(appt.start_time))}min</p>
                            </div>
                            <div>
                              <p className="font-medium text-[#2C2A29]">{appt.client_name || 'Walk-in'}</p>
                              <p className="text-sm text-[#9E948F]">{appt.service_name || theme.terminology.service}{appt.staff_name ? ` · ${appt.staff_name}` : ''}</p>
                              {appt.notes && <p className="text-xs text-[#B8868B] mt-0.5 italic">"{appt.notes.substring(0, 50)}{appt.notes.length > 50 ? '...' : ''}"</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {appt.client_phone && <a href={`tel:${appt.client_phone}`} className="p-2.5 text-[#9E948F] hover:text-[#2C2A29] rounded-xl hover:bg-[#F7F3EE] transition-colors"><Phone className="w-4 h-4" strokeWidth={1.5} /></a>}
                            <button onClick={() => handleComplete(appt.appointment_id)} className="px-4 py-2 rounded-full bg-[#2C2A29] text-white text-xs font-medium hover:bg-[#4A4745] transition-colors" data-testid={`complete-btn-${appt.appointment_id}`}>Done</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {todayCompleted.length > 0 && (
                      <div className="pt-4">
                        <p className="text-xs tracking-[0.2em] uppercase text-[#9E948F] font-medium mb-3">Completed · {todayCompleted.length}</p>
                        {todayCompleted.map((appt) => (
                          <div key={appt.appointment_id} className="flex items-center gap-4 py-2.5 px-2 opacity-50">
                            <div className="w-5 h-5 rounded-full bg-[#8FA68F]/20 flex items-center justify-center"><Check className="w-3 h-3 text-[#8FA68F]" /></div>
                            <span className="text-sm text-[#706B68]">{appt.client_name}</span>
                            <span className="text-xs text-[#9E948F] ml-auto font-mono">{format(parseISO(appt.start_time), 'HH:mm')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <p className="text-xs tracking-[0.2em] uppercase text-[#9E948F] font-medium mb-4">Quick Actions</p>
                <div className="space-y-2">
                  {[
                    { label: 'View Calendar', path: `${urlPrefix}/calendar`, icon: CalendarDays },
                    { label: 'Manage Team', path: `${urlPrefix}/staff`, icon: Users },
                    { label: 'View Reports', path: `${urlPrefix}/reports`, icon: TrendingUp },
                  ].map(action => (
                    <button key={action.label} onClick={() => navigate(action.path)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm text-[#2C2A29] hover:bg-[#F7F3EE] transition-all duration-200 group"
                    >
                      <action.icon className="w-4 h-4 text-[#9E948F] group-hover:text-[#B8868B] transition-colors" strokeWidth={1.5} />
                      <span className="flex-1 text-left">{action.label}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#9E948F] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Insights */}
              <div className="bg-gradient-to-br from-[#2C2A29] to-[#4A4745] rounded-3xl p-6 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-[#E8C5C8]" strokeWidth={1.5} />
                  <span className="text-xs tracking-[0.15em] uppercase text-[#E8C5C8] font-medium">{theme.aiName} Insights</span>
                </div>
                <div className="space-y-2.5 text-sm">
                  {stats.pendingTotal > 0 && <p className="text-white/80">{stats.pendingTotal} booking{stats.pendingTotal !== 1 ? 's' : ''} awaiting approval</p>}
                  {stats.todayTotal > 5 && <p className="text-white/80">Busy day — {stats.todayTotal} appointments lined up</p>}
                  {stats.todayTotal === 0 && stats.weekTotal > 0 && <p className="text-white/80">Quiet today. {stats.weekTotal} bookings coming this week</p>}
                  {stats.todayTotal === 0 && stats.weekTotal === 0 && <p className="text-white/80">No bookings yet. Share your link to start getting clients</p>}
                  <p className="text-white/60 text-xs">AI monitoring {todayConfirmed.length} active appointment{todayConfirmed.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Upcoming */}
              {Object.keys(groupedUpcoming).length > 0 && (
                <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <p className="text-xs tracking-[0.2em] uppercase text-[#9E948F] font-medium mb-4">Coming Up</p>
                  <div className="space-y-4">
                    {Object.entries(groupedUpcoming).slice(0, 3).map(([dayLabel, appts]) => (
                      <div key={dayLabel}>
                        <p className="text-sm font-medium text-[#2C2A29] mb-2">{dayLabel} <span className="text-[#9E948F] font-normal">· {appts.length}</span></p>
                        {appts.slice(0, 3).map(a => (
                          <div key={a.appointment_id} className="flex items-center gap-3 py-1.5">
                            <span className="text-xs font-mono text-[#9E948F] w-10">{format(parseISO(a.start_time), 'HH:mm')}</span>
                            <div className="w-px h-4 bg-[#E5DFD9]" />
                            <span className="text-sm text-[#706B68] truncate">{a.client_name}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </TenantLayout>
  );
};

const StatCard = ({ icon: Icon, label, value, sublabel, color }) => (
  <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5">
    <Icon className="w-5 h-5 mb-3" style={{ color }} strokeWidth={1.5} />
    <p className="font-['Cormorant_Garamond'] text-3xl font-light text-[#2C2A29]">{value}</p>
    <p className="text-xs text-[#9E948F] mt-1">{sublabel}</p>
  </div>
);

export default DashboardPage;
