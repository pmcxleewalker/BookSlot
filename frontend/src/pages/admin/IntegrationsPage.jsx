import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Checkbox } from '../../components/ui/checkbox';
import { toast } from 'sonner';
import { Puzzle, Plus, Trash2, Copy, Calendar, Bot, CreditCard, Globe, Webhook } from 'lucide-react';

const IntegrationsPage = () => {
  const { token, tenant } = useAuth();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    url: '',
    events: []
  });

  const webhookEvents = [
    { value: 'booking.created', label: 'Booking Created' },
    { value: 'booking.updated', label: 'Booking Updated' },
    { value: 'booking.cancelled', label: 'Booking Cancelled' },
    { value: 'booking.completed', label: 'Booking Completed' }
  ];

  const integrations = [
    { 
      name: 'Google Calendar', 
      icon: Calendar, 
      description: 'Sync appointments with Google Calendar',
      connected: false,
      plan: 'starter'
    },
    { 
      name: 'AI Receptionist (Moltbot)', 
      icon: Bot, 
      description: 'Connect your AI receptionist to handle bookings',
      connected: true,
      plan: 'growth'
    },
    { 
      name: 'Stripe Payments', 
      icon: CreditCard, 
      description: 'Accept online payments and deposits',
      connected: false,
      plan: 'starter'
    },
    { 
      name: 'Website Widget', 
      icon: Globe, 
      description: 'Embed booking widget on your website',
      connected: true,
      plan: 'starter'
    }
  ];

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const response = await axios.get(`${API}/webhooks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWebhooks(response.data.webhooks || []);
    } catch (error) {
      console.error('Failed to load webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhook.url || newWebhook.events.length === 0) {
      toast.error('Please enter URL and select at least one event');
      return;
    }

    try {
      await axios.post(`${API}/webhooks`, newWebhook, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Webhook created');
      setShowWebhookDialog(false);
      setNewWebhook({ url: '', events: [] });
      fetchWebhooks();
    } catch (error) {
      toast.error('Failed to create webhook');
    }
  };

  const handleDeleteWebhook = async (webhookId) => {
    if (!window.confirm('Delete this webhook?')) return;

    try {
      await axios.delete(`${API}/webhooks/${webhookId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Webhook deleted');
      fetchWebhooks();
    } catch (error) {
      toast.error('Failed to delete webhook');
    }
  };

  const copyApiKey = () => {
    // In production, this would be a real API key
    navigator.clipboard.writeText(`bks_${tenant?.tenant_id}_demo_key`);
    toast.success('API key copied');
  };

  return (
    <TenantLayout title="Integrations">
      {/* Available Integrations */}
      <div className="mb-8">
        <h2 className="font-semibold text-[#0A0A0A] mb-4">Available Integrations</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {integrations.map((integration, idx) => {
            const Icon = integration.icon;
            return (
              <div key={idx} className="card-flat flex items-start justify-between" data-testid={`integration-${idx}`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                    <Icon className="w-6 h-6 text-[#666666]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0A0A0A]">{integration.name}</h3>
                    <p className="text-sm text-[#666666] mb-2">{integration.description}</p>
                    <span className={`text-xs px-2 py-0.5 ${integration.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-[#FAFAFA] text-[#666666]'}`}>
                      {integration.connected ? 'Connected' : 'Not connected'}
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  {integration.connected ? 'Configure' : 'Connect'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* API Access */}
      <div className="card-flat mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
            <Puzzle className="w-5 h-5 text-[#666666]" />
          </div>
          <div>
            <h3 className="font-semibold text-[#0A0A0A]">API Access</h3>
            <p className="text-sm text-[#666666]">
              Use the API to integrate BookSlot with your own systems
              {tenant?.plan !== 'pro' && ' (Pro plan required)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 bg-[#FAFAFA] border border-[#E5E5E5]">
          <code className="flex-1 text-sm font-mono text-[#666666] truncate">
            bks_{tenant?.tenant_id?.slice(0, 8)}...demo_key
          </code>
          <Button variant="outline" size="sm" onClick={copyApiKey} className="flex items-center gap-2" data-testid="copy-api-key">
            <Copy className="w-4 h-4" />
            Copy
          </Button>
        </div>

        <div className="mt-4 text-sm">
          <p className="text-[#666666] mb-2">API Documentation:</p>
          <ul className="space-y-1 text-[#666666]">
            <li>• <code className="text-xs bg-[#FAFAFA] px-1">GET /api/receptionist/{'{tenant_id}'}/info</code> - Get business info</li>
            <li>• <code className="text-xs bg-[#FAFAFA] px-1">GET /api/receptionist/{'{tenant_id}'}/availability</code> - Check availability</li>
            <li>• <code className="text-xs bg-[#FAFAFA] px-1">POST /api/receptionist/{'{tenant_id}'}/book</code> - Create booking</li>
            <li>• <code className="text-xs bg-[#FAFAFA] px-1">POST /api/receptionist/{'{tenant_id}'}/cancel</code> - Cancel booking</li>
          </ul>
        </div>
      </div>

      {/* Webhooks */}
      <div className="card-flat">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
              <Webhook className="w-5 h-5 text-[#666666]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0A0A0A]">Webhooks</h3>
              <p className="text-sm text-[#666666]">Receive notifications when booking events occur</p>
            </div>
          </div>
          <Button 
            onClick={() => setShowWebhookDialog(true)} 
            className="btn-primary flex items-center gap-2"
            data-testid="add-webhook-btn"
          >
            <Plus className="w-4 h-4" />
            Add Webhook
          </Button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-[#666666]">Loading...</div>
        ) : webhooks.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[#666666]">No webhooks configured</p>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((webhook) => (
              <div key={webhook.webhook_id} className="flex items-center justify-between p-4 bg-[#FAFAFA] border border-[#E5E5E5]">
                <div>
                  <p className="font-mono text-sm text-[#0A0A0A] truncate max-w-md">{webhook.url}</p>
                  <div className="flex gap-2 mt-1">
                    {webhook.events.map((event) => (
                      <span key={event} className="text-xs bg-white px-2 py-0.5 border border-[#E5E5E5]">
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDeleteWebhook(webhook.webhook_id)}
                  className="text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Webhook Dialog */}
      <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-sm font-medium">Webhook URL</Label>
              <Input
                value={newWebhook.url}
                onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                placeholder="https://your-server.com/webhook"
                className="mt-1.5"
                data-testid="webhook-url"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Events</Label>
              <div className="space-y-2 mt-2">
                {webhookEvents.map((event) => (
                  <label key={event.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={newWebhook.events.includes(event.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setNewWebhook({ ...newWebhook, events: [...newWebhook.events, event.value] });
                        } else {
                          setNewWebhook({ ...newWebhook, events: newWebhook.events.filter(e => e !== event.value) });
                        }
                      }}
                    />
                    <span className="text-sm text-[#0A0A0A]">{event.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowWebhookDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1 btn-primary" onClick={handleCreateWebhook} data-testid="create-webhook-btn">
                Create Webhook
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
};

export default IntegrationsPage;
