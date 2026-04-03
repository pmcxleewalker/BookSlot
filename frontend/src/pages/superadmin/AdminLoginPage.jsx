import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const AdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      axios.get(`${API}/admin/me`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(() => {
        navigate('/admin/dashboard');
      }).catch(() => {
        localStorage.removeItem('admin_token');
      });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/admin/login`, { email, password });
      localStorage.setItem('admin_token', response.data.token);
      toast.success('Welcome, Admin!');
      navigate('/admin/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">BookSlot</h1>
          <p className="text-white/60">Tenant Control Centre</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 space-y-4">
          <div>
            <Label className="text-sm font-medium text-[#0A0A0A]">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@bookslot.io"
              required
              className="mt-1.5"
              data-testid="admin-email"
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
              data-testid="admin-password"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full btn-primary flex items-center justify-center gap-2"
            data-testid="admin-login-submit"
          >
            {loading ? 'Signing in...' : 'Sign in to Admin'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </Button>
        </form>

        <p className="text-center text-white/40 text-sm mt-6">
          <Link to="/" className="hover:text-white transition-colors">← Back to main site</Link>
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;
