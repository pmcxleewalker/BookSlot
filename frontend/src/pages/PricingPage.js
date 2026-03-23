import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Check, ArrowRight, HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';

const plans = [
  {
    name: 'Starter',
    price: 29,
    description: 'Perfect for solo practitioners and small teams',
    features: [
      '1 location',
      'Up to 2 staff members',
      'Online booking page',
      'Email reminders',
      'Deposit collection',
      'Calendar sync (Google/Outlook)',
      'Basic support',
    ],
    notIncluded: [
      'AI receptionist',
      'SMS automations',
      'Reports & analytics',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Growth',
    price: 79,
    description: 'For growing businesses that need more power',
    features: [
      '1 location',
      'Up to 8 staff members',
      'Everything in Starter, plus:',
      'Waitlist management',
      'Service packages',
      'AI receptionist (Moltbot)',
      'SMS automations',
      'Reports & analytics',
      'Priority support',
    ],
    notIncluded: [
      'Multi-location',
      'API access',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Pro',
    price: 149,
    description: 'For established businesses with advanced needs',
    features: [
      'Unlimited locations',
      'Unlimited staff',
      'Everything in Growth, plus:',
      'Multi-location management',
      'Advanced permissions',
      'Resource booking (rooms, equipment)',
      'Custom intake forms',
      'White-label booking page',
      'API & webhooks',
      'Dedicated support',
    ],
    notIncluded: [],
    cta: 'Start Free Trial',
    popular: false,
  },
];

const faqs = [
  {
    question: 'Is there a free trial?',
    answer: 'Yes! All plans come with a 14-day free trial. No credit card required to start.',
  },
  {
    question: 'Can I change plans later?',
    answer: 'Absolutely. You can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express) and PayPal.',
  },
  {
    question: 'Do you offer discounts for annual billing?',
    answer: 'Yes! Save 20% when you choose annual billing. Thats 2 months free!',
  },
  {
    question: 'What is the AI receptionist?',
    answer: 'Our AI receptionist (powered by Moltbot) can handle bookings, answer FAQs, and communicate with clients 24/7 via chat, WhatsApp, or other messaging platforms.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes. We use industry-standard encryption and are fully GDPR compliant. Your data is stored securely in EU data centers.',
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

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
              <Link to="/features" className="text-[#6B6B6B] hover:text-[#1C1C1C] transition-colors">Features</Link>
              <Link to="/pricing" className="text-[#2E473B] font-medium">Pricing</Link>
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
              Simple, transparent pricing
            </h1>
            <p className="text-lg text-[#6B6B6B] max-w-2xl mx-auto mb-8">
              Choose the plan that fits your business. All plans include a 14-day free trial.
            </p>
            
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <span className={`text-sm ${!annual ? 'text-[#1C1C1C] font-medium' : 'text-[#6B6B6B]'}`}>Monthly</span>
              <Switch 
                checked={annual} 
                onCheckedChange={setAnnual}
                data-testid="billing-toggle"
              />
              <span className={`text-sm ${annual ? 'text-[#1C1C1C] font-medium' : 'text-[#6B6B6B]'}`}>
                Annual <span className="text-[#3E6653] font-medium">(Save 20%)</span>
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`pricing-card ${plan.popular ? 'pricing-card-featured' : ''}`}
                data-testid={`plan-${plan.name.toLowerCase()}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-[#2E473B] text-white text-xs font-medium px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-[#1C1C1C] mb-2" style={{ fontFamily: 'Outfit' }}>
                    {plan.name}
                  </h3>
                  <p className="text-sm text-[#6B6B6B]">{plan.description}</p>
                </div>
                
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
                      €{annual ? Math.round(plan.price * 0.8) : plan.price}
                    </span>
                    <span className="text-[#6B6B6B]">/month</span>
                  </div>
                  {annual && (
                    <p className="text-sm text-[#3E6653] mt-1">
                      Billed €{Math.round(plan.price * 0.8 * 12)} annually
                    </p>
                  )}
                </div>
                
                <Link to="/signup">
                  <Button 
                    className={`w-full rounded-xl h-12 mb-6 ${
                      plan.popular 
                        ? 'bg-[#2E473B] hover:bg-[#243A2F] text-white' 
                        : 'bg-[#2E473B]/10 hover:bg-[#2E473B]/20 text-[#2E473B]'
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
                
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <Check className="w-4 h-4 text-[#3E6653] flex-shrink-0 mt-0.5" />
                      <span className="text-[#1C1C1C]">{feature}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm opacity-50">
                      <Check className="w-4 h-4 text-[#6B6B6B] flex-shrink-0 mt-0.5" />
                      <span className="text-[#6B6B6B] line-through">{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1C1C1C] text-center mb-12" style={{ fontFamily: 'Outfit' }}>
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className="border border-[#E5E5E0] rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-[#FAF9F6] transition-colors"
                  data-testid={`faq-${index}`}
                >
                  <span className="font-medium text-[#1C1C1C]">{faq.question}</span>
                  <HelpCircle className={`w-5 h-5 text-[#6B6B6B] transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === index && (
                  <div className="px-4 pb-4 text-[#6B6B6B]">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="cta-section text-center">
            <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Outfit' }}>
              Start your free trial today
            </h2>
            <p className="text-white/80 text-lg mb-8">
              14 days free. No credit card required. Cancel anytime.
            </p>
            <Link to="/signup">
              <Button 
                size="lg" 
                className="bg-white text-[#2E473B] hover:bg-white/90 rounded-full px-8"
                data-testid="pricing-cta"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
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
