import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { useParams, useLocation } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const AIReceptionistWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const messagesEndRef = useRef(null);
  const location = useLocation();
  
  // Extract slug from URL (works for /book/:slug and /:slug/* routes)
  const getSlugFromPath = () => {
    const path = location.pathname;
    
    // Match /book/:slug
    const bookMatch = path.match(/^\/book\/([^/]+)/);
    if (bookMatch) return bookMatch[1];
    
    // Match /:slug/login or /:slug/dashboard etc (but not /admin, /login, /signup, etc)
    const slugMatch = path.match(/^\/([^/]+)\//);
    if (slugMatch && !['admin', 'login', 'signup', 'features', 'pricing', 'onboarding'].includes(slugMatch[1])) {
      return slugMatch[1];
    }
    
    return null;
  };
  
  const slug = getSlugFromPath();

  // Determine if widget should show
  const hiddenPaths = [
    '/dashboard', '/calendar', '/appointments', '/staff', '/services',
    '/resources', '/clients', '/forms', '/messages', '/reports', 
    '/settings', '/integrations', '/onboarding', '/login', '/signup',
    '/admin', '/moltbot'
  ];
  
  const shouldShow = slug && !hiddenPaths.some(p => location.pathname.startsWith(p));

  // Fetch tenant info and check if AI is enabled
  useEffect(() => {
    if (slug && shouldShow) {
      fetchTenantInfo();
    }
  }, [slug, shouldShow]);

  const fetchTenantInfo = async () => {
    try {
      const response = await axios.get(`${API}/public/tenant/${slug}`);
      setTenantInfo(response.data);
      setAiEnabled(response.data.ai_receptionist_enabled);
      
      if (response.data.ai_receptionist_enabled) {
        // Set initial greeting
        setMessages([{
          id: 1,
          type: 'bot',
          text: `Hi! I'm Moltbot, the AI assistant for ${response.data.name}. I can help you book appointments, check availability, or answer questions about our services. How can I help you today?`
        }]);
      }
    } catch (error) {
      console.log('Tenant not found or AI not enabled');
      setAiEnabled(false);
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !slug) return;

    const userMessage = { id: Date.now(), type: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const messageText = input;
    setInput('');
    setIsTyping(true);

    try {
      const response = await axios.post(`${API}/public/chat/${slug}`, {
        message: messageText,
        conversation_id: conversationId
      });

      // Store conversation_id for multi-turn
      if (response.data.conversation_id) {
        setConversationId(response.data.conversation_id);
      }

      const botResponse = {
        id: Date.now() + 1,
        type: 'bot',
        text: response.data.response,
        action: response.data.action_taken
      };
      
      setMessages(prev => [...prev, botResponse]);
      
      // If an action was taken (booking made), show confirmation
      if (response.data.action_taken?.success) {
        const actionMsg = {
          id: Date.now() + 2,
          type: 'action',
          text: `✓ ${response.data.action_taken.message || 'Action completed successfully!'}`
        };
        setMessages(prev => [...prev, actionMsg]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorResponse = {
        id: Date.now() + 1,
        type: 'bot',
        text: "I'm sorry, I'm having trouble connecting right now. Please try again or contact the business directly."
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Don't render if shouldn't show or AI not enabled
  if (!shouldShow || !aiEnabled) return null;

  const primaryColor = tenantInfo?.branding?.primary_color || '#4F46E5';

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-20 right-6 w-14 h-14 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-xl z-50 ${isOpen ? 'scale-0' : 'scale-100'}`}
        style={{ backgroundColor: primaryColor }}
        data-testid="ai-widget-button"
        aria-label="Open AI receptionist chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      <div
        className={`fixed bottom-20 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 z-50 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
        }`}
        style={{ transformOrigin: 'bottom right' }}
      >
        {/* Header */}
        <div 
          className="p-4 text-white flex items-center justify-between"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">Moltbot</h3>
              <p className="text-xs text-white/80">AI Assistant</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            data-testid="ai-widget-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAFAFA]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {msg.type !== 'action' && (
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.type === 'user' ? 'bg-[#0A0A0A]' : ''
                  }`}
                  style={msg.type === 'bot' ? { backgroundColor: primaryColor } : {}}
                >
                  {msg.type === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
              )}
              <div
                className={`max-w-[80%] p-3 rounded-xl text-sm ${
                  msg.type === 'user'
                    ? 'bg-[#0A0A0A] text-white rounded-tr-sm'
                    : msg.type === 'action'
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 w-full'
                    : 'bg-white text-[#0A0A0A] border border-[#E5E5E5] rounded-tl-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex items-start gap-2">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-[#E5E5E5] p-3 rounded-xl rounded-tl-sm">
                <div className="flex items-center gap-1">
                  <Loader2 className="w-4 h-4 animate-spin text-[#666666]" />
                  <span className="text-sm text-[#666666]">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-[#E5E5E5]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 border border-[#E5E5E5] rounded-full text-sm focus:outline-none focus:border-[#0A0A0A]"
              data-testid="ai-widget-input"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 text-white"
              style={{ backgroundColor: primaryColor }}
              data-testid="ai-widget-send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-center text-[#999999] mt-2">
            Powered by Moltbot AI
          </p>
        </div>
      </div>
    </>
  );
};

export default AIReceptionistWidget;
