import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import { getTheme } from '../../config/industryThemes';
import axios from 'axios';
import { BarChart3, TrendingUp, Users, Clock, DollarSign, CalendarCheck, XCircle, Trophy, Star } from 'lucide-react';
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
      const res = await axios.get(`${API}/reports/detailed`, { params: { start_date: start, end_date: end }, headers: { Authorization: `Bearer ${token}` } });
      setData(res.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const s = data?.summary || {};
  const byService = data?.by_service || [];
  const byStaff = data?.by_staff || [];
  const busiestHours = data?.busiest_hours || [];
  const dailyTrends = data?.daily_trends || [];
  const topStaff = byStaff[0];
  const topService = byService[0];
  const peakHour = busiestHours.reduce((max, h) => h.bookings > (max?.bookings || 0) ? h : max, null);
  const maxStaff = Math.max(...byStaff.map(x => x.bookings), 1);
  const maxSvc = Math.max(...byService.map(x => x.bookings), 1);
  const maxHour = Math.max(...busiestHours.map(x => x.bookings), 1);

  return (
    <TenantLayout title="Reports">
      <div className="max-w-5xl mx-auto">
        {/* Date Range */}
        <div className="flex items-center justify-between mb-8">
          <p className="text-xs tracking-[0.2em] uppercase text-[#9E948F] font-medium">Business Insights</p>
          <div className="flex bg-[#F7F3EE] rounded-full p-1">
            {[{ v: '7', l: '7d' }, { v: '30', l: '30d' }, { v: '90', l: '90d' }].map(o => (
              <button key={o.v} onClick={() => setDateRange(o.v)} className={`px-4 py-2 text-xs font-medium rounded-full transition-all ${dateRange === o.v ? 'bg-white text-[#2C2A29] shadow-sm' : 'text-[#9E948F] hover:text-[#706B68]'}`}>{o.l}</button>
            ))}
          </div>
        </div>

        {loading ? <div className="text-center py-16 text-[#9E948F]">Loading...</div> : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" data-testid="report-summary-cards">
              <div className="bg-[#2C2A29] rounded-3xl p-6 text-white">
                <CalendarCheck className="w-5 h-5 text-[#E8C5C8] mb-3" strokeWidth={1.5} />
                <p className="font-['Cormorant_Garamond'] text-3xl font-light">{s.total_bookings || 0}</p>
                <p className="text-xs text-white/50 mt-1">Total Bookings</p>
              </div>
              <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <DollarSign className="w-5 h-5 text-[#8FA68F] mb-3" strokeWidth={1.5} />
                <p className="font-['Cormorant_Garamond'] text-3xl font-light text-[#2C2A29]">&euro;{s.total_revenue || 0}</p>
                <p className="text-xs text-[#9E948F] mt-1">Revenue</p>
              </div>
              <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <XCircle className="w-5 h-5 text-[#D4A373] mb-3" strokeWidth={1.5} />
                <p className="font-['Cormorant_Garamond'] text-3xl font-light text-[#2C2A29]">{s.cancelled || 0}</p>
                <p className="text-xs text-[#9E948F] mt-1">Cancellations</p>
              </div>
              <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <TrendingUp className="w-5 h-5 text-[#B8868B] mb-3" strokeWidth={1.5} />
                <p className="font-['Cormorant_Garamond'] text-3xl font-light text-[#2C2A29]">{s.completion_rate || 0}%</p>
                <p className="text-xs text-[#9E948F] mt-1">Completion Rate</p>
              </div>
            </div>

            {/* Top Performers */}
            {(topStaff || topService || peakHour) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8" data-testid="top-performers">
                {topStaff && <TopCard icon={Trophy} label={`Top ${theme.terminology.staff.replace(/s$/, '')}`} value={topStaff.name} sub={`${topStaff.bookings} bookings`} color="#B8868B" />}
                {topService && <TopCard icon={Star} label="Most Popular" value={topService.name} sub={`${topService.bookings} bookings`} color="#D4A373" />}
                {peakHour && <TopCard icon={Clock} label="Busiest Hour" value={`${String(peakHour.hour).padStart(2, '0')}:00`} sub={`${peakHour.bookings} bookings`} color="#A8B8CC" />}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Staff Leaderboard */}
              <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden" data-testid="staff-leaderboard">
                <div className="px-6 py-5 border-b border-[#F0EBE6]"><h3 className="font-['Cormorant_Garamond'] text-lg text-[#2C2A29]">{theme.terminology.staff} Leaderboard</h3></div>
                <div className="p-6 space-y-4">
                  {byStaff.length === 0 ? <p className="text-center text-[#9E948F] py-6 text-sm">No data yet</p> :
                    byStaff.map((x, i) => (
                      <div key={x.name} className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-[#2C2A29] text-white' : 'bg-[#F7F3EE] text-[#9E948F]'}`}>{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1"><span className="text-sm text-[#2C2A29]">{x.name}</span><span className="text-sm font-mono text-[#706B68]">{x.bookings}</span></div>
                          <div className="w-full h-1.5 bg-[#F7F3EE] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[#E8C5C8] transition-all duration-500" style={{ width: `${(x.bookings / maxStaff) * 100}%` }} /></div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Service Popularity */}
              <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden" data-testid="service-popularity">
                <div className="px-6 py-5 border-b border-[#F0EBE6]"><h3 className="font-['Cormorant_Garamond'] text-lg text-[#2C2A29]">Service Popularity</h3></div>
                <div className="p-6 space-y-4">
                  {byService.length === 0 ? <p className="text-center text-[#9E948F] py-6 text-sm">No data yet</p> :
                    byService.slice(0, 8).map((x) => (
                      <div key={x.name}>
                        <div className="flex justify-between mb-1"><span className="text-sm text-[#2C2A29] truncate">{x.name}</span><div className="flex gap-2 shrink-0"><span className="text-xs text-[#9E948F]">{x.bookings}</span>{x.revenue > 0 && <span className="text-xs font-medium text-[#8FA68F]">&euro;{x.revenue}</span>}</div></div>
                        <div className="w-full h-1.5 bg-[#F7F3EE] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[#E5DFD9] transition-all duration-500" style={{ width: `${(x.bookings / maxSvc) * 100}%` }} /></div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Busiest Hours */}
              <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden" data-testid="busiest-hours">
                <div className="px-6 py-5 border-b border-[#F0EBE6]"><h3 className="font-['Cormorant_Garamond'] text-lg text-[#2C2A29]">Busiest Hours</h3></div>
                <div className="p-6">
                  {busiestHours.length === 0 ? <p className="text-center text-[#9E948F] py-6 text-sm">No data yet</p> : (
                    <div className="flex items-end gap-1.5 h-32">
                      {Array.from({ length: 10 }, (_, i) => i + 8).map(h => {
                        const f = busiestHours.find(x => x.hour === h);
                        const c = f?.bookings || 0;
                        const pct = maxHour > 0 ? (c / maxHour) * 100 : 0;
                        const isPeak = peakHour && h === peakHour.hour;
                        return (
                          <div key={h} className="flex-1 flex flex-col items-center gap-1">
                            {c > 0 && <span className="text-[9px] font-medium text-[#706B68]">{c}</span>}
                            <div className="w-full rounded-lg transition-all duration-500 min-h-[3px]" style={{ height: `${Math.max(pct, 3)}%`, backgroundColor: isPeak ? '#2C2A29' : '#E8C5C8' }} />
                            <span className="text-[9px] text-[#9E948F] font-mono">{h}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Daily Trend */}
              <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden" data-testid="daily-trends">
                <div className="px-6 py-5 border-b border-[#F0EBE6]"><h3 className="font-['Cormorant_Garamond'] text-lg text-[#2C2A29]">Daily Trend</h3></div>
                <div className="p-6">
                  {dailyTrends.length === 0 ? <p className="text-center text-[#9E948F] py-6 text-sm">No data yet</p> : (
                    <div className="flex items-end gap-[2px] h-32">
                      {dailyTrends.slice(-30).map((d, i) => {
                        const mx = Math.max(...dailyTrends.map(t => t.bookings), 1);
                        return (
                          <div key={d.date} className="flex-1 group relative">
                            <div className="w-full rounded-sm min-h-[2px] transition-all hover:opacity-80" style={{ height: `${Math.max((d.bookings / mx) * 100, 2)}%`, backgroundColor: '#2C2A29', opacity: 0.15 + (i / 30) * 0.85 }} />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-[#2C2A29] text-white text-[9px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">{d.date.slice(5)}: {d.bookings}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="mt-6 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8" data-testid="status-breakdown">
              <h3 className="font-['Cormorant_Garamond'] text-lg text-[#2C2A29] mb-6 text-center">Booking Status</h3>
              <div className="flex items-center justify-center gap-10">
                <StatusDot label="Confirmed" count={Math.max(0, (s.total_bookings || 0) - (s.completed || 0) - (s.cancelled || 0) - (s.no_shows || 0))} color="#8FA68F" />
                <StatusDot label="Completed" count={s.completed || 0} color="#A8B8CC" />
                <StatusDot label="Cancelled" count={s.cancelled || 0} color="#D4A373" />
                <StatusDot label="No Shows" count={s.no_shows || 0} color="#B8868B" />
              </div>
            </div>
          </>
        )}
      </div>
    </TenantLayout>
  );
};

const TopCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center gap-4 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5">
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: color + '15' }}><Icon className="w-5 h-5" style={{ color }} strokeWidth={1.5} /></div>
    <div><p className="text-[10px] tracking-[0.15em] uppercase text-[#9E948F] font-medium">{label}</p><p className="font-['Cormorant_Garamond'] text-xl text-[#2C2A29] truncate max-w-[160px]">{value}</p><p className="text-xs text-[#9E948F]">{sub}</p></div>
  </div>
);

const StatusDot = ({ label, count, color }) => (
  <div className="text-center">
    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: color + '15' }}>
      <span className="font-['Cormorant_Garamond'] text-xl font-light" style={{ color }}>{count}</span>
    </div>
    <p className="text-xs text-[#9E948F]">{label}</p>
  </div>
);

export default ReportsPage;
