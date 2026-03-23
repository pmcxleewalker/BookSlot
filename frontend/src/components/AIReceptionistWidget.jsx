import React, { useState } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { useAuth } from '../App';

const AIReceptionistWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      text: "Hi! I'm Moltbot, your AI receptionist. I can help you book appointments, check availability, or answer questions about our services. How can I assist you today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const { tenant } = useAuth();

  // Only show on public pages or when tenant exists
  const shouldShow = !window.location.pathname.startsWith('/dashboard') && 
                     !window.location.pathname.startsWith('/calendar') &&
                     !window.location.pathname.startsWith('/appointments') &&
                     !window.location.pathname.startsWith('/staff') &&
                     !window.location.pathname.startsWith('/services') &&
                     !window.location.pathname.startsWith('/resources') &&
                     !window.location.pathname.startsWith('/clients') &&
                     !window.location.pathname.startsWith('/forms') &&
                     !window.location.pathname.startsWith('/messages') &&
                     !window.location.pathname.startsWith('/reports') &&
                     !window.location.pathname.startsWith('/settings') &&
                     !window.location.pathname.startsWith('/integrations') &&
                     !window.location.pathname.startsWith('/onboarding') &&
                     !window.location.pathname.startsWith('/login') &&
                     !window.location.pathname.startsWith('/signup');

  if (!shouldShow) return null;

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { id: Date.now(), type: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response (in production, this would call the Moltbot API)
    setTimeout(() => {
      const responses = [
        "I'd be happy to help you book an appointment! What service are you interested in?",
        "Let me check our availability for you. What date and time works best?",
        "Great choice! Our team is highly skilled in that service. Would you like me to find the next available slot?",
        "I can see several openings this week. Would you prefer morning or afternoon appointments?",
        "Perfect! I'll need your name and contact information to complete the booking."
      ];
      
      const botResponse = {
        id: Date.now() + 1,
        type: 'bot',
        text: responses[Math.floor(Math.random() * responses.length)]
      };
      
      setMessages(prev => [...prev, botResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-20 right-6 w-14 h-14 bg-[#4F46E5] text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-xl z-50 ${isOpen ? 'scale-0' : 'scale-100'}`}
        data-testid="ai-widget-button"
        aria-label="Open AI receptionist chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      <div
        className={`fixed bottom-20 right-6 w-[380px] max-w-[calc(100vw-48px)] glass-widget rounded-lg overflow-hidden z-50 transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}
        data-testid="ai-widget-window"
      >
        {/* Header */}
        <div className="bg-[#4F46E5] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">Moltbot</h3>
              <p className="text-xs text-white/80">AI Receptionist</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
            data-testid="ai-widget-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="h-[350px] overflow-y-auto p-4 space-y-4 bg-white">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.type === 'user' ? 'bg-[#121212]' : 'bg-[#4F46E5]'}`}>
                {msg.type === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              <div
                className={`max-w-[75%] p-3 rounded-lg ${
                  msg.type === 'user'
                    ? 'bg-[#121212] text-white'
                    : 'bg-[#FAFAFA] text-[#0A0A0A] border border-[#E5E5E5]'
                }`}
              >
                <p className="text-sm">{msg.text}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-[#4F46E5] flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-3 rounded-lg">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-[#666666] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-[#666666] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-[#666666] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[#E5E5E5] bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#4F46E5] text-sm"
              data-testid="ai-widget-input"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-10 h-10 bg-[#4F46E5] text-white rounded-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#4338CA] transition-colors"
              data-testid="ai-widget-send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-[#666666] mt-2 text-center">
            Powered by Moltbot AI Receptionist
          </p>
        </div>
      </div>
    </>
  );
};

export default AIReceptionistWidget;
