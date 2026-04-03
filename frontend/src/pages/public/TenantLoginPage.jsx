import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { ArrowRight, Building2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const TenantLoginPage = () => {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    fetchTenant();
  }, [tenantSlug]);

  const fetchTenant = async () => {
    try {
      const response = await axios.get(`${API}/public/tenant/${tenantSlug}`);
      setTenant(response.data);
    } catch (error) {
      toast.error('Business not found');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await axios.post(`${API}/auth/tenant-login`, {
        email,
        password,
        tenant_slug: tenantSlug
      });

      localStorage.setItem('token', response.data.token);
      toast.success('Welcome back!');
      navigate(`/${tenantSlug}/dashboard`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-[#666666]">Loading...</div>
      </div>
    );
  }

  const primaryColor = tenant?.branding?.primary_color || '#0A0A0A';
  const businessName = tenant?.branding?.business_name || tenant?.name;

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div 
            className="w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold"
            style={{ backgroundColor: primaryColor }}
          >
            {businessName?.charAt(0) || 'B'}
          </div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] mb-2">{businessName}</h1>
          <p className="text-[#666666]">Staff Login</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-[#E5E5E5] rounded-lg p-8 space-y-4">
          <div>
            <Label className="text-sm font-medium text-[#0A0A0A]">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="mt-1.5"
              data-testid="tenant-login-email"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-[#0A0A0A]">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="mt-1.5"
              data-testid="tenant-login-password"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
            data-testid="tenant-login-submit"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
            {!submitting && <ArrowRight className="w-4 h-4" />}
          </Button>
        </form>

        <p className="text-center text-[#999999] text-sm mt-6">
          <Link to={`/book/${tenantSlug}`} className="hover:text-[#0A0A0A] transition-colors">
            Book an appointment →
          </Link>
        </p>
      </div>
    </div>
  );
};

export default TenantLoginPage;
