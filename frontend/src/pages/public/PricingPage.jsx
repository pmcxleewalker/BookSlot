import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Check, ArrowRight, Mail } from 'lucide-react';

const PricingPage = () => {
  const plans = [
    {
      name: 'Starter',
      price: '99',
      period: '/month',
      description: 'For small businesses just getting started',
      features: [
        '1 location',
        'Up to 2 staff members',
        'Online booking page',
        'Drag-and-drop calendar',
        'Client management',
        'Basic reports'
      ],
      cta: 'Get Started',
      popular: false
    },
    {
      name: 'Growth',
      price: '149',
      period: '/month',
      description: 'For growing businesses with more needs',
      features: [
        '1 location',
        'Up to 8 staff members',
        'Everything in Starter, plus:',
        'AI Receptionist (Moltbot)',
        'No-Show Shield',
        'Waitlist management',
        'Service packages',
        'Growth analytics & reports',
        'Priority support'
      ],
      cta: 'Get Started',
      popular: true
    },
    {
      name: 'Pro',
      price: '219',
      period: '/month',
      description: 'For established businesses scaling up',
      features: [
        'Multi-location support',
        'Unlimited staff',
        'Everything in Growth, plus:',
        'Advanced permissions',
        'Custom intake forms',
        'White-label branding',
        'Pro analytics dashboard',
        'Dedicated account manager'
      ],
      cta: 'Contact Us',
      popular: false
    }
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
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="heading-marketing text-5xl md:text-6xl text-[#0A0A0A] mb-6" data-testid="pricing-title">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-[#666666] max-w-2xl mx-auto">
            No hidden fees. No long-term contracts. Choose the plan that works for your business.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, idx) => (
              <div
                key={idx}
                className={`relative card-flat ${plan.popular ? 'border-[#121212] border-2' : ''}`}
                data-testid={`plan-${plan.name.toLowerCase()}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#121212] text-white text-xs font-medium">
                    MOST POPULAR
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-[#0A0A0A] mb-2">{plan.name}</h3>
                  <p className="text-sm text-[#666666]">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-semibold text-[#0A0A0A]">€{plan.price}</span>
                  <span className="text-[#666666]">{plan.period}</span>
                </div>

                <a href="mailto:lee.quickwing@gmail.com" className="block mb-8">
                  <Button 
                    className={`w-full ${plan.popular ? 'btn-primary' : 'btn-secondary'} flex items-center justify-center gap-2`}
                    data-testid={`plan-${plan.name.toLowerCase()}-cta`}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>

                <ul className="space-y-3">
                  {plan.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-[#0A0A0A] flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-[#666666]">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 bg-[#FAFAFA] border-t border-[#E5E5E5]">
        <div className="max-w-3xl mx-auto">
          <h2 className="heading-marketing text-3xl md:text-4xl text-[#0A0A0A] text-center mb-12">
            Frequently asked questions
          </h2>

          <div className="space-y-6">
            {[
              {
                q: 'Can I switch plans later?',
                a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we\'ll prorate your billing.'
              },
              {
                q: 'How do I get started?',
                a: 'Simply contact us via email and we\'ll set up your account and guide you through the onboarding process.'
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards and bank transfers for annual plans.'
              },
              {
                q: 'What\'s included in the AI Receptionist?',
                a: 'Moltbot can answer FAQs, check availability, book appointments, and send confirmations via chat or messaging platforms.'
              },
              {
                q: 'What is No-Show Shield?',
                a: 'Our AI-powered system predicts which appointments are at risk of no-shows and helps you take proactive action to protect your revenue.'
              },
              {
                q: 'Is my data secure?',
                a: 'Yes. We\'re GDPR compliant and use industry-standard encryption. Your data is backed up daily and never shared.'
              }
            ].map((faq, idx) => (
              <div key={idx} className="card-flat">
                <h3 className="font-semibold text-[#0A0A0A] mb-2">{faq.q}</h3>
                <p className="text-[#666666]">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="heading-marketing text-4xl text-[#0A0A0A] mb-6">
            Ready to get started?
          </h2>
          <p className="text-lg text-[#666666] mb-10">
            Contact us to discuss which plan is right for your business.
          </p>
          <a href="mailto:lee.quickwing@gmail.com">
            <Button className="btn-accent px-10 py-4 text-base flex items-center gap-2 mx-auto">
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
