import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Calendar, Clock, Users, Star, ArrowRight, Check, 
  Menu, X, ChevronRight, Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/button';

// Business showcase images
const businessImages = [
  {
    url: "https://images.pexels.com/photos/3993308/pexels-photo-3993308.jpeg?auto=compress&cs=tinysrgb&w=800",
    title: "Salons"
  },
  {
    url: "https://images.pexels.com/photos/4269276/pexels-photo-4269276.jpeg?auto=compress&cs=tinysrgb&w=800",
    title: "Clinics"
  },
  {
    url: "https://images.unsplash.com/photo-1759134198561-e2041049419c?w=800",
    title: "Barbers"
  },
  {
    url: "https://images.pexels.com/photos/7195799/pexels-photo-7195799.jpeg?auto=compress&cs=tinysrgb&w=800",
    title: "Spas"
  },
];

const features = [
  { title: "Online Booking 24/7", icon: Calendar },
  { title: "Automated Reminders", icon: Clock },
  { title: "Staff Management", icon: Users },
  { title: "AI Receptionist", icon: Sparkles },
];

const testimonials = [
  {
    quote: "The online booking has been a game changer for our clinic.",
    author: "Verified Business Owner",
    role: "Dental Clinic",
    rating: 5
  },
  {
    quote: "My clients love being able to book online anytime!",
    author: "Verified Business Owner",
    role: "Barber Shop",
    rating: 5
  },
  {
    quote: "Nothing else comes close for the price and features.",
    author: "Verified Business Owner",
    role: "Spa & Wellness",
    rating: 5
  },
];

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
  },
  {
    name: 'Growth',
    price: 129,
    popular: true,
    description: 'For growing teams',
    inheritText: 'Everything in Starter, plus:',
    features: [
      'Up to 8 staff',
      'AI receptionist',
      'Reports & analytics',
      'Deposits and no-show protection',
      'Custom booking forms',
      'Service add-ons / extras',
      'Team performance insights',
      'Branded booking page',
      'Priority email support',
    ],
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
      'Centralised admin dashboard',
      'Custom onboarding support',
      'Priority support',
    ],
  },
];

export default function FranchiseLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-gray-900">TimeSlot Pro</span>
            </Link>

            <div className="hidden md:flex items-center gap-6">
              <a href="#pricing" className="text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium">
                Pricing
              </a>
              <Link to="/trial">
                <Button className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-5 h-9 text-sm">
                  Try Free Demo
                </Button>
              </Link>
            </div>

            <button 
              className="md:hidden p-2 text-gray-500"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 py-3 px-4">
            <a href="#pricing" className="block py-2 text-gray-900">Pricing</a>
            <Link to="/trial">
              <Button className="w-full mt-2 bg-gray-900 text-white rounded-full">Try Free Demo</Button>
            </Link>
          </div>
        )}
      </nav>

      {/* Hero - Clear value prop + pricing in 6 seconds */}
      <section className="pt-24 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-gray-900 leading-tight mb-4">
              Booking software for salons,
              <br />clinics & service businesses
            </h1>
            
            <p className="text-gray-500 text-lg mb-6">
              Online scheduling your clients will love. From €59/month.
            </p>

            <Link to="/trial">
              <Button 
                size="lg" 
                className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-8 h-12 text-base"
              >
                Start 3-Day Free Trial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            
            <p className="text-gray-400 text-sm mt-3">No credit card required</p>
          </motion.div>

          {/* Quick pricing preview */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-10 flex justify-center gap-3 flex-wrap"
          >
            {plans.map((plan) => (
              <div 
                key={plan.name}
                className={`px-5 py-3 rounded-xl text-center min-w-[140px] ${
                  plan.popular 
                    ? 'bg-gray-900 text-white' 
                    : 'bg-gray-50 text-gray-900 border border-gray-100'
                }`}
              >
                <div className="text-xs text-gray-400 mb-0.5">{plan.name}</div>
                <div className="text-xl font-semibold">€{plan.price}</div>
                <div className={`text-xs ${plan.popular ? 'text-gray-400' : 'text-gray-500'}`}>/month</div>
              </div>
            ))}
          </motion.div>

          {/* Business images */}
          <motion.div 
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-12 grid grid-cols-4 gap-3"
          >
            {businessImages.map((img, index) => (
              <div key={index} className="relative overflow-hidden rounded-xl aspect-[4/3]">
                <img 
                  src={img.url} 
                  alt={img.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute bottom-3 left-3 text-white text-sm font-medium">{img.title}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features - minimal */}
      <section className="py-12 px-4 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-gray-700" />
                </div>
                <span className="text-gray-700 font-medium text-sm">{feature.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-10">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-gray-600 text-sm ml-1">4.9 rating from verified businesses</span>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, index) => (
              <div key={index} className="bg-gray-50 rounded-2xl p-6">
                <p className="text-gray-700 mb-4">"{t.quote}"</p>
                <div className="text-sm">
                  <span className="text-gray-900 font-medium">{t.author}</span>
                  <span className="text-gray-400 ml-1">· {t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Full Pricing */}
      <section className="py-16 px-4 bg-gray-50" id="pricing">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
              Simple pricing
            </h2>
            <p className="text-gray-500">All plans include a 3-day free trial</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-5">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 relative ${
                  plan.popular 
                    ? 'bg-gray-900 text-white ring-2 ring-gray-900 ring-offset-2' 
                    : 'bg-white border border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-amber-400 text-gray-900 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                      Most Popular
                    </span>
                  </div>
                )}
                <h3 className={`text-xl font-semibold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-4 ${plan.popular ? 'text-gray-400' : 'text-gray-500'}`}>
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className={`text-3xl font-semibold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                    €{plan.price}
                  </span>
                  <span className={plan.popular ? 'text-gray-400' : 'text-gray-500'}>/month</span>
                </div>
                
                <Link to="/trial">
                  <Button 
                    className={`w-full rounded-full h-10 mb-5 ${
                      plan.popular 
                        ? 'bg-white text-gray-900 hover:bg-gray-100' 
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    Start Free Trial
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
                
                <ul className="space-y-2.5">
                  {plan.inheritText && (
                    <li className={`text-sm font-medium mb-3 ${plan.popular ? 'text-gray-300' : 'text-gray-700'}`}>
                      {plan.inheritText}
                    </li>
                  )}
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.popular ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      <span className={plan.popular ? 'text-gray-300' : 'text-gray-600'}>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-3">
            Ready to get started?
          </h2>
          <p className="text-gray-500 mb-6">
            Try TimeSlot Pro free for 3 days. No credit card needed.
          </p>
          <Link to="/trial">
            <Button 
              size="lg" 
              className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-8 h-12"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-900">TimeSlot Pro</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="#pricing" className="hover:text-gray-900">Pricing</a>
            <a href="#" className="hover:text-gray-900">Privacy</a>
            <a href="#" className="hover:text-gray-900">Terms</a>
            <Link to="/admin/login" className="hover:text-gray-900">Director Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
