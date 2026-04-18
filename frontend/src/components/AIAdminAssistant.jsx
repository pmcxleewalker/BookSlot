import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Send, User, Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth, API } from '../App';
import { getTheme } from '../config/industryThemes';
import axios from 'axios';

const AIAdminAssistant = () => {
  const { user, tenant, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const location = useLocation();

  const theme = getTheme(tenant?.industry);

  // Show on admin pages only
  const adminPaths = ['/dashboard', '/calendar', '/staff', '/settings', '/no-show-shield'];
  const shouldShow = user && tenant && adminPaths.some(p => location.pathname.endsWith(p));

  // Set greeting when tenant loads
  useEffect(() => {
    if (tenant && messages.length === 0) {
      setMessages([{
        id: 1,
        role: 'assistant',
        content: theme.aiGreeting,
      }]);
    }
  }, [tenant]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg = { id: Date.now(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    const text = input;
    setInput('');
    setIsTyping(true);

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await axios.post(`${API}/ai-assistant/chat`, {
        message: text,
        history,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: res.data.response,
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: "Sorry, I couldn't process that. Please try again.",
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!shouldShow) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 text-white rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-2xl z-[9999] ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
        data-testid="ai-assistant-button"
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {/* Chat Panel */}
      <div
        className={`fixed bottom-6 right-6 w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 z-[9999] border border-gray-200 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
        }`}
        style={{ transformOrigin: 'bottom right' }}
        data-testid="ai-assistant-panel"
      >
        {/* Header */}
        <div
          className="px-5 py-4 text-white flex items-center justify-between shrink-0"
          style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{theme.aiName}</h3>
              <p className="text-[11px] text-white/70">AI Assistant &middot; Online</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            data-testid="ai-assistant-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white"
                  style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              )}
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-gray-700 text-white">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gray-800 text-white rounded-2xl rounded-br-md'
                    : 'bg-white text-gray-800 rounded-2xl rounded-bl-md border border-gray-200 shadow-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-end gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white"
                style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  <span className="text-sm text-gray-400">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length <= 1 && (
          <div className="px-4 py-2 flex gap-2 flex-wrap border-t border-gray-100 bg-white">
            {[
              "What's my schedule today?",
              "Any pending bookings?",
              "Business tips",
            ].map((q) => (
              <button
                key={q}
                onClick={() => { setInput(q); }}
                className="text-[11px] px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={`Ask ${theme.aiName} anything...`}
              className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 text-gray-800 placeholder:text-gray-400"
              style={{ '--tw-ring-color': theme.primary }}
              data-testid="ai-assistant-input"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 text-white"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
              data-testid="ai-assistant-send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AIAdminAssistant;
