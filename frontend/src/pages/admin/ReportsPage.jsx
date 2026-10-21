import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { 
  BarChart3, TrendingUp, DollarSign, Calendar, Users, Clock,
  Download, FileText, Table, RefreshCw, ChevronDown
} from 'lucide-react';
import { errorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/utils';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

const ReportsPage = () => {
  const { token, tenant, currency } = useAuth();
  const money = (v) => formatMoney(v || 0, currency);
  // Client-entered text (names, notes) must be escaped before writing it into the print window
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState('30');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [report, setReport] = useState(null);

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

  const handleDateRangeChange = (value) => {
    setDateRange(value);
    const today = new Date();
    
    switch(value) {
      case '7':
        setStartDate(format(subDays(today, 7), 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case '30':
        setStartDate(format(subDays(today, 30), 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case '90':
        setStartDate(format(subDays(today, 90), 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'month':
        setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
        break;
      default:
        break;
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/reports/detailed`, {
        params: { start_date: startDate, end_date: endDate },
        headers: { Authorization: `Bearer ${token}` }
      });
      setReport(response.data);
    } catch (error) {
      console.error('Failed to load reports:', error);
      toast.error(errorMessage(error, 'Failed to load reports'));
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (format, reportType) => {
    setExporting(true);
    try {
      const response = await axios.get(`${API}/reports/export`, {
        params: { 
          format, 
          report_type: reportType,
          start_date: startDate,
          end_date: endDate
        },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (format === 'csv') {
        // Download CSV
        const blob = new Blob([response.data.csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success(`Downloaded ${response.data.row_count} records`);
      } else {
        // Generate PDF from data (using browser print)
        const data = response.data;
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          toast.error('Allow pop-ups for this site to print the report');
          return;
        }
        printWindow.document.write(`
          <html>
            <head>
              <title>${esc(data.title)}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 40px; }
                h1 { color: #0A0A0A; border-bottom: 2px solid #3730A3; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #E5E5E5; padding: 8px; text-align: left; }
                th { background: #FAFAFA; }
                .summary { background: #FAFAFA; padding: 20px; margin: 20px 0; }
                .logo { color: #3730A3; font-size: 24px; font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="logo">${esc(tenant?.name || 'BookSlot')}</div>
              <p style="color: #666;">Powered by BookSlot</p>
              <h1>${esc(data.title)}</h1>
              <div class="summary">
                <strong>Summary:</strong><br/>
                ${Object.entries(data.summary || {}).map(([k, v]) => `${esc(k.replace(/_/g, ' '))}: ${esc(v)}`).join('<br/>')}
              </div>
              <table>
                <thead>
                  <tr>${(data.columns || []).map(c => `<th>${esc(c)}</th>`).join('')}</tr>
                </thead>
                <tbody>
                  ${(data.data || []).map(row => `
                    <tr>${(data.columns || []).map(c => `<td>${esc(row[c])}</td>`).join('')}</tr>
                  `).join('')}
                </tbody>
              </table>
              <p style="margin-top: 40px; color: #666; font-size: 12px;">
                Generated on ${new Date().toLocaleDateString()} by BookSlot
              </p>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
        toast.success('PDF ready for printing');
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to export'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <TenantLayout title="Reports">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={handleDateRangeChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36"
              />
              <span className="text-[#666666]">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36"
              />
            </div>
          )}
          
          <Button variant="ghost" size="sm" onClick={fetchReport}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => exportData('csv', 'appointments')}
            disabled={exporting}
            data-testid="export-csv"
          >
            <Table className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => exportData('pdf', 'appointments')}
            disabled={exporting}
            data-testid="export-pdf"
          >
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[#666666]">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          Loading reports...
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card-flat">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#0A0A0A]">{money(report.summary?.total_revenue)}</p>
                  <p className="text-xs text-[#666666]">Total Revenue</p>
                </div>
              </div>
            </div>

            <div className="card-flat">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#0A0A0A]">{report.summary?.total_bookings || 0}</p>
                  <p className="text-xs text-[#666666]">Total Bookings</p>
                </div>
              </div>
            </div>

            <div className="card-flat">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#0A0A0A]">{report.summary?.completion_rate || 0}%</p>
                  <p className="text-xs text-[#666666]">Completion Rate</p>
                </div>
              </div>
            </div>

            <div className="card-flat">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#0A0A0A]">{money(report.summary?.average_booking_value)}</p>
                  <p className="text-xs text-[#666666]">Avg. Booking Value</p>
                </div>
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="card-flat">
            <h3 className="font-semibold text-[#0A0A0A] mb-4">Booking Status</h3>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="text-sm">Completed: {report.summary?.completed || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span className="text-sm">Cancelled: {report.summary?.cancelled || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-500 rounded-full" />
                <span className="text-sm">No Shows: {report.summary?.no_shows || 0}</span>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Revenue by Service */}
            <div className="card-flat">
              <h3 className="font-semibold text-[#0A0A0A] mb-4">Revenue by Service</h3>
              <div className="space-y-3">
                {report.by_service?.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <div className="w-full bg-[#E5E5E5] h-2 rounded mt-1">
                        <div 
                          className="bg-[#3730A3] h-2 rounded"
                          style={{ 
                            width: `${Math.min(100, (item.revenue / (report.by_service[0]?.revenue || 1)) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="font-semibold">{money(item.revenue)}</p>
                      <p className="text-xs text-[#666666]">{item.bookings} bookings</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue by Staff */}
            <div className="card-flat">
              <h3 className="font-semibold text-[#0A0A0A] mb-4">Revenue by Staff</h3>
              <div className="space-y-3">
                {report.by_staff?.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <div className="w-full bg-[#E5E5E5] h-2 rounded mt-1">
                        <div 
                          className="bg-[#4F46E5] h-2 rounded"
                          style={{ 
                            width: `${Math.min(100, (item.revenue / (report.by_staff[0]?.revenue || 1)) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="font-semibold">{money(item.revenue)}</p>
                      <p className="text-xs text-[#666666]">{item.bookings} bookings</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Busiest Hours */}
          <div className="card-flat">
            <h3 className="font-semibold text-[#0A0A0A] mb-4">Busiest Hours</h3>
            <div className="flex items-end gap-1 h-32">
              {Array.from({ length: 12 }, (_, i) => i + 8).map(hour => {
                const data = report.busiest_hours?.find(h => h.hour === hour);
                const bookings = data?.bookings || 0;
                const maxBookings = Math.max(...(report.busiest_hours?.map(h => h.bookings) || [1]));
                const height = maxBookings > 0 ? (bookings / maxBookings) * 100 : 0;
                
                return (
                  <div key={hour} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-[#3730A3] rounded-t transition-all"
                      style={{ height: `${height}%`, minHeight: bookings > 0 ? '4px' : '0' }}
                      title={`${hour}:00 - ${bookings} bookings`}
                    />
                    <span className="text-xs text-[#666666] mt-1">{hour}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Trends */}
          {report.daily_trends && report.daily_trends.length > 0 && (
            <div className="card-flat">
              <h3 className="font-semibold text-[#0A0A0A] mb-4">Daily Revenue Trend</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E5E5]">
                      <th className="text-left py-2 font-medium text-[#666666]">Date</th>
                      <th className="text-right py-2 font-medium text-[#666666]">Bookings</th>
                      <th className="text-right py-2 font-medium text-[#666666]">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.daily_trends.slice(-10).map((day, idx) => (
                      <tr key={idx} className="border-b border-[#E5E5E5] last:border-0">
                        <td className="py-2">{day.date}</td>
                        <td className="py-2 text-right">{day.bookings}</td>
                        <td className="py-2 text-right font-medium">{money(day.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card-flat py-12 text-center">
          <BarChart3 className="w-12 h-12 text-[#E5E5E5] mx-auto mb-4" />
          <h3 className="font-semibold text-[#0A0A0A] mb-2">No data available</h3>
          <p className="text-[#666666]">Select a date range to view reports</p>
        </div>
      )}
    </TenantLayout>
  );
};

export default ReportsPage;
