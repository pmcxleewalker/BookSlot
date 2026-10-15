import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';

const SignupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/onboarding');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password);
      toast.success('Account created successfully!');
      navigate('/onboarding');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create account');
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
    <div className="min-h-screen bg-white flex">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-24">
        <div className="max-w-md w-full mx-auto">
          <Link to="/" className="text-2xl font-semibold text-[#0A0A0A] mb-12 block">
            BookSlot
          </Link>

          <h1 className="text-3xl font-semibold text-[#0A0A0A] mb-2" data-testid="signup-title">
            Start your free trial
          </h1>
          <p className="text-[#666666] mb-8">
            14 days free. No credit card required.
          </p>

          {/* Google Signup */}
          <button
            onClick={handleGoogleSignup}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-[#E5E5E5] hover:border-[#121212] transition-colors mb-6"
            data-testid="google-signup-btn"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-[#0A0A0A] font-medium">Continue with Google</span>
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-[#E5E5E5]" />
            <span className="text-sm text-[#666666]">or</span>
            <div className="flex-1 h-px bg-[#E5E5E5]" />
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-[#0A0A0A]">Full name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                required
                className="mt-1.5 input-swiss"
                data-testid="name-input"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium text-[#0A0A0A]">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="mt-1.5 input-swiss"
                data-testid="email-input"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium text-[#0A0A0A]">Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  className="input-swiss pr-12"
                  data-testid="password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#0A0A0A]"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2"
              data-testid="signup-submit"
            >
              {loading ? 'Creating account...' : 'Create account'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>

          <p className="mt-6 text-xs text-[#666666] text-center">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>

          <p className="mt-8 text-center text-sm text-[#666666]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#0A0A0A] font-medium hover:underline" data-testid="login-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right Panel - Visual */}
      <div className="hidden lg:flex w-1/2 bg-[#FAFAFA] border-l border-[#E5E5E5] items-center justify-center p-16">
        <div className="max-w-md">
          <div className="space-y-6">
            {[
              { num: '01', title: 'Create account', desc: 'Sign up in seconds' },
              { num: '02', title: 'Set up your business', desc: 'Add services and staff' },
              { num: '03', title: 'Start booking', desc: 'Share your booking page' },
            ].map((step, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="w-10 h-10 bg-[#121212] text-white flex items-center justify-center text-sm font-mono">
                  {step.num}
                </div>
                <div>
                  <h3 className="font-semibold text-[#0A0A0A]">{step.title}</h3>
                  <p className="text-sm text-[#666666]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
