import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Calendar, Clock, Users, Star, ArrowRight, Check, 
  Menu, X, Play, ChevronRight, Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/button';

// Business showcase images
const businessImages = [
  {
    url: "https://images.pexels.com/photos/3993308/pexels-photo-3993308.jpeg?auto=compress&cs=tinysrgb&w=800",
    title: "Hair Salons",
    description: "Modern styling stations"
  },
  {
    url: "https://images.pexels.com/photos/4269276/pexels-photo-4269276.jpeg?auto=compress&cs=tinysrgb&w=800",
    title: "Dental Clinics",
    description: "State-of-the-art equipment"
  },
  {
    url: "https://images.unsplash.com/photo-1759134198561-e2041049419c?w=800",
    title: "Barber Shops",
    description: "Classic & contemporary"
  },
  {
    url: "https://images.pexels.com/photos/7195799/pexels-photo-7195799.jpeg?auto=compress&cs=tinysrgb&w=800",
    title: "Beauty Studios",
    description: "Luxurious experiences"
  },
];

const features = [
  {
    title: "Online Booking 24/7",
    description: "Let clients book appointments anytime, from any device. No phone tag required.",
    icon: Calendar
  },
  {
    title: "Automated Reminders",
    description: "Reduce no-shows with email reminders sent automatically before appointments.",
    icon: Clock
  },
  {
    title: "Staff Management",
    description: "Manage schedules, assign services, and track performance across your team.",
    icon: Users
  },
  {
    title: "AI Receptionist",
    description: "Let AI handle booking inquiries while you focus on your clients.",
    icon: Sparkles
  },
];

const testimonials = [
  {
    quote: "TimeSlot Pro transformed how we manage appointments. The online booking has been a game changer for our clinic.",
    author: "Verified Business Owner",
    role: "Dental Clinic",
    avatar: "DC",
    rating: 5
  },
  {
    quote: "The easiest booking system I've ever used. My clients love being able to book online anytime!",
    author: "Verified Business Owner",
    role: "Barber Shop",
    avatar: "BS",
    rating: 5
  },
  {
    quote: "We tried several systems before TimeSlot Pro. Nothing else comes close for the price and features.",
    author: "Verified Business Owner",
    role: "Spa & Wellness",
    avatar: "SW",
    rating: 5
  },
  {
    quote: "Setup was incredibly fast. Now we save hours every week on scheduling and admin work.",
    author: "Verified Business Owner",
    role: "Hair Salon",
    avatar: "HS",
    rating: 5
  },
];

const plans = [
  {
    name: 'Starter',
    price: 90,
    description: 'For solo practitioners',
    features: [
      '1 location',
      'Up to 2 staff',
      'Online booking page',
      'Email confirmations',
      'Calendar sync',
    ],
    cta: 'Start Free Trial',
  },
  {
    name: 'Growth',
    price: 145,
    description: 'For growing businesses',
    popular: true,
    features: [
      '1 location',
      'Up to 8 staff',
      'Everything in Starter',
      'SMS notifications',
      'AI receptionist',
      'Waitlist & packages',
      'Reports & analytics',
    ],
    cta: 'Start Free Trial',
  },
  {
    name: 'Pro',
    price: 299,
    description: 'For established businesses',
    features: [
      'Up to 10 locations',
      'Up to 50 staff',
      'Everything in Growth',
      'Multi-location',
      'API & webhooks',
      'White-label branding',
      'Dedicated support',
    ],
    cta: 'Start Free Trial',
  },
];

const stats = [
  { value: '99%', label: 'Uptime' },
  { value: '4.9', label: 'Star Rating' },
];

