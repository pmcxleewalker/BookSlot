import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { API, errorMessage } from '../lib/api';

const newSessionId = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const getSessionId = (slug) => {
  const key = `bookslot_chat_${slug}`;
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = newSessionId();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch (e) {
    return newSessionId();
  }
};

/** AI receptionist chat bubble shown on a business's public booking page. */
const BookingChatWidget = ({ slug, businessName, accent = '#4F46E5' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', text: `Hi! I'm the assistant for ${businessName}. I can answer questions, check availability and book an appointment for you.` },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const sessionRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => { sessionRef.current = getSessionId(slug); }, [slug]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;
    setMessages((prev) => [...prev, { id: Date.now(), type: 'user', text }]);
    setInput('');
    setIsTyping(true);
    try {
      const res = await axios.post(`${API}/public/booking/${slug}/chat`, { message: text, session_id: sessionRef.current });
      setMessages((prev) => [...prev, { id: Date.now() + 1, type: 'bot', text: res.data.response }]);
    } catch (error) {
      setMessages((prev) => [...prev, { id: Date.now() + 1, type: 'bot', text: errorMessage(error, 'Sorry, something went wrong. Please try again.') }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} style={{ backgroundColor: accent }}
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105 z-50 ${isOpen ? 'scale-0' : 'scale-100'}`}
        data-testid="ai-widget-button" aria-label="Chat with us">
        <MessageCircle className="w-6 h-6" />
      </button>

      <div className={`fixed inset-x-2 bottom-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px] bg-white shadow-2xl border border-[#E5E5E5] rounded-lg overflow-hidden z-50 transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}
        data-testid="ai-widget-window" role="dialog" aria-label="Chat">
        <div className="text-white p-4 flex items-center justify-between" style={{ backgroundColor: accent }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><Bot className="w-5 h-5" /></div>
            <div>
              <h3 className="font-semibold">{businessName}</h3>
              <p className="text-xs text-white/80">Virtual receptionist</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full" data-testid="ai-widget-close" aria-label="Close chat">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="h-[350px] overflow-y-auto p-4 space-y-4 bg-white">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-start gap-2 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: msg.type === 'user' ? '#121212' : accent }}>
                {msg.type === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
              </div>
              <div className={`max-w-[75%] p-3 rounded-lg ${msg.type === 'user' ? 'bg-[#121212] text-white' : 'bg-[#FAFAFA] text-[#0A0A0A] border border-[#E5E5E5]'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: accent }}><Bot className="w-4 h-4 text-white" /></div>
              <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-3 rounded-lg flex gap-1">
                {[0, 150, 300].map((d) => <span key={d} className="w-2 h-2 bg-[#666666] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="p-4 border-t border-[#E5E5E5] bg-white">
          <div className="flex gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type your message..." className="flex-1 px-4 py-2 border border-[#E5E5E5] rounded-md focus:outline-none text-sm text-[#0A0A0A]"
              data-testid="ai-widget-input" />
            <button onClick={handleSend} disabled={!input.trim() || isTyping} style={{ backgroundColor: accent }}
              className="w-10 h-10 text-white rounded-md flex items-center justify-center disabled:opacity-50" data-testid="ai-widget-send" aria-label="Send">
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-[#999999] mt-2 text-center">Automated assistant - it can make mistakes. Always check your confirmation email.</p>
        </div>
      </div>
    </>
  );
};

export default BookingChatWidget;
