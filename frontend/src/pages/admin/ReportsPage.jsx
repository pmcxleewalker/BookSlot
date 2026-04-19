import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import { getTheme } from '../../config/industryThemes';
import axios from 'axios';
import { BarChart3, TrendingUp, Users, Clock, DollarSign, CalendarCheck, XCircle, AlertTriangle, Trophy, Star } from 'lucide-react';
import { format, subDays } from 'date-fns';

const ReportsPage = () => {
  const { token, tenant } = useAuth();
  const theme = getTheme(tenant?.industry);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');

  useEffect(() => { fetchReports(); }, [dateRange]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const end = format(new Date(), 'yyyy-MM-dd');
      const start = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd');
      const res = await axios.get(`${API}/reports/detailed`, {
        params: { start_date: start, end_date: end },
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (error) { console.error('Failed:', error); }
    finally { setLoading(false); }
  };

  const summary = data?.summary || {};
  const byService = data?.by_service || [];
  const byStaff = data?.by_staff || [];
  const busiestHours = data?.busiest_hours || [];
  const dailyTrends = data?.daily_trends || [];

  const topService = byService[0];
  const topStaff = byStaff[0];
  const peakHour = busiestHours.reduce((max, h) => h.bookings > (max?.bookings || 0) ? h : max, null);

  const maxBookings = Math.max(...byStaff.map(s => s.bookings), 1);
  const maxServiceBookings = Math.max(...byService.map(s => s.bookings), 1);
  const maxHourBookings = Math.max(...busiestHours.map(h => h.bookings), 1);

  return (
    <TenantLayout title="Reports">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" style={{ color: theme.primary }} />
            <h2 className="text-lg font-bold text-gray-900">Business Insights</h2>
          </div>
          <div className="flex bg-gray-100 rounded-xl p-0.5">
            {[
              { value: '7', label: '7 Days' },
              { value: '30', label: '30 Days' },
              { value: '90', label: '90 Days' },
            ].map(opt => (
              <button key={opt.value} onClick={() => setDateRange(opt.value)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${dateRange === opt.value ? 'text-white shadow-md' : 'text-gray-500 hover:text-gray-800'}`}
                style={dateRange === opt.value ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` } : {}}
              >{opt.label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading reports...</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6" data-testid="report-summary-cards">
              <SummaryCard icon={CalendarCheck} label="Total Bookings" value={summary.total_bookings || 0} theme={theme} gradient />
              <SummaryCard icon={DollarSign} label="Revenue" value={`€${summary.total_revenue || 0}`} theme={theme} />
              <SummaryCard icon={XCircle} label="Cancellations" value={summary.cancelled || 0} theme={theme} warn={summary.cancelled > 0} />
              <SummaryCard icon={TrendingUp} label="Completion Rate" value={`${summary.completion_rate || 0}%`} theme={theme} />
            </div>

            {/* Top Performers */}
            {(topStaff || topService || peakHour) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6" data-testid="top-performers">
                {topStaff && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${theme.primary}20, ${theme.accent}20)` }}>
                      <Trophy className="w-6 h-6" style={{ color: theme.primary }} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Top {theme.terminology.staff.replace(/s$/, '')}</p>
                      <p className="font-bold text-gray-900 text-lg">{topStaff.name}</p>
                      <p className="text-sm text-gray-500">{topStaff.bookings} bookings</p>
                    </div>
                  </div>
                )}
                {topService && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50">
                      <Star className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Most Booked Service</p>
                      <p className="font-bold text-gray-900 text-lg truncate max-w-[180px]">{topService.name}</p>
                      <p className="text-sm text-gray-500">{topService.bookings} bookings</p>
                    </div>
                  </div>
                )}
                {peakHour && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-50">
                      <Clock className="w-6 h-6 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Peak Hour</p>
                      <p className="font-bold text-gray-900 text-lg">{String(peakHour.hour).padStart(2, '0')}:00</p>
                      <p className="text-sm text-gray-500">{peakHour.bookings} bookings</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Staff Leaderboard */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" data-testid="staff-leaderboard">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: theme.primary }} />
                  <h3 className="font-semibold text-gray-900 text-sm">{theme.terminology.staff} Leaderboard</h3>
                </div>
                <div className="p-4 space-y-3">
                  {byStaff.length === 0 ? (
                    <p className="text-center text-gray-400 py-4 text-sm">No booking data yet</p>
                  ) : byStaff.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'text-white' : 'text-gray-500 bg-gray-100'}`}
                        style={i === 0 ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` } : {}}
                      >{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900 truncate">{s.name}</span>
                          <span className="text-sm font-bold text-gray-700">{s.bookings}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${(s.bookings / maxBookings) * 100}%`, background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`, opacity: 1 - (i * 0.15) }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Service Popularity */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" data-testid="service-popularity">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-gray-900 text-sm">Service Popularity</h3>
                </div>
                <div className="p-4 space-y-3">
                  {byService.length === 0 ? (
                    <p className="text-center text-gray-400 py-4 text-sm">No service data yet</p>
                  ) : byService.slice(0, 8).map((s, i) => (
                    <div key={s.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 truncate">{s.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400">{s.bookings}</span>
                          {s.revenue > 0 && <span className="text-xs font-semibold text-emerald-600">€{s.revenue}</span>}
                        </div>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500 bg-amber-400"
                          style={{ width: `${(s.bookings / maxServiceBookings) * 100}%`, opacity: 1 - (i * 0.1) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Busiest Hours */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" data-testid="busiest-hours">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-semibold text-gray-900 text-sm">Busiest Hours</h3>
                </div>
                <div className="p-4">
                  {busiestHours.length === 0 ? (
                    <p className="text-center text-gray-400 py-4 text-sm">No data yet</p>
                  ) : (
                    <div className="flex items-end gap-1 h-36">
                      {Array.from({ length: 10 }, (_, i) => i + 8).map(hour => {
                        const found = busiestHours.find(h => h.hour === hour);
                        const count = found?.bookings || 0;
                        const height = maxHourBookings > 0 ? (count / maxHourBookings) * 100 : 0;
                        const isPeak = found && peakHour && found.hour === peakHour.hour;
                        return (
                          <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[9px] font-bold text-gray-600">{count || ''}</span>
                            <div className="w-full rounded-t-lg transition-all duration-500 min-h-[4px]"
                              style={{ height: `${Math.max(height, 4)}%`, background: isPeak ? `linear-gradient(180deg, ${theme.primary}, ${theme.accent})` : '#e5e7eb' }}
                            />
                            <span className="text-[9px] text-gray-400 font-mono">{hour}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Daily Trend */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" data-testid="daily-trends">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <h3 className="font-semibold text-gray-900 text-sm">Daily Booking Trend</h3>
                </div>
                <div className="p-4">
                  {dailyTrends.length === 0 ? (
                    <p className="text-center text-gray-400 py-4 text-sm">No trend data yet</p>
                  ) : (
                    <div className="flex items-end gap-[2px] h-36">
                      {dailyTrends.slice(-30).map((d, i) => {
                        const maxDaily = Math.max(...dailyTrends.map(t => t.bookings), 1);
                        const height = (d.bookings / maxDaily) * 100;
                        return (
                          <div key={d.date} className="flex-1 group relative">
                            <div className="w-full rounded-t-sm min-h-[2px] hover:opacity-80 transition-all"
                              style={{ height: `${Math.max(height, 2)}%`, background: `linear-gradient(180deg, ${theme.primary}, ${theme.accent})`, opacity: 0.4 + (i / dailyTrends.length) * 0.6 }}
                            />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                              {d.date}: {d.bookings}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="mt-5 bg-white rounded-2xl border border-gray-200 overflow-hidden" data-testid="status-breakdown">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">Booking Status Breakdown</h3>
              </div>
              <div className="p-5 flex items-center justify-center gap-8">
                <StatusBlock label="Confirmed" count={Math.max(0, (summary.total_bookings || 0) - (summary.completed || 0) - (summary.cancelled || 0) - (summary.no_shows || 0))} color="#10b981" />
                <StatusBlock label="Completed" count={summary.completed || 0} color="#3b82f6" />
                <StatusBlock label="Cancelled" count={summary.cancelled || 0} color="#ef4444" />
                <StatusBlock label="No Shows" count={summary.no_shows || 0} color="#f97316" />
              </div>
            </div>
          </>
        )}
      </div>
    </TenantLayout>
  );
};

const SummaryCard = ({ icon: Icon, label, value, theme, gradient, warn }) => (
  <div className={`rounded-2xl p-4 border transition-all hover:shadow-md ${gradient ? 'text-white border-transparent' : warn ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}
    style={gradient ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` } : {}}
  >
    <Icon className={`w-5 h-5 mb-2 ${gradient ? 'text-white/70' : warn ? 'text-red-400' : 'text-gray-400'}`} />
    <p className={`text-2xl font-bold ${gradient ? '' : warn ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
    <p className={`text-xs mt-0.5 ${gradient ? 'text-white/60' : 'text-gray-400'}`}>{label}</p>
  </div>
);

const StatusBlock = ({ label, count, color }) => (
  <div className="text-center">
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: color + '15' }}>
      <span className="text-xl font-bold" style={{ color }}>{count}</span>
    </div>
    <p className="text-xs text-gray-500 font-medium">{label}</p>
  </div>
);

export default ReportsPage;
