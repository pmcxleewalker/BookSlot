import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { inboxAPI } from '../../lib/api';
import { 
  MessageCircle, UserCircle, Clock, CheckCircle2, AlertCircle,
  Send, ArrowLeft, Phone, Mail, MoreHorizontal, Search,
  Filter, RefreshCw, Bell, ChevronDown
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

const statusConfig = {
  active: { label: 'Active', color: 'bg-blue-100 text-blue-700', icon: MessageCircle },
  waiting_human: { label: 'Waiting', color: 'bg-amber-100 text-amber-700', icon: Clock },
  human_handling: { label: 'Handling', color: 'bg-purple-100 text-purple-700', icon: UserCircle },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  abandoned: { label: 'Abandoned', color: 'bg-gray-100 text-gray-500', icon: AlertCircle }
};

const priorityConfig = {
  low: { label: 'Low', color: 'text-gray-500' },
  normal: { label: 'Normal', color: 'text-blue-500' },
  high: { label: 'High', color: 'text-orange-500' },
  urgent: { label: 'Urgent', color: 'text-red-500' }
};

const channelConfig = {
  api: { label: 'API', icon: '🤖' },
  widget: { label: 'Widget', icon: '💬' },
  phone: { label: 'Phone', icon: '📞' },
  sms: { label: 'SMS', icon: '📱' },
  whatsapp: { label: 'WhatsApp', icon: '📲' },
  email: { label: 'Email', icon: '📧' }
};

const ConversationList = ({ 
  conversations, 
  selectedId, 
  onSelect, 
  loading,
  onRefresh,
  filter,
  setFilter
}) => {
  return (
    <div className="w-full lg:w-80 xl:w-96 border-r border-[#E5E5E0] flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-[#E5E5E0]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
            Inbox
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="text-[#6B6B6B]"
            data-testid="refresh-inbox-btn"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {/* Filter tabs */}
        <div className="flex gap-1 bg-[#FAF9F6] rounded-lg p-1">
          {[
            { key: null, label: 'All' },
            { key: 'waiting_human', label: 'Waiting' },
            { key: 'human_handling', label: 'Active' },
            { key: 'resolved', label: 'Resolved' }
          ].map(({ key, label }) => (
            <button
              key={label}
              onClick={() => setFilter(key)}
              className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === key 
                  ? 'bg-white text-[#2E473B] shadow-sm' 
                  : 'text-[#6B6B6B] hover:text-[#1C1C1C]'
              }`}
              data-testid={`filter-${label.toLowerCase()}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div className="p-4 text-center text-[#6B6B6B]">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-[#6B6B6B]">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const status = statusConfig[conv.status] || statusConfig.active;
            const channel = channelConfig[conv.channel] || channelConfig.api;
            const priority = priorityConfig[conv.priority] || priorityConfig.normal;
            
            return (
              <button
                key={conv.conversation_id}
                onClick={() => onSelect(conv)}
                className={`w-full p-4 text-left border-b border-[#E5E5E0] hover:bg-[#FAF9F6] transition-colors ${
                  selectedId === conv.conversation_id ? 'bg-[#2E473B]/5' : ''
                }`}
                data-testid={`conversation-${conv.conversation_id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2E473B]/10 flex items-center justify-center text-[#2E473B] font-medium shrink-0">
                    {conv.client_name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#1C1C1C] truncate">
                        {conv.client_name || 'Anonymous'}
                      </span>
                      <span className="text-xs text-[#6B6B6B] shrink-0">
                        {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${status.color}`}>
                        {status.label}
                      </span>
                      <span className="text-xs">{channel.icon}</span>
                      {conv.priority !== 'normal' && (
                        <span className={`text-xs font-medium ${priority.color}`}>
                          {priority.label}
                        </span>
                      )}
                    </div>
                    {conv.booking_intent_detected && (
                      <p className="text-xs text-[#2E473B] mt-1">
                        Booking intent detected
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

const ConversationView = ({ 
  conversation, 
  messages, 
  loading, 
  onBack,
  onAssign,
  onResolve,
  onSendMessage
}) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const { user } = useAuth();
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FAF9F6]">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 mx-auto mb-3 text-[#6B6B6B] opacity-50" />
          <p className="text-[#6B6B6B]">Select a conversation to view</p>
        </div>
      </div>
    );
  }
  
  const status = statusConfig[conversation.status] || statusConfig.active;
  const canAssign = conversation.status === 'waiting_human';
  const canResolve = conversation.status === 'human_handling';
  const canSendMessage = conversation.status === 'human_handling';
  
  const handleSend = async () => {
    if (!newMessage.trim()) return;
    await onSendMessage(newMessage);
    setNewMessage('');
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-[#E5E5E0] flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="lg:hidden"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
              {conversation.client_name || 'Anonymous'}
            </h2>
            <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-[#6B6B6B]">
            {conversation.client_email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {conversation.client_email}
              </span>
            )}
            {conversation.client_phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {conversation.client_phone}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {canAssign && (
            <Button
              onClick={onAssign}
              className="bg-[#2E473B] hover:bg-[#243a30] text-white rounded-xl"
              data-testid="assign-btn"
            >
              Take Over
            </Button>
          )}
          {canResolve && (
            <Button
              variant="outline"
              onClick={onResolve}
              className="rounded-xl border-[#E5E5E0]"
              data-testid="resolve-btn"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Resolve
            </Button>
          )}
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF9F6]">
        {loading ? (
          <div className="text-center text-[#6B6B6B]">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-[#6B6B6B]">No messages yet</div>
        ) : (
          messages.map((msg) => {
            const isClient = msg.sender_type === 'client';
            const isAI = msg.sender_type === 'ai';
            const isStaff = msg.sender_type === 'staff';
            const isSystem = msg.sender_type === 'system';
            
            if (isSystem) {
              return (
                <div key={msg.message_id} className="text-center">
                  <span className="text-xs text-[#6B6B6B] bg-[#E5E5E0] px-3 py-1 rounded-full">
                    {msg.content}
                  </span>
                </div>
              );
            }
            
            return (
              <div
                key={msg.message_id}
                className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-[70%] ${isClient ? 'order-1' : ''}`}>
                  <div className={`rounded-2xl px-4 py-2 ${
                    isClient 
                      ? 'bg-white border border-[#E5E5E0]' 
                      : isAI 
                        ? 'bg-blue-50 border border-blue-100' 
                        : 'bg-[#2E473B] text-white'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <div className={`flex items-center gap-2 mt-1 text-xs text-[#6B6B6B] ${
                    isClient ? '' : 'justify-end'
                  }`}>
                    <span>
                      {isAI ? 'AI' : isStaff ? (msg.sender_name || 'Staff') : ''}
                    </span>
                    <span>
                      {format(new Date(msg.created_at), 'HH:mm')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      {canSendMessage && (
        <div className="p-4 border-t border-[#E5E5E0] bg-white">
          <div className="flex items-center gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 rounded-xl border-[#E5E5E0]"
              data-testid="message-input"
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim()}
              className="bg-[#2E473B] hover:bg-[#243a30] text-white rounded-xl"
              data-testid="send-btn"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
      
      {!canSendMessage && conversation.status !== 'resolved' && (
        <div className="p-4 border-t border-[#E5E5E0] bg-amber-50 text-center text-sm text-amber-700">
          {conversation.status === 'waiting_human' 
            ? 'Click "Take Over" to start handling this conversation'
            : 'This conversation is being handled by AI'}
        </div>
      )}
    </div>
  );
};

const Inbox = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [filter, setFilter] = useState(null);
  const [stats, setStats] = useState(null);
  const { user } = useAuth();
  
  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter) params.status = filter;
      
      const response = await inboxAPI.getConversations(params);
      setConversations(response.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [filter]);
  
  const fetchStats = useCallback(async () => {
    try {
      const response = await inboxAPI.getStats();
      setStats(response);
    } catch (error) {
      console.error('Error fetching inbox stats:', error);
    }
  }, []);
  
  const fetchMessages = useCallback(async (conversationId) => {
    try {
      setMessagesLoading(true);
      const response = await inboxAPI.getConversation(conversationId);
      setMessages(response.messages || []);
      setSelectedConversation(response);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchConversations();
    fetchStats();
  }, [fetchConversations, fetchStats]);
  
  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    fetchMessages(conv.conversation_id);
  };
  
  const handleAssign = async () => {
    if (!selectedConversation) return;
    
    try {
      await inboxAPI.assignConversation(selectedConversation.conversation_id);
      toast.success('Conversation assigned to you');
      fetchMessages(selectedConversation.conversation_id);
      fetchConversations();
      fetchStats();
    } catch (error) {
      console.error('Error assigning conversation:', error);
      toast.error('Failed to assign conversation');
    }
  };
  
  const handleResolve = async () => {
    if (!selectedConversation) return;
    
    try {
      await inboxAPI.resolveConversation(selectedConversation.conversation_id);
      toast.success('Conversation resolved');
      setSelectedConversation(null);
      setMessages([]);
      fetchConversations();
      fetchStats();
    } catch (error) {
      console.error('Error resolving conversation:', error);
      toast.error('Failed to resolve conversation');
    }
  };
  
  const handleSendMessage = async (content) => {
    if (!selectedConversation) return;
    
    try {
      await inboxAPI.sendMessage(selectedConversation.conversation_id, content);
      fetchMessages(selectedConversation.conversation_id);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };
  
  const handleBack = () => {
    setSelectedConversation(null);
    setMessages([]);
  };
  
  return (
    <DashboardLayout title="Receptionist Inbox">
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-[#E5E5E0] p-4">
            <div className="text-sm text-[#6B6B6B]">Active</div>
            <div className="text-2xl font-bold text-[#1C1C1C]" data-testid="stat-active">
              {stats.active_conversations}
            </div>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <div className="text-sm text-amber-700">Waiting for Human</div>
            <div className="text-2xl font-bold text-amber-700" data-testid="stat-waiting">
              {stats.waiting_human}
            </div>
          </div>
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
            <div className="text-sm text-purple-700">Being Handled</div>
            <div className="text-2xl font-bold text-purple-700" data-testid="stat-handling">
              {stats.human_handling}
            </div>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4">
            <div className="text-sm text-green-700">Resolved Today</div>
            <div className="text-2xl font-bold text-green-700" data-testid="stat-resolved">
              {stats.resolved_today}
            </div>
          </div>
        </div>
      )}
      
      {/* Main inbox area */}
      <div className="bg-white rounded-xl border border-[#E5E5E0] overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
        <div className="flex h-full">
          {/* List - hide on mobile when conversation selected */}
          <div className={`${selectedConversation ? 'hidden lg:flex' : 'flex'} flex-col`}>
            <ConversationList
              conversations={conversations}
              selectedId={selectedConversation?.conversation_id}
              onSelect={handleSelectConversation}
              loading={loading}
              onRefresh={() => { fetchConversations(); fetchStats(); }}
              filter={filter}
              setFilter={setFilter}
            />
          </div>
          
          {/* Conversation view */}
          <ConversationView
            conversation={selectedConversation}
            messages={messages}
            loading={messagesLoading}
            onBack={handleBack}
            onAssign={handleAssign}
            onResolve={handleResolve}
            onSendMessage={handleSendMessage}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Inbox;
