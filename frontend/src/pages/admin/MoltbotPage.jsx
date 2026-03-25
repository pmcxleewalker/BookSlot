import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { Bot, MessageSquare, Clock, User, CheckCircle, XCircle, Send, RefreshCw, Mail, FileText, Edit2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const MoltbotPage = () => {
  const { token, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState('chat');
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [moltbotStatus, setMoltbotStatus] = useState(null);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState(null);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [convRes, statusRes, templatesRes] = await Promise.all([
        axios.get(`${API}/moltbot/${tenant?.tenant_id}/conversations?api_key=admin&limit=50`),
        axios.get(`${API}/moltbot/status`),
        axios.get(`${API}/messages/templates`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { templates: [] } }))
      ]);
      setConversations(convRes.data.conversations || []);
      setMoltbotStatus(statusRes.data);
      setTemplates(templatesRes.data.templates || []);
    } catch (error) {
      console.error('Failed to load Moltbot data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateToggle = async (templateId, isActive) => {
    try {
      await axios.put(`${API}/messages/templates/${templateId}`, { is_active: isActive }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(isActive ? 'Template enabled' : 'Template disabled');
      fetchData();
    } catch (error) {
      toast.error('Failed to update template');
    }
  };

  const handleTemplateSave = async () => {
    if (!editingTemplate) return;
    try {
      await axios.put(`${API}/messages/templates/${editingTemplate.template_id}`, {
        subject: editingTemplate.subject,
        content: editingTemplate.content
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Template saved');
      setEditingTemplate(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to save template');
    }
  };

  const triggerLabels = {
    booking_confirmation: 'Booking Confirmation',
    reminder: 'Appointment Reminder',
    cancellation: 'Cancellation Notice'
  };

  const sendTestMessage = async () => {
    if (!testMessage.trim()) return;
    setSending(true);
    setTestResponse(null);

    try {
      const response = await axios.post(
        `${API}/moltbot/${tenant?.tenant_id}/chat?api_key=admin`,
        {
          message: testMessage,
          client_identifier: 'admin-test',
          channel: 'chat'
        }
      );
      setTestResponse(response.data);
      setTestMessage('');
      fetchData(); // Refresh conversations
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const closeConversation = async (conversationId) => {
    try {
      await axios.post(
        `${API}/moltbot/${tenant?.tenant_id}/conversations/${conversationId}/close?api_key=admin`
      );
      toast.success('Conversation closed');
      fetchData();
    } catch (error) {
      toast.error('Failed to close conversation');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      case 'abandoned': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatTime = (timestamp) => {
    try {
      return format(parseISO(timestamp), 'MMM d, h:mm a');
    } catch {
      return timestamp;
    }
  };

  if (loading) {
    return (
      <TenantLayout title="AI Receptionist">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-[#E34A33] border-t-transparent rounded-full" />
        </div>
      </TenantLayout>
    );
  }

  const tabs = [
    { id: 'chat', label: 'AI Chat', icon: Bot },
    { id: 'conversations', label: 'Conversations', icon: MessageSquare },
    { id: 'templates', label: 'Message Templates', icon: FileText }
  ];

  return (
    <TenantLayout title="AI Receptionist">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#E5E5E5] overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#E34A33] text-[#E34A33]'
                  : 'border-transparent text-[#666666] hover:text-[#0A0A0A]'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* AI Chat Tab */}
      {activeTab === 'chat' && (
        <>
      {/* Status Banner */}
      <div className="card-flat mb-6" data-testid="moltbot-status">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              moltbotStatus?.llm_configured ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <Bot className={`w-6 h-6 ${moltbotStatus?.llm_configured ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-[#0A0A0A]">Moltbot AI</h3>
              <p className="text-sm text-[#666666]">
                {moltbotStatus?.llm_configured 
                  ? 'AI receptionist is active and ready to help customers'
                  : 'AI receptionist is not configured'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {moltbotStatus?.features?.sms_webhook && (
              <span className="px-2 py-1 text-xs bg-[#FAFAFA] border border-[#E5E5E5]">SMS</span>
            )}
            {moltbotStatus?.features?.email_webhook && (
              <span className="px-2 py-1 text-xs bg-[#FAFAFA] border border-[#E5E5E5]">Email</span>
            )}
            <span className="px-2 py-1 text-xs bg-[#FAFAFA] border border-[#E5E5E5]">Chat</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Test Chat */}
        <div className="card-flat" data-testid="moltbot-test-chat">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-[#666666]" />
            <h3 className="font-semibold text-[#0A0A0A]">Test Conversation</h3>
          </div>
          
          <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-4 mb-4 min-h-[200px] max-h-[300px] overflow-y-auto">
            {testResponse ? (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <div className="bg-[#0A0A0A] text-white px-3 py-2 rounded-lg max-w-[80%]">
                    <p className="text-sm">{testResponse.context?.message || 'Your message'}</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-white border border-[#E5E5E5] px-3 py-2 rounded-lg max-w-[80%]">
                    <p className="text-sm">{testResponse.response}</p>
                    {testResponse.action_taken?.success && (
                      <div className="mt-2 pt-2 border-t border-[#E5E5E5]">
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Action: {testResponse.action_taken.action}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[#666666] text-sm text-center py-8">
                Send a test message to see how Moltbot responds
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Type a message... e.g., 'I want to book a haircut'"
              onKeyPress={(e) => e.key === 'Enter' && sendTestMessage()}
              disabled={sending}
              data-testid="moltbot-test-input"
            />
            <Button 
              onClick={sendTestMessage} 
              disabled={sending || !testMessage.trim()}
              className="btn-primary"
              data-testid="moltbot-send-btn"
            >
              {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Conversations Tab */}
      {activeTab === 'conversations' && (
        <div className="card-flat" data-testid="moltbot-conversations">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#666666]" />
              <h3 className="font-semibold text-[#0A0A0A]">All Conversations</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-[#666666] text-sm text-center py-8">No conversations yet</p>
            ) : (
              conversations.map((conv) => (
                <div 
                  key={conv.conversation_id}
                  className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] hover:border-[#0A0A0A] cursor-pointer transition-colors"
                  onClick={() => setSelectedConversation(conv)}
                  data-testid={`conv-${conv.conversation_id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[#666666]" />
                      <span className="text-sm font-medium">{conv.client_identifier}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(conv.status)}`}>{conv.status}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-[#666666]">
                    <span>{conv.channel} • {conv.messages?.length || 0} messages</span>
                    <span>{formatTime(conv.updated_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Message Templates Tab */}
      {activeTab === 'templates' && (
        <div>
          <div className="mb-6">
            <p className="text-[#666666]">
              Configure automated messages sent to your clients. 
              <span className="text-amber-600 ml-1">(Requires SMS/Email integration)</span>
            </p>
          </div>

          <div className="space-y-4">
            {templates.length === 0 ? (
              <div className="card-flat text-center py-8 text-[#666666]">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No message templates configured</p>
              </div>
            ) : (
              templates.map((template) => (
                <div key={template.template_id} className="card-flat" data-testid={`template-${template.template_id}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                        {template.type === 'email' ? (
                          <Mail className="w-5 h-5 text-[#666666]" />
                        ) : (
                          <MessageSquare className="w-5 h-5 text-[#666666]" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#0A0A0A]">{template.name}</h3>
                        <p className="text-sm text-[#666666]">
                          {triggerLabels[template.trigger] || template.trigger} · {template.type.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={(checked) => handleTemplateToggle(template.template_id, checked)}
                      />
                      <Button variant="ghost" size="sm" onClick={() => setEditingTemplate({ ...template })}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-[#666666] bg-[#FAFAFA] p-3 font-mono whitespace-pre-wrap border border-[#E5E5E5]">
                    {template.content}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Edit Template Dialog */}
          <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit Message Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-sm font-medium">Subject (for emails)</Label>
                  <Input
                    value={editingTemplate?.subject || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Message Content</Label>
                  <Textarea
                    value={editingTemplate?.content || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                    rows={6}
                    className="mt-1.5 font-mono text-sm"
                  />
                  <p className="text-xs text-[#666666] mt-1">
                    Available variables: {'{'}client_name{'}'}, {'{'}service_name{'}'}, {'{'}date{'}'}, {'{'}time{'}'}, {'{'}business_name{'}'}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setEditingTemplate(null)}>Cancel</Button>
                  <Button className="flex-1 btn-primary" onClick={handleTemplateSave}>Save Template</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Conversation Detail Dialog */}
      <Dialog open={!!selectedConversation} onOpenChange={() => setSelectedConversation(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Conversation with {selectedConversation?.client_identifier}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {selectedConversation?.messages?.map((msg, idx) => (
              <div 
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`px-3 py-2 rounded-lg max-w-[80%] ${
                  msg.role === 'user' 
                    ? 'bg-[#0A0A0A] text-white' 
                    : 'bg-[#FAFAFA] border border-[#E5E5E5]'
                }`}>
                  <p className="text-sm">{msg.content}</p>
                  <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/60' : 'text-[#666666]'}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {selectedConversation?.context && Object.keys(selectedConversation.context).length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#E5E5E5]">
              <h4 className="text-sm font-medium mb-2">Extracted Information</h4>
              <div className="bg-[#FAFAFA] p-3 text-xs font-mono">
                {Object.entries(selectedConversation.context).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-[#666666]">{key}:</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedConversation?.status === 'active' && (
            <div className="mt-4 pt-4 border-t border-[#E5E5E5]">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  closeConversation(selectedConversation.conversation_id);
                  setSelectedConversation(null);
                }}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Close Conversation
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
};

export default MoltbotPage;
