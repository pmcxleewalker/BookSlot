import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Calendar, Clock, Users, TrendingUp, Plus, ArrowRight, 
  CheckCircle, XCircle, AlertCircle, Sparkles
} from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../../components/ui/button';
import { dashboardAPI, appointmentsAPI } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [statsData, upcomingData] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getUpcoming(5)
      ]);
      setStats(statsData);
      setUpcoming(upcomingData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = stats ? [
    { 
      label: "Today's Appointments", 
      value: stats.today_appointments, 
      icon: Calendar, 
      color: 'bg-[#2E473B]' 
    },
    { 
      label: 'This Week', 
      value: stats.week_appointments, 
      icon: Clock, 
      color: 'bg-[#C26A58]' 
    },
    { 
      label: "Month's Revenue", 
      value: `€${stats.month_revenue.toFixed(0)}`, 
      icon: TrendingUp, 
      color: 'bg-[#3E6653]' 
    },
    { 
      label: 'New Clients', 
      value: stats.new_clients, 
      icon: Users, 
      color: 'bg-[#E6B861]' 
    },
  ] : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-[#2E473B] to-[#3E6653] rounded-2xl p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Outfit' }}>
                Welcome back, {user?.name?.split(' ')[0] || 'there'}!
              </h1>
              <p className="text-white/80">
                Here's what's happening with your business today.
              </p>
            </div>
            <Link to="/dashboard/appointments">
              <Button className="bg-white text-[#2E473B] hover:bg-white/90 rounded-xl" data-testid="new-booking-btn">
                <Plus className="w-4 h-4 mr-2" />
                New Booking
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#E5E5E0] p-6 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-[#E5E5E0] mb-4" />
                <div className="h-8 w-16 bg-[#E5E5E0] rounded mb-2" />
                <div className="h-4 w-24 bg-[#E5E5E0] rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat, index) => (
              <div 
                key={index}
                className="stats-card"
                data-testid={`stat-${index}`}
              >
                <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center mb-4`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <div className="stats-card-value">{stat.value}</div>
                <div className="stats-card-label">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Upcoming Appointments */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5E5E0]">
            <div className="p-6 border-b border-[#E5E5E0] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
                Upcoming Appointments
              </h2>
              <Link to="/dashboard/appointments" className="text-sm text-[#2E473B] hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-4 animate-pulse">
                      <div className="w-12 h-12 rounded-xl bg-[#E5E5E0]" />
                      <div className="flex-1">
                        <div className="h-4 w-32 bg-[#E5E5E0] rounded mb-2" />
                        <div className="h-3 w-48 bg-[#E5E5E0] rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : upcoming.length === 0 ? (
                <div className="empty-state py-8">
                  <Calendar className="w-12 h-12 text-[#E5E5E0] mx-auto mb-4" />
                  <p className="text-[#6B6B6B]">No upcoming appointments</p>
                  <Link to="/dashboard/appointments">
                    <Button variant="outline" className="mt-4 rounded-xl">
                      Create First Booking
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcoming.map((apt) => (
                    <div 
                      key={apt.appointment_id}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#FAF9F6] transition-colors"
                      data-testid={`appointment-${apt.appointment_id}`}
                    >
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: apt.staff_color || '#2E473B' }}
                      >
                        {format(new Date(apt.start_time), 'HH:mm')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#1C1C1C] truncate">
                          {apt.client_name}
                        </p>
                        <p className="text-sm text-[#6B6B6B]">
                          {apt.service_name} • {apt.staff_name}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        apt.status === 'confirmed' ? 'status-confirmed' :
                        apt.status === 'pending' ? 'status-pending' :
                        'status-completed'
                      }`}>
                        {apt.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#E5E5E0] p-6">
              <h2 className="text-lg font-semibold text-[#1C1C1C] mb-4" style={{ fontFamily: 'Outfit' }}>
                Quick Actions
              </h2>
              <div className="space-y-3">
                <Link to="/dashboard/appointments" className="quick-action-btn w-full" data-testid="quick-new-appointment">
                  <div className="w-10 h-10 rounded-xl bg-[#2E473B]/10 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-[#2E473B]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-[#1C1C1C]">New Appointment</p>
                    <p className="text-xs text-[#6B6B6B]">Book a client</p>
                  </div>
                </Link>
                <Link to="/dashboard/clients" className="quick-action-btn w-full" data-testid="quick-add-client">
                  <div className="w-10 h-10 rounded-xl bg-[#C26A58]/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#C26A58]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-[#1C1C1C]">Add Client</p>
                    <p className="text-xs text-[#6B6B6B]">Create new client</p>
                  </div>
                </Link>
                <Link to="/dashboard/calendar" className="quick-action-btn w-full" data-testid="quick-view-calendar">
                  <div className="w-10 h-10 rounded-xl bg-[#3E6653]/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-[#3E6653]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-[#1C1C1C]">View Calendar</p>
                    <p className="text-xs text-[#6B6B6B]">See schedule</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Booking Link */}
            <div className="bg-gradient-to-br from-[#2E473B]/5 to-[#2E473B]/10 rounded-2xl border border-[#2E473B]/20 p-6">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles className="w-5 h-5 text-[#2E473B]" />
                <h3 className="font-semibold text-[#1C1C1C]">Share Your Booking Page</h3>
              </div>
              <p className="text-sm text-[#6B6B6B] mb-4">
                Let clients book appointments online 24/7
              </p>
              <div className="bg-white rounded-xl p-3 text-sm font-mono text-[#2E473B] truncate">
                {window.location.origin}/book/{user?.tenant?.slug || 'your-business'}
              </div>
              <Button 
                variant="outline" 
                className="w-full mt-3 rounded-xl border-[#2E473B]/30 text-[#2E473B]"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/book/${user?.tenant?.slug}`);
                }}
                data-testid="copy-booking-link"
              >
                Copy Link
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
