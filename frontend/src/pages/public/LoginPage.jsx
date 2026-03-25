import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';

// Elite by Caitlin logo
const ELITE_LOGO = 'https://customer-assets.emergentagent.com/job_b51cdde9-aca8-4bc9-8629-803189777585/artifacts/nyi83tyj_image.png';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, tenant } = useAuth();
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
      toast.error(error.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-24">
        <div className="max-w-md w-full mx-auto">
          {/* Logo and Brand */}
          <div className="mb-12 text-center lg:text-left">
            <img 
              src={ELITE_LOGO} 
              alt="Elite by Caitlin" 
              className="h-24 w-auto mx-auto lg:mx-0 mb-4"
              data-testid="login-logo"
            />
            <p className="text-[#D4AF37] font-serif text-xl tracking-wide" style={{ fontFamily: "'Playfair Display', serif" }}>
              Elite by Caitlin
            </p>
          </div>

          <h1 className="text-3xl font-semibold text-white mb-2" style={{ fontFamily: "'Playfair Display', serif" }} data-testid="login-title">
            Welcome back
          </h1>
          <p className="text-[#B8B8B8] mb-8">
            Sign in to manage your bookings
          </p>

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-[#2A2A2A] hover:border-[#D4AF37] bg-[#141414] transition-colors mb-6"
            data-testid="google-login-btn"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-white font-medium">Continue with Google</span>
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-[#2A2A2A]" />
            <span className="text-sm text-[#666666]">or</span>
            <div className="flex-1 h-px bg-[#2A2A2A]" />
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-white">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="mt-1.5 bg-[#141414] border-[#2A2A2A] text-white placeholder:text-[#666666] focus:border-[#D4AF37]"
                data-testid="email-input"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium text-white">Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-[#141414] border-[#2A2A2A] text-white placeholder:text-[#666666] focus:border-[#D4AF37] pr-12"
                  data-testid="password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#666666] hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#D4AF37] hover:bg-[#B8860B] text-[#0A0A0A] font-semibold flex items-center justify-center gap-2"
              data-testid="login-submit"
            >
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-[#666666]">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#D4AF37] font-medium hover:underline" data-testid="signup-link">
              Sign up free
            </Link>
          </p>
        </div>
      </div>

      {/* Right Panel - Visual */}
      <div className="hidden lg:flex w-1/2 bg-[#141414] items-center justify-center p-16 relative overflow-hidden">
        {/* Decorative gold lines */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#D4AF37] to-transparent" />
          <div className="absolute top-0 left-2/4 w-px h-full bg-gradient-to-b from-transparent via-[#D4AF37] to-transparent" />
          <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-transparent via-[#D4AF37] to-transparent" />
        </div>
        
        <div className="text-center relative z-10">
          <img 
            src={ELITE_LOGO} 
            alt="Elite by Caitlin" 
            className="h-40 w-auto mx-auto mb-8"
          />
          <h2 className="text-3xl text-[#D4AF37] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            Premium Beauty Services
          </h2>
          <p className="text-[#B8B8B8] text-lg max-w-md mx-auto">
            Experience luxury hair and beauty treatments with our expert stylists
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
