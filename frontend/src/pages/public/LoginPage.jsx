import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import { errorMessage } from '../../lib/api';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, googleLogin, isAuthenticated, tenant } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(tenant ? '/dashboard' : '/onboarding');
    }
  }, [isAuthenticated, tenant, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await login(email, password);
      toast.success('Welcome back!');
      navigate(user.tenant_id ? '/dashboard' : '/onboarding');
    } catch (error) {
      toast.error(errorMessage(error, 'Invalid credentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credential) => {
    const user = await googleLogin(credential);
    toast.success('Welcome back!');
    navigate(user.tenant_id ? '/dashboard' : '/onboarding');
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-24">
        <div className="max-w-md w-full mx-auto">
          <Link to="/" className="text-2xl font-semibold text-[#0A0A0A] mb-12 block">
            BookSlot
          </Link>

          <h1 className="text-3xl font-semibold text-[#0A0A0A] mb-2" data-testid="login-title">
            Welcome back
          </h1>
          <p className="text-[#666666] mb-8">
            Sign in to manage your bookings
          </p>

          <GoogleSignInButton onCredential={handleGoogle} />

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-[#0A0A0A]">Password</Label>
                <Link to="/forgot-password" className="text-sm text-[#666666] hover:text-[#0A0A0A] hover:underline" data-testid="forgot-password-link">
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
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
              data-testid="login-submit"
            >
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-[#666666]">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#0A0A0A] font-medium hover:underline" data-testid="signup-link">
              Sign up free
            </Link>
          </p>
        </div>
      </div>

      {/* Right Panel - Visual */}
      <div className="hidden lg:flex w-1/2 bg-[#121212] items-center justify-center p-16">
        <div className="text-white max-w-md">
          <h2 className="heading-marketing text-4xl mb-6">
            Simplify your scheduling
          </h2>
          <p className="text-white/70 text-lg">
            Manage appointments, send automatic reminders and let clients book online around the clock.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