export default function FranchiseLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-black tracking-tight" style={{ fontFamily: 'Outfit' }}>
                TimeSlot Pro
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#pricing" className="text-gray-600 hover:text-black transition-colors font-medium" data-testid="nav-pricing">
                Pricing
              </a>
              <Link to="/book/demo-business">
                <Button className="bg-black hover:bg-gray-800 text-white rounded-full px-6 h-10" data-testid="nav-try-demo">
                  Try 3-Day Demo
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-btn"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 py-4 px-4">
            <div className="flex flex-col gap-4">
              <a href="#pricing" className="py-2 text-black font-medium">Pricing</a>
              <Link to="/book/demo-business">
                <Button className="w-full bg-black hover:bg-gray-800 text-white rounded-full">
                  Try 3-Day Demo
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-28 pb-16 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-700 text-sm font-medium mb-6">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                4.9 Star Rating
              </span>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black leading-tight mb-6" style={{ fontFamily: 'Outfit' }}>
                The booking system your
                <br />
                <span className="text-gray-400">clients will love</span>
              </h1>
              
              <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                Powerful, beautiful scheduling software for salons, clinics, barbers, and any appointment-based business. 
                Set up in minutes, not days.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/book/demo-business">
                  <Button 
                    size="lg" 
                    className="bg-black hover:bg-gray-800 text-white rounded-full px-8 h-14 text-lg"
                    data-testid="hero-demo"
                  >
                    Try 3-Day Free Demo
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="rounded-full px-8 h-14 text-lg border-gray-300 text-black hover:bg-gray-50"
                  data-testid="hero-watch"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Watch Demo
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Business Images Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-16"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {businessImages.map((img, index) => (
                <div key={index} className="relative group overflow-hidden rounded-2xl aspect-[4/3]">
                  <img 
                    src={img.url} 
                    alt={img.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent" />
                  <div className="absolute bottom-4 left-4 text-white">
                    <p className="font-semibold">{img.title}</p>
                    <p className="text-sm text-white/80">{img.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-12 px-4 border-y border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-black mb-1" style={{ fontFamily: 'Outfit' }}>
                  {stat.value}
                </div>
                <div className="text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4" id="features">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Why TimeSlot Pro</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-black mt-3 mb-4" style={{ fontFamily: 'Outfit' }}>
              Everything you need to grow
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              From online booking to AI automation, we've built every feature your business needs.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center p-6"
              >
                <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center mx-auto mb-5">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-black mb-3" style={{ fontFamily: 'Outfit' }}>
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Testimonials</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-black mt-3" style={{ fontFamily: 'Outfit' }}>
              Loved by businesses across Ireland
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 text-sm leading-relaxed">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white text-sm font-semibold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-medium text-black text-sm">{testimonial.author}</p>
                    <p className="text-gray-500 text-xs">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4" id="pricing">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Pricing</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-black mt-3 mb-4" style={{ fontFamily: 'Outfit' }}>
              Simple, transparent pricing
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Choose the plan that fits your business. All plans include a 3-day free trial.
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
                className={`rounded-2xl p-8 ${
                  plan.popular 
                    ? 'bg-black text-white ring-4 ring-black/5' 
                    : 'bg-white border border-gray-200'
                }`}
                data-testid={`plan-${plan.name.toLowerCase()}`}
              >
                {plan.popular && (
                  <span className="inline-block text-xs font-medium text-white/80 uppercase tracking-wider mb-2">
                    Most Popular
                  </span>
                )}
                <h3 className={`text-2xl font-bold mb-1 ${plan.popular ? 'text-white' : 'text-black'}`} style={{ fontFamily: 'Outfit' }}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-4 ${plan.popular ? 'text-white/70' : 'text-gray-500'}`}>
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className={`text-4xl font-bold ${plan.popular ? 'text-white' : 'text-black'}`} style={{ fontFamily: 'Outfit' }}>
                    €{plan.price}
                  </span>
                  <span className={plan.popular ? 'text-white/70' : 'text-gray-500'}>/month</span>
                </div>
                
                <Link to="/book/demo-business">
                  <Button 
                    className={`w-full rounded-full h-12 mb-6 ${
                      plan.popular 
                        ? 'bg-white text-black hover:bg-gray-100' 
                        : 'bg-black text-white hover:bg-gray-800'
                    }`}
                  >
                    {plan.cta}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
                
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <Check className={`w-4 h-4 flex-shrink-0 ${plan.popular ? 'text-white/80' : 'text-black'}`} />
                      <span className={plan.popular ? 'text-white/90' : 'text-gray-700'}>{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-black">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4" style={{ fontFamily: 'Outfit' }}>
            Ready to simplify your scheduling?
          </h2>
          <p className="text-white/70 text-lg mb-8 max-w-xl mx-auto">
            Join businesses that trust TimeSlot Pro for their booking needs. 
            Start your free 3-day trial today.
          </p>
          <Link to="/book/demo-business">
            <Button 
              size="lg" 
              className="bg-white text-black hover:bg-gray-100 rounded-full px-8 h-14 text-lg"
              data-testid="cta-demo"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <p className="text-white/50 text-sm mt-4">No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-black" style={{ fontFamily: 'Outfit' }}>TimeSlot Pro</span>
              </div>
              <p className="text-gray-500 text-sm">
                Powerful booking software for appointment-based businesses.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-black mb-4">Product</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li><a href="#features" className="hover:text-black transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-black transition-colors">Pricing</a></li>
                <li><Link to="/book/demo-business" className="hover:text-black transition-colors">Demo</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-black mb-4">Industries</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li><a href="#" className="hover:text-black transition-colors">Salons</a></li>
                <li><a href="#" className="hover:text-black transition-colors">Clinics</a></li>
                <li><a href="#" className="hover:text-black transition-colors">Barbers</a></li>
                <li><a href="#" className="hover:text-black transition-colors">Spas</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-black mb-4">Support</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li><a href="#" className="hover:text-black transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-black transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-black transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-black transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} TimeSlot Pro. All rights reserved.
            </p>
            <Link 
              to="/admin/login" 
              className="text-gray-400 text-sm hover:text-black transition-colors"
              data-testid="footer-director-login"
            >
              Director Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
