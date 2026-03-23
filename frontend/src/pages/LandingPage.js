import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Calendar, Clock, Users, Sparkles, Shield, Globe,
  ArrowRight, Check, Star, Menu, X, Play
} from 'lucide-react';
import { Button } from '../components/ui/button';

const industries = [
  { name: 'Salons', icon: '✂️', description: 'Hair, beauty & spa businesses' },
  { name: 'Clinics', icon: '🏥', description: 'Medical & health clinics' },
  { name: 'Dentists', icon: '🦷', description: 'Dental practices' },
  { name: 'Doctors', icon: '👨‍⚕️', description: 'Private medical practices' },
  { name: 'Vets', icon: '🐾', description: 'Veterinary clinics' },
  { name: 'Consultants', icon: '💼', description: 'Professional services' },
];

const features = [
  { icon: Calendar, title: 'Smart Scheduling', description: 'Drag-and-drop calendar with conflict detection' },
  { icon: Clock, title: '24/7 Online Booking', description: 'Let clients book anytime, anywhere' },
  { icon: Users, title: 'Staff Management', description: 'Manage schedules, services & permissions' },
  { icon: Sparkles, title: 'AI Receptionist', description: 'Automate bookings with Moltbot integration' },
  { icon: Shield, title: 'No-Show Protection', description: 'Deposits and automated reminders' },
  { icon: Globe, title: 'Multi-Location', description: 'Manage all your locations in one place' },
];

