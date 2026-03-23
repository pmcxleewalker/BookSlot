import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, Calendar, 
  Clock, UserCheck, UserX, BarChart3, PieChart, RefreshCw
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { toast } from 'sonner';

const StatCard = ({ title, value, change, changeType, icon: Icon, prefix = '', suffix = '' }) => {
  const isPositive = change > 0;
  const isNegative = change < 0;
  
  return (
    <div className="bg-white rounded-xl border border-[#E5E5E0] p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-[#6B6B6B]">{title}</span>
        <div className="w-10 h-10 rounded-lg bg-[#2E473B]/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#2E473B]" />
        </div>
      </div>
      <div className="text-3xl font-bold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
        {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-sm ${
          isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-[#6B6B6B]'
        }`}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : isNegative ? <TrendingDown className="w-4 h-4" /> : null}
          <span>{isPositive ? '+' : ''}{change}% vs previous period</span>
        </div>
      )}
    </div>
  );
};

const BarChartSimple = ({ data, maxValue, label }) => {
  const max = maxValue || Math.max(...data.map(d => d.value), 1);
  
  return (
    <div className="space-y-2">
      {data.map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <span className="text-sm text-[#6B6B6B] w-24 truncate">{item.label}</span>
          <div className="flex-1 bg-[#E5E5E0] rounded-full h-6 overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color || '#2E473B'
              }}
            />
          </div>
          <span className="text-sm font-medium text-[#1C1C1C] w-16 text-right">
            {item.displayValue || item.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const Analytics = () => {
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [serviceData, setServiceData] = useState([]);
  const [staffData, setStaffData] = useState([]);
  const [clientData, setClientData] = useState(null);
  const [peakHours, setPeakHours] = useState(null);
  const [receptionistData, setReceptionistData] = useState(null);
  const { user } = useAuth();

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch all analytics data in parallel
      const [overviewRes, servicesRes, staffRes, clientsRes, peakRes] = await Promise.all([
        api.get(`/api/analytics/overview?period=${period}`),
        api.get(`/api/analytics/services?period=${period}`),
        api.get(`/api/analytics/staff?period=${period}`),
        api.get(`/api/analytics/clients?period=${period}`),
        api.get(`/api/analytics/peak-hours?period=${period}`).catch(() => null),
      ]);
      
      setOverview(overviewRes);
      setServiceData(servicesRes.services || []);
      setStaffData(staffRes.staff || []);
      setClientData(clientsRes);
      setPeakHours(peakRes);
      
      // Try to get receptionist analytics (requires Growth+ plan)
      try {
        const receptionistRes = await api.get(`/api/analytics/receptionist?period=${period}`);
        setReceptionistData(receptionistRes);
      } catch (e) {
        // Plan doesn't support this feature
        setReceptionistData(null);
      }
      
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading && !overview) {
    return (
      <DashboardLayout title="Analytics">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-[#2E473B]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Analytics & Reports">
      {/* Header with period selector */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
            Business Analytics
          </h1>
          <p className="text-[#6B6B6B]">Track your business performance</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36 rounded-xl border-[#E5E5E0]" data-testid="period-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
              <SelectItem value="quarter">Last 90 days</SelectItem>
              <SelectItem value="year">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="icon"
            onClick={fetchAnalytics}
            className="rounded-xl border-[#E5E5E0]"
            data-testid="refresh-analytics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Bookings"
            value={overview.metrics.total_bookings}
            change={overview.comparison.booking_change_percent}
            icon={Calendar}
          />
          <StatCard
            title="Revenue"
            value={overview.metrics.total_revenue}
            change={overview.comparison.revenue_change_percent}
            icon={DollarSign}
            prefix="€"
          />
          <StatCard
            title="New Clients"
            value={overview.metrics.new_clients}
            icon={Users}
          />
          <StatCard
            title="Completion Rate"
            value={100 - overview.metrics.cancellation_rate - overview.metrics.no_show_rate}
            icon={UserCheck}
            suffix="%"
          />
        </div>
      )}

      {/* Secondary Stats Row */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-[#E5E5E0] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-[#6B6B6B]">Cancellation Rate</p>
                <p className="text-2xl font-bold text-[#1C1C1C]">{overview.metrics.cancellation_rate}%</p>
              </div>
            </div>
            <p className="text-sm text-[#6B6B6B]">
              {overview.metrics.cancelled_bookings} cancelled out of {overview.metrics.total_bookings} bookings
            </p>
          </div>
          
          <div className="bg-white rounded-xl border border-[#E5E5E0] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <UserX className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-[#6B6B6B]">No-Show Rate</p>
                <p className="text-2xl font-bold text-[#1C1C1C]">{overview.metrics.no_show_rate}%</p>
              </div>
            </div>
            <p className="text-sm text-[#6B6B6B]">
              {overview.metrics.no_shows} no-shows out of {overview.metrics.total_bookings} bookings
            </p>
          </div>
          
          <div className="bg-white rounded-xl border border-[#E5E5E0] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#6B6B6B]">Completed</p>
                <p className="text-2xl font-bold text-[#1C1C1C]">{overview.metrics.completed_bookings}</p>
              </div>
            </div>
            <p className="text-sm text-[#6B6B6B]">
              Successfully completed appointments
            </p>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Services Performance */}
        <div className="bg-white rounded-xl border border-[#E5E5E0] p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-[#2E473B]" />
            <h3 className="font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
              Top Services
            </h3>
          </div>
          {serviceData.length > 0 ? (
            <BarChartSimple 
              data={serviceData.slice(0, 5).map(s => ({
                label: s.service_name,
                value: s.total_bookings,
                displayValue: `${s.total_bookings} bookings`,
                color: '#2E473B'
              }))}
            />
          ) : (
            <p className="text-[#6B6B6B] text-center py-8">No service data available</p>
          )}
        </div>

        {/* Staff Performance */}
        <div className="bg-white rounded-xl border border-[#E5E5E0] p-6">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-[#2E473B]" />
            <h3 className="font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
              Staff Performance
            </h3>
          </div>
          {staffData.length > 0 ? (
            <BarChartSimple 
              data={staffData.slice(0, 5).map(s => ({
                label: s.staff_name,
                value: s.revenue,
                displayValue: `€${s.revenue.toLocaleString()}`,
                color: s.color || '#2E473B'
              }))}
            />
          ) : (
            <p className="text-[#6B6B6B] text-center py-8">No staff data available</p>
          )}
        </div>
      </div>

      {/* Client Analytics */}
      {clientData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-[#E5E5E0] p-6">
            <div className="flex items-center gap-2 mb-6">
              <PieChart className="w-5 h-5 text-[#2E473B]" />
              <h3 className="font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
                Client Overview
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-[#FAF9F6] rounded-xl">
                <p className="text-2xl font-bold text-[#1C1C1C]">{clientData.summary.total_clients}</p>
                <p className="text-sm text-[#6B6B6B]">Total Clients</p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl">
                <p className="text-2xl font-bold text-green-700">{clientData.summary.new_clients}</p>
                <p className="text-sm text-green-600">New</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl">
                <p className="text-2xl font-bold text-blue-700">{clientData.summary.returning_clients}</p>
                <p className="text-sm text-blue-600">Returning</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E5E0] p-6">
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-[#2E473B]" />
              <h3 className="font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
                Top Clients
              </h3>
            </div>
            {clientData.top_clients?.length > 0 ? (
              <div className="space-y-3">
                {clientData.top_clients.slice(0, 5).map((client, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-[#E5E5E0] last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#2E473B]/10 flex items-center justify-center text-sm font-medium text-[#2E473B]">
                        {idx + 1}
                      </div>
                      <span className="text-[#1C1C1C]">{client.client_name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-[#1C1C1C]">€{client.total_spent.toLocaleString()}</p>
                      <p className="text-xs text-[#6B6B6B]">{client.booking_count} bookings</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#6B6B6B] text-center py-8">No client data available</p>
            )}
          </div>
        </div>
      )}

      {/* Peak Hours */}
      {peakHours && (
        <div className="bg-white rounded-xl border border-[#E5E5E0] p-6 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="w-5 h-5 text-[#2E473B]" />
            <h3 className="font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
              Busiest Times
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* By Day */}
            <div>
              <p className="text-sm text-[#6B6B6B] mb-4">By Day of Week</p>
              <BarChartSimple 
                data={peakHours.by_day?.map(d => ({
                  label: d.name,
                  value: d.count,
                  displayValue: `${d.count}`,
                  color: d.count === Math.max(...peakHours.by_day.map(x => x.count)) ? '#2E473B' : '#A8B5A0'
                })) || []}
              />
            </div>
            {/* By Hour */}
            <div>
              <p className="text-sm text-[#6B6B6B] mb-4">Peak Hours</p>
              <div className="flex items-end gap-1 h-32">
                {peakHours.by_hour?.filter(h => h.hour >= 8 && h.hour <= 19).map(h => {
                  const maxCount = Math.max(...peakHours.by_hour.map(x => x.count), 1);
                  const height = (h.count / maxCount) * 100;
                  return (
                    <div key={h.hour} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full rounded-t transition-all duration-300"
                        style={{ 
                          height: `${height}%`, 
                          minHeight: h.count > 0 ? '4px' : '0',
                          backgroundColor: height > 70 ? '#2E473B' : height > 40 ? '#6B8F71' : '#A8B5A0'
                        }}
                      />
                      <span className="text-xs text-[#6B6B6B] mt-1">{h.hour}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Receptionist Analytics */}
      {receptionistData && (
        <div className="bg-white rounded-xl border border-[#E5E5E0] p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-[#2E473B]" />
            <h3 className="font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
              AI Receptionist Performance
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-[#FAF9F6] rounded-xl text-center">
              <p className="text-2xl font-bold text-[#1C1C1C]">{receptionistData.summary.total_conversations}</p>
              <p className="text-sm text-[#6B6B6B]">Conversations</p>
            </div>
            <div className="p-4 bg-green-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-green-700">{receptionistData.summary.resolved}</p>
              <p className="text-sm text-green-600">Resolved</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-amber-700">{receptionistData.summary.handoff_rate}%</p>
              <p className="text-sm text-amber-600">Handoff Rate</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-blue-700">{receptionistData.summary.conversion_rate}%</p>
              <p className="text-sm text-blue-600">Booking Conversion</p>
            </div>
          </div>
          {receptionistData.handoff_reasons?.length > 0 && (
            <div>
              <p className="text-sm text-[#6B6B6B] mb-3">Handoff Reasons</p>
              <div className="flex flex-wrap gap-2">
                {receptionistData.handoff_reasons.map((r, idx) => (
                  <span key={idx} className="px-3 py-1 bg-[#E5E5E0] rounded-full text-sm text-[#1C1C1C]">
                    {r.reason.replace(/_/g, ' ')}: {r.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
};

export default Analytics;
