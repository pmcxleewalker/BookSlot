import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Calendar, Users, Globe, Sparkles, BarChart3, Palette,
  Mail, Check
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import SavingsCalculator from '../../components/SavingsCalculator';

const LandingPage = () => {
  const features = [
    { icon: Calendar, title: 'Smart Scheduling', desc: 'Drag-and-drop calendar with real-time availability and conflict detection' },
    { icon: Users, title: 'Staff Management', desc: 'Manage working hours, services per staff, and permissions' },
    { icon: Globe, title: 'Online Booking', desc: 'Let clients book 24/7 from any device with your branded booking page' },
    { icon: Sparkles, title: 'Custom AI Receptionist', desc: 'Bella answers questions, suggests rebooks, drafts last-minute blasts' },
    { icon: BarChart3, title: 'Reports & Analytics', desc: 'Track revenue, appointments, and staff performance' },
    { icon: Palette, title: 'Custom Branding', desc: 'Your logo, colors, and business name on all pages' },
  ];

  const everythingElse = [
    'Unlimited bookings · Unlimited clients',
    'Up to 8 staff members included',
    'PWA push notifications (free, no SMS bills)',
    'Premium themes (Champagne · Onyx & Gold)',
    'Optional Stripe deposits — flip on/off any time',
    'Cancel any time. No long-term contracts.',
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
            <a href="#pricing">
              <Button variant="outline" className="btn-secondary px-8 py-4 text-base" data-testid="cta-secondary">
                View Pricing
              </Button>
            </a>
          </div>

          <p className="text-sm text-[#666666] mt-6">
            Contact us at <a href="mailto:lee.quickwing@gmail.com" className="text-[#E34A33] hover:underline">lee.quickwing@gmail.com</a>
          </p>
        </div>
      </section>

      {/* Features Grid — 6 tiles */}
      <section className="py-24 px-6 bg-[#FAFAFA] border-y border-[#E5E5E5]">
        <div className="max-w-6xl mx-auto">
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
                className="bg-white p-6 rounded-2xl border border-[#E5E5E5] hover:border-[#CCCCCC] transition-colors"
                data-testid={`feature-${index}`}
              >
                <div className="w-12 h-12 bg-[#FAFAFA] rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-[#0A0A0A]" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold text-[#0A0A0A] mb-2">{feature.title}</h3>
                <p className="text-sm text-[#666666] leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Calculator — reused from pricing page */}
      <SavingsCalculator />

      {/* Inline pricing card */}
      <section id="pricing" className="py-24 px-6 bg-[#FAFAFA] border-t border-[#E5E5E5]">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[11px] tracking-[0.3em] uppercase font-semibold text-[#B8868B] mb-4">One plan · everything included</p>
            <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-light text-[#0A0A0A] mb-3">
              Simple, transparent pricing
            </h2>
            <p className="text-base text-[#666666] max-w-xl mx-auto">
              One price. Every feature. No upsells, no &ldquo;upgrade to unlock&rdquo;.
            </p>
          </div>

          <div
            className="relative rounded-3xl overflow-hidden"
            style={{ background: 'linear-gradient(180deg, #FAF7F3 0%, #FFFFFF 60%)', border: '1px solid #E8C5C8' }}
            data-testid="landing-pricing-card"
          >
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #C4898E 0%, #D4A373 50%, #C4898E 100%)' }} />

            <div className="p-10 md:p-12 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8C5C8]/40 mb-6">
                <Sparkles className="w-3 h-3" style={{ color: '#B8868B' }} strokeWidth={2} />
                <span className="text-[10px] tracking-[0.2em] uppercase font-semibold" style={{ color: '#B8868B' }}>BookSlot Premium</span>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-2xl font-light text-[#9E948F]">€</span>
                  <span className="font-['Cormorant_Garamond'] text-7xl font-light text-[#0A0A0A] leading-none" data-testid="landing-price">99</span>
                  <span className="text-base text-[#9E948F] ml-1">/ month</span>
                </div>
                <p className="text-sm text-[#9E948F] mt-2">Billed monthly · cancel any time</p>
              </div>

              <a href="mailto:lee.quickwing@gmail.com" className="block mb-3">
                <Button
                  className="w-full h-12 rounded-full text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                  style={{ background: '#0A0A0A' }}
                  data-testid="landing-get-started"
                >
                  Get started
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
              <p className="text-xs text-[#9E948F]">Cancel any time. No long-term contracts.</p>
            </div>

            <div className="border-t border-[#F0EBE6] p-8 md:p-10 bg-[#FAF8F6]">
              <p className="text-[11px] tracking-[0.25em] uppercase font-semibold text-[#9E948F] text-center mb-5">What&apos;s included</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {everythingElse.map((line, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-[#706B68]">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#D4A373' }} strokeWidth={2} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <div className="text-center mt-6">
                <Link to="/pricing" className="text-sm font-medium text-[#B8868B] hover:underline">
                  See full pricing details & FAQ →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-xl font-semibold text-[#0A0A0A]">BookSlot</div>
            <div className="flex items-center gap-8 text-sm text-[#666666]">
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
