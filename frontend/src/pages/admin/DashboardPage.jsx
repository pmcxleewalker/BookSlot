import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { 
  Calendar, Clock, Users, DollarSign, TrendingUp, 
  ArrowRight, Copy, ExternalLink, Plus
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { formatMoney, parseLocal, STATUS_LABELS, STATUS_STYLES } from '../../lib/utils';

const DashboardPage = () => {
  const { tenant, token, currency } = useAuth();
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API}/reports/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data.stats);
      setUpcoming(response.data.upcoming_appointments || []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyBookingLink = () => {
    const link = `${window.location.origin}/book/${tenant?.booking_url_slug}`;
    navigator.clipboard?.writeText(link).then(
      () => toast.success('Booking link copied!'),
      () => toast.error('Could not copy - select the link and copy it manually')
    );
  };

  const statCards = [
    { 
      label: "Today's Appointments", 
      value: stats?.today_appointments || 0, 
      icon: Calendar,
      color: 'bg-blue-50 text-blue-600'
    },
    { 
      label: 'This Month', 
      value: stats?.month_appointments || 0, 
      icon: Clock,
      color: 'bg-emerald-50 text-emerald-600'
    },
    { 
      label: 'Revenue (Month)', 
      value: formatMoney(stats?.month_revenue || 0, currency), 
      icon: DollarSign,
      color: 'bg-amber-50 text-amber-600'
    },
    { 
      label: 'Total Clients', 
      value: stats?.total_clients || 0, 
      icon: Users,
      color: 'bg-violet-50 text-violet-600'
    },
  ];

  return (
    <TenantLayout title="Dashboard">
      {(tenant?.messaging?.whatsapp || tenant?.messaging?.sms) && (
        <div className="card-flat mb-6" data-testid="messaging-links">
          <h2 className="font-semibold text-[#0A0A0A] mb-1">Clients can book by message</h2>
          <p className="text-sm text-[#666666] mb-3">Share these links (Instagram bio, Google profile, window poster). Messages reach your AI receptionist and only ever see your diary.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            {[['WhatsApp', tenant.messaging.whatsapp], ['Text (SMS)', tenant.messaging.sms]].filter(([, l]) => l).map(([label, link]) => (
              <button key={label} type="button" className="flex-1 text-left px-3 py-2 border border-[#E5E5E5] rounded hover:border-[#0A0A0A]"
                onClick={() => { try { navigator.clipboard.writeText(link); toast.success(`${label} link copied`); } catch (e) { /* ignore */ } }}>
                <span className="block text-sm font-medium text-[#0A0A0A]">{label} link</span>
                <span className="block text-xs text-[#666666] truncate">{link}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card-flat mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-[#0A0A0A] mb-1">Your booking page</h2>
          <p className="text-sm text-[#666666]">Share this link with your clients</p>
        </div>
        <div className="flex items-center gap-2">
          <code className="px-3 py-2 bg-[#FAFAFA] border border-[#E5E5E5] text-sm font-mono text-[#666666] truncate max-w-[200px] sm:max-w-[300px]">
            {window.location.host}/book/{tenant?.booking_url_slug}
          </code>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={copyBookingLink}
            className="flex items-center gap-1"
            data-testid="copy-booking-link"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <a 
            href={`/book/${tenant?.booking_url_slug}`} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </div>

      {stats?.pending_approvals > 0 && (
        <Link to="/calendar?status=pending_approval" className="block mb-6 p-4 bg-orange-50 border border-orange-200 text-orange-800 hover:bg-orange-100" data-testid="pending-approvals-banner">
          <strong>{stats.pending_approvals}</strong> booking request{stats.pending_approvals === 1 ? '' : 's'} waiting for your approval →
        </Link>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="card-flat" data-testid={`stat-${idx}`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-[#0A0A0A] font-mono">{stat.value}</p>
              <p className="text-sm text-[#666666]">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <div className="card-flat">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#0A0A0A]">Upcoming Appointments</h3>
            <Link to="/calendar" className="text-sm text-[#666666] hover:text-[#0A0A0A] flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-[#666666]">Loading...</div>
          ) : upcoming.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[#666666] mb-4">No upcoming appointments</p>
              <Link to="/calendar">
                <Button variant="outline" size="sm" className="flex items-center gap-2 mx-auto">
                  <Plus className="w-4 h-4" />
                  Add appointment
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.slice(0, 5).map((appt) => (
                <Link
                  to={`/calendar?appointment=${appt.appointment_id}`}
                  key={appt.appointment_id}
                  className="flex items-center justify-between py-3 border-b border-[#E5E5E5] last:border-0 hover:bg-[#FAFAFA]"
                  data-testid={`upcoming-${appt.appointment_id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#121212] rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {appt.client_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-[#0A0A0A]">{appt.client_name || 'Walk-in'}</p>
                      <p className="text-sm text-[#666666]">
                        {format(parseLocal(appt.start_time), 'EEE d MMM')} at {appt.start_time.slice(11, 16)} · {appt.service_name}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[appt.status] || ''}`}>
                    {STATUS_LABELS[appt.status] || appt.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="card-flat">
          <h3 className="font-semibold text-[#0A0A0A] mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link 
              to="/calendar" 
              className="p-4 border border-[#E5E5E5] hover:border-[#121212] transition-colors group"
              data-testid="quick-calendar"
            >
              <Calendar className="w-6 h-6 text-[#666666] group-hover:text-[#0A0A0A] mb-2" />
              <p className="font-medium text-[#0A0A0A]">Calendar</p>
              <p className="text-sm text-[#666666]">View schedule</p>
            </Link>
            <Link 
              to="/calendar?view=list" 
              className="p-4 border border-[#E5E5E5] hover:border-[#121212] transition-colors group"
              data-testid="quick-appointments"
            >
              <Clock className="w-6 h-6 text-[#666666] group-hover:text-[#0A0A0A] mb-2" />
              <p className="font-medium text-[#0A0A0A]">Appointments</p>
              <p className="text-sm text-[#666666]">Manage bookings</p>
            </Link>
            <Link 
              to="/clients" 
              className="p-4 border border-[#E5E5E5] hover:border-[#121212] transition-colors group"
              data-testid="quick-clients"
            >
              <Users className="w-6 h-6 text-[#666666] group-hover:text-[#0A0A0A] mb-2" />
              <p className="font-medium text-[#0A0A0A]">Clients</p>
              <p className="text-sm text-[#666666]">View database</p>
            </Link>
            <Link 
              to="/reports" 
              className="p-4 border border-[#E5E5E5] hover:border-[#121212] transition-colors group"
              data-testid="quick-reports"
            >
              <TrendingUp className="w-6 h-6 text-[#666666] group-hover:text-[#0A0A0A] mb-2" />
              <p className="font-medium text-[#0A0A0A]">Reports</p>
              <p className="text-sm text-[#666666]">Analytics</p>
            </Link>
          </div>
        </div>
      </div>
    </TenantLayout>
  );
};

export default DashboardPage;
