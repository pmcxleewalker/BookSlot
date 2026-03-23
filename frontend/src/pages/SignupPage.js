import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await register(name, email, password);
      toast.success('Account created successfully!');
      navigate('/onboarding');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex">
      {/* Left Panel - Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2E473B] to-[#1C1C1C]">
          <img
            src="https://images.pexels.com/photos/4269361/pexels-photo-4269361.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
            alt="Clinic interior"
            className="w-full h-full object-cover opacity-30"
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-white max-w-md">
            <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Outfit' }}>
              Start your 14-day free trial
            </h2>
            <p className="text-white/70 mb-6">
              Set up your booking system in minutes. No credit card required.
            </p>
            <ul className="space-y-3">
              {['Online booking page', 'Automated reminders', 'Staff scheduling', 'AI receptionist'].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-white/90">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-[#2E473B] flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
              TimeSlot Pro
            </span>
          </Link>

          <h1 className="text-3xl font-bold text-[#1C1C1C] mb-2" style={{ fontFamily: 'Outfit' }}>
            Create your account
          </h1>
          <p className="text-[#6B6B6B] mb-8">
            Get started with your free 14-day trial
          </p>

          {/* Google Signup */}
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl border-[#E5E5E0] mb-6"
            onClick={handleGoogleSignup}
            data-testid="google-signup-btn"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E5E5E0]"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-4 bg-[#FAF9F6] text-[#6B6B6B]">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="name" className="text-[#1C1C1C]">Full Name</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6B6B]" />
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="pl-10 h-12 rounded-xl border-[#E5E5E0] focus:border-[#2E473B] focus:ring-[#2E473B]/20"
                  required
                  data-testid="signup-name"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="text-[#1C1C1C]">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6B6B]" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10 h-12 rounded-xl border-[#E5E5E0] focus:border-[#2E473B] focus:ring-[#2E473B]/20"
                  required
                  data-testid="signup-email"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-[#1C1C1C]">Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6B6B]" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-12 rounded-xl border-[#E5E5E0] focus:border-[#2E473B] focus:ring-[#2E473B]/20"
                  required
                  minLength={8}
                  data-testid="signup-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#1C1C1C]"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-[#6B6B6B] mt-1">Must be at least 8 characters</p>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
              disabled={loading}
              data-testid="signup-submit-btn"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-xs text-center text-[#6B6B6B]">
            By signing up, you agree to our{' '}
            <a href="#" className="text-[#2E473B] hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-[#2E473B] hover:underline">Privacy Policy</a>
          </p>

          <p className="mt-8 text-center text-[#6B6B6B]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#2E473B] font-medium hover:underline" data-testid="login-link">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
