import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Users, Clock, Bot, Shield, Zap, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';

const LandingPage = () => {
  const features = [
    { icon: Calendar, title: 'Smart Scheduling', desc: 'Drag-and-drop calendar with conflict detection' },
    { icon: Users, title: 'Staff Management', desc: 'Manage schedules, services, and permissions' },
    { icon: Clock, title: 'Online Booking', desc: 'Let clients book 24/7 from any device' },
    { icon: Bot, title: 'AI Receptionist', desc: 'Moltbot handles bookings and inquiries' },
    { icon: Shield, title: 'GDPR Compliant', desc: 'Built with privacy and security first' },
    { icon: Zap, title: 'Fast Setup', desc: 'Go live in minutes, not days' },
  ];

  const industries = [
    { name: 'Salons', image: 'https://images.pexels.com/photos/853427/pexels-photo-853427.jpeg?auto=compress&cs=tinysrgb&w=400' },
    { name: 'Clinics', image: 'https://images.pexels.com/photos/4269276/pexels-photo-4269276.jpeg?auto=compress&cs=tinysrgb&w=400' },
    { name: 'Dentists', image: 'https://images.pexels.com/photos/3845810/pexels-photo-3845810.jpeg?auto=compress&cs=tinysrgb&w=400' },
    { name: 'Consultants', image: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=400' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold text-[#0A0A0A]" data-testid="logo">
            BookSlot
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/features" className="text-sm text-[#666666] hover:text-[#0A0A0A] transition-colors" data-testid="nav-features">
              Features
            </Link>
            <Link to="/pricing" className="text-sm text-[#666666] hover:text-[#0A0A0A] transition-colors" data-testid="nav-pricing">
              Pricing
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/signup">
              <Button className="btn-primary text-sm" data-testid="signup-btn">Start Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-6 noise-overlay">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FAFAFA] border border-[#E5E5E5] rounded-full mb-8">
            <Bot className="w-4 h-4 text-[#4F46E5]" />
            <span className="text-sm text-[#666666]">Now with AI Receptionist</span>
          </div>
          
          <h1 className="heading-marketing text-5xl md:text-6xl lg:text-7xl text-[#0A0A0A] mb-6 leading-tight" data-testid="hero-title">
            Simple booking software that just works
          </h1>
          
          <p className="text-lg md:text-xl text-[#666666] mb-10 max-w-2xl mx-auto">
            The easiest way for salons, clinics, and service businesses to manage appointments. 
            Transparent pricing. Fast setup. AI-powered.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button className="btn-primary px-8 py-4 text-base flex items-center gap-2" data-testid="cta-primary">
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" className="btn-secondary px-8 py-4 text-base" data-testid="cta-secondary">
                View Pricing
              </Button>
            </Link>
          </div>

          <p className="text-sm text-[#666666] mt-6">No credit card required · 14-day free trial</p>
        </div>
      </section>

      {/* Trusted By */}
      <section className="py-16 px-6 bg-[#FAFAFA] border-y border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-sm text-[#666666] mb-8">TRUSTED BY 2,000+ BUSINESSES</p>
          <div className="flex flex-wrap items-center justify-center gap-12 opacity-50">
            {['Salon Pro', 'MediCare', 'DentaClinic', 'VetFirst', 'ConsultHub'].map((brand) => (
              <span key={brand} className="text-xl font-semibold text-[#0A0A0A]">{brand}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="heading-marketing text-4xl md:text-5xl text-[#0A0A0A] mb-4">
              Everything you need to manage bookings
            </h2>
            <p className="text-lg text-[#666666]">
              Powerful features, simple interface
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="card-hover" data-testid={`feature-${idx}`}>
                  <div className="w-12 h-12 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-[#0A0A0A]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#0A0A0A] mb-2">{feature.title}</h3>
                  <p className="text-[#666666]">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-24 px-6 bg-[#FAFAFA] border-y border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="heading-marketing text-4xl md:text-5xl text-[#0A0A0A] mb-4">
              Built for your industry
            </h2>
            <p className="text-lg text-[#666666]">
              Pre-configured templates for quick setup
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {industries.map((industry, idx) => (
              <div key={idx} className="group cursor-pointer" data-testid={`industry-${idx}`}>
                <div className="aspect-[4/3] overflow-hidden mb-4 border border-[#E5E5E5]">
                  <img 
                    src={industry.image} 
                    alt={industry.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <h3 className="font-semibold text-[#0A0A0A] group-hover:text-[#E34A33] transition-colors flex items-center gap-2">
                  {industry.name}
                  <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Receptionist CTA */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-[#121212] text-white p-12 md:p-16 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-[#4F46E5] rounded-full flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium text-[#4F46E5]">MOLTBOT AI</span>
              </div>
              <h2 className="heading-marketing text-3xl md:text-4xl mb-4">
                Your 24/7 AI Receptionist
              </h2>
              <p className="text-white/70 mb-8 max-w-lg">
                Let Moltbot handle booking inquiries, check availability, and schedule appointments 
                automatically. Works via chat, WhatsApp, or your website.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#4F46E5]" />
                  <span className="text-sm">Answers FAQs</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#4F46E5]" />
                  <span className="text-sm">Books appointments</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#4F46E5]" />
                  <span className="text-sm">Sends reminders</span>
                </div>
              </div>
            </div>
            {/* Background pattern */}
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
              <div className="w-full h-full bg-gradient-to-l from-[#4F46E5] to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-[#FAFAFA] border-t border-[#E5E5E5]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="heading-marketing text-4xl md:text-5xl text-[#0A0A0A] mb-6">
            Ready to simplify your bookings?
          </h2>
          <p className="text-lg text-[#666666] mb-10">
            Join thousands of businesses using BookSlot to manage their appointments.
          </p>
          <Link to="/signup">
            <Button className="btn-accent px-10 py-4 text-base" data-testid="final-cta">
              Start Your Free Trial
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-xl font-semibold text-[#0A0A0A]">BookSlot</div>
            <div className="flex items-center gap-8 text-sm text-[#666666]">
              <Link to="/features" className="hover:text-[#0A0A0A] transition-colors">Features</Link>
              <Link to="/pricing" className="hover:text-[#0A0A0A] transition-colors">Pricing</Link>
              <span>Privacy</span>
              <span>Terms</span>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-sm text-[#666666]">© 2026 BookSlot. All rights reserved.</p>
              <Link to="/admin" className="text-[#E5E5E5] hover:text-[#CCCCCC] transition-colors" title="Franchise Command Centre">
                <span className="text-xs">◆</span>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
