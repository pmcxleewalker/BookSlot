import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Users, Clock, Bot, Shield, Zap, CheckCircle2, ChevronRight, BarChart3, Palette, FileText, Bell, Mail } from 'lucide-react';
import { Button } from '../../components/ui/button';

const LandingPage = () => {
  const features = [
    { icon: Calendar, title: 'Smart Scheduling', desc: 'Drag-and-drop calendar with real-time availability and conflict detection' },
    { icon: Users, title: 'Staff Management', desc: 'Manage working hours, services per staff, and permissions' },
    { icon: Clock, title: 'Online Booking', desc: 'Let clients book 24/7 from any device with your branded booking page' },
    { icon: Bot, title: 'AI Receptionist', desc: 'Moltbot answers questions and takes bookings automatically' },
    { icon: BarChart3, title: 'Reports & Analytics', desc: 'Track revenue, appointments, and staff performance' },
    { icon: Palette, title: 'Custom Branding', desc: 'Your logo, colors, and business name on all pages' },
    { icon: FileText, title: 'Client Management', desc: 'VIP status, notes, and full booking history for every client' },
    { icon: Bell, title: 'Waitlist', desc: 'Automatically fill cancellations from your waitlist' },
    { icon: Shield, title: 'Multi-Tenant', desc: 'Perfect for franchises with isolated data per location' },
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
            <a href="mailto:lee.quickwing@gmail.com">
              <Button className="btn-primary text-sm" data-testid="contact-btn">Contact Us</Button>
            </a>
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
            <a href="mailto:lee.quickwing@gmail.com">
              <Button className="btn-primary px-8 py-4 text-base flex items-center gap-2" data-testid="cta-primary">
                <Mail className="w-4 h-4" />
                Get in Touch
              </Button>
            </a>
            <Link to="/pricing">
              <Button variant="outline" className="btn-secondary px-8 py-4 text-base" data-testid="cta-secondary">
                View Pricing
              </Button>
            </Link>
          </div>

          <p className="text-sm text-[#666666] mt-6">
            Contact us at <a href="mailto:lee.quickwing@gmail.com" className="text-[#E34A33] hover:underline">lee.quickwing@gmail.com</a>
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 bg-[#FAFAFA] border-y border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="heading-marketing text-4xl md:text-5xl text-[#0A0A0A] mb-4">
              Everything you need
            </h2>
            <p className="text-lg text-[#666666]">
              Powerful features to run your appointment-based business
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="bg-white p-6 rounded-lg border border-[#E5E5E5] hover:border-[#CCCCCC] transition-colors"
              >
                <div className="w-12 h-12 bg-[#FAFAFA] rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-[#0A0A0A]" />
                </div>
                <h3 className="text-lg font-semibold text-[#0A0A0A] mb-2">{feature.title}</h3>
                <p className="text-sm text-[#666666]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="heading-marketing text-4xl md:text-5xl text-[#0A0A0A] mb-4">
              Built for service businesses
            </h2>
            <p className="text-lg text-[#666666]">
              From salons to clinics, BookSlot adapts to your industry
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {industries.map((industry, index) => (
              <div key={index} className="relative overflow-hidden rounded-lg aspect-square group">
                <img 
                  src={industry.image} 
                  alt={industry.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-4 left-4 text-white font-semibold text-lg">
                  {industry.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Receptionist Feature */}
      <section className="py-24 px-6 bg-[#0A0A0A] text-white">
        <div className="max-w-7xl mx-auto">
          <div className="relative p-8 md:p-12 rounded-2xl overflow-hidden">
            <div className="relative z-10 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full mb-6">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-sm">AI-Powered</span>
              </div>
              <h2 className="heading-marketing text-4xl md:text-5xl mb-6">
                Meet Moltbot, your AI receptionist
              </h2>
              <p className="text-lg text-white/70 mb-8">
                Never miss a booking. Moltbot handles customer inquiries 24/7, 
                understands context, and books appointments automatically.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#4F46E5]" />
                  <span className="text-sm">Answers FAQs instantly</span>
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
            Get in touch to learn how BookSlot can help your business.
          </p>
          <a href="mailto:lee.quickwing@gmail.com">
            <Button className="btn-accent px-10 py-4 text-base flex items-center gap-2 mx-auto" data-testid="final-cta">
              <Mail className="w-5 h-5" />
              Contact Us
            </Button>
          </a>
          <p className="text-sm text-[#666666] mt-6">
            Email: <a href="mailto:lee.quickwing@gmail.com" className="text-[#E34A33] hover:underline">lee.quickwing@gmail.com</a>
          </p>
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
              <Link to="/privacy" className="hover:text-[#0A0A0A] transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-[#0A0A0A] transition-colors">Terms of Service</Link>
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
