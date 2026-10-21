import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { 
  Calendar, Users, Clock, Bot, Shield, Zap, 
  Bell, CreditCard, FileText, BarChart3, 
  Globe, Puzzle, ArrowRight
} from 'lucide-react';

const FeaturesPage = () => {
  const featureGroups = [
    {
      title: 'Scheduling & Booking',
      features: [
        { icon: Calendar, name: 'Drag-and-drop Calendar', desc: 'Day, week and list views. Drag to move appointments, with clash checks.' },
        { icon: Clock, name: 'Online Booking', desc: 'Beautiful booking page your clients can access 24/7 from any device.' },
        { icon: Users, name: 'Staff Scheduling', desc: 'Manage individual schedules, working hours, and time off for each team member.' },
      ]
    },
    {
      title: 'AI & Automation',
      features: [
        { icon: Bot, name: 'AI Receptionist', desc: 'Moltbot handles inquiries, checks availability, and books appointments automatically.' },
        { icon: Bell, name: 'Smart Reminders', desc: 'Automatic email and SMS reminders before every appointment to cut no-shows.' },
        { icon: Zap, name: 'Waitlist Automation', desc: 'Coming soon: automatically fill cancelled slots from your waitlist.' },
      ]
    },
    {
      title: 'Business Tools',
      features: [
        { icon: CreditCard, name: 'Deposits & Payments', desc: 'Coming soon: take deposits online when clients book.' },
        { icon: FileText, name: 'Custom Forms', desc: 'Create intake forms and gather important client information before appointments.' },
        { icon: BarChart3, name: 'Reports & Analytics', desc: 'Track revenue, appointments, and staff performance with visual dashboards.' },
      ]
    },
    {
      title: 'Enterprise Ready',
      features: [
        { icon: Globe, name: 'Multi-location', desc: 'Coming soon: manage several locations from one dashboard.' },
        { icon: Shield, name: 'GDPR Compliance', desc: 'Client data export and delete-on-request built in.' },
        { icon: Puzzle, name: 'API & Webhooks', desc: 'Connect with your existing tools and build custom integrations.' },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold text-[#0A0A0A]">BookSlot</Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/features" className="text-sm text-[#0A0A0A] font-medium">Features</Link>
            <Link to="/pricing" className="text-sm text-[#666666] hover:text-[#0A0A0A] transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login"><Button variant="ghost" className="text-sm">Log in</Button></Link>
            <Link to="/signup"><Button className="btn-primary text-sm">Start Free</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 noise-overlay">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="heading-marketing text-5xl md:text-6xl text-[#0A0A0A] mb-6" data-testid="features-title">
            Everything you need to run your business
          </h1>
          <p className="text-lg text-[#666666] max-w-2xl mx-auto">
            Powerful features designed for appointment-based businesses. Simple to use, quick to set up.
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
                checks real-time availability, collects client information, and schedules appointments — 
                all through natural conversation.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Answers FAQs about your services',
                  'Checks staff availability in real-time',
                  'Books, reschedules, and cancels appointments',
                  'Sends confirmations and reminders',
                  'Works via website chat or messaging apps'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-[#4F46E5] rounded-full" />
                    <span className="text-[#0A0A0A]">{item}</span>
                  </li>
                ))}
              </ul>
              <Link to="/signup">
                <Button className="btn-primary flex items-center gap-2">
                  Try Moltbot Free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
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
            Ready to get started?
          </h2>
          <p className="text-lg text-white/70 mb-10">
            14-day free trial. No credit card required.
          </p>
          <Link to="/signup">
            <Button className="bg-white text-[#0A0A0A] hover:bg-white/90 px-10 py-4 text-base">
              Start Free Trial
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-xl font-semibold text-[#0A0A0A]">BookSlot</div>
          <p className="text-sm text-[#666666]">© 2026 BookSlot. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default FeaturesPage;
