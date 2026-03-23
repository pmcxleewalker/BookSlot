import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Calendar, Clock, Users, Bell, Shield, Globe, 
  Zap, BarChart3, Settings, Webhook, ArrowRight, Check
} from 'lucide-react';
import { Button } from '../components/ui/button';

const allFeatures = [
  {
    category: 'Scheduling',
    items: [
      { icon: Calendar, title: 'Smart Calendar', description: 'Interactive drag-and-drop calendar with week, day, and month views.' },
      { icon: Clock, title: 'Online Booking', description: '24/7 customer self-booking with real-time availability.' },
      { icon: Users, title: 'Staff Management', description: 'Individual schedules, services, and working hours per staff member.' },
      { icon: Shield, title: 'Conflict Detection', description: 'Automatic double-booking prevention and buffer time management.' },
    ]
  },
  {
    category: 'Automation',
    items: [
      { icon: Bell, title: 'Automated Reminders', description: 'Email and SMS reminders to reduce no-shows by up to 60%.' },
      { icon: Zap, title: 'AI Receptionist', description: 'Let Moltbot handle bookings, FAQs, and client communications.' },
      { icon: Webhook, title: 'Webhooks & API', description: 'Connect with your tools. Automate workflows with real-time events.' },
      { icon: Globe, title: 'Multi-Location', description: 'Manage multiple business locations from one dashboard.' },
    ]
  },
  {
    category: 'Business Tools',
    items: [
      { icon: BarChart3, title: 'Reports & Analytics', description: 'Track bookings, revenue, staff performance, and more.' },
      { icon: Settings, title: 'Custom Forms', description: 'Intake forms to collect client information before appointments.' },
      { icon: Shield, title: 'Deposits & Payments', description: 'Reduce no-shows with deposit collection at booking time.' },
      { icon: Users, title: 'Client Management', description: 'Full CRM with booking history, notes, and preferences.' },
    ]
  }
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#2E473B] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
                TimeSlot Pro
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link to="/features" className="text-[#2E473B] font-medium">Features</Link>
              <Link to="/pricing" className="text-[#6B6B6B] hover:text-[#1C1C1C] transition-colors">Pricing</Link>
              <Link to="/login" className="text-[#6B6B6B] hover:text-[#1C1C1C] transition-colors">Login</Link>
              <Link to="/signup">
                <Button className="bg-[#2E473B] hover:bg-[#243A2F] text-white rounded-full px-6">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-[#1C1C1C] mb-6" style={{ fontFamily: 'Outfit' }}>
              Powerful features, <span className="text-[#2E473B]">simple to use</span>
            </h1>
            <p className="text-lg text-[#6B6B6B] max-w-2xl mx-auto mb-8">
              Everything you need to manage appointments, staff, and clients—without the complexity.
            </p>
            <Link to="/signup">
              <Button size="lg" className="bg-[#2E473B] hover:bg-[#243A2F] text-white rounded-full px-8" data-testid="features-cta">
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Feature Sections */}
      {allFeatures.map((section, sectionIndex) => (
        <section key={section.category} className={`py-16 px-4 ${sectionIndex % 2 === 1 ? 'bg-white' : ''}`}>
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold text-[#1C1C1C] mb-8" style={{ fontFamily: 'Outfit' }}>
              {section.category}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {section.items.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-2xl border border-[#E5E5E0] p-6"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#2E473B]/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-5 h-5 text-[#2E473B]" />
                  </div>
                  <h3 className="font-semibold text-[#1C1C1C] mb-2">{feature.title}</h3>
                  <p className="text-sm text-[#6B6B6B]">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* AI Receptionist Section */}
      <section className="py-20 px-4 bg-[#2E473B]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-white">
              <span className="text-sm font-medium uppercase tracking-wider text-white/60">Moltbot Integration</span>
              <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-6" style={{ fontFamily: 'Outfit' }}>
                AI Receptionist that works 24/7
              </h2>
              <p className="text-white/80 text-lg mb-8">
                Connect Moltbot to handle bookings, answer FAQs, and manage client communications 
                automatically. Never miss a booking opportunity again.
              </p>
              <ul className="space-y-4">
                {[
                  'Answer FAQs instantly',
                  'Collect booking details naturally',
                  'Check real-time availability',
                  'Create, reschedule, or cancel bookings',
                  'Send confirmations and reminders',
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-white/90">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="bg-white/10 rounded-2xl p-8 backdrop-blur-sm border border-white/10">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm">
                      C
                    </div>
                    <div className="bg-white/10 rounded-xl px-4 py-2 text-white/90 text-sm">
                      Hi, I'd like to book a haircut for tomorrow
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="bg-white rounded-xl px-4 py-2 text-[#1C1C1C] text-sm max-w-xs">
                      Of course! I have availability tomorrow at 10:00 AM, 2:00 PM, and 4:30 PM. Which time works best for you?
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#C26A58] flex items-center justify-center">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm">
                      C
                    </div>
                    <div className="bg-white/10 rounded-xl px-4 py-2 text-white/90 text-sm">
                      2:00 PM please
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="bg-white rounded-xl px-4 py-2 text-[#1C1C1C] text-sm max-w-xs">
                      Perfect! I've booked your haircut for tomorrow at 2:00 PM. You'll receive a confirmation email shortly.
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#C26A58] flex items-center justify-center">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1C1C1C] mb-4" style={{ fontFamily: 'Outfit' }}>
            Ready to streamline your bookings?
          </h2>
          <p className="text-[#6B6B6B] text-lg mb-8">
            Start your 14-day free trial. No credit card required.
          </p>
          <Link to="/signup">
            <Button size="lg" className="bg-[#2E473B] hover:bg-[#243A2F] text-white rounded-full px-8">
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-[#E5E5E0]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#2E473B] flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-[#1C1C1C]">TimeSlot Pro</span>
          </div>
          <p className="text-sm text-[#6B6B6B]">© {new Date().getFullYear()} TimeSlot Pro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
