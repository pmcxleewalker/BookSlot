import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Check, ArrowRight, Mail, Sparkles, Calendar, Users, BarChart3, Globe } from 'lucide-react';

const PricingPage = () => {
  const features = [
    { icon: Globe, label: 'Branded online booking page', desc: 'Your colours, your logo, your URL. Clients book in 30 seconds.' },
    { icon: Calendar, label: 'Drag-and-drop calendar', desc: 'Reschedule with a flick. Approve bookings with a tap. Block off your day in seconds.' },
    { icon: Users, label: 'Client management', desc: 'Every visit, every spend, every preference — kept tidy. Auto-tag VIPs at your chosen threshold.' },
    { icon: BarChart3, label: 'Growth analytics & reports', desc: 'See what services pay your bills, who your top clients are, and where the no-shows are hiding.' },
    { icon: Sparkles, label: 'Bella — your AI Receptionist', desc: 'Answers questions, suggests rebooking intervals, drafts last-minute "Fill My Day" blasts. Always on.' },
  ];

  const everythingElse = [
    'Unlimited bookings · Unlimited clients',
    'Up to 8 staff members included',
    'PWA push notifications (free, no SMS bills)',
    'Premium themes (Champagne · Onyx & Gold)',
    'Optional Stripe deposits — flip on/off any time',
    'GDPR-compliant · daily encrypted backups',
    'Cancel any time. No long-term contracts.',
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold text-[#0A0A0A]">BookSlot</Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/features" className="text-sm text-[#666666] hover:text-[#0A0A0A] transition-colors">Features</Link>
            <Link to="/pricing" className="text-sm text-[#0A0A0A] font-medium">Pricing</Link>
          </div>
          <div className="flex items-center gap-4">
            <a href="mailto:lee.quickwing@gmail.com">
              <Button className="btn-primary text-sm">Contact Us</Button>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-12 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[11px] tracking-[0.3em] uppercase font-semibold text-[#B8868B] mb-4">One plan · everything included</p>
          <h1 className="font-['Cormorant_Garamond'] text-5xl md:text-6xl font-light text-[#0A0A0A] mb-5" data-testid="pricing-title">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-[#666666] max-w-xl mx-auto leading-relaxed">
            One price. Every feature. No upsells, no &ldquo;upgrade to unlock&rdquo;, no per-user gotchas.
          </p>
        </div>
      </section>

      {/* The single card */}
      <section className="pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          <div
            className="relative rounded-3xl overflow-hidden"
            style={{ background: 'linear-gradient(180deg, #FAF7F3 0%, #FFFFFF 60%)', border: '1px solid #E8C5C8' }}
            data-testid="pricing-card"
          >
            {/* Top accent stripe */}
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #C4898E 0%, #D4A373 50%, #C4898E 100%)' }} />

            <div className="p-10 md:p-12 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8C5C8]/40 mb-6">
                <Sparkles className="w-3 h-3" style={{ color: '#B8868B' }} strokeWidth={2} />
                <span className="text-[10px] tracking-[0.2em] uppercase font-semibold" style={{ color: '#B8868B' }}>BookSlot Premium</span>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-2xl font-light text-[#9E948F]">€</span>
                  <span className="font-['Cormorant_Garamond'] text-7xl font-light text-[#0A0A0A] leading-none" data-testid="price">99</span>
                  <span className="text-base text-[#9E948F] ml-1">/ month</span>
                </div>
                <p className="text-sm text-[#9E948F] mt-2">Billed monthly · cancel any time</p>
              </div>

              <a href="mailto:lee.quickwing@gmail.com" className="block mb-3">
                <Button
                  className="w-full h-12 rounded-full text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                  style={{ background: '#0A0A0A' }}
                  data-testid="get-started-cta"
                >
                  Start a 14-day free trial
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
              <p className="text-xs text-[#9E948F]">No credit card required to start</p>
            </div>

            {/* Headline features */}
            <div className="border-t border-[#F0EBE6] bg-white/40 p-8 md:p-10">
              <p className="text-[11px] tracking-[0.25em] uppercase font-semibold text-[#9E948F] text-center mb-6">What you get</p>
              <ul className="space-y-5">
                {features.map((f, idx) => {
                  const Icon = f.icon;
                  return (
                    <li key={idx} className="flex items-start gap-4" data-testid={`feature-${idx}`}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: '#E8C5C8' + '40' }}>
                        <Icon className="w-4 h-4" style={{ color: '#B8868B' }} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#2C2A29]">{f.label}</p>
                        <p className="text-xs text-[#706B68] mt-0.5 leading-relaxed">{f.desc}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Plus everything else */}
            <div className="border-t border-[#F0EBE6] p-8 md:p-10 bg-[#FAF8F6]">
              <p className="text-[11px] tracking-[0.25em] uppercase font-semibold text-[#9E948F] text-center mb-5">Plus everything else</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {everythingElse.map((line, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-[#706B68]" data-testid={`extra-${idx}`}>
                    <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#D4A373' }} strokeWidth={2} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Reassurance */}
          <p className="text-center text-xs text-[#9E948F] mt-6 max-w-md mx-auto leading-relaxed">
            Need multi-location, white-label, or franchise tooling?{' '}
            <a href="mailto:lee.quickwing@gmail.com" className="text-[#B8868B] hover:underline font-medium whitespace-nowrap">Talk to us</a>{' '}
            — we&apos;ll quote you something tailored.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 bg-[#FAFAFA] border-t border-[#E5E5E5]">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-['Cormorant_Garamond'] text-3xl md:text-4xl font-light text-[#0A0A0A] text-center mb-12">
            Questions, before you sign up
          </h2>

          <div className="space-y-4">
            {[
              {
                q: 'Why one price instead of tiers?',
                a: 'Tiered pricing punishes growing salons. We&rsquo;d rather you focus on your clients than on which feature you can&rsquo;t use yet. Everyone gets everything.'
              },
              {
                q: 'Is there really no card needed for the trial?',
                a: 'Correct. Email us, we&rsquo;ll set you up. After 14 days you decide whether BookSlot pays for itself — most salons see €99 saved in their first week of automated reminders alone.'
              },
              {
                q: 'What happens if I want to cancel?',
                a: 'You email us and we cancel. No phone trees, no retention scripts. Your data exports to CSV before we close the account.'
              },
              {
                q: 'Do you charge per booking?',
                a: 'No — bookings are unlimited. The only optional cost is Stripe&rsquo;s standard processing fee (~1.5% + €0.25) IF you choose to take card deposits, and even that you can switch off any time.'
              },
              {
                q: 'What does Bella, the AI Receptionist, actually do?',
                a: 'Answers FAQs, suggests when each client should rebook, drafts your &ldquo;Fill My Day&rdquo; messages when there&rsquo;s a cancellation, and quietly tags your VIPs. She works 24/7, doesn&rsquo;t need lunch.'
              },
              {
                q: 'Is my data safe?',
                a: 'GDPR-compliant. Encrypted at rest. Daily backups. Never sold, never shared, never used to train external AI models.'
              }
            ].map((faq, idx) => (
              <div key={idx} className="card-flat" data-testid={`faq-${idx}`}>
                <h3 className="font-semibold text-[#0A0A0A] mb-2" dangerouslySetInnerHTML={{ __html: faq.q }} />
                <p className="text-[#666666]" dangerouslySetInnerHTML={{ __html: faq.a }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-light text-[#0A0A0A] mb-5">
            Ready when you are
          </h2>
          <p className="text-lg text-[#666666] mb-10 max-w-xl mx-auto">
            Email us and we&apos;ll have your salon live on BookSlot inside 24 hours — branded, themed, and taking bookings.
          </p>
          <a href="mailto:lee.quickwing@gmail.com">
            <Button className="btn-accent px-10 py-4 text-base flex items-center gap-2 mx-auto">
              <Mail className="w-5 h-5" />
              Start your 14-day trial
            </Button>
          </a>
          <p className="text-sm text-[#666666] mt-6">
            Email: <a href="mailto:lee.quickwing@gmail.com" className="text-[#E34A33] hover:underline">lee.quickwing@gmail.com</a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-xl font-semibold text-[#0A0A0A]">BookSlot</div>
          <div className="flex items-center gap-6 text-sm text-[#666666]">
            <Link to="/privacy" className="hover:text-[#0A0A0A] transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-[#0A0A0A] transition-colors">Terms of Service</Link>
          </div>
          <p className="text-sm text-[#666666]">© 2026 BookSlot. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default PricingPage;
