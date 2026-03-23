import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { BarChart3, TrendingUp, Users, Calendar, DollarSign } from 'lucide-react';

const ReportsPage = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/reports/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: "Today's Appointments", value: stats?.today_appointments || 0, icon: Calendar, change: '+12%' },
    { label: 'This Month', value: stats?.month_appointments || 0, icon: TrendingUp, change: '+8%' },
    { label: 'Revenue (Month)', value: `€${stats?.month_revenue || 0}`, icon: DollarSign, change: '+15%' },
    { label: 'Total Clients', value: stats?.total_clients || 0, icon: Users, change: '+5%' },
  ];

  return (
    <AdminLayout title="Reports">
      {loading ? (
        <div className="py-12 text-center text-[#666666]">Loading...</div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div key={idx} className="card-flat" data-testid={`report-stat-${idx}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#666666]" />
                    </div>
                    <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1">
                      {stat.change}
                    </span>
                  </div>
                  <p className="text-2xl font-semibold text-[#0A0A0A] font-mono">{stat.value}</p>
                  <p className="text-sm text-[#666666]">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* Charts Placeholder */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card-flat">
              <h3 className="font-semibold text-[#0A0A0A] mb-4">Appointments Over Time</h3>
              <div className="h-64 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-[#E5E5E5] mx-auto mb-2" />
                  <p className="text-sm text-[#666666]">Chart visualization</p>
                  <p className="text-xs text-[#666666]">(Coming soon)</p>
                </div>
              </div>
            </div>

            <div className="card-flat">
              <h3 className="font-semibold text-[#0A0A0A] mb-4">Revenue Breakdown</h3>
              <div className="h-64 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                <div className="text-center">
                  <DollarSign className="w-12 h-12 text-[#E5E5E5] mx-auto mb-2" />
                  <p className="text-sm text-[#666666]">Revenue chart</p>
                  <p className="text-xs text-[#666666]">(Coming soon)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Services */}
          <div className="card-flat mt-6">
            <h3 className="font-semibold text-[#0A0A0A] mb-4">Top Services</h3>
            <div className="space-y-3">
              {['Consultation', 'Standard Session', 'Premium Package'].map((service, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-[#E5E5E5] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-[#121212] text-white text-xs flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <span className="text-[#0A0A0A]">{service}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[#0A0A0A]">{Math.floor(Math.random() * 50) + 10} bookings</p>
                    <p className="text-sm text-[#666666]">€{Math.floor(Math.random() * 2000) + 500}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default ReportsPage;
