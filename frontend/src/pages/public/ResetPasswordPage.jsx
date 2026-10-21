import React, { useState } from 'react';
import BrandLogo from '../../components/BrandLogo';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { API, errorMessage } from '../../lib/api';
import { useAuth } from '../../App';

const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return toast.error('Password must be at least 8 characters');
    if (password !== confirm) return toast.error("Passwords don't match");
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/reset-password`, { token, password });
      const user = await setSession(res.data);
      toast.success('Password updated');
      navigate(user.tenant_id ? '/dashboard' : '/onboarding');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not reset password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <Link to="/" className="mb-10 inline-block" aria-label="BookSlot home"><BrandLogo size={36} textClassName="text-2xl" /></Link>
        <h1 className="text-3xl font-semibold text-[#0A0A0A] mb-2">Choose a new password</h1>
        {!token ? (
          <p className="text-[#666666] mt-4">
            This link is missing its reset code. <Link to="/forgot-password" className="underline">Request a new link</Link>.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4 mt-8">
            <div>
              <Label htmlFor="pw" className="text-sm font-medium">New password</Label>
              <Input id="pw" type="password" required minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)} className="mt-1.5 input-swiss" data-testid="reset-password" />
            </div>
            <div>
              <Label htmlFor="pw2" className="text-sm font-medium">Confirm new password</Label>
              <Input id="pw2" type="password" required minLength={8} value={confirm}
                onChange={(e) => setConfirm(e.target.value)} className="mt-1.5 input-swiss" data-testid="reset-confirm" />
            </div>
            <Button type="submit" disabled={loading} className="w-full btn-primary" data-testid="reset-submit">
              {loading ? 'Saving...' : 'Save new password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
