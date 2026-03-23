import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, Plus, Search, Download, Eye, Check, Clock, 
  AlertCircle, Ban, MoreVertical, Filter, Send
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const statusColors = {
  draft: 'bg-slate-500/20 text-slate-400',
  sent: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-emerald-500/20 text-emerald-400',
  overdue: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-slate-500/20 text-slate-400'
};

const statusIcons = {
  draft: Clock,
  sent: Send,
  paid: Check,
  overdue: AlertCircle,
  cancelled: Ban
};

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, [filterStatus]);

  const loadInvoices = async () => {
    try {
      const sessionToken = localStorage.getItem('admin_session_token');
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);

      const response = await fetch(`${API_URL}/api/admin/invoices?${params}`, {
        credentials: 'include',
        headers: { 'X-Admin-Token': sessionToken || '' }
      });

      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices);
      }
    } catch (error) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (invoiceId, newStatus) => {
    try {
      const sessionToken = localStorage.getItem('admin_session_token');
      const response = await fetch(`${API_URL}/api/admin/invoices/${invoiceId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': sessionToken || ''
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        toast.success('Invoice status updated');
        loadInvoices();
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const viewPdf = async (invoiceId) => {
    const sessionToken = localStorage.getItem('admin_session_token');
    window.open(`${API_URL}/api/admin/invoices/${invoiceId}/pdf?token=${sessionToken}`, '_blank');
  };

  const filteredInvoices = invoices.filter(inv => 
    !search || 
    inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    inv.bill_to_name?.toLowerCase().includes(search.toLowerCase()) ||
    inv.tenant_name?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency
    }).format(amount);
  };

  return (
    <AdminLayout title="Invoices">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <Input
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white rounded-xl"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <Link to="/admin/invoices/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
          </Link>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Invoices', value: invoices.length, color: 'text-slate-400' },
            { label: 'Paid', value: invoices.filter(i => i.status === 'paid').length, color: 'text-emerald-400' },
            { label: 'Pending', value: invoices.filter(i => ['draft', 'sent'].includes(i.status)).length, color: 'text-blue-400' },
            { label: 'Total Value', value: formatCurrency(invoices.reduce((sum, i) => sum + (i.total || 0), 0)), color: 'text-white' }
          ].map((stat, i) => (
            <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <p className="text-sm text-slate-400">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Invoices Table */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-700 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No invoices found</h3>
              <p className="text-slate-400 mb-6">Create your first invoice to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">Invoice</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">Tenant</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">Bill To</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">Amount</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">Status</th>
                    <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">Due Date</th>
                    <th className="text-right p-4 text-xs font-medium text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredInvoices.map((invoice) => {
                    const StatusIcon = statusIcons[invoice.status] || Clock;
                    return (
                      <tr key={invoice.invoice_id} className="hover:bg-slate-700/30">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
                              <FileText className="w-5 h-5 text-slate-400" />
                            </div>
                            <div>
                              <p className="font-medium text-white">{invoice.invoice_number}</p>
                              <p className="text-xs text-slate-500">{formatDate(invoice.issue_date)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-slate-300">{invoice.tenant_name || '-'}</span>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-white">{invoice.bill_to_name}</p>
                          <p className="text-xs text-slate-500">{invoice.bill_to_email}</p>
                        </td>
                        <td className="p-4">
                          <span className="text-white font-medium">
                            {formatCurrency(invoice.total, invoice.currency)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[invoice.status]}`}>
                            <StatusIcon className="w-3 h-3" />
                            {invoice.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-slate-300">{formatDate(invoice.due_date)}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => viewPdf(invoice.invoice_id)}
                              className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"
                              title="View PDF"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <div className="relative group">
                              <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              <div className="absolute right-0 top-full mt-1 w-40 bg-slate-700 rounded-xl shadow-lg border border-slate-600 py-1 hidden group-hover:block z-10">
                                {invoice.status === 'draft' && (
                                  <button
                                    onClick={() => updateStatus(invoice.invoice_id, 'sent')}
                                    className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-600"
                                  >
                                    Mark as Sent
                                  </button>
                                )}
                                {['draft', 'sent', 'overdue'].includes(invoice.status) && (
                                  <button
                                    onClick={() => updateStatus(invoice.invoice_id, 'paid')}
                                    className="w-full px-4 py-2 text-left text-sm text-emerald-400 hover:bg-slate-600"
                                  >
                                    Mark as Paid
                                  </button>
                                )}
                                {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                                  <button
                                    onClick={() => updateStatus(invoice.invoice_id, 'cancelled')}
                                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-600"
                                  >
                                    Cancel Invoice
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
