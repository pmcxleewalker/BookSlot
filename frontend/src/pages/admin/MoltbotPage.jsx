import React, { useState, useEffect, useRef } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { Bot, MessageSquare, User, Send, RefreshCw, Mail, FileText, Edit2, Settings, AlertTriangle, RotateCcw, Smartphone } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { API, errorMessage } from '../../lib/api';

const TRIGGER_LABELS = {
  booking_confirmation: 'Booking confirmation',
  booking_pending: 'Booking request received (needs approval)',
  reminder: 'Appointment reminder',
  cancellation: 'Cancellation',
  rescheduled: 'Appointment moved',
};

const fmtTime = (iso) => { try { return format(parseISO(iso), 'd MMM, HH:mm'); } catch (e) { return ''; } };

const MoltbotPage = () => {
  const { tenant, isManager } = useAuth();
  const features = tenant?.features || {};
  const [activeTab, setActiveTab] = useState(features.ai_assistant ? 'chat' : 'templates');
  const [status, setStatus] = useState(null);
  const [aiSettings, setAiSettings] = useState({ ai_chat_enabled: true, ai_instructions: '' });
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(() => `t${Date.now()}`);
  const endRef = useRef(null);

  const load = async () => {
    try {
      const [st, settings, conv, tpl] = await Promise.all([
        axios.get(`${API}/moltbot/status`),
        axios.get(`${API}/moltbot/settings`),
        axios.get(`${API}/moltbot/conversations`, { params: { limit: 50 } }),
        axios.get(`${API}/messages/templates`),
      ]);
      setStatus(st.data);
      setAiSettings({ ai_chat_enabled: settings.data.ai_chat_enabled, ai_instructions: settings.data.ai_instructions });
      setConversations((conv.data.conversations || []).filter((c) => !c.client_identifier?.startsWith('test:')));
      setTemplates(tpl.data.templates || []);
      setPlaceholders(tpl.data.placeholders || []);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to load'));
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat, sending]);

  const send = async () => {
    const text = message.trim();
    if (!text || sending) return;
    setChat((c) => [...c, { role: 'user', content: text }]);
    setMessage('');
    setSending(true);
    try {
      const r = await axios.post(`${API}/moltbot/chat`, { message: text, session_id: sessionId });
      setChat((c) => [...c, { role: 'assistant', content: r.data.response, actions: r.data.actions }]);
    } catch (error) {
      setChat((c) => [...c, { role: 'assistant', content: errorMessage(error, 'Something went wrong') }]);
    } finally {
      setSending(false);
    }
  };

  const resetChat = async () => {
    setChat([]);
    setSessionId(`t${Date.now()}`);
  };

  const saveAiSettings = async () => {
    try {
      await axios.put(`${API}/moltbot/settings`, aiSettings);
      toast.success('AI receptionist settings saved');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const closeConversation = async (id) => {
    try {
      await axios.post(`${API}/moltbot/conversations/${id}/close`);
      toast.success('Conversation closed');
      setSelectedConversation(null);
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const toggleTemplate = async (tpl, isActive) => {
    try {
      await axios.put(`${API}/messages/templates/${tpl.template_id}`, { is_active: isActive });
      setTemplates((t) => t.map((x) => (x.template_id === tpl.template_id ? { ...x, is_active: isActive } : x)));
      toast.success(isActive ? 'Message turned on' : 'Message turned off');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const saveTemplate = async () => {
    try {
      await axios.put(`${API}/messages/templates/${editingTemplate.template_id}`, {
        subject: editingTemplate.subject, content: editingTemplate.content,
      });
      toast.success('Message saved');
      setEditingTemplate(null);
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const resetTemplate = async () => {
    try {
      const r = await axios.post(`${API}/messages/templates/${editingTemplate.template_id}/reset`);
      setEditingTemplate(r.data.template);
      toast.success('Default wording restored - press Save to keep it');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const tabs = [
    { id: 'chat', label: 'Try it', icon: MessageSquare, needsAi: true },
    { id: 'conversations', label: 'Conversations', icon: Bot, needsAi: true },
    { id: 'settings', label: 'Settings', icon: Settings, needsAi: true },
    { id: 'templates', label: 'Message templates', icon: FileText },
  ];

  return (
    <TenantLayout title="AI Receptionist">
      {!features.ai_assistant && (
        <div className="card-flat mb-6 flex gap-3 items-start">
          <Bot className="w-6 h-6 text-[#4F46E5] flex-shrink-0" />
          <div>
            <p className="font-semibold text-[#0A0A0A]">The AI receptionist is part of the Growth and Pro plans</p>
            <p className="text-sm text-[#666666]">It chats with clients on your booking page, answers questions and books, checks or cancels appointments for them. You can still edit your email and SMS templates below.</p>
          </div>
        </div>
      )}
      {features.ai_assistant && status && !status.enabled && (
        <div className="flex gap-2 p-3 mb-6 bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          The AI service hasn't been connected on the platform yet (an OpenAI or Anthropic API key is needed). Until then the chat replies with a polite "not available" message.
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b border-[#E5E5E5] overflow-x-auto">
        {tabs.filter((t) => !t.needsAi || features.ai_assistant).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} data-testid={`tab-${id}`}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === id ? 'border-[#4F46E5] text-[#4F46E5]' : 'border-transparent text-[#666666] hover:text-[#0A0A0A]'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Test chat */}
      {activeTab === 'chat' && features.ai_assistant && (
        <div className="card-flat max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[#0A0A0A]">Talk to your receptionist</h3>
              <p className="text-sm text-[#666666]">Chat like a client would. Bookings made here are real - cancel them afterwards if you're just testing.</p>
            </div>
            <Button variant="outline" size="sm" onClick={resetChat}><RotateCcw className="w-4 h-4 mr-1" />New chat</Button>
          </div>
          <div className="h-[380px] overflow-y-auto border border-[#E5E5E5] p-4 space-y-3 bg-[#FAFAFA]">
            {chat.length === 0 && <p className="text-sm text-[#666666] text-center mt-24">Try "What services do you offer?" or "Can I book a consultation next Tuesday afternoon?"</p>}
            {chat.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-[#121212]' : 'bg-[#4F46E5]'}`}>
                  {m.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                </div>
                <div className={`max-w-[80%] p-3 rounded-lg text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-[#121212] text-white' : 'bg-white border border-[#E5E5E5]'}`}>
                  {m.content}
                  {m.actions?.length > 0 && (
                    <p className="text-xs text-[#999] mt-2">{m.actions.map((a) => `${a.action.replace('_', ' ')}${a.result?.success === false ? ' (failed)' : ''}`).join(' · ')}</p>
                  )}
                </div>
              </div>
            ))}
            {sending && <p className="text-xs text-[#666666]">Typing...</p>}
            <div ref={endRef} />
          </div>
          <div className="flex gap-2 mt-3">
            <Input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Type a message..." data-testid="test-message-input" />
            <Button onClick={send} disabled={sending || !message.trim()} className="bg-[#4F46E5] hover:bg-[#4338CA] text-white" data-testid="send-test-message">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Conversations */}
      {activeTab === 'conversations' && features.ai_assistant && (
        <div className="card-flat">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#0A0A0A]">Client conversations</h3>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
          </div>
          {conversations.length === 0 ? (
            <p className="py-8 text-center text-[#666666]">No conversations yet. They appear here when clients use the chat on your booking page.</p>
          ) : (
            <div className="divide-y divide-[#E5E5E5]">
              {conversations.map((conv) => {
                const last = conv.messages?.[conv.messages.length - 1];
                return (
                  <button key={conv.conversation_id} onClick={() => setSelectedConversation(conv)} className="w-full text-left py-3 hover:bg-[#FAFAFA] px-2 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0A0A0A] flex items-center gap-2">
                        {conv.channel === 'sms' ? <Smartphone className="w-4 h-4" /> : conv.channel === 'email' ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                        {conv.channel === 'whatsapp' ? 'WhatsApp' : conv.channel === 'sms' ? 'Text' : conv.channel === 'email' ? 'Email' : 'Website chat'}
                        <span className="text-[#999] font-normal">·</span>
                        {conv.context?.booked ? 'Booked an appointment' : `${conv.messages?.length || 0} messages`}
                      </p>
                      <p className="text-sm text-[#666666] truncate">{last?.content}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-[#999]">{fmtTime(conv.updated_at)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${conv.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{conv.status}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Settings */}
      {activeTab === 'settings' && features.ai_assistant && (
        <div className="card-flat max-w-2xl space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-[#0A0A0A]">Show chat on my booking page</p>
              <p className="text-sm text-[#666666]">A chat bubble clients can use to ask questions and book</p>
            </div>
            <Switch checked={aiSettings.ai_chat_enabled} onCheckedChange={(v) => setAiSettings({ ...aiSettings, ai_chat_enabled: v })} disabled={!isManager} />
          </div>
          <div>
            <Label className="text-sm font-medium">Extra instructions (optional)</Label>
            <textarea value={aiSettings.ai_instructions} onChange={(e) => setAiSettings({ ...aiSettings, ai_instructions: e.target.value })}
              rows={6} maxLength={2000} disabled={!isManager} className="mt-1.5 input-swiss resize-y"
              placeholder={'e.g. Parking is free behind the building.\nWe ask clients to arrive 10 minutes early.\nPatch tests are needed 48 hours before any colour service.'} />
            <p className="text-xs text-[#666666] mt-1">The receptionist already knows your services, prices, team and opening hours.</p>
          </div>
          {isManager && <Button className="btn-primary" onClick={saveAiSettings}>Save</Button>}
          {status && <p className="text-xs text-[#999]">AI service: {status.enabled ? `${status.provider} (${status.model})` : 'not connected'}</p>}
        </div>
      )}

      {/* Templates */}
      {activeTab === 'templates' && (
        <div className="space-y-3 max-w-3xl">
          <p className="text-sm text-[#666666]">The emails and texts your clients receive. Switch any off, or change the wording.</p>
          {templates.map((tpl) => (
            <div key={tpl.template_id} className="card-flat flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-[#0A0A0A] flex items-center gap-2">
                  {tpl.type === 'sms' ? <Smartphone className="w-4 h-4 text-[#666666]" /> : <Mail className="w-4 h-4 text-[#666666]" />}
                  {TRIGGER_LABELS[tpl.trigger] || tpl.name} <span className="text-xs text-[#999] uppercase">{tpl.type}</span>
                </p>
                {tpl.subject && <p className="text-sm text-[#666666] truncate">Subject: {tpl.subject}</p>}
                <p className="text-sm text-[#999] line-clamp-2 whitespace-pre-line">{tpl.content}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch checked={tpl.is_active} onCheckedChange={(v) => toggleTemplate(tpl, v)} disabled={!isManager} />
                {isManager && <Button variant="ghost" size="sm" onClick={() => setEditingTemplate({ ...tpl })}><Edit2 className="w-4 h-4" /></Button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conversation detail */}
      <Dialog open={!!selectedConversation} onOpenChange={(o) => !o && setSelectedConversation(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Conversation</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            {selectedConversation?.messages?.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : ''}`}>
                <div className={`max-w-[85%] p-3 rounded-lg text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-[#121212] text-white' : 'bg-[#FAFAFA] border border-[#E5E5E5]'}`}>
                  {m.content}
                  <p className={`text-[10px] mt-1 ${m.role === 'user' ? 'text-white/60' : 'text-[#999]'}`}>{fmtTime(m.timestamp)}</p>
                </div>
              </div>
            ))}
            {selectedConversation?.status === 'active' && (
              <Button variant="outline" className="w-full" onClick={() => closeConversation(selectedConversation.conversation_id)}>Mark as closed</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Template editor */}
      <Dialog open={!!editingTemplate} onOpenChange={(o) => !o && setEditingTemplate(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{TRIGGER_LABELS[editingTemplate?.trigger] || editingTemplate?.name}</DialogTitle></DialogHeader>
          {editingTemplate && (
            <div className="space-y-4 mt-2">
              {editingTemplate.type === 'email' && (
                <div>
                  <Label className="text-sm font-medium">Subject</Label>
                  <Input value={editingTemplate.subject || ''} onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })} className="mt-1.5" />
                </div>
              )}
              <div>
                <Label className="text-sm font-medium">Message</Label>
                <textarea value={editingTemplate.content} onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                  rows={10} className="mt-1.5 input-swiss font-mono text-sm resize-y" />
                {editingTemplate.type === 'sms' && <p className="text-xs text-[#666666] mt-1">Keep texts short - long messages cost more.</p>}
              </div>
              <div className="text-xs text-[#666666]">
                Placeholders: {placeholders.map((p) => <code key={p} className="bg-[#FAFAFA] px-1 mr-1">{`{${p}}`}</code>)}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetTemplate}><RotateCcw className="w-4 h-4 mr-1" />Restore default</Button>
                <Button className="btn-primary flex-1" onClick={saveTemplate}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
};

export default MoltbotPage;