const testimonials = [
  {
    quote: "TimeSlot Pro transformed how we manage appointments. Our no-shows dropped by 60%!",
    author: "Sarah M.",
    role: "Salon Owner",
    avatar: "S"
  },
  {
    quote: "The AI receptionist handles bookings while I focus on patients. Game changer.",
    author: "Dr. James L.",
    role: "Dentist",
    avatar: "J"
  },
  {
    quote: "Setup took 10 minutes. Now we save 15+ hours per week on scheduling.",
    author: "Maria C.",
    role: "Clinic Manager",
    avatar: "M"
  }
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <Link to="/features" className="text-[#6B6B6B] hover:text-[#1C1C1C] transition-colors" data-testid="nav-features">
                Features
              </Link>
              <Link to="/pricing" className="text-[#6B6B6B] hover:text-[#1C1C1C] transition-colors" data-testid="nav-pricing">
                Pricing
              </Link>
              <Link to="/login" className="text-[#6B6B6B] hover:text-[#1C1C1C] transition-colors" data-testid="nav-login">
                Login
              </Link>
              <Link to="/signup">
                <Button className="bg-[#2E473B] hover:bg-[#243A2F] text-white rounded-full px-6" data-testid="nav-get-started">
                  Get Started Free
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
          <div className="md:hidden bg-white border-t border-[#E5E5E0] py-4 px-4">
            <div className="flex flex-col gap-4">
              <Link to="/features" className="py-2 text-[#1C1C1C]">Features</Link>
              <Link to="/pricing" className="py-2 text-[#1C1C1C]">Pricing</Link>
              <Link to="/login" className="py-2 text-[#1C1C1C]">Login</Link>
              <Link to="/signup">
                <Button className="w-full bg-[#2E473B] hover:bg-[#243A2F] text-white rounded-full">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 hero-gradient">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2E473B]/10 text-[#2E473B] text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                Now with AI Receptionist
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1C1C1C] leading-tight mb-6" style={{ fontFamily: 'Outfit' }}>
                The simplest way to manage
                <span className="text-[#2E473B]"> bookings</span>
              </h1>
              <p className="text-lg text-[#6B6B6B] mb-8 max-w-lg">
                Powerful scheduling software for appointment-based businesses. 
                Online booking, automated reminders, and AI receptionist—all in one.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/signup">
                  <Button 
                    size="lg" 
                    className="bg-[#2E473B] hover:bg-[#243A2F] text-white rounded-full px-8 h-14 text-lg"
                    data-testid="hero-get-started"
                  >
                    Start Free Trial
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="rounded-full px-8 h-14 text-lg border-[#E5E5E0]"
                  data-testid="hero-watch-demo"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Watch Demo
                </Button>
              </div>
              <div className="flex items-center gap-6 mt-8">
                <div className="flex -space-x-2">
                  {['S', 'J', 'M', 'A'].map((letter, i) => (
                    <div 
                      key={i}
                      className="w-10 h-10 rounded-full bg-[#2E473B]/10 border-2 border-white flex items-center justify-center text-sm font-medium text-[#2E473B]"
                    >
                      {letter}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-[#E6B861] text-[#E6B861]" />
                    ))}
                  </div>
                  <p className="text-sm text-[#6B6B6B]">Trusted by 2,000+ businesses</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="bg-white rounded-2xl shadow-xl border border-[#E5E5E0] overflow-hidden">
                <img 
                  src="https://images.pexels.com/photos/853427/pexels-photo-853427.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
                  alt="Salon booking"
                  className="w-full h-[400px] object-cover"
                />
              </div>
              {/* Floating card */}
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-lg border border-[#E5E5E0] p-4 animate-slide-up">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#3E6653]/10 flex items-center justify-center">
                    <Check className="w-5 h-5 text-[#3E6653]" />
                  </div>
                  <div>
                    <p className="font-medium text-[#1C1C1C]">New Booking</p>
                    <p className="text-sm text-[#6B6B6B]">Sarah booked for 2:00 PM</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1C1C1C] mb-4" style={{ fontFamily: 'Outfit' }}>
              Built for appointment-based businesses
            </h2>
            <p className="text-[#6B6B6B] text-lg max-w-2xl mx-auto">
              Pre-configured templates for your industry. Get started in minutes.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {industries.map((industry, index) => (
              <motion.div
                key={industry.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="industry-card text-center cursor-pointer"
                data-testid={`industry-${industry.name.toLowerCase()}`}
              >
                <span className="text-4xl mb-3 block">{industry.icon}</span>
                <h3 className="font-semibold text-[#1C1C1C]">{industry.name}</h3>
                <p className="text-sm text-[#6B6B6B] mt-1">{industry.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-[#FAF9F6]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-medium text-[#2E473B] uppercase tracking-wider">Features</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1C1C1C] mt-3 mb-4" style={{ fontFamily: 'Outfit' }}>
              Everything you need to manage bookings
            </h2>
            <p className="text-[#6B6B6B] text-lg max-w-2xl mx-auto">
              From online booking to AI-powered automation, we've got you covered.
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
                className="bg-white rounded-2xl border border-[#E5E5E0] p-8 card-hover"
              >
                <div className="w-12 h-12 rounded-xl bg-[#2E473B]/10 flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-[#2E473B]" />
                </div>
                <h3 className="text-xl font-semibold text-[#1C1C1C] mb-3" style={{ fontFamily: 'Outfit' }}>
                  {feature.title}
                </h3>
                <p className="text-[#6B6B6B]">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-medium text-[#2E473B] uppercase tracking-wider">Testimonials</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1C1C1C] mt-3" style={{ fontFamily: 'Outfit' }}>
              Loved by businesses worldwide
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="testimonial-card"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#E6B861] text-[#E6B861]" />
                  ))}
                </div>
                <p className="text-[#1C1C1C] mb-6">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2E473B]/10 flex items-center justify-center text-[#2E473B] font-semibold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-medium text-[#1C1C1C]">{testimonial.author}</p>
                    <p className="text-sm text-[#6B6B6B]">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="cta-section text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ fontFamily: 'Outfit' }}>
              Ready to simplify your scheduling?
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
              Join 2,000+ businesses that trust TimeSlot Pro for their booking needs.
              Start your 14-day free trial today.
            </p>
            <Link to="/signup">
              <Button 
                size="lg" 
                className="bg-white text-[#2E473B] hover:bg-white/90 rounded-full px-8 h-14 text-lg"
                data-testid="cta-get-started"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <p className="text-white/60 text-sm mt-4">No credit card required</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-[#1C1C1C] text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#2E473B] flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold" style={{ fontFamily: 'Outfit' }}>TimeSlot Pro</span>
              </div>
              <p className="text-white/60 text-sm">
                Simple booking software for appointment-based businesses.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li><Link to="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Industries</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                {industries.slice(0, 4).map(ind => (
                  <li key={ind.name}><a href="#" className="hover:text-white transition-colors">{ind.name}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 text-center text-white/40 text-sm">
            © {new Date().getFullYear()} TimeSlot Pro. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
