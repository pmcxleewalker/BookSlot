import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Check, ArrowRight, HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/button';

const plans = [
  {
    name: 'Starter',
    price: 59,
    description: 'For solo operators and very small teams',
    features: [
      '1 location',
      'Up to 2 staff',
      'Online booking page',
      'Email confirmations',
      'Automated reminders',
      'Calendar sync',
      'Basic customer records',
      'Basic availability management',
      'Basic reports',
    ],
    inheritText: null,
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Growth',
    price: 129,
    description: 'For growing teams',
    inheritText: 'Everything in Starter, plus:',
    features: [
      'Up to 8 staff',
      'AI receptionist',
      'Reports & analytics',
      'Deposits & no-show protection',
      'Custom booking forms',
      'Service add-ons',
      'Team performance insights',
      'Branded booking page',
      'Priority email support',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Pro',
    price: 279,
    description: 'For multi-location businesses',
    inheritText: 'Everything in Growth, plus:',
    features: [
      'Up to 5 locations',
      'Up to 50 staff',
      'API access',
      'Webhooks',
      'White-label option',
      'Advanced roles and permissions',
      'Multi-location reporting',
      'Central admin dashboard',
      'Custom onboarding support',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
];

const faqs = [
  {
    question: 'Is there a free trial?',
    answer: 'Yes! All plans come with a 3-day free trial. No credit card required to start.',
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
    question: 'What is the AI receptionist?',
    answer: 'Our AI receptionist can handle bookings, answer FAQs, and communicate with clients 24/7 via chat, WhatsApp, or other messaging platforms.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes. We use industry-standard encryption and are fully GDPR compliant. Your data is stored securely in EU data centers.',
  },
];

export default function PricingPage() {
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
              <Link to="/trial">
                <Button className="bg-[#2E473B] hover:bg-[#243A2F] text-white rounded-full px-6">
                  Start Free Trial
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
            <p className="text-lg text-[#6B6B6B] max-w-2xl mx-auto mb-4">
              Choose the plan that fits your business.
            </p>
            <p className="text-sm text-[#3E6653] font-medium">
              All plans include a 3-day free trial
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`relative rounded-2xl p-6 ${
                  plan.popular 
                    ? 'bg-[#2E473B] text-white ring-2 ring-[#2E473B] ring-offset-2 ring-offset-[#FAF9F6]' 
                    : 'bg-white border border-[#E5E5E0]'
                }`}
                data-testid={`plan-${plan.name.toLowerCase()}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-[#E6B861] text-[#1C1C1C] text-xs font-semibold px-4 py-1 rounded-full whitespace-nowrap">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className={`text-xl font-bold mb-1 ${plan.popular ? 'text-white' : 'text-[#1C1C1C]'}`} style={{ fontFamily: 'Outfit' }}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm ${plan.popular ? 'text-white/70' : 'text-[#6B6B6B]'}`}>{plan.description}</p>
                </div>
                
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-bold ${plan.popular ? 'text-white' : 'text-[#1C1C1C]'}`} style={{ fontFamily: 'Outfit' }}>
                      €{plan.price}
                    </span>
                    <span className={plan.popular ? 'text-white/70' : 'text-[#6B6B6B]'}>/month</span>
                  </div>
                </div>
                
                <Link to="/trial">
                  <Button 
                    className={`w-full rounded-xl h-12 mb-6 font-medium ${
                      plan.popular 
                        ? 'bg-white hover:bg-gray-100 text-[#2E473B]' 
                        : 'bg-[#2E473B] hover:bg-[#243A2F] text-white'
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
                
                <ul className="space-y-3">
                  {plan.inheritText && (
                    <li className={`text-sm font-semibold pb-2 border-b ${
                      plan.popular 
                        ? 'text-white/90 border-white/20' 
                        : 'text-[#1C1C1C] border-[#E5E5E0]'
                    }`}>
                      {plan.inheritText}
                    </li>
                  )}
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        plan.popular ? 'text-[#E6B861]' : 'text-[#3E6653]'
                      }`} />
                      <span className={plan.popular ? 'text-white/90' : 'text-[#1C1C1C]'}>{feature}</span>
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
              3 days free. No credit card required. Cancel anytime.
            </p>
            <Link to="/trial">
              <Button 
                size="lg" 
                className="bg-white text-[#2E473B] hover:bg-white/90 rounded-full px-8"
                data-testid="pricing-cta"
              >
                Start Free Trial
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
