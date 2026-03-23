import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, Key, Webhook, Code, ExternalLink } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { webhooksAPI, apiKeysAPI } from '../../lib/api';
import { toast } from 'sonner';

export default function Integrations() {
  const [webhooks, setWebhooks] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState(null);
  
  const [webhookForm, setWebhookForm] = useState({ url: '', events: [] });
  const [apiKeyForm, setApiKeyForm] = useState({ name: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [webhooksData, keysData, eventsData] = await Promise.all([
        webhooksAPI.list(),
        apiKeysAPI.list(),
        webhooksAPI.getEvents()
      ]);
      setWebhooks(webhooksData);
      setApiKeys(keysData);
      setEvents(eventsData.events);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const createWebhook = async (e) => {
    e.preventDefault();
    try {
      const result = await webhooksAPI.create(webhookForm);
      toast.success('Webhook created');
      toast.info(`Secret: ${result.secret}`, { duration: 10000 });
      loadData();
      setShowWebhookModal(false);
      setWebhookForm({ url: '', events: [] });
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteWebhook = async (webhookId) => {
    if (!confirm('Delete this webhook?')) return;
    try {
      await webhooksAPI.delete(webhookId);
      toast.success('Webhook deleted');
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const createApiKey = async (e) => {
    e.preventDefault();
    try {
      const result = await apiKeysAPI.create(apiKeyForm.name, ['read', 'write']);
      setNewApiKey(result.key);
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteApiKey = async (apiKeyId) => {
    if (!confirm('Delete this API key?')) return;
    try {
      await apiKeysAPI.delete(apiKeyId);
      toast.success('API key deleted');
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const toggleEvent = (event) => {
    if (webhookForm.events.includes(event)) {
      setWebhookForm({ ...webhookForm, events: webhookForm.events.filter(e => e !== event) });
    } else {
      setWebhookForm({ ...webhookForm, events: [...webhookForm.events, event] });
    }
  };

  return (
    <DashboardLayout title="Integrations">
      <div className="space-y-8 max-w-4xl">
        {/* Moltbot Integration Info */}
        <div className="bg-gradient-to-r from-[#2E473B] to-[#3E6653] rounded-2xl p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Code className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'Outfit' }}>
                AI Receptionist (Moltbot)
              </h2>
              <p className="text-white/80 mb-4">
                Connect Moltbot to handle bookings automatically. Use the API endpoints below to integrate.
              </p>
              <div className="bg-black/20 rounded-xl p-4 font-mono text-sm">
                <p className="mb-2">API Base URL:</p>
                <code className="text-[#E6B861]">{window.location.origin}/api/moltbot/</code>
              </div>
              <div className="mt-4 flex gap-3">
                <Button variant="secondary" className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View API Docs
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-white rounded-2xl border border-[#E5E5E0] overflow-hidden">
          <div className="p-6 border-b border-[#E5E5E0] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2E473B]/10 flex items-center justify-center">
                <Key className="w-5 h-5 text-[#2E473B]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
                  API Keys
                </h2>
                <p className="text-sm text-[#6B6B6B]">Authenticate external integrations</p>
              </div>
            </div>
            <Button
              onClick={() => setShowApiKeyModal(true)}
              className="rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
              data-testid="create-api-key-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Key
            </Button>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-12 bg-[#E5E5E0] rounded" />
              </div>
            ) : apiKeys.length === 0 ? (
              <p className="text-[#6B6B6B] text-center py-4">No API keys created yet</p>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((key) => (
                  <div 
                    key={key.api_key_id}
                    className="flex items-center justify-between p-3 bg-[#FAF9F6] rounded-xl"
                  >
                    <div>
                      <p className="font-medium text-[#1C1C1C]">{key.name}</p>
                      <p className="text-sm font-mono text-[#6B6B6B]">{key.key_prefix}...</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteApiKey(key.api_key_id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Webhooks */}
        <div className="bg-white rounded-2xl border border-[#E5E5E0] overflow-hidden">
          <div className="p-6 border-b border-[#E5E5E0] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C26A58]/10 flex items-center justify-center">
                <Webhook className="w-5 h-5 text-[#C26A58]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
                  Webhooks
                </h2>
                <p className="text-sm text-[#6B6B6B]">Receive real-time event notifications</p>
              </div>
            </div>
            <Button
              onClick={() => setShowWebhookModal(true)}
              className="rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
              data-testid="create-webhook-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Webhook
            </Button>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-12 bg-[#E5E5E0] rounded" />
              </div>
            ) : webhooks.length === 0 ? (
              <p className="text-[#6B6B6B] text-center py-4">No webhooks configured</p>
            ) : (
              <div className="space-y-3">
                {webhooks.map((webhook) => (
                  <div 
                    key={webhook.webhook_id}
                    className="flex items-center justify-between p-3 bg-[#FAF9F6] rounded-xl"
                  >
                    <div>
                      <p className="font-mono text-sm text-[#1C1C1C] truncate max-w-md">{webhook.url}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {webhook.events.map(e => (
                          <span key={e} className="text-xs bg-[#E5E5E0] px-2 py-0.5 rounded-full">
                            {e}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteWebhook(webhook.webhook_id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* API Key Modal */}
      <Dialog open={showApiKeyModal} onOpenChange={(open) => {
        setShowApiKeyModal(open);
        if (!open) {
          setNewApiKey(null);
          setApiKeyForm({ name: '' });
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
          {newApiKey ? (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800 mb-2">
                  Make sure to copy your API key now. You won't be able to see it again!
                </p>
              </div>
              <div className="bg-[#FAF9F6] rounded-xl p-4 font-mono text-sm break-all">
                {newApiKey}
              </div>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(newApiKey);
                  toast.success('Copied!');
                }}
                className="w-full rounded-xl"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy to Clipboard
              </Button>
            </div>
          ) : (
            <form onSubmit={createApiKey} className="space-y-4">
              <div>
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  value={apiKeyForm.name}
                  onChange={(e) => setApiKeyForm({ ...apiKeyForm, name: e.target.value })}
                  placeholder="e.g. Moltbot Integration"
                  required
                  className="mt-1 rounded-xl"
                  data-testid="api-key-name-input"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowApiKeyModal(false)} className="flex-1 rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white" data-testid="create-key-btn">
                  Create Key
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Webhook Modal */}
      <Dialog open={showWebhookModal} onOpenChange={setShowWebhookModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
          </DialogHeader>
          <form onSubmit={createWebhook} className="space-y-4">
            <div>
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                type="url"
                value={webhookForm.url}
                onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                placeholder="https://your-server.com/webhook"
                required
                className="mt-1 rounded-xl"
                data-testid="webhook-url-input"
              />
            </div>
            <div>
              <Label>Events</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {events.map((event) => (
                  <label key={event} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={webhookForm.events.includes(event)}
                      onCheckedChange={() => toggleEvent(event)}
                    />
                    <span className="text-sm">{event}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowWebhookModal(false)} className="flex-1 rounded-xl">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={webhookForm.events.length === 0}
                className="flex-1 rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white" 
                data-testid="create-webhook-submit"
              >
                Create Webhook
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
