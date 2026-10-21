import React, { useState } from 'react';
import BrandLogo from '../../components/BrandLogo';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import { errorMessage } from '../../lib/api';

const SignupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, googleLogin, isAuthenticated } = useAuth();
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
      toast.error(errorMessage(error, 'Failed to create account'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credential) => {
    const user = await googleLogin(credential);
    toast.success('Welcome to BookSlot!');
    navigate(user.tenant_id ? '/dashboard' : '/onboarding');
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-24">
        <div className="max-w-md w-full mx-auto">
          <Link to="/" className="mb-12 inline-block" aria-label="BookSlot home">
            <BrandLogo size={36} textClassName="text-2xl" />
          </Link>

          <h1 className="text-3xl font-semibold text-[#0A0A0A] mb-2" data-testid="signup-title">
            Create your BookSlot account
          </h1>
          <p className="text-[#666666] mb-8">
            Set up your business and booking page in a few minutes.
          </p>

          <GoogleSignInButton onCredential={handleGoogle} text="signup_with" />

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
