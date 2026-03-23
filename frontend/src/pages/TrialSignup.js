import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, ArrowRight, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import api from '../lib/api';

const benefits = [
  "Full access to all Growth features",
  "Create your booking page instantly",
  "Add services and staff",
  "5% discount if you subscribe before trial ends",
];

const businessTypes = [
  { value: "salon", label: "Hair Salon" },
  { value: "barber", label: "Barber Shop" },
  { value: "dental", label: "Dental Clinic" },
  { value: "spa", label: "Spa & Wellness" },
  { value: "medical", label: "Medical Practice" },
  { value: "beauty", label: "Beauty Studio" },
  { value: "fitness", label: "Fitness / Personal Training" },
  { value: "consulting", label: "Consulting" },
  { value: "general", label: "Other" },
];

export default function TrialSignup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    business_name: '',
    owner_name: '',
    email: '',
    password: '',
    business_type: 'general'
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/trial/signup', formData);
      
      if (response.data.session_token) {
        // Store session info
        localStorage.setItem('trialInfo', JSON.stringify({
          tenant_id: response.data.tenant_id,
          booking_url: response.data.booking_url,
          trial_end_date: response.data.trial_end_date,
          days_remaining: response.data.days_remaining
        }));
        
        // Redirect to dashboard
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create trial. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-gray-900">TimeSlot Pro</span>
          </Link>

          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Start your free 3-day trial
          </h1>
          <p className="text-gray-500 mb-6">
            No credit card required. Get started in 2 minutes.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="business_name" className="text-gray-700">Business name</Label>
              <Input
                id="business_name"
                name="business_name"
                type="text"
                placeholder="e.g. Elite Hair Studio"
                value={formData.business_name}
                onChange={handleChange}
                required
                className="mt-1"
                data-testid="trial-business-name"
              />
            </div>

            <div>
              <Label htmlFor="owner_name" className="text-gray-700">Your name</Label>
              <Input
                id="owner_name"
                name="owner_name"
                type="text"
                placeholder="John Smith"
                value={formData.owner_name}
                onChange={handleChange}
                required
                className="mt-1"
                data-testid="trial-owner-name"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-gray-700">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                className="mt-1"
                data-testid="trial-email"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-700">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="pr-10"
                  data-testid="trial-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="business_type" className="text-gray-700">Business type</Label>
              <select
                id="business_type"
                name="business_type"
                value={formData.business_type}
                onChange={handleChange}
                className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                data-testid="trial-business-type"
              >
                {businessTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-lg h-11 mt-2"
              data-testid="trial-submit"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Start Free Trial
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-gray-900 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right side - Benefits */}
      <div className="hidden lg:flex flex-1 bg-gray-900 items-center justify-center px-12">
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold text-white mb-6">
            Your 3-day trial includes:
          </h2>
          
          <ul className="space-y-4 mb-8">
            {benefits.map((benefit, i) => (
              <motion.li 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span className="text-gray-300">{benefit}</span>
              </motion.li>
            ))}
          </ul>

          <div className="bg-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl font-bold text-green-400">5% OFF</span>
              <span className="text-gray-400">for 3 months</span>
            </div>
            <p className="text-gray-400 text-sm">
              Subscribe before your trial ends and save on your first 3 months.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
