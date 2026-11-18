import React from 'react';
import { MarketingNav, MarketingFooter } from '../../components/MarketingChrome';
import { 
  Calendar, Users, Clock, Bot, Zap,
  Bell, FileText, BarChart3,
  Globe, Puzzle, ArrowRight
} from 'lucide-react';

const FeaturesPage = () => {
  const featureGroups = [
    {
      title: 'Scheduling & booking',
      features: [
        { icon: Calendar, name: 'Drag-and-drop calendar', desc: 'Day, week and list views for the whole team. Move appointments in a click; double-bookings are blocked.' },
        { icon: Clock, name: 'Online booking page', desc: 'A booking page with your logo and colours that clients can use 24/7 from any phone or computer.' },
        { icon: Users, name: 'Staff scheduling', desc: 'Working hours, breaks and the services each person offers, so clients only see real availability.' },
      ]
    },
    {
      title: 'Clients & reminders',
      features: [
        { icon: Bell, name: 'Email confirmations & reminders', desc: 'Every booking gets a confirmation email and a reminder before the appointment, with timing you choose.' },
        { icon: Zap, name: 'Self-serve cancellations', desc: 'Clients cancel from the link in their email, freeing the slot for someone else.' },
        { icon: FileText, name: 'Client records & forms', desc: 'Visit history, notes and VIP flags, plus intake forms to collect details before the appointment.' },
      ]
    },
    {
      title: 'Running the business',
      features: [
        { icon: BarChart3, name: 'Reports', desc: 'Bookings, revenue and busiest times at a glance. Export to CSV or PDF.' },
        { icon: Globe, name: 'Your branding', desc: 'Upload your logo and pick your colours. Clients see your business, not ours.' },
        { icon: Puzzle, name: 'Webhooks', desc: 'Send booking events to your other tools when you need to.' },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 noise-overlay">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="heading-marketing text-5xl md:text-6xl text-[#0A0A0A] mb-6" data-testid="features-title">
            Everything you need to run your bookings
          </h1>
          <p className="text-lg text-[#666666] max-w-2xl mx-auto">
            Built for appointment-based businesses. Simple to use, and we set it up with you.
          </p>
        </div>
      </section>

      {/* Feature Groups */}
      {featureGroups.map((group, gIdx) => (
        <section 
          key={gIdx} 
          className={`py-24 px-6 ${gIdx % 2 === 1 ? 'bg-[#FAFAFA] border-y border-[#E5E5E5]' : ''}`}
        >
          <div className="max-w-7xl mx-auto">
            <h2 className="heading-marketing text-3xl md:text-4xl text-[#0A0A0A] mb-12 text-center">
              {group.title}
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              {group.features.map((feature, fIdx) => {
                const Icon = feature.icon;
                return (
                  <div key={fIdx} className="card-hover" data-testid={`feature-${gIdx}-${fIdx}`}>
                    <div className="w-14 h-14 bg-[#121212] flex items-center justify-center mb-6">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#0A0A0A] mb-3">{feature.name}</h3>
                    <p className="text-[#666666] leading-relaxed">{feature.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}

      {/* AI Receptionist Deep Dive */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#4F46E5]/10 text-[#4F46E5] rounded-full mb-6">
                <Bot className="w-4 h-4" />
                <span className="text-sm font-medium">Moltbot AI</span>
              </div>
              <h2 className="heading-marketing text-3xl md:text-4xl text-[#0A0A0A] mb-6">
                Your AI receptionist never sleeps
              </h2>
              <p className="text-[#666666] mb-6 leading-relaxed">
                Moltbot is designed to be your always-on receptionist. It handles booking inquiries, 
                checks real-time availability, collects client details and schedules appointments,
                all through natural conversation.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Answers FAQs about your services',
                  'Checks staff availability in real-time',
                  'Books, reschedules, and cancels appointments',
                  'Works in a chat on your booking page'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-[#4F46E5] rounded-full" />
                    <span className="text-[#0A0A0A]">{item}</span>
                  </li>
                ))}
              </ul>
              <a href="/#demo" className="btn-primary inline-flex items-center gap-2">
                See it in a demo
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
            <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-8">
              <div className="bg-white border border-[#E5E5E5] p-4 mb-4 rounded-lg">
                <p className="text-sm text-[#666666]">Customer:</p>
                <p className="text-[#0A0A0A]">"Hi, do you have any openings for a haircut tomorrow afternoon?"</p>
              </div>
              <div className="bg-[#4F46E5] text-white p-4 rounded-lg ml-8">
                <p className="text-sm text-white/70">Moltbot:</p>
                <p>"Yes! I have 2:00 PM and 3:30 PM available with Sarah. Would either of those work for you?"</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-[#121212]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="heading-marketing text-4xl text-white mb-6">
            Want to see it with your business in it?
          </h2>
          <p className="text-lg text-white/70 mb-10">
            Book a short demo and we'll walk you through it.
          </p>
          <a href="/#demo" className="inline-block bg-white text-[#0A0A0A] hover:bg-white/90 px-10 py-4 text-base font-medium">
            Book a demo
          </a>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
};

export default FeaturesPage;
