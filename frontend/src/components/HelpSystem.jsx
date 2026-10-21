import React, { useState, useEffect } from 'react';
import { HelpCircle, X, ChevronRight, Search, BookOpen, Calendar, Users, Settings, Bot, BarChart3 } from 'lucide-react';

const helpTopics = [
  {
    id: 'getting-started',
    icon: BookOpen,
    title: 'Getting Started',
    description: 'Learn the basics of BookSlot',
    content: [
      { q: 'How do I add my first service?', a: 'Go to Services page and click "Add Service". Enter the name, duration, and price.' },
      { q: 'How do I add staff members?', a: 'Navigate to Staff page and click "Add Staff". You can set their working hours and assign services.' },
      { q: 'How do clients book appointments?', a: 'Share your booking link (on the Dashboard, or "View booking page" in the menu). Clients pick a service, a team member (or anyone), and a free time.' }
    ]
  },
  {
    id: 'calendar',
    icon: Calendar,
    title: 'Calendar & Bookings',
    description: 'Managing your schedule',
    content: [
      { q: 'How do I reschedule an appointment?', a: 'Drag the appointment to a new hour on the calendar, or click it and choose Move. The client is emailed the new time.' },
      { q: 'How do I create a manual booking?', a: 'Click the "New Appointment" button or click on any empty time slot in the calendar.' },
      { q: 'Can I block off time for breaks?', a: 'Yes. On the Staff page use the clock icon for regular hours and breaks, and the plane icon for holidays and one-off time off.' }
    ]
  },
  {
    id: 'clients',
    icon: Users,
    title: 'Client Management',
    description: 'Managing your customers',
    content: [
      { q: 'How do I mark a client as VIP?', a: 'Open the client profile and toggle the VIP status. VIP clients are highlighted throughout the system.' },
      { q: 'Can I add notes to a client?', a: 'Yes! Each client has a notes section for important info like preferences or allergies.' },
      { q: 'How do I view booking history?', a: 'Click on any client to see their complete appointment history and spending.' }
    ]
  },
  {
    id: 'ai-receptionist',
    icon: Bot,
    title: 'AI Receptionist (Moltbot)',
    description: 'Your AI booking assistant',
    content: [
      { q: 'What can the AI receptionist do?', a: 'It answers questions about your services, checks real availability, books appointments and cancels them (with the client\'s confirmation code and email).' },
      { q: 'How do I test the AI?', a: 'Go to AI Receptionist page and use the test chat to try different booking scenarios.' },
      { q: 'Can clients message the AI?', a: 'Yes, through the chat bubble on your booking page (Growth and Pro plans). Switch it on or off under AI Receptionist > Settings.' }
    ]
  },
  {
    id: 'reports',
    icon: BarChart3,
    title: 'Reports & Analytics',
    description: 'Understanding your business',
    content: [
      { q: 'What reports are available?', a: 'View revenue, bookings, popular services, staff performance, and client statistics.' },
      { q: 'Can I export data?', a: 'Yes! Use the export buttons to download reports as CSV or PDF.' },
      { q: 'How often is data updated?', a: 'Reports are updated in real-time as bookings are made and completed.' }
    ]
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Settings & Customization',
    description: 'Configuring your account',
    content: [
      { q: 'How do I customize my booking page?', a: 'Go to Settings > Branding to change colors and upload your logo.' },
      { q: 'How do I enable SMS reminders?', a: 'In Settings > Notifications, enable the SMS add-on and switch on SMS reminders. Reminder timing is set on the same page.' },
      { q: 'Where is my booking link?', a: 'It is at the top of your Dashboard, and you can change it in Settings > General > Booking link.' }
    ]
  }
];

const HelpPanel = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const filteredTopics = searchQuery
    ? helpTopics.filter(topic =>
        topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        topic.content.some(item =>
          item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : helpTopics;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:relative lg:inset-auto">
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/50 lg:hidden"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col lg:absolute lg:right-4 lg:top-16 lg:h-[600px] lg:rounded-lg lg:border lg:border-[#E5E5E5]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#3730A3]" />
            <h2 className="font-semibold text-[#0A0A0A]">Help Center</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#FAFAFA] rounded transition-colors"
            data-testid="close-help"
          >
            <X className="w-5 h-5 text-[#666666]" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-[#E5E5E5]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
            <input
              type="text"
              placeholder="Search help topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#E5E5E5] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3730A3]/20 focus:border-[#3730A3]"
              data-testid="help-search"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {selectedTopic ? (
            /* Topic Detail View */
            <div className="p-4">
              <button
                onClick={() => setSelectedTopic(null)}
                className="flex items-center gap-1 text-sm text-[#666666] hover:text-[#0A0A0A] mb-4"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to topics
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                {React.createElement(selectedTopic.icon, { className: 'w-6 h-6 text-[#3730A3]' })}
                <h3 className="font-semibold text-lg text-[#0A0A0A]">{selectedTopic.title}</h3>
              </div>

              <div className="space-y-3">
                {selectedTopic.content.map((item, idx) => (
                  <div
                    key={idx}
                    className="border border-[#E5E5E5] rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-[#FAFAFA] transition-colors"
                    >
                      <span className="text-sm font-medium text-[#0A0A0A] pr-2">{item.q}</span>
                      <ChevronRight className={`w-4 h-4 text-[#666666] flex-shrink-0 transition-transform ${expandedFaq === idx ? 'rotate-90' : ''}`} />
                    </button>
                    {expandedFaq === idx && (
                      <div className="px-3 pb-3 text-sm text-[#666666] border-t border-[#E5E5E5] pt-3 bg-[#FAFAFA]">
                        {item.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Topics List View */
            <div className="p-4 space-y-2">
              {filteredTopics.map((topic) => {
                const Icon = topic.icon;
                return (
                  <button
                    key={topic.id}
                    onClick={() => setSelectedTopic(topic)}
                    className="w-full flex items-center gap-3 p-3 border border-[#E5E5E5] rounded-lg hover:border-[#3730A3] hover:bg-[#FAFAFA] transition-colors text-left group"
                    data-testid={`help-topic-${topic.id}`}
                  >
                    <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] rounded-lg flex items-center justify-center group-hover:bg-white">
                      <Icon className="w-5 h-5 text-[#666666] group-hover:text-[#3730A3]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[#0A0A0A]">{topic.title}</p>
                      <p className="text-xs text-[#666666]">{topic.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#666666] group-hover:text-[#3730A3]" />
                  </button>
                );
              })}
              
              {filteredTopics.length === 0 && (
                <div className="text-center py-8 text-[#666666]">
                  <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No results found</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#E5E5E5] bg-[#FAFAFA]">
          <p className="text-xs text-center text-[#666666]">
            Need more help? Contact support@bookslot.io
          </p>
        </div>
      </div>
    </div>
  );
};

// Tooltip component for inline help
export const HelpTooltip = ({ text, children }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="inline-flex items-center gap-1 cursor-help"
      >
        {children}
        <HelpCircle className="w-3.5 h-3.5 text-[#999999] hover:text-[#666666]" />
      </div>
      
      {showTooltip && (
        <div className="absolute z-50 w-48 p-2 bg-[#0A0A0A] text-white text-xs rounded shadow-lg bottom-full left-1/2 -translate-x-1/2 mb-1">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#0A0A0A]" />
        </div>
      )}
    </div>
  );
};

export default HelpPanel;
