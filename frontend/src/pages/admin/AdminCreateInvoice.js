import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, FileText } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AdminCreateInvoice() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);

  const [formData, setFormData] = useState({
    tenant_id: '',
    bill_to_name: '',
    bill_to_email: '',
    bill_to_address: '',
    bill_to_city: '',
    bill_to_country: 'Ireland',
    bill_to_vat: '',
    items: [{ description: '', quantity: 1, unit_price: 0 }],
    tax_rate: 23,
    notes: '',
    due_days: 14
  });

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const sessionToken = localStorage.getItem('admin_session_token');
      const response = await fetch(`${API_URL}/api/admin/tenants?limit=100`, {
        headers: { 'X-Admin-Token': sessionToken || '' }
      });
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants);
      }
    } catch (error) {
      console.error('Failed to load tenants:', error);
    }
  };

  const handleTenantChange = (tenantId) => {
    const tenant = tenants.find(t => t.tenant_id === tenantId);
    setSelectedTenant(tenant);
    setFormData(prev => ({
      ...prev,
      tenant_id: tenantId,
      bill_to_name: tenant?.name || '',
      bill_to_email: tenant?.email || '',
      bill_to_address: tenant?.address || '',
      bill_to_city: tenant?.city || '',
      bill_to_country: tenant?.country || 'Ireland'
    }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unit_price: 0 }]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => 
      sum + (item.quantity * item.unit_price), 0
    );
  };

  const calculateTax = () => {
    return calculateSubtotal() * (formData.tax_rate / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.tenant_id) {
      toast.error('Please select a tenant');
      return;
    }

    if (formData.items.some(item => !item.description || item.unit_price <= 0)) {
      toast.error('Please fill in all item details');
      return;
    }

    setLoading(true);

    try {
      const sessionToken = localStorage.getItem('admin_session_token');
      const response = await fetch(`${API_URL}/api/admin/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': sessionToken || ''
        },
        body: JSON.stringify({
          ...formData,
          items: formData.items.map(item => ({
            ...item,
            quantity: parseInt(item.quantity),
            unit_price: parseFloat(item.unit_price)
          })),
          tax_rate: parseFloat(formData.tax_rate),
          due_days: parseInt(formData.due_days)
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Invoice ${data.invoice_number} created`);
        navigate('/admin/invoices');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create invoice');
      }
    } catch (error) {
      toast.error('Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Create Invoice">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/admin/invoices')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </button>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tenant Selection */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-700">
              <h2 className="font-semibold text-white" style={{ fontFamily: 'Outfit' }}>
                Select Tenant
              </h2>
            </div>
            <div className="p-5">
              <select
                value={formData.tenant_id}
                onChange={(e) => handleTenantChange(e.target.value)}
                className="w-full h-10 px-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white"
                required
              >
                <option value="">Select a tenant...</option>
                {tenants.map(tenant => (
                  <option key={tenant.tenant_id} value={tenant.tenant_id}>
                    {tenant.name} ({tenant.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Billing Details */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-700">
              <h2 className="font-semibold text-white" style={{ fontFamily: 'Outfit' }}>
                Billing Details
              </h2>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-slate-300">Bill To Name</Label>
                <Input
                  value={formData.bill_to_name}
                  onChange={(e) => setFormData({...formData, bill_to_name: e.target.value})}
                  className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                  required
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-slate-300">Email</Label>
                <Input
                  type="email"
                  value={formData.bill_to_email}
                  onChange={(e) => setFormData({...formData, bill_to_email: e.target.value})}
                  className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                  required
                />
              </div>
              <div className="col-span-2">
                <Label className="text-slate-300">Address</Label>
                <Input
                  value={formData.bill_to_address}
                  onChange={(e) => setFormData({...formData, bill_to_address: e.target.value})}
                  className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                />
              </div>
              <div>
                <Label className="text-slate-300">City</Label>
                <Input
                  value={formData.bill_to_city}
                  onChange={(e) => setFormData({...formData, bill_to_city: e.target.value})}
                  className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                />
              </div>
              <div>
                <Label className="text-slate-300">Country</Label>
                <Input
                  value={formData.bill_to_country}
                  onChange={(e) => setFormData({...formData, bill_to_country: e.target.value})}
                  className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                />
              </div>
              <div>
                <Label className="text-slate-300">VAT Number (optional)</Label>
                <Input
                  value={formData.bill_to_vat}
                  onChange={(e) => setFormData({...formData, bill_to_vat: e.target.value})}
                  placeholder="IE1234567X"
                  className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                />
              </div>
              <div>
                <Label className="text-slate-300">Payment Due (days)</Label>
                <Input
                  type="number"
                  value={formData.due_days}
                  onChange={(e) => setFormData({...formData, due_days: e.target.value})}
                  className="mt-1 bg-slate-900/50 border-slate-600 text-white rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-white" style={{ fontFamily: 'Outfit' }}>
                Line Items
              </h2>
              <Button
                type="button"
                onClick={addItem}
                variant="outline"
                size="sm"
                className="rounded-xl border-slate-600 text-slate-300"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>
            <div className="p-5 space-y-4">
              {formData.items.map((item, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      placeholder="Description"
                      className="bg-slate-900/50 border-slate-600 text-white rounded-xl"
                      required
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      placeholder="Qty"
                      min="1"
                      className="bg-slate-900/50 border-slate-600 text-white rounded-xl"
                      required
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                      placeholder="Price"
                      min="0"
                      step="0.01"
                      className="bg-slate-900/50 border-slate-600 text-white rounded-xl"
                      required
                    />
                  </div>
                  <div className="w-28 text-right text-white font-medium pt-2">
                    €{(item.quantity * item.unit_price).toFixed(2)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="p-2 text-slate-500 hover:text-red-400"
                    disabled={formData.items.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Totals */}
              <div className="pt-4 border-t border-slate-700 space-y-2">
                <div className="flex justify-end gap-8">
                  <span className="text-slate-400">Subtotal</span>
                  <span className="text-white w-28 text-right">€{calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-end gap-8 items-center">
                  <span className="text-slate-400">Tax</span>
                  <Input
                    type="number"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({...formData, tax_rate: e.target.value})}
                    className="w-20 bg-slate-900/50 border-slate-600 text-white rounded-xl text-right"
                    min="0"
                    max="100"
                  />
                  <span className="text-slate-400">%</span>
                  <span className="text-white w-28 text-right">€{calculateTax().toFixed(2)}</span>
                </div>
                <div className="flex justify-end gap-8 pt-2 border-t border-slate-700">
                  <span className="text-white font-semibold">Total</span>
                  <span className="text-emerald-400 text-xl font-bold w-28 text-right">
                    €{calculateTotal().toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-700">
              <h2 className="font-semibold text-white" style={{ fontFamily: 'Outfit' }}>
                Notes (Optional)
              </h2>
            </div>
            <div className="p-5">
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Add any notes for this invoice..."
                className="w-full h-24 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 resize-none"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/invoices')}
              className="rounded-xl border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl min-w-[160px]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Create Invoice
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
