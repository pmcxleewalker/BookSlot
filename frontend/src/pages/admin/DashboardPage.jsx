import React, { useState, useEffect, useMemo } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  Calendar, Clock, Users, Banknote, ArrowRight, Copy, ExternalLink, Plus, Sparkles, BellRing,
  UserPlus, Briefcase, BarChart3, MessageCircle, CalendarCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isTomorrow } from 'date-fns';
import { formatMoney, parseLocal, STATUS_LABELS, STATUS_STYLES } from '../../lib/utils';

const dayLabel = (d) => (isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEEE d MMMM'));

const DashboardPage = () => {
  const { tenant, token, currency, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/reports/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { setStats(r.data.stats); setUpcoming(r.data.upcoming_appointments || []); })
      .catch((e) => console.error('Failed to load dashboard:', e))
      .finally(() => setLoading(false));
  }, [token]);

  const bookingLink = `${window.location.origin}/book/${tenant?.booking_url_slug}`;
  const copy = (text, label) => navigator.clipboard?.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error('Could not copy - select it and copy it manually'),
  );

  const next = upcoming[0];
  const grouped = useMemo(() => {
    const out = [];
    upcoming.slice(0, 8).forEach((a) => {
      const d = parseLocal(a.start_time);
      const key = format(d, 'yyyy-MM-dd');
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(a);
      else out.push({ key, label: dayLabel(d), items: [a] });
    });
    return out;
  }, [upcoming]);

  const today = stats?.today_appointments || 0;
  const firstName = (user?.name || '').split(' ')[0];

  const statCards = [
    { label: 'Today', value: today, icon: CalendarCheck, tone: 'from-indigo-500 to-violet-500' },
    { label: 'This month', value: stats?.month_appointments || 0, icon: Clock, tone: 'from-sky-500 to-cyan-500' },
    { label: 'Revenue this month', value: formatMoney(stats?.month_revenue || 0, currency), icon: Banknote, tone: 'from-emerald-500 to-teal-500' },
    { label: 'Clients', value: stats?.total_clients || 0, icon: Users, tone: 'from-pink-500 to-rose-500' },
  ];

  const quick = [
    { to: '/calendar?new=1', label: 'New booking', desc: 'Add a phone or walk-in', icon: Plus },
    { to: '/clients', label: 'Clients', desc: 'History and notes', icon: UserPlus },
    { to: '/services', label: 'Services', desc: 'Prices and times', icon: Briefcase },
    { to: '/reports', label: 'Reports', desc: 'How you\'re doing', icon: BarChart3 },
  ];

  return (
    <TenantLayout title="Home">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl p-6 sm:p-8 mb-6 text-white shadow-xl shadow-indigo-500/20"
        style={{ background: 'linear-gradient(135deg,#4F46E5 0%,#7C3AED 55%,#C026D3 100%)' }} data-testid="dashboard-hero">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="absolute right-24 -bottom-24 w-56 h-56 rounded-full bg-pink-300/20 blur-2xl" aria-hidden="true" />
        <div className="relative grid lg:grid-cols-[1.3fr_1fr] gap-6 items-center">
          <div>
            <p className="text-white/80 text-sm font-medium flex items-center gap-2"><Sparkles className="w-4 h-4" />{format(new Date(), 'EEEE d MMMM')}</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold mt-2 leading-tight">
              {loading ? 'Loading your day…' : today === 0
                ? `A clear diary today${firstName ? `, ${firstName}` : ''}.`
                : `${today} appointment${today === 1 ? '' : 's'} today${firstName ? `, ${firstName}` : ''}.`}
            </h2>
            <p className="text-white/80 mt-2">
              {today === 0 ? 'Share your booking link and let clients fill it for you.' : 'Here\'s what\'s coming up next.'}
            </p>
            <div className="flex flex-wrap gap-2 mt-5">
              <Link to="/calendar?new=1" className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-white text-[#4338CA] font-semibold shadow-sm hover:shadow-md transition-all" data-testid="hero-new-booking">
                <Plus className="w-4 h-4" /> New booking
              </Link>
              <button onClick={() => copy(bookingLink, 'Booking link')} data-testid="copy-booking-link"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-white/15 hover:bg-white/25 font-semibold backdrop-blur transition-all">
                <Copy className="w-4 h-4" /> Copy booking link
              </button>
            </div>
          </div>
          {next && (
            <Link to={`/calendar?appointment=${next.appointment_id}`} className="block rounded-2xl bg-white/15 backdrop-blur p-5 hover:bg-white/20 transition-colors" data-testid="next-appointment">
              <p className="text-xs uppercase tracking-wider text-white/70 font-semibold">Next up · {dayLabel(parseLocal(next.start_time))}</p>
              <p className="text-3xl font-extrabold mt-1">{next.start_time.slice(11, 16)}</p>
              <p className="font-semibold mt-1">{next.client_name || 'Walk-in'}</p>
              <p className="text-sm text-white/80">{next.service_name}{next.staff_name ? ` · ${next.staff_name}` : ''}</p>
            </Link>
          )}
        </div>
      </section>

      {stats?.pending_approvals > 0 && (
        <Link to="/calendar?status=pending_approval" data-testid="pending-approvals-banner"
          className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 transition-colors">
          <span className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><BellRing className="w-5 h-5 text-amber-600" /></span>
          <span className="flex-1"><strong>{stats.pending_approvals}</strong> booking request{stats.pending_approvals === 1 ? '' : 's'} waiting for your OK</span>
          <ArrowRight className="w-5 h-5" />
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 animate-stagger">
        {statCards.map(({ label, value, icon: Icon, tone }, idx) => (
          <div key={label} className="card-flat !p-5" data-testid={`stat-${idx}`}>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tone} flex items-center justify-center text-white shadow-sm mb-4`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-[#1E1B3A] tracking-tight">{loading ? '–' : value}</p>
            <p className="text-sm text-[#6B6890] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
        {/* Coming up */}
        <section className="card-flat">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-[#1E1B3A]">Coming up</h3>
            <Link to="/calendar" className="text-sm font-semibold text-[#4F46E5] hover:underline flex items-center gap-1">
              Open calendar <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-[#F7F6FC] animate-pulse" />)}</div>
          ) : grouped.length === 0 ? (
            <div className="py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4"><Calendar className="w-7 h-7 text-[#4F46E5]" /></div>
              <p className="font-semibold text-[#1E1B3A]">Nothing booked for the next 7 days</p>
              <p className="text-sm text-[#6B6890] mt-1 mb-5">Share your link on Instagram, Facebook or Google to get the first bookings in.</p>
              <button onClick={() => copy(bookingLink, 'Booking link')} className="btn-primary !py-2.5 inline-flex items-center gap-2">
                <Copy className="w-4 h-4" /> Copy booking link
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map((g) => (
                <div key={g.key}>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#9A97B0] mb-2">{g.label}</p>
                  <div className="space-y-2">
                    {g.items.map((appt) => (
                      <Link to={`/calendar?appointment=${appt.appointment_id}`} key={appt.appointment_id} data-testid={`upcoming-${appt.appointment_id}`}
                        className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#F7F6FC] transition-colors">
                        <div className="w-14 text-center shrink-0">
                          <p className="font-bold text-[#1E1B3A]">{appt.start_time.slice(11, 16)}</p>
                        </div>
                        <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: appt.staff_color || '#A5B4FC' }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#1E1B3A] truncate">{appt.client_name || 'Walk-in'}</p>
                          <p className="text-sm text-[#6B6890] truncate">{appt.service_name}{appt.staff_name ? ` · ${appt.staff_name}` : ''}</p>
                        </div>
                        <span className={`hidden sm:inline text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[appt.status] || ''}`}>
                          {STATUS_LABELS[appt.status] || appt.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6">
          {/* Booking page */}
          <section className="card-flat">
            <h3 className="text-lg font-bold text-[#1E1B3A]">Your booking page</h3>
            <p className="text-sm text-[#6B6890] mt-1 mb-4">Clients book themselves here, any time of day.</p>
            <div className="flex items-center gap-2 p-1.5 pl-3 rounded-xl bg-[#F7F6FC] border border-[#ECEAF5]">
              <span className="flex-1 text-sm text-[#5B5880] truncate font-medium">{window.location.host}/book/{tenant?.booking_url_slug}</span>
              <button onClick={() => copy(bookingLink, 'Booking link')} className="p-2 rounded-lg bg-white shadow-sm text-[#4F46E5] hover:shadow" aria-label="Copy booking link">
                <Copy className="w-4 h-4" />
              </button>
              <a href={`/book/${tenant?.booking_url_slug}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white shadow-sm text-[#4F46E5] hover:shadow" aria-label="Open booking page">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            {(tenant?.messaging?.whatsapp || tenant?.messaging?.sms) && (
              <div className="mt-4 space-y-2" data-testid="messaging-links">
                {[['WhatsApp', tenant.messaging.whatsapp], ['Text (SMS)', tenant.messaging.sms]].filter(([, l]) => l).map(([label, link]) => (
                  <button key={label} type="button" onClick={() => copy(link, `${label} link`)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#ECEAF5] hover:border-[#C7C2F5] text-left transition-colors">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span className="flex-1 text-sm font-semibold text-[#1E1B3A]">{label} booking link</span>
                    <Copy className="w-4 h-4 text-[#9A97B0]" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Shortcuts */}
          <section className="card-flat">
            <h3 className="text-lg font-bold text-[#1E1B3A] mb-4">Shortcuts</h3>
            <div className="grid grid-cols-2 gap-3">
              {quick.map(({ to, label, desc, icon: Icon }) => (
                <Link key={label} to={to} data-testid={`quick-${label.toLowerCase().replace(/\s/g, '-')}`}
                  className="p-4 rounded-xl border border-[#ECEAF5] hover:border-[#C7C2F5] hover:bg-indigo-50/40 transition-all group">
                  <span className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center mb-3 group-hover:bg-white transition-colors">
                    <Icon className="w-[18px] h-[18px] text-[#4F46E5]" />
                  </span>
                  <p className="font-semibold text-[#1E1B3A] text-sm">{label}</p>
                  <p className="text-xs text-[#6B6890]">{desc}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </TenantLayout>
  );
};

export default DashboardPage;
