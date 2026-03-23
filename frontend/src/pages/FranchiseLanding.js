import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Calendar, Building2, Users, BarChart3, Shield, Globe,
  ArrowRight, Check, Menu, X, Zap, TrendingUp, Settings
} from 'lucide-react';
import { Button } from '../components/ui/button';

const stats = [
  { value: '500+', label: 'Businesses Managed' },
  { value: '€2.4M', label: 'Revenue Processed' },
  { value: '99.9%', label: 'Uptime Guarantee' },
  { value: '24/7', label: 'Support Available' },
];

const features = [
  { 
    icon: Building2, 
    title: 'Multi-Tenant Architecture', 
    description: 'Manage unlimited businesses from a single command center. Each tenant operates independently with their own branding.' 
  },
  { 
    icon: Users, 
    title: 'Automated Onboarding', 
    description: 'Create new business accounts in seconds. Auto-configure plans, features, and billing from your dashboard.' 
  },
  { 
    icon: BarChart3, 
    title: 'Revenue Analytics', 
    description: 'Track MRR, churn, and growth across your entire portfolio. Export reports for stakeholders.' 
  },
  { 
    icon: Shield, 
    title: 'Enterprise Security', 
    description: 'Role-based access control, audit logs, and GDPR compliance built-in. Your data stays in EU data centers.' 
  },
  { 
    icon: Zap, 
    title: 'Instant Provisioning', 
    description: 'New tenants get their booking page live within minutes. Zero manual setup required.' 
  },
  { 
    icon: Globe, 
    title: 'White-Label Ready', 
    description: 'Full branding control per tenant. Custom domains, colors, logos—make it their own.' 
  },
];

const plans = [
  {
    name: 'Starter',
    price: 90,
    features: ['2 staff', '1 location', '10 services', 'Email confirmations', 'Calendar sync'],
  },
  {
    name: 'Growth',
    price: 145,
    popular: true,
    features: ['8 staff', '1 location', '50 services', 'SMS & AI receptionist', 'Reports'],
  },
  {
    name: 'Pro',
    price: 299,
    features: ['50 staff', '10 locations', 'Unlimited services', 'API & webhooks', 'White-label'],
  },
];

export default function FranchiseLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit' }}>
                TimeSlot Pro
              </span>
              <span className="text-xs text-emerald-400 font-medium ml-2 px-2 py-0.5 bg-emerald-500/10 rounded">
                FRANCHISE
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <Link to="/pricing" className="text-slate-400 hover:text-white transition-colors" data-testid="nav-pricing">
                Pricing
              </Link>
              <Link to="/features" className="text-slate-400 hover:text-white transition-colors" data-testid="nav-features">
                Features
              </Link>
              <Link to="/admin/login" className="text-slate-400 hover:text-white transition-colors" data-testid="nav-director-login">
                Director Login
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2 text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-btn"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-800 border-t border-slate-700 py-4 px-4">
            <div className="flex flex-col gap-4">
              <Link to="/pricing" className="py-2 text-white">Pricing</Link>
              <Link to="/features" className="py-2 text-white">Features</Link>
              <Link to="/admin/login">
                <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg">
                  Director Login
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium mb-6">
                <Building2 className="w-4 h-4" />
                Franchise Control Center
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6" style={{ fontFamily: 'Outfit' }}>
                Manage your
                <span className="text-emerald-400"> booking empire</span>
              </h1>
              <p className="text-lg text-slate-400 mb-8 max-w-lg">
                The command center for multi-location booking businesses. 
                Create tenants, manage subscriptions, and track revenue—all from one dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/admin/login">
                  <Button 
                    size="lg" 
                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-8 h-14 text-lg"
                    data-testid="hero-director-login"
                  >
                    Director Login
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link to="/admin/setup">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="rounded-lg px-8 h-14 text-lg border-slate-700 text-white hover:bg-slate-800"
                    data-testid="hero-register"
                  >
                    <Settings className="w-5 h-5 mr-2" />
                    Register as Director
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              {/* Dashboard Preview */}
              <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                <div className="bg-slate-900 px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-slate-500 text-sm ml-2">Franchise Command Center</span>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {stats.map((stat, i) => (
                      <div key={i} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                        <div className="text-2xl font-bold text-emerald-400">{stat.value}</div>
                        <div className="text-sm text-slate-500">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-medium">Recent Tenants</span>
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="space-y-2">
                      {['Elite Dental Care', 'Glow Beauty Salon', 'City Physio Clinic'].map((name, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                          <span className="text-slate-400 text-sm">{name}</span>
                          <span className="text-emerald-400 text-xs">Active</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-8 px-4 border-y border-slate-800 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-emerald-400 mb-1">{stat.value}</div>
                <div className="text-slate-500 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-medium text-emerald-400 uppercase tracking-wider">Platform Features</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4" style={{ fontFamily: 'Outfit' }}>
              Built for franchise operators
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Everything you need to manage a portfolio of appointment-based businesses.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-800/50 rounded-xl border border-slate-700 p-8 hover:border-emerald-500/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3" style={{ fontFamily: 'Outfit' }}>
                  {feature.title}
                </h3>
                <p className="text-slate-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-medium text-emerald-400 uppercase tracking-wider">Tenant Plans</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-3 mb-4" style={{ fontFamily: 'Outfit' }}>
              Flexible pricing for every tenant
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Assign plans when creating new tenants. Upgrade or downgrade anytime.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`rounded-xl border p-6 ${
                  plan.popular 
                    ? 'bg-emerald-500/10 border-emerald-500' 
                    : 'bg-slate-800/50 border-slate-700'
                }`}
              >
                {plan.popular && (
                  <span className="text-emerald-400 text-xs font-medium uppercase tracking-wider">Most Popular</span>
                )}
                <h3 className="text-xl font-bold text-white mt-2" style={{ fontFamily: 'Outfit' }}>
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 my-4">
                  <span className="text-3xl font-bold text-white">€{plan.price}</span>
                  <span className="text-slate-500">/month</span>
                </div>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4" style={{ fontFamily: 'Outfit' }}>
            Ready to scale your booking business?
          </h2>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            Access the Franchise Command Center and start managing your multi-tenant booking empire today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/admin/login">
              <Button 
                size="lg" 
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-8 h-14 text-lg"
                data-testid="cta-director-login"
              >
                Director Login
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/admin/setup">
              <Button 
                variant="outline" 
                size="lg" 
                className="rounded-lg px-8 h-14 text-lg border-slate-700 text-white hover:bg-slate-800"
              >
                Register New Account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit' }}>TimeSlot Pro</span>
              <span className="text-xs text-emerald-400 font-medium ml-2">FRANCHISE</span>
            </div>
            <div className="flex items-center gap-6 text-slate-500 text-sm">
              <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
              <Link to="/features" className="hover:text-white transition-colors">Features</Link>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
            © {new Date().getFullYear()} TimeSlot Pro. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
